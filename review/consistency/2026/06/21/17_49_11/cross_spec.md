# Cross-Spec 일관성 검토 결과

**검토 대상**: `spec/4-nodes/4-integration` (0-common, 1-http-request, 2-database-query, 3-send-email, 4-cafe24, 5-makeshop)
**검토 모드**: `--impl-done`, scope=spec/4-nodes/4-integration, diff-base=origin/main
**검토 일시**: 2026-06-21

---

## 발견사항

### [WARNING] `spec/4-nodes/0-overview.md` §2.4 Integration 노드 출력 포트 수가 실제 노드 spec 과 불일치
- **target 위치**: `spec/4-nodes/4-integration/2-database-query.md` §3.2 출력 포트 (`success` / `error` 2종), `spec/4-nodes/4-integration/3-send-email.md` §3.2 출력 포트 (`out` / `error` 2종)
- **충돌 대상**: `spec/4-nodes/0-overview.md` §2.4 Integration 노드 표 — `database_query` 출력 칸 = `1`, `send_email` 출력 칸 = `1`
- **상세**: `0-overview.md` 의 카탈로그 표는 `database_query` 와 `send_email` 을 출력 포트 수 `1`로 기재하고 있다. 그러나 target `2-database-query.md` §3.2는 `success`·`error` 2개 포트를 정의하고, `3-send-email.md` §3.2도 `out`·`error` 2개 포트를 정의한다. `http_request`·`cafe24`·`makeshop` 은 `2 (success/error)` 로 올바르게 표기돼 있어, `database_query`·`send_email` 만 예외적으로 `1` 로 남아 있는 상태다. D4 결정 이후 Database Query·Send Email 에도 error 포트가 추가됐으므로 `0-overview.md` 카탈로그 표가 구 상태를 반영하고 있다.
- **제안**: `spec/4-nodes/0-overview.md` §2.4 의 `database_query` 출력 칸을 `2 (success/error)`, `send_email` 출력 칸을 `2 (out/error)` 로 갱신한다.

---

### [WARNING] `INTEGRATION_SERVICE_UNAVAILABLE` surface 경로가 `0-common.md` 와 `3-send-email.md` 간 불일치
- **target 위치**: `spec/4-nodes/4-integration/0-common.md` §4.2 공통 에러 코드 ("`IntegrationsService` 미주입 또는 workspace context 누락 … `port: 'error'` 라우팅"), `spec/4-nodes/4-integration/3-send-email.md` §5.3 표 1 비고 ("`INTEGRATION_SERVICE_UNAVAILABLE` — `__workspaceId` 컨텍스트 누락 시 … `EMAIL_SEND_FAILED` 로 매핑된다")
- **충돌 대상**: target 문서 내부 — `0-common.md` 와 `3-send-email.md` 간 동일 도메인 기술 충돌
- **상세**: `0-common.md` §4.2 는 `INTEGRATION_SERVICE_UNAVAILABLE` 코드가 D4 이후 `port: 'error'` + `output.error.code` 로 surface 된다고 서술한다. 그러나 `3-send-email.md` §5.3 표 1 비고와 §5.8 은 "현재 미surface (구현 갭)" 섹션에서 `INTEGRATION_SERVICE_UNAVAILABLE`(`__workspaceId` 누락 plain `Error`) 이 `IntegrationError` 가 아니므로 catch 에서 `EMAIL_SEND_FAILED` 로 흡수된다고 명시한다. 두 문서가 같은 코드의 surface 여부를 반대로 기술하고 있다. (HTTP Request 의 §5.8과 Database Query 의 §5.8은 `INTEGRATION_SERVICE_UNAVAILABLE`을 surface 되는 코드로 포함하고 있어 이들과도 비대칭이다.)
- **제안**: `0-common.md` §4.2 의 `INTEGRATION_SERVICE_UNAVAILABLE` 설명에 "단, Send Email 은 현재 `EMAIL_SEND_FAILED` 로 흡수됨 (구현 갭, `3-send-email.md §5.3` 비고 참조)" 를 주석으로 추가하거나, `3-send-email.md` 에 "이는 `0-common.md §4.2` 가 약속하는 surface 에서 예외" 라는 참조를 명확히 달아 두 문서가 같은 사실을 다른 각도에서 기술한다는 것을 독자가 인식하도록 한다.

