# Code Review 통합 보고서

## 전체 위험도
**LOW** — CRITICAL 0건, WARNING 1건(응답 DTO nullable 선언의 회귀 캐너리 부재). 나머지는 전부 INFO 수준 확인·관찰이며, forced 리뷰어 7명 전원 결과 확보됨(강제 화이트리스트 미이행 없음).

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Testing | 응답 DTO(`NodeDto.description`·`AuthConfigDto.ipWhitelist`)의 `nullable: true` 선언이 "선언·타입을 함께 되돌리는" 회귀에 대해 캐너리가 없다. 이번 PR 이 요청 DTO 축(D4~D6)에서 정확히 같은 형태의 결함을 고쳤는데, 응답 DTO 축에는 대칭 캐너리가 없다. `grep` 전수 확인 결과 저장소 전체에 이 두 필드를 null 값으로 응답 계약(`assertMatchesContract`)과 대조하는 지점이 하나도 없다. | `codebase/backend/test/patch-partial-body.e2e-spec.ts` E2(272-297행)·E3(299-321행) — `toHaveProperty(field, null)` 만 사용, `assertMatchesContract` 미호출. 응답 DTO 선언: `codebase/backend/src/modules/nodes/dto/responses/node-response.dto.ts:42-44`, `codebase/backend/src/modules/auth-configs/dto/responses/auth-config-response.dto.ts:27-28` | E1·E2·E3에 `assertMatchesContract(patched.body.data, await contractForDto(...))` 한 줄씩 추가(이미 import 돼 있어 비용 낮음). 같은 파일 A·C·D 가 이미 쓰는 3단 단언 규율(저장값→응답값→응답계약)을 E1~E3 도 따르게 함 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Security / API Contract | `ipWhitelist: null` 은 IP 화이트리스트를 전면 해제한다 — 새 취약점이 아니라 기존 `[]` 전송과 동치인 동작의 재확인/재선언(`ac.ipWhitelist?.length` 가드가 둘 다 falsy 처리). 저장/응답 값을 canonical 값으로 정규화하지 않아 `null`과 `[]`가 영구 공존 | `codebase/backend/src/modules/auth-configs/dto/update-auth-config.dto.ts`, `auth-configs.service.ts:400` | 조치 불요 — 의도된 설계, `it.each(['null','[]'])` 캐너리로 동치 확인됨 |
| 2 | Security / Requirement / API Contract / Documentation | PATCH 로 NOT NULL 컬럼에 `null` 을 보내면 Postgres 23502 위반이 500(`INTERNAL_ERROR`)으로 응답됨(정보 노출은 아님, 4xx여야 할 것이 5xx). 이번 diff 의 3필드는 모두 nullable 컬럼이라 해당 없으며, 이미 트래커에 별도 등재·처분(BLOCK:NO)됨 | `plan/in-progress/spec-draft-nullable-notation-followups.md` 신규 백로그 항목 | 이번 PR 범위 밖, 재-flag 금지. 착수 시 처방은 필터 매핑이 아니라 DTO 입구 검증(`@ValidateIf`) |
| 3 | Requirement | `PATCH /nodes/:id` 에 `label: null` 전송 시 `UpdateNodeDto.label` 이 `@IsOptional()` 만 있어 검증을 통과하고 `assertLabelUnique(workflowId, null, id)` 호출로 이어져 엉뚱한 409(`DUPLICATE_NODE_LABEL`)가 날 수 있음(코드 경로 추적만, 미재현). 이번 PR 의 회귀 아님, 동일 실측이 이미 백로그에 기록돼 있으나 `label` 이 "NOT NULL 컬럼 + `@IsOptional()`" 전수 목록에서 빠져 있을 수 있음 | `codebase/backend/src/modules/nodes/nodes.service.ts` `update()` | 조치 불요, 단 해당 백로그 착수 시 `label` 을 전수에 포함시킬 것 |
| 4 | Requirement | `plan/in-progress/patch-body-followups.md` 가 아직 in-progress 인데, 관련 문서들이 `plan/complete/patch-body-followups.md` 를 선인용 | `plan/in-progress/patch-body-followups.md`, `plan/in-progress/spec-draft-nullable-notation-followups.md` | 최종 마무리 커밋에서 in-progress → complete 이동 + frontmatter 갱신 |
| 5 | Maintainability | 검증 옵션 리터럴 `{ whitelist: true, forbidNonWhitelisted: true }` 가 3개 DTO spec 파일에 동일하게 중복 | `auth-config-ip-whitelist.dto.spec.ts:8`, `node-dto-validation.spec.ts:8`, `workflow-dto-validation.spec.ts:12` | 즉시 조치 불요. 4번째 DTO spec 필요 시 공용 상수로 추출 검토 |
| 6 | Maintainability | "선언 캐너리" describe 블록 구조가 3파일에 거의 동일하게 반복(1R 에서 이미 지적·처분됨, 재발 아님) | 각 DTO validation spec 파일 | 기존 처분 유지, 추가 조치 불필요 |
| 7 | Maintainability / Testing | e2e E1/E2/E3 가 "생성→PATCH null→검증" 뼈대를 각자 반복(2R WARNING 은 병합 해소로 처리됐으나 공용 헬퍼 추출은 미적용); null 필드와 다른 갱신 필드를 같은 PATCH 에 함께 보내는 조합은 미검증 | `codebase/backend/test/patch-partial-body.e2e-spec.ts:255,272,299` | 차단 사유 아님. 헬퍼 추출·조합 케이스는 후속 개선으로 남겨도 무방 |
| 8 | Documentation | `UpdateAuthConfigDto.ipWhitelist` 의 `@ApiPropertyOptional.example` 이 "값 설정" 예시만 있고 "null 로 지운다" 예시는 없음(같은 패턴이 다른 두 DTO 에도 있음). 산문 설명에는 명시돼 있어 실질적 정보 손실 없음 | `codebase/backend/src/modules/auth-configs/dto/update-auth-config.dto.ts:50-56` | 비차단, 선택적 개선 |
| 9 | Scope | `nodes.service.spec.ts` "명시적 null" 캐너리가 plan 이 선언한 범위(`description`)보다 넓게 `containerId` 까지 같은 테스트에서 단언(1R·2R 에서 이미 처분됨, 재발 아님) | `codebase/backend/src/modules/nodes/nodes.service.spec.ts:230-246` | 조치 불요, 의도된 확장 |

