# Cross-Spec 일관성 검토 결과

## 발견사항

### 1. **[CRITICAL]** `§5.1` validation error 코드·shape 이 기존 spec 과 정면 충돌

- **target 위치**: draft `14-external-interaction-api.md` §5.1 에러 응답 표, EIA-IN-10, R8
- **충돌 대상**: 기존 `spec/5-system/14-external-interaction-api.md` §5.1·§EIA-IN-10·§R8
- **상세**:
  - 기존 spec §5.1 은 `400 VALIDATION_FAILED` + `details.fieldErrors[{field, reason, expected, actual}]` 형식 사용.
  - draft 는 `400 VALIDATION_ERROR` + `details[{field, message, code: "INVALID_FIELD"}]` 로 변경 — 코드명·details 객체 형태 모두 달라짐.
  - 기존 R8 (Rationale)도 `400 VALIDATION_FAILED` 를 idempotency 캐시 제외 코드로 명시하고 있으며, draft 는 R8 에서 `400 VALIDATION_ERROR` 로 표기 — 두 R8 이 같은 ID 로 다른 코드명을 가리킴.
  - `details.fieldErrors[]` (기존, object 래퍼) vs `details[]` (draft, 배열 최상위) 구조가 충돌 — 클라이언트 언랩 경로가 달라 하나는 항상 깨짐.
- **제안**: 기존 spec(VALIDATION_FAILED + fieldErrors 래퍼)을 draft 의 표준 API 규약 `VALIDATION_ERROR` + `details[{field, message, code}]` 형식으로 갱신하거나, 반대로 draft 를 `VALIDATION_FAILED` 로 되돌려 기존 spec 과 일치시킨다. `spec/5-system/3-error-handling.md` §2.1 의 표준 포맷(`VALIDATION_ERROR` + `details[{field, message, code: "INVALID_FIELD"}]`)과 draft 가 일치하므로, 기존 `14-external-interaction-api.md` 가 과거 독자적 포맷을 정의한 drift 를 해소하는 방향(draft 채택)이 적절하다. 단 기존 SDK/client 가 `VALIDATION_FAILED`/`fieldErrors` 에 의존하는 경우 추가 확인 필요.

---

### 2. **[CRITICAL]** 토큰 에러 HTTP 상태코드·코드명 충돌 (403 vs 401, SCOPE_MISMATCH vs TOKEN_SCOPE_MISMATCH)

- **target 위치**: draft `14-external-interaction-api.md` §5.1 에러 표, §3.3 EIA-AU-06, R14
- **충돌 대상**: 기존 `spec/5-system/14-external-interaction-api.md` §5.1 에러 표
- **상세**:
  - 기존 spec §5.1: `403 Forbidden / SCOPE_MISMATCH` (scope 불일치 시), `TOKEN_REVOKED`/`TOKEN_AUDIENCE_MISMATCH` 코드 없음.
  - draft §5.1: `401 Unauthorized / TOKEN_SCOPE_MISMATCH`, `401 Unauthorized / TOKEN_REVOKED`, `401 Unauthorized / TOKEN_AUDIENCE_MISMATCH` — 403 을 완전히 제거하고 모든 토큰 실패를 401 로 통일.
  - 기존 spec §R13 주석은 "TOKEN_* 계열·HTTP status·SCOPE_MISMATCH 정합은 별도 진행 중인 token-error-codes 정합 작업이 소유한다" 고 명시 — draft 가 그 작업을 직접 수행하고 있으나, 기존 spec 에 `403 SCOPE_MISMATCH` 가 남아 있어 두 진술이 직접 모순됨.
  - 두 spec 이 동시에 읽힐 경우 클라이언트는 403 을 처리해야 하는지 여부를 판단할 수 없음.
- **제안**: draft R14 의 401 통일 결정을 기존 spec 에도 반영해 `403 Forbidden / SCOPE_MISMATCH` 행을 제거·교체한다. 기존 spec 의 "별도 작업이 소유" 주석(§R13 범위 참고)도 해소됨을 표시.

---

### 3. **[WARNING]** `terminal-revoke-reconcile` 큐가 `data-flow/0-overview.md` BullMQ 카탈로그에 없음

- **target 위치**: draft `data-flow/0-overview.md` §4 BullMQ 큐 카탈로그 (16번째 큐 추가)
- **충돌 대상**: 기존 `spec/data-flow/0-overview.md` §4 카탈로그 (15개 큐, terminal-revoke-reconcile 없음)
- **상세**:
  - draft `data-flow/0-overview.md` 는 `terminal-revoke-reconcile` 큐를 카탈로그에 추가했으나, 현재 저장된 `spec/data-flow/0-overview.md` 에는 해당 큐가 없음.
  - `spec/data-flow/0-overview.md` §4 의 주석은 "본 표를 SoT 로 삼는다 — 큐 추가/삭제 시 본 카탈로그를 먼저 갱신" 이라고 정의하므로, 카탈로그 미갱신은 SoT 위반.
  - 코드 측 `codebase/backend/src/modules/system-status/system-status.constants.ts` MONITORED_QUEUES 에도 `terminal-revoke-reconcile` 가 없어 운영 모니터링 누락.
  - draft 가 두 파일(0-overview.md + 14-external-interaction-api.md)을 동시에 갱신하는 구조라면 번들로 처리되겠으나, 현재 저장된 파일과는 불일치 상태.
