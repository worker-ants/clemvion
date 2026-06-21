# 신규 식별자 충돌 검토 결과

검토 모드: 구현 착수 전 검토 (--impl-prep, scope=spec/4-nodes/4-integration)
검토 일시: 2026-06-21

---

## 발견사항

### [WARNING] `INTEGRATION_AUTH_UNSUPPORTED` 가 공통 에러 코드 표 및 시스템 에러 카탈로그에 미등재

- **target 신규 식별자**: `INTEGRATION_AUTH_UNSUPPORTED` — `spec/4-nodes/4-integration/1-http-request.md` §4.1 표, §5.8, §6 에러 코드 표에서 `INTEGRATION_*` prefix 코드로 도입
- **기존 사용처**:
  - `spec/4-nodes/4-integration/0-common.md` §4.2 `공통 에러 코드` 표 — `INTEGRATION_TYPE_MISMATCH` / `INTEGRATION_NOT_CONNECTED` / `INTEGRATION_INCOMPLETE` / `INTEGRATION_CALL_FAILED` / `INTEGRATION_SERVICE_UNAVAILABLE` 5개만 열거. `INTEGRATION_AUTH_UNSUPPORTED` 미포함
  - `spec/5-system/3-error-handling.md` §1.4 "노드 수준 런타임 에러" 표 — HTTP/Database/Email/LLM/Code/Sub-workflow 카테고리만 있고 `INTEGRATION_AUTH_UNSUPPORTED` 미등재
- **상세**: `0-common.md §4.2` 는 모든 Integration 노드에 공통 적용되는 `INTEGRATION_*` 코드의 정의 테이블로 선언되어 있다. `1-http-request.md` 는 HTTP 전용 auth_type 문제에 대해 이 prefix 를 사용하는 신규 코드를 도입했으나 공통 표에 추가하지 않았다. 소비 측(`spec/5-system/3-error-handling.md`) 도 모른다.
- **제안**: `0-common.md §4.2` 테이블에 `INTEGRATION_AUTH_UNSUPPORTED` 행을 추가 (`HTTP Request 노드 한정 — 지원하지 않는 auth_type` 주석 포함). 또는 HTTP 전용 코드임을 명시해 `1-http-request.md §6` 에만 두고 공통 표 범위 밖임을 명기한다.

---

### [WARNING] `meta.rowCount` — 0-common.md 및 node-output.md 가 선언하지만 2-database-query.md 가 `output` 에만 보존한다고 명시

- **target 신규 식별자**: `meta.rowCount` — `spec/4-nodes/4-integration/0-common.md` §6 5필드 공통 규약 표의 `meta` 행에서 `meta.rowCount (output.rowCount 와 중복 가능 — output 은 도메인, meta 는 메트릭 측면)` 로 도입
- **기존 사용처**:
  - `spec/conventions/node-output.md` line 92: `| **DB** | meta.durationMs, meta.rowCount |` — `meta.rowCount` 를 DB 카테고리 공식 메트릭 필드로 등재
  - `spec/4-nodes/4-integration/2-database-query.md` §5.1 출력 구조 JSON 및 §5.1 표 — `meta` 에는 `durationMs` 만 있고 `rowCount` 는 `output.rowCount` 에만 위치. 테이블 주석: "rowCount 는 … output 에 유지한다. meta 에 복제하지 않는다 — 같은 값이 두 곳에 있으면 일관성을 해친다"
- **상세**: `0-common.md §6` 과 `node-output.md` 는 `meta.rowCount` 가 존재한다고 말하지만, `2-database-query.md` 는 명시적으로 `meta` 에 두지 않는다고 결론 내렸다. 동일 식별자가 두 문서에서 서로 상충하는 의미(존재 vs 비존재)로 기술되어 있어 구현자가 어느 쪽이 SoT 인지 알 수 없다.
- **제안**: `spec/4-nodes/4-integration/0-common.md §6` 의 `meta` 행에서 `meta.rowCount` 언급을 제거하거나 "DB: meta.rowCount 는 의도적으로 생략 — output.rowCount 가 SoT" 로 수정한다. `spec/conventions/node-output.md` line 92 의 `meta.rowCount` 도 동일하게 정정한다.

---

### [WARNING] `CAFE24_*` 및 `MAKESHOP_*` 노드 에러 코드가 `spec/5-system/3-error-handling.md` §1.4 카탈로그에 미등재

- **target 신규 식별자**: `CAFE24_4XX`, `CAFE24_5XX`, `CAFE24_TRANSPORT_FAILED`, `CAFE24_RATE_LIMITED`, `CAFE24_404`, `CAFE24_422`, `CAFE24_AUTH_FAILED`, `CAFE24_MISSING_FIELDS`, `CAFE24_UNKNOWN_OPERATION` (`spec/4-nodes/4-integration/4-cafe24.md §6`) 및 `MAKESHOP_4XX`, `MAKESHOP_5XX`, `MAKESHOP_TRANSPORT_FAILED`, `MAKESHOP_RATE_LIMITED`, `MAKESHOP_MISSING_FIELDS`, `MAKESHOP_UNKNOWN_OPERATION`, `MAKESHOP_INVALID_SHOP_UID` (`spec/4-nodes/4-integration/5-makeshop.md §6`)
- **기존 사용처**: `spec/5-system/3-error-handling.md` §1.4 "노드 수준 런타임 에러" 표는 HTTP/Database/Email/LLM/Code/Sub-workflow 6개 카테고리만 열거. Cafe24/MakeShop 카테고리 행이 없다.
- **상세**: `3-error-handling.md §1.4` 는 "주요 항목" 표이며 "정식 목록은 `error-codes.ts` 의 `ErrorCode` enum" 이라 하지만, chat-channel-adapter 분류기는 `3-error-handling.md §1.4` 노트("본 enum 확장 시 분류 표 행 추가 검토 의무")를 따라 작성된다. `CAFE24_*`/`MAKESHOP_*` 코드들이 `chat-channel-adapter.md §3.1` 에 없고(미분류 — fallback `executionFailedInternal`), `3-error-handling.md §1.4` 에도 없다. 구현자가 신규 에러 코드 추가 시 카탈로그 등재 여부를 알기 어렵다.
- **제안**: `3-error-handling.md §1.4` 표에 `Cafe24` 및 `MakeShop` 카테고리 행을 추가하고 각 에러 코드를 열거한다. `chat-channel-adapter.md §3.1` 에도 `CAFE24_*`/`MAKESHOP_*` 의 분류(아마 `executionFailedThirdParty` 또는 `executionFailedInternal`) 를 명시적으로 등재하거나, "그 외 fallback" 행으로 커버됨을 주석으로 명기한다.