---

### [INFO] `spec/5-system/3-error-handling.md` §1.4 에 Cafe24·MakeShop 에러 코드 카탈로그 미등재
- **target 위치**: `spec/4-nodes/4-integration/4-cafe24.md` §6 에러 코드 (`CAFE24_4XX`·`CAFE24_404`·`CAFE24_422`·`CAFE24_AUTH_FAILED`·`CAFE24_RATE_LIMITED`·`CAFE24_5XX`·`CAFE24_TRANSPORT_FAILED`·`CAFE24_UNKNOWN_OPERATION`·`CAFE24_MISSING_FIELDS`·`CAFE24_INVALID_MALL_ID`), `spec/4-nodes/4-integration/5-makeshop.md` §6 에러 코드 (`MAKESHOP_4XX`·`MAKESHOP_404`·`MAKESHOP_422`·`MAKESHOP_AUTH_FAILED`·`MAKESHOP_RATE_LIMITED`·`MAKESHOP_5XX`·`MAKESHOP_TRANSPORT_FAILED`·`MAKESHOP_UNKNOWN_OPERATION`·`MAKESHOP_MISSING_FIELDS`·`MAKESHOP_INVALID_SHOP_UID`)
- **충돌 대상**: `spec/5-system/3-error-handling.md` §1.4 노드 수준 런타임 에러 코드 표 — HTTP·Database·Email·LLM·Code·Sub-workflow 카테고리만 열거하며 Cafe24·MakeShop 카테고리 행 없음
- **상세**: `3-error-handling.md` §1.4 의 상단 주석은 "정식 목록은 `codebase/backend/src/nodes/core/error-codes.ts` 의 `ErrorCode` enum" 이라고 하므로 완전 열거 의무는 없다. 그러나 `chat-channel-adapter.md §3.1` 분류 표가 `DB_*` 와 같은 wildcard 패턴을 사용해 `DB_HOST_BLOCKED` 를 포함하는 것처럼, `CAFE24_*`·`MAKESHOP_*` 코드도 분류 표에 포함돼야 한다. 현재 분류 표에는 해당 코드가 없어, 분류 표 "unknown code" fallback (`executionFailedInternal`) 으로 떨어진다. Cafe24·MakeShop 의 rate-limit 에러 (`CAFE24_RATE_LIMITED`·`MAKESHOP_RATE_LIMITED`) 는 `executionFailedThirdParty` 로 분류하는 게 자연스러운데 현재 미지원이다. `3-error-handling.md §1.4` 의 주석("본 enum 확장 시 분류 표 행 추가 검토 의무")이 있으므로, Cafe24·MakeShop 코드 등재가 명시적으로 요구된다.
- **제안**: (1) `spec/5-system/3-error-handling.md` §1.4 에 `Cafe24` / `MakeShop` 카테고리 행을 추가한다. (2) `spec/conventions/chat-channel-adapter.md §3.1` 분류 표에 `CAFE24_RATE_LIMITED`·`MAKESHOP_RATE_LIMITED` → `executionFailedRateLimit`, `CAFE24_AUTH_FAILED`·`MAKESHOP_AUTH_FAILED` → `executionFailedThirdParty` (또는 별도 `executionFailedAuth` 신설 검토), `CAFE24_*`·`MAKESHOP_*` (그 외) → `executionFailedThirdParty` 행을 추가한다.

---