- **제안**: 기존 `spec/data-flow/0-overview.md` §4 에 `terminal-revoke-reconcile` 행을 추가한다. `system-status.constants.ts` MONITORED_QUEUES 에도 동기화 필요 (draft spec R15 부팅 정책 참조 — 등록 실패는 fail-fast).

---

### 4. **[WARNING]** `execution_token` 엔티티가 `spec/1-data-model.md` 에 없음

- **target 위치**: draft `14-external-interaction-api.md` §7.3 InteractionToken 절
- **충돌 대상**: `spec/1-data-model.md` (execution_token 정의 없음)
- **상세**:
  - draft §7.3 은 `execution_token` 테이블(V060 마이그레이션, `jti PK · execution_id FK→execution ON DELETE CASCADE · issued_at · exp_at · idx_execution_token_execution_id`) 을 정의한다.
  - `spec/1-data-model.md` 는 전체 엔티티의 단일 진실이지만, `execution_token` 엔티티에 대한 항목이 없음.
  - 데이터 모델 spec 이 missing 한 채로 5-system spec 이 단독으로 테이블 스키마를 정의하면 이후 마이그레이션 검토나 데이터 모델 리뷰 시 가시성이 누락됨.
  - `data-flow/15-external-interaction.md` 도 `execution_token` 를 schema 매핑 표에서 기술하지만, 1-data-model.md SoT 링크가 없어 흐름 문서의 정합성이 단절됨.
- **제안**: `spec/1-data-model.md` 의 적절한 위치(Execution 엔티티 인근)에 `execution_token` 테이블 정의 섹션을 추가한다. draft 의 §7.3 스키마를 SoT 로 삼아 마이그레이션 V060 참조와 함께 기재.

---

### 5. **[INFO]** 명명 비일관성 — `details.fieldErrors[]` (기존 EIA spec) vs `details[]` (API convention, draft)

- **target 위치**: draft `14-external-interaction-api.md` §5.1 에러 응답
- **충돌 대상**: `spec/5-system/2-api-convention.md` §5.3, `spec/5-system/3-error-handling.md` §2.1
- **상세**:
  - `spec/5-system/3-error-handling.md` §2.1 은 `details[]` 를 최상위 배열로 정의 (`{field, message, code: "INVALID_FIELD"}`).
  - 기존 `14-external-interaction-api.md` 는 `details.fieldErrors[]` 의 중첩 객체 형태를 독자 정의해 API 규약과 diverge 했음.
  - Draft 는 이를 API 규약 표준(`details[]`)으로 일치시켰으므로, 불일치 해소 방향은 올바름. 단, 기존 spec 이 수정 전까지 두 표기가 공존하는 상태임을 명시.
- **제안**: 발견사항 1번의 CRITICAL 조치 완료 시 자동 해소됨. 별도 조치 불필요.

---

## 요약

Draft (`spec/5-system/14-external-interaction-api.md` + `spec/data-flow/0-overview.md`) 는 기존 spec 에 대해 두 가지 CRITICAL 충돌을 가지고 있다. 첫째, `submit_form` 검증 실패의 에러 코드(`VALIDATION_FAILED` → `VALIDATION_ERROR`)와 details 구조(`details.fieldErrors` 래퍼 → `details[]` 배열)를 변경하며, 이는 기존 spec 과 정면 모순이다. 둘째, scope 불일치 토큰 에러를 `403 SCOPE_MISMATCH` 에서 `401 TOKEN_SCOPE_MISMATCH` 로 교체하는 결정이 기존 spec 에 여전히 `403` 으로 남아 있어 두 spec 이 동시에 참조되면 클라이언트 구현이 불가능하다. 추가로 `terminal-revoke-reconcile` 큐가 data-flow 카탈로그 SoT 에 반영되지 않고, `execution_token` 엔티티가 `spec/1-data-model.md` 에 없다는 WARNING 급 미등록 이슈도 있다. CRITICAL 두 건은 기존 spec(`14-external-interaction-api.md`)을 draft 기준으로 갱신해야만 해소 가능하며, 두 WARNING 은 각각 `spec/data-flow/0-overview.md` 큐 카탈로그 갱신 + `spec/1-data-model.md` 신규 섹션 추가로 해소된다.

## 위험도

HIGH
