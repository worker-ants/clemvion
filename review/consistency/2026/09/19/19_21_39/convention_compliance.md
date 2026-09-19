# 정식 규약 준수 검토 — 웹훅 경로 영구 예약

대상: `plan/in-progress/spec-draft-webhook-endpoint-reservation.md` (spec draft, 검토 모드 `--spec`)

## 발견사항

- **[INFO]** `1-data-model.md` frontmatter `code:` 확장(변경 F)이 `spec-impl-evidence.md` 의 basename 제외 목록과 겹쳐 보임
  - target 위치: 변경 F 첫 항목 — `spec/1-data-model.md` frontmatter `code:` 에 전용 e2e 한 줄 추가
  - 관련 규약: `spec/conventions/spec-impl-evidence.md` §1 "제외" — `basename '1-data-model.md' (단순 overview 성격) — EXCLUDE_BASENAMES 에 등재"
  - 상세: 이 규약만 보면 `1-data-model.md` 는 frontmatter-evidence build 가드(`spec-code-paths.test.ts` 등) 대상에서 아예 빠지므로, `code:` 를 채우는 것이 무의미해 보일 수 있다. 그러나 실제로 이 파일은 이미 자체적으로 `id`/`status: implemented`/`code:`(엔티티 glob + 전용 e2e 나열)를 갖고 있고, 그 파일 자신의 Rationale("§2 FK 삭제 동작" 인접 절 · code: 주석 "이 문서의 사실을 지키는 전용 e2e — 새 전용 가드는 여기에 더한다")이 **build 가드와 무관하게** 수동으로 유지하는 로컬 관례임을 이미 선언해 두었다(선례 커밋 `53335867a`). 즉 두 문서(공식 규약의 제외 목록 vs 대상 파일 자신의 로컬 선언) 사이에 표면적 긴장이 있으나, 실제로는 "build 가드 면제" 와 "자율적 문서 위생" 이 공존하는 의도된 이중 트랙이다.
  - 제안: target 자체는 기존 확립된 로컬 관례를 그대로 따르고 있어 수정 불필요. 다만 `spec-impl-evidence.md` §1 의 제외 서술(또는 `1-data-model.md` 자신의 code: 인접 주석)에 "이 파일은 build 가드 면제지만 자체 관례로 code: 를 수동 유지한다" 는 상호 참조 한 줄을 추가하면, 다음 검토자가 동일한 표면적 모순을 다시 조사하는 비용을 없앨 수 있다 — 규약 갱신이 적절한 편(규약 자체 결함이 아니라 상호 참조 누락).

- **[INFO]** `details.field='endpoint_path'` (snake_case) 재사용은 위반이 아니라 규약의 정본 예시임 — 확인 기록
  - target 위치: 변경 D, `spec/5-system/3-error-handling.md` §1.10 `TRIGGER_ENDPOINT_PATH_CONFLICT` 행
  - 관련 규약: `spec/5-system/2-api-convention.md` §5.3
  - 상세: 얼핏 같은 문서 §1.11 `details.field='authConfigId'`(camelCase, API DTO 필드명과 일치)와 표기가 갈라져 "API 응답은 camelCase" 관례(`2-trigger-list.md:145`, `1-data-model.md:95` 에 명문화) 위반처럼 보였으나, 실측 결과 `api-convention.md §5.3` 본문이 **바로 이 코드**를 "객체 `details: { field, code, … }`" 패턴의 정본 예시로 인용하고 있다(`TRIGGER_ENDPOINT_PATH_CONFLICT` (`{ field: 'endpoint_path', code: … }`)). 이 값은 이 draft 가 새로 만든 것이 아니라 선행 커밋(`ee96a90de`)에서 이미 확정된 값이며, target 은 그 행의 **설명만** 확장했을 뿐 필드 표기를 건드리지 않았다. 위반 아님 — 오탐 방지 차원에서 기록.
  - 제안: 조치 불필요.

- **[INFO]** 마이그레이션 V번호·명명 정합성 확인
  - target 위치: 설계·변경 E — `V133` 신규 테이블/트리거/백필
  - 관련 규약: `spec/conventions/migrations.md` §1·§2
  - 상세: 저장소의 현재 `codebase/backend/migrations/` 최대 V번호는 `V132`(2건, `.conf` 페어 포함)이므로 `V133` 은 정확히 "현재 max+1" 규칙을 만족한다. 파일명 자체는 아직 생성되지 않았고(구현 단계 항목으로 체크리스트에 남아 있음), `snake_case_descriptor` 형식을 구체적으로 명시하지 않았지만 이는 아직 구현 전이라 규약 위반이 아니다.
  - 제안: 조치 불필요 — 구현 커밋에서 실제 파일명이 `V133__<snake_case>.sql` 패턴을 따르는지만 `--impl-done` 단계에서 재확인.

## 교차검증 메모 (위반 아님을 확인한 항목)

- 엔티티/컬럼/인덱스 명명(`webhook_endpoint_reservation`, `endpoint_path`, `workspace_id`, `reserved_at`) — 기존 스키마의 snake_case·단수형 테이블명 관례와 일치.
- FK 표기 짧은 형 `(SET NULL)` — `1-data-model.md` "§2 FK 삭제 동작 · 빠진 컬럼" Rationale 이 정의한 표기 규칙과 정확히 일치.
- ER 다이어그램 항목 형식(`├── WebhookEndpointReservation (1:N, … §2.8.1)`)·§3 인덱스 표 행 형식 — 기존 다른 엔티티 행과 동일한 패턴.
- 에러 코드 재사용(`TRIGGER_ENDPOINT_PATH_CONFLICT`, rename 없이 의미만 확장) — `error-codes.md` §2(rename=breaking, 신규 코드가 아니면 안정 유지)와 상충하지 않음. §3 historical-artifact 레지스트리 미등재 판단(변경 D 본문의 자체 근거)도 §1 의미 기반 명명 원칙에 부합 — 이름이 부정확해진 것이 아니라 의도된 통합.
- 앵커 링크(`#281-webhookendpointreservation`, `#3-api` 등) — 실제 heading("### 2.8.1 WebhookEndpointReservation", "## 3. API")의 github-slugger 산출 슬러그와 일치, `spec-link-integrity.test.ts` 가드 통과 예상.
- e2e 파일명 `webhook-endpoint-reservation.e2e-spec.ts` — 기존 전용 e2e 파일명 관례(kebab-case + `.e2e-spec.ts`)와 일치.
- `spec_impact` 5개 경로 전부 실존 확인(`spec/1-data-model.md`, `spec/5-system/12-webhook.md`, `spec/2-navigation/2-trigger-list.md`, `spec/5-system/3-error-handling.md`, `spec/data-flow/10-triggers.md`).
- API 문서 규약(Swagger/DTO 데코레이터) — 이 draft 는 컨트롤러·DTO·swagger 데코레이터를 신설/변경하지 않으므로 점검 관점 4는 해당 없음(N/A).

## 요약

정식 규약(`spec/conventions/**`) 관점에서 이 draft 는 명명·출력 포맷·문서 구조 어느 축에서도 CRITICAL/WARNING 급 위반을 만들지 않는다. 에러 코드 재사용, FK 표기, 인덱스 표 행, ER 다이어그램 표기, 마이그레이션 V번호 정책이 모두 기존에 확립된 패턴을 정확히 따르며, 얼핏 위반처럼 보였던 `details.field='endpoint_path'` 스네이크케이스 표기는 오히려 `api-convention.md §5.3` 이 인용하는 정본 예시임을 실측으로 확인했다. 유일하게 남는 것은 `1-data-model.md` 의 `code:` frontmatter 확장이 `spec-impl-evidence.md` 의 basename 제외 목록과 표면적으로 긴장 관계를 보인다는 INFO 수준 관찰인데, 이는 이미 선행 커밋에서 확립된 "build 가드 면제 + 자율적 문서 위생 병존" 패턴이라 target 수정 없이 규약 문서 쪽에 상호 참조 한 줄을 더하는 정도로 충분하다.

## 위험도

NONE