---

### [INFO] `CAFE24_AUTH_FAILED` 가 `spec/5-system/11-mcp-client.md §2.3` 에서 MCP 에러 vocabulary 로도 사용됨 — namespace 혼용 가능성

- **target 신규 식별자**: `CAFE24_AUTH_FAILED` — `spec/4-nodes/4-integration/4-cafe24.md §6` 에서 노드 `output.error.code` 로 정의
- **기존 사용처**: `spec/5-system/11-mcp-client.md` line 81: "`tool_result.error` 의 `code` 는 Cafe24 노드 §6 의 vocabulary (`CAFE24_AUTH_FAILED` 등) 를 그대로 사용"
- **상세**: `CAFE24_AUTH_FAILED` 는 노드 런타임 `output.error.code` namespace 와 MCP tool_result.error.code namespace 양쪽에서 동일 identifier 를 공유한다. 의도된 재사용이며 충돌은 아니지만, 두 namespace 가 구분 없이 표기되어 있어 소비 측 코드가 어느 레이어의 코드인지 혼동할 수 있다.
- **제안**: `4-cafe24.md §6` 에 "(노드 `output.error.code` 및 MCP `tool_result.error.code` 공용)" 주석 추가. 또는 `11-mcp-client.md §2.3` 에서 이 재사용이 의도된 것임을 명시적으로 기술한다.

---

### [INFO] `EMAIL_HOST_BLOCKED` 가 `spec/5-system/3-error-handling.md §1.4` 에는 등재되어 있지만 `chat-channel-adapter.md §3.1` 에는 명시적 행이 없음

- **target 신규 식별자**: `EMAIL_HOST_BLOCKED` — `spec/4-nodes/4-integration/3-send-email.md §5.3` 및 §6 에서 `output.error.code` 로 정의
- **기존 사용처**:
  - `spec/5-system/3-error-handling.md` §1.4: Email 카테고리에 `EMAIL_HOST_BLOCKED` 등재됨 (올바름)
  - `spec/conventions/chat-channel-adapter.md §3.1`: `EMAIL_SEND_FAILED` 만 명시적 행 존재. `EMAIL_HOST_BLOCKED` 없음
- **상세**: `2-navigation/4-integration.md` Rationale (line 1133)이 "chat-channel 분류표 영향 없음 — `ERROR_PORT_FALLBACK` 으로 수렴" 이라고 정당화하고 있어 의도된 gap 이다. 그러나 분류기 코드(`execution-failure-classifier.ts`)를 직접 작성하는 구현자는 이 rationale 을 모를 수 있다.
- **제안**: `chat-channel-adapter.md §3.1` 표에 `EMAIL_HOST_BLOCKED` 행을 추가하고 분류를 `executionFailedInternal` (fallback 경로 — `ERROR_PORT_FALLBACK` 통해 도달) 로 주석과 함께 명기해 혼동을 제거한다.

---

## 요약

`spec/4-nodes/4-integration` 스코프가 도입하는 신규 식별자 중 실제 다른 의미로 이미 사용되는 충돌은 발견되지 않았다. 다만 두 개의 주의 사항이 있다. 첫째, `INTEGRATION_AUTH_UNSUPPORTED` 가 HTTP Request 에서만 쓰이는 `INTEGRATION_*` prefix 코드로 도입되었으나 공통 에러 코드 표(`0-common.md §4.2`)와 시스템 에러 카탈로그(`3-error-handling.md §1.4`) 양쪽에 미등재되어 있어 소비 측이 이 코드의 존재를 알 수 없다. 둘째, `meta.rowCount` 가 `0-common.md §6` 과 `node-output.md` 에서 DB 메트릭 필드로 선언되지만 `2-database-query.md §5.1` 은 명시적으로 `meta` 에 두지 않는다고 결론 내려 동일 식별자의 존재 여부가 문서마다 상충한다. `CAFE24_*`/`MAKESHOP_*` 에러 코드들은 `3-error-handling.md §1.4` 카탈로그와 `chat-channel-adapter.md §3.1` 분류 표에 카테고리 자체가 없어 구현자가 신규 코드 추가 시 등재 여부를 판단하기 어려운 상황이다. 진짜 의미 충돌(동일 이름, 다른 의미)은 `meta.rowCount` 의 존재 여부 불일치가 가장 가깝고, 나머지는 누락·미등재 수준이다.

## 위험도

MEDIUM