### [INFO] `0-common.md` §4.2 `INTEGRATION_SERVICE_UNAVAILABLE` 설명과 `spec/5-system/3-error-handling.md` §1.4 사이 상호 참조 부재
- **target 위치**: `spec/4-nodes/4-integration/0-common.md` §4.2 (`INTEGRATION_SERVICE_UNAVAILABLE` — "D4 이후 `port: 'error'` 라우팅")
- **충돌 대상**: `spec/5-system/3-error-handling.md` §1.4 에 `INTEGRATION_SERVICE_UNAVAILABLE` 코드 미등재
- **상세**: `0-common.md` 가 D4 결정으로 `INTEGRATION_SERVICE_UNAVAILABLE` 이 error 포트로 surface 된다고 정의했으나, `3-error-handling.md` §1.4 의 카테고리 표에는 이 코드가 없다. 카테고리 표에 `INTEGRATION_*` 공통 코드를 일괄 등재하거나 참조 주석을 추가하면 카탈로그 가시성이 개선된다.
- **제안**: `3-error-handling.md` §1.4 에 Integration 공통 에러 코드 행 (`INTEGRATION_TYPE_MISMATCH`·`INTEGRATION_NOT_CONNECTED`·`INTEGRATION_INCOMPLETE`·`INTEGRATION_CALL_FAILED`·`INTEGRATION_SERVICE_UNAVAILABLE`) 을 추가하거나, `0-common.md §4.2` 를 cross-reference 하는 주석을 삽입한다. 단독 INFO 로 처리 가능 (기능 동작에는 영향 없음).

---

### [INFO] `spec/4-nodes/0-overview.md` §2.4 `send_email` 성공 포트 레이블이 `out` 임을 미표기
- **target 위치**: `spec/4-nodes/4-integration/3-send-email.md` §3.2 — 성공 포트 id=`out`, label="Output"
- **충돌 대상**: `spec/4-nodes/0-overview.md` §2.4 — `send_email` 출력 칸 `1` (기타 표기 없음)
- **상세**: `http_request`·`cafe24`·`makeshop` 은 `success/error` 포트 레이블이 표기되어 있으나 `send_email` 의 성공 포트는 `out` 이라는 고유 식별자를 사용한다 (다른 integration 노드의 `success` 와 다름). `0-overview.md` 가 이를 `out/error` 로 표기하면 워크플로 작성자가 `$node["X"].port === 'out'` 분기를 예측할 수 있다. 이는 WARNING 수준이 아닌 명명 비일관성(INFO)이다.
- **제안**: `0-overview.md` §2.4 의 `send_email` 출력 칸을 `2 (out/error)` 로 갱신할 때 함께 반영한다. 선택적으로 `3-send-email.md §3.2` 에 "다른 integration 노드가 `success` 포트를 쓰는 반면 Send Email 은 `out` 포트를 사용한다 (legacy 명명)" 주석을 남길 수 있다.

---

## 요약

`spec/4-nodes/4-integration` 의 6개 파일(0-common / 1-http-request / 2-database-query / 3-send-email / 4-cafe24 / 5-makeshop) 은 대체로 `spec/1-data-model.md`, `spec/5-system/3-error-handling.md`, `spec/conventions/node-output.md`, `spec/conventions/chat-channel-adapter.md` 등 상위 spec 과 정합적으로 작성돼 있다. 그러나 두 가지 실질적 불일치가 존재한다: (1) D4 결정으로 Database Query·Send Email 에 error 포트가 추가됐으나 `spec/4-nodes/0-overview.md` 의 출력 포트 수 카탈로그가 구 상태(1개)를 반영하고 있고, (2) `INTEGRATION_SERVICE_UNAVAILABLE` 의 Send Email 구현 갭(`EMAIL_SEND_FAILED` 로 흡수)이 `0-common.md` 와 `3-send-email.md` 에서 상충되는 시각으로 기술되어 독자 혼란을 유발할 수 있다. 추가로 Cafe24·MakeShop 의 `CAFE24_*`·`MAKESHOP_*` 에러 코드가 시스템 카탈로그(`3-error-handling.md`)와 chat-channel-adapter 분류 표에 미등재된 INFO 수준 gap 이 있다. CRITICAL 수준의 직접 모순은 발견되지 않았다.

## 위험도

MEDIUM

---

STATUS: OK
