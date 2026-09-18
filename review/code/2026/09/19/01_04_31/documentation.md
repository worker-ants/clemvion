# 문서화(Documentation) 리뷰 — 웹훅 `endpoint_path` 전역 유일 (V131·V132)

## 발견사항

- **[WARNING]** 보안 결함 수정인데 `CHANGELOG.md` 에 항목이 없다
  - 위치: `CHANGELOG.md` (루트) — 이번 diff 범위 `origin/main..HEAD` 4개 커밋(`eb5332b57`, `0704b33c3`, `b290d236b`, `b9162a877`) 어디에도 `CHANGELOG.md` 변경 없음(`git log --oneline origin/main..HEAD -- CHANGELOG.md` 결과 없음).
  - 상세: 이 저장소의 `CHANGELOG.md` 는 "Unreleased" 섹션으로 트리거 도메인의 보안·데이터-격리류 수정 사항을 빠짐없이 기록해 온 관례가 있다 — 직전 4개 트리거 관련 fix 커밋(`a9288bf6e` #1346, `cc199df6f` #1343, `2d20cc3e1` #1341, `60be0712a` #1334)이 전부 같은 커밋에서 `CHANGELOG.md` 에 "무엇이 문제였고 무엇을 고쳤는지 · 남는 창(residual risk)" 항목을 함께 추가했다. 또한 `spec/conventions/swagger.md:398` 는 과거 감사 로그 유출 사고를 `CHANGELOG.md` 를 근거로 인용하는 등, 이 문서가 단순 이력이 아니라 **보안/데이터-격리 인시던트의 기록처**로 쓰이고 있다. 이번 변경은 "다른 워크스페이스가 알고 있는 웹훅 경로를 등록해 수신 웹훅을 가로챌 수 있었다"는, 위 선례들과 동일한 성격(cross-tenant 격리 결함)의 보안 수정이며 `spec/1-data-model.md` Rationale·`plan/complete/spec-draft-webhook-endpoint-path-global-unique.md` 에는 재현·근거·"남는 틈"(지운 경로 재등록 묘비 부재)까지 상세히 기록돼 있음에도, 같은 내용이 `CHANGELOG.md` 에는 반영되지 않았다.
  - 제안: 기존 선례(`a9288bf6e` 등)와 같은 형식으로 "Unreleased" 섹션을 추가한다 — 문제(워크스페이스 단위 UNIQUE가 전역 라우팅 키를 보호하지 못함) · 고친 것(V131 dedupe + V132 전역 UNIQUE) · 남는 창(지운 경로 재등록 가능, 트래커에 등재됨)을 요약. spec Rationale·plan 문서를 거의 그대로 요약해 옮기면 되므로 비용은 작다.

- **[INFO]** `endpointPath` DTO 의 Swagger 설명이 새 전역 유일성/충돌 의미를 언급하지 않는다
  - 위치: `codebase/backend/src/modules/triggers/dto/create-trigger.dto.ts` (`endpointPath` 필드의 `@ApiPropertyOptional`, 함수·필드명으로 특정 — 이번 diff 로 수정된 파일이 아니라 게이트 숫자 없음) 및 대응하는 `update-trigger.dto.ts`
  - 상세: 이번 PR 은 `triggers.controller.ts` 의 `@ApiConflictResponse` 설명(엔드포인트 레벨)은 "다른 워크스페이스의 트리거 포함 — 전역 유일" 로 정확히 갱신했다. 그런데 같은 필드의 프로퍼티 레벨 설명(`create-trigger.dto.ts` 의 `endpointPath` ApiPropertyOptional description)은 "라우팅 키가 워크스페이스 무관 전역이라 추측 불가한 UUID 가 사실상 비밀 키 역할을 한다"는 **추측 방지(엔트로피)** 관점만 서술하고, 이번에 새로 생긴 **복사 방지(전역 유일성)** 의미는 언급하지 않는다. Swagger UI 에서 필드 설명만 보는 API 소비자는 이 필드에 왜 409 가 날 수 있는지(다른 워크스페이스가 이미 쓰는 값이면 거부)를 프로퍼티 설명만으로는 알 수 없다.
  - 제안: 필수는 아니나(엔드포인트 레벨 `@ApiConflictResponse` 가 이미 커버), 프로퍼티 설명에도 "다른 워크스페이스의 트리거와 값이 겹치면 안 됨(전역 UNIQUE)" 한 문장을 추가하면 필드 단위로만 스키마를 보는 소비자에게도 일관된 정보가 전달된다.

## 확인했으나 문제 없음 (참고)

- 마이그레이션 `V131__trigger_endpoint_path_dedupe.sql` / `V132__trigger_endpoint_path_global_unique.sql` 헤더 주석은 정책·근거·재현·운영 절차·NOTICE 정책(경로 비공개)까지 상세하고 실제 코드와 정확히 일치한다. `.conf` 주석도 `executeInTransaction=false` 의 이유를 정확히 설명한다.
- `triggers.controller.ts` 의 `TRIGGER_ENDPOINT_PATH_CONFLICT_DESCRIPTION` 상수 추출 — 두 엔드포인트(`create`/`update`)의 409 Swagger 설명 중복을 제거했고, JSDoc 이 인용한 선례(`integrations.controller.ts` `OAUTH_BEGIN_RESULT_DESCRIPTION`)도 실재 확인.
- `triggers.service.ts` 의 `TRIGGER_ENDPOINT_PATH_UNIQUE_INDEX` 상수 JSDoc·`rethrowEndpointPathConflict()` JSDoc 모두 옛 워크스페이스-단위 서술을 전역-서술로 정확히 갱신했고, "이름이 바뀌면 조용히 false 를 반환" 등 위험 서술도 유지된다.
- `triggers.service.spec.ts` 의 새 단위 테스트 주석(`err_` 캐치 변수, "다른 인덱스 이름은 더 좁히지 않는다" 등)은 의도를 정확히 설명한다.
- `codebase/backend/test/trigger-endpoint-path-dedupe.e2e-spec.ts` 신규 e2e 는 파일 최상단에 "왜 따로 무는가/어떻게" 를 포함한 모범적인 문서화 헤더를 갖췄다.
- `codebase/backend/test/webhook-trigger.e2e-spec.ts` 의 B5·B6 신규 테스트에도 시나리오 근거(무엇이 문제였고 무엇을 검증하는지)가 인라인 주석으로 충분히 달려 있다.
- `spec/1-data-model.md` 신규 Rationale 절("Webhook `endpoint_path` 전역 유일")은 문제·재현·결정·기각안·성능·"남는 틈"까지 포함해 매우 상세하다.
- `spec/data-flow/10-triggers.md` 의 반증된 옛 전제 두 문장은 삭제 대신 취소선(`~~~~`) 처리 후 "정정 (2026-09-18)" 인용구로 정정해, 정정 이력을 보존하는 관례를 그대로 따른다.
- `spec/5-system/2-api-convention.md` §12.2 유니크 범위 표, `spec/5-system/3-error-handling.md` 에러 카탈로그 행, `spec/7-channel-web-chat/5-admin-console.md`, `codebase/frontend/src/content/docs/02-nodes/triggers.mdx`/`triggers.en.mdx` (한/영 페어) 등 — 이전 라운드 consistency-check 가 지적했던 spec 자기-모순·누락(SUMMARY BLOCK:YES → BLOCK:NO 로 수렴한 이력, `review/consistency/2026/09/19/00_16_40/SUMMARY.md`)이 현재 상태에서는 전부 해소되어 있음을 직접 대조로 확인했다(`grep -rn "workspace_id, endpoint_path"`, `"동일 워크스페이스"` 로 잔존 stale 문구 없음 확인).
- `codebase/backend/migrations/README.md` 는 "인덱스 교체는 DROP-먼저"·"mixed 판정" 을 이미 선례(V110/V111) 기반 일반 정책으로 문서화해 두었고 V131/V132 는 그 정책을 그대로 따르므로, README 자체를 갱신할 필요는 없다(신규 컨벤션이 아니라 기존 컨벤션의 적용).
- `plan/in-progress/spec-draft-webhook-endpoint-path-global-unique.md` 체크리스트·`plan/in-progress/spec-draft-nullable-notation-followups.md` 트래커 항목은 모두 해소 상태로 갱신돼 있고 정지 규칙(1라운드 결과를 보기 전 선언)도 명시돼 있다.

## 요약

코드·마이그레이션·spec·e2e 전반의 인라인 문서화 수준은 이 저장소 평균보다도 높다 — JSDoc·SQL 헤더 주석이 "무엇을 왜" 뿐 아니라 재현·기각한 대안·잔여 위험까지 담고 있고, 여러 차례의 consistency-check 라운드를 거치며 spec 간 모순(전역 유일 vs 워크스페이스 단위 서술)이 실제로 전부 수렴됐다. 유일하게 남은 실질 공백은 **`CHANGELOG.md` 미기재**로, 이 저장소가 동일 성격(cross-tenant 격리 결함)의 과거 트리거 수정 4건 모두에서 지켜 온 관례와 어긋난다. 그 외 DTO 프로퍼티 레벨 Swagger 설명 갱신 누락은 엔드포인트 레벨 설명이 이미 보완하므로 경미하다.

## 위험도

LOW