## SPEC-DRIFT

없음 — 오히려 `spec/5-system/2-api-convention.md` §5.4 가 이번 PR 의 패턴(요청 DTO `nullable: true` + `T | null`)을 line-level 로 이미 정당화하고 있음이 requirement/documentation 리뷰에서 확인됨.

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | 새 취약점 없음. ipWhitelist 전면해제·NOT NULL 500 은 기존 결함, 범위 밖 재확인 |
| requirement | NONE | 기능 요구사항 충족(런타임과 선언 정합화). label:null 오탐 409 가능성(기존 결함 클래스), plan lifecycle 미이동 |
| scope | NONE | 스코프 이탈 없음. 3R 신규 커밋(주석 정정 3줄, plan/review 기록) 모두 범위 내 |
| side_effect | NONE | 새로운 부작용 없음 — 선언 확장이 기존 병합 로직·엔티티 컬럼과 일치 |
| maintainability | LOW | 테스트 보일러플레이트 소폭 중복(INFO), 차단 아님 |
| testing | LOW | WARNING 1건(응답 DTO nullable 회귀 캐너리 부재), 나머지 커버리지는 뮤테이션 검증까지 완료 |
| documentation | NONE | 1R/2R 지적사항 모두 정상 처분 확인, 재발 없음 |
| api_contract | LOW | breaking change 아님, additive. 기존 결함 재확인(범위 밖) |
| user_guide_sync | NONE | frontend/channel-web-chat 변경 0건. 매칭된 trigger(backend-api-change) target 모두 충족/해당없음 |

## 발견 없는 에이전트

- user_guide_sync — 발견사항 0건(CRITICAL/WARNING/INFO 모두 없음, "해당 없음" 판정만 존재)

## 권장 조치사항

1. (WARNING 해소) `codebase/backend/test/patch-partial-body.e2e-spec.ts` 의 E1·E2·E3 에 `assertMatchesContract(patched.body.data, await contractForDto(...))` 호출을 추가해 응답 DTO(`NodeDto.description`·`AuthConfigDto.ipWhitelist`, 필요시 `WorkflowDto.description`)의 nullable 선언 회귀를 캐너리로 고정한다.
2. `plan/in-progress/patch-body-followups.md` 를 `plan/complete/`로 이동하고 frontmatter `status`를 갱신한다(이미 다른 문서가 완료 경로를 선인용하고 있음).
3. (비차단, 후속) 검증 옵션 리터럴 공용 상수화, e2e 헬퍼(`patchAndVerifyNulled` 류) 추출, PATCH NOT NULL 필드 500 결함·`label:null` 오탐 409 결함은 이미 트래커에 등재돼 있으므로 별도 착수 시 처리한다(이번 PR 범위 아님, 재-flag 불필요).

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: security, requirement, scope, side_effect, maintainability, testing, documentation, api_contract, user_guide_sync (9명)
  - **제외**: 아래 표 (5명)
  - **강제 포함(router_safety)**: documentation, maintainability, requirement, scope, security, side_effect, testing (7명) — 전원 결과 확보됨(미이행 없음)

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | performance | 라우터가 이번 변경(DTO nullable 선언 + 테스트) 성격상 비관련으로 판단 |
  | architecture | 상동 |
  | dependency | 상동 — 신규/변경 의존성 없음 |
  | database | 상동 — 마이그레이션/스키마 변경 없음(nullable 컬럼은 이미 존재) |
  | concurrency | 상동 — 동시성 경로 변경 없음 |