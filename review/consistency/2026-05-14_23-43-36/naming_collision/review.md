필요한 검색을 마쳤습니다. 결과를 정리합니다.

---

## 발견사항

### 1. [INFO] `CAFE24_INSTALL_MISSING_PARAMS` — 코드에 존재하나 spec §10 에 미등재

- **target 신규 식별자**: (없음 — spec 에 누락)
- **기존 사용처**: `backend/src/modules/integrations/integrations.controller.ts:258` — `400` 응답으로 구현됨. 같은 파일의 `@ApiResponse` Swagger 설명(`mall_id/timestamp/hmac 누락`)과 `integrations.controller.spec.ts:200, 220` 테스트에도 등장
- **상세**: `spec/2-navigation/4-integration.md §10` 에러 코드 목록은 `CAFE24_INSTALL_INVALID_TOKEN(404)`, `CAFE24_INSTALL_INVALID_HMAC(403)`, `CAFE24_INSTALL_REPLAY(400)`, `CAFE24_PRIVATE_APP_ALREADY_CONNECTED(409)` 를 나열하지만, **`CAFE24_INSTALL_MISSING_PARAMS(400)`** 는 빠져있다. spec 를 보고 API 소비자가 이 코드를 예측할 수 없다.
- **제안**: §10 에러 목록에 `CAFE24_INSTALL_MISSING_PARAMS (400) — App URL 호출 시 `mall_id` / `timestamp` / `hmac` 쿼리 파라미터 중 하나 이상 누락` 행을 추가한다.

---

### 2. (이상 없음) 신규 에러 코드 / status_reason 교차 검증 — 충돌 없음

| 신규 식별자 | spec 간 정합 | code 정합 |
|---|---|---|
| `CAFE24_INSTALL_INVALID_TOKEN (404)` | `4-integration.md`, `4-cafe24.md`, `data-flow/integration.md §1.2.1` 모두 일치 | 코드에 구현됨 |
| `CAFE24_PRIVATE_APP_ALREADY_CONNECTED (409)` | §9.2, §10, Rationale 일치 | 코드에 구현됨 |
| `oauth_token_exchange_failed`, `oauth_state_mismatch`, `oauth_state_expired` (status_reason) | `1-data-model.md §2.10` 에 이미 정의됨 | 코드에 구현됨 |
| `install_timeout` (status_reason for expired) | `1-data-model.md §2.10` 에 이미 정의됨 | `integration-expiry-scanner.service.ts` 에 구현됨 |
| `pending_install_timeout` (BullMQ reason 값) | `data-flow/integration.md §1.4` 에 정의됨 | `ExpiryJobData` 에 `reason` 필드 미구현 (follow-up plan 그룹 D 대상) — 구현 gap이나 명명 충돌은 아님 |
| `GET /oauth/install/cafe24/:installToken` (endpoint) | 세 spec 문서 모두 일치 | 컨트롤러에 구현됨 |
| `CAFE24_INSTALL_INVALID_HMAC` 의미 축소 (token 미존재 분기 분리) | `data-flow/integration.md §1.2.1` diagram (line 95–97)에 이미 분리 반영됨 | 코드와 일치 |

---

### 요약

명명 충돌은 발견되지 않았다. 모든 신규 식별자는 `spec/1-data-model.md`, `spec/4-nodes/4-integration/4-cafe24.md`, `spec/data-flow/integration.md` 와 일관성이 확인된다. 유일한 조치 항목은 구현 코드에는 있지만 spec §10 에서 누락된 `CAFE24_INSTALL_MISSING_PARAMS(400)` 등재다 — 구현 착수를 막는 충돌은 아니나, spec 소비자에게 API 계약이 불완전하게 전달된다.

### 위험도

**LOW** — 충돌 없음. spec §10 에 `CAFE24_INSTALL_MISSING_PARAMS` 1행 추가 권장.