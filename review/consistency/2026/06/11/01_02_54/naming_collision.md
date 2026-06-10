# 신규 식별자 충돌 검토 결과

검토 범위: `spec/2-navigation/` — 구현 완료 후 검토 (--impl-done), diff-base=origin/main

실제 변경 파일: `spec/1-data-model.md`, `spec/2-navigation/4-integration.md`, `spec/4-nodes/4-integration/4-cafe24.md`, `spec/data-flow/5-integration.md`, `spec/data-flow/8-notifications.md`, `codebase/backend/src/modules/integrations/integration-status-reason.ts`, `codebase/backend/src/modules/integrations/integration-expiry-scanner.service.ts`, `codebase/backend/src/modules/system-status/system-status.constants.ts`

---

## 발견사항

### [WARNING] `token_expired` — Integration.status_reason 슬러그와 REST/WebSocket `TOKEN_EXPIRED` 간 표기 유사성

- **target 신규 식별자**: `token_expired` — `INTEGRATION_STATUS_REASONS` union 에 새로 추가된 DB 저장값 (`codebase/backend/src/modules/integrations/integration-status-reason.ts`). `spec/1-data-model.md` `status_reason` 컬럼 정의와 `spec/2-navigation/4-integration.md §11.1/§11.2` 에 반영됨.
- **기존 사용처**:
  - `spec/5-system/3-error-handling.md` line 35 — REST API 에러 코드 `TOKEN_EXPIRED` (UPPER_SNAKE_CASE, JWT Access Token 만료 → HTTP 401)
  - `spec/5-system/14-external-interaction-api.md` line 315 — `TOKEN_EXPIRED` 401 응답 코드
  - `spec/5-system/6-websocket-protocol.md` line 739 — (계획·미구현) WS 서버 이벤트 `auth.token_expired` (lower_dot 표기)
  - `spec/data-flow/2-auth.md` line 166 — `401 TOKEN_EXPIRED` 반환 흐름
- **상세**: `token_expired` (lower_snake_case, Integration.status_reason DB 슬러그)는 `TOKEN_EXPIRED` (UPPER_SNAKE_CASE, JWT 만료 REST 에러 코드)·`auth.token_expired` (WS 이벤트 계획명)와 표기 체계는 다르지만, 세 식별자 모두 "토큰 만료" 를 뜻하는 맥락이어서 코드 검색·로그 분석 시 혼동 가능하다. 특히 미구현(Planned) WS 이벤트 `auth.token_expired` 는 점(`.`) 구분자 우측이 정확히 `token_expired` 와 일치한다.
- **제안**: `spec/1-data-model.md` 의 `status_reason` 정의에 "별개 네임스페이스" 주석이 이미 추가됐다. 추가적으로 `spec/5-system/6-websocket-protocol.md` §4.5 의 `auth.token_expired` 계획 항목에 "이 WS 이벤트명이 `Integration.status_reason='token_expired'` (DB 슬러그) 와 무관함" 을 크로스-주석으로 달면 향후 구현 시 혼동을 예방할 수 있다. 필수 변경은 아님.

---

### [INFO] `isRefreshCapable` — 기존 `isCafe24RefreshCapable` 에서의 이름 변경

- **target 신규 식별자**: module-scope private 함수 `isRefreshCapable` (`codebase/backend/src/modules/integrations/integration-expiry-scanner.service.ts` line 531).
- **기존 사용처**: `isCafe24RefreshCapable` 은 이 branch 이전 구현에서 사용되던 함수명. 현재 코드·spec 어디에도 `isCafe24RefreshCapable` 이 남아있지 않으며(plan 파일에 마이그레이션 언급만 있음), 해당 함수가 외부에 export 되지 않아 API 계약에 영향 없음.
- **상세**: 완전한 in-place 교체. 모듈 private 함수라 외부 충돌 없음.
- **제안**: 없음.

---

### [INFO] `unknown_error` — DB Integration 연결 테스트 에러 코드 표기 정합

- **target 신규 식별자**: `spec/1-data-model.md` 의 `status_reason` 정의에서 `error` 상태 fallback 사유를 `unknown` → `unknown_error` 로 명칭 정정.
- **기존 사용처**: `spec/2-navigation/4-integration.md` line 488 — DB Integration 연결 테스트 결과의 `error.code` 정규화 목록이 `auth_failed`, `network`, `unknown_error` 로 이미 갱신됐다 (이번 branch 가 수정 완료). `INTEGRATION_STATUS_REASONS` union 도 `unknown_error` 를 포함하므로 양쪽 정합.
- **상세**: 이번 branch 가 두 곳 모두 `unknown_error` 로 통일했다. 잔존 불일치 없음.
- **제안**: 없음.

---

### [INFO] `MAKESHOP_REFRESH_QUEUE` — `MONITORED_QUEUES` 등록

- **target 신규 식별자**: `codebase/backend/src/modules/system-status/system-status.constants.ts` 의 `MONITORED_QUEUES` 배열에 `makeshop-token-refresh` 큐 추가.
- **기존 사용처**: `MAKESHOP_REFRESH_QUEUE` 상수(`makeshop-token-refresh.constants.ts`)와 큐 이름 `'makeshop-token-refresh'` 는 이미 `makeshop-api.client.ts`, `makeshop-token-refresh.processor.ts`, `makeshop.module.ts` 에서 사용 중. `CAFE24_REFRESH_QUEUE` (`'cafe24-token-refresh'`) 와 다른 이름.
- **상세**: 큐 이름 중복 없음. `system-status.e2e-spec.ts` 의 `EXPECTED_QUEUE_NAMES` 에도 동기 추가됨.
- **제안**: 없음.

---

### [INFO] `integration_action_required` — Notification type 기존 사용처 확인

- **target 신규 식별자**: 이번 branch 에서 `integration_action_required` 알림을 `error(auth_failed/insufficient_scope/network)` 전이 시 발사하는 정책을 확정·명시했다.
- **기존 사용처**: `integration_action_required` type 은 `spec/1-data-model.md` Notification 엔티티 `type` 필드의 열거값으로 이미 기존에 정의돼 있었고(`spec/data-flow/8-notifications.md`), 코드 구현도 `integration-action-required-notifier.service.ts` 로 존재한다.
- **상세**: 신규 도입 식별자가 아니라 기존 식별자의 사용 정책 확정. 다른 의미로 사용되는 곳 없음. 충돌 없음.
- **제안**: 없음.

---

## 요약

이번 branch 가 도입하거나 명칭을 정정한 식별자 — `token_expired` (status_reason 슬러그 신규), `isRefreshCapable` (함수 rename), `unknown_error` (spec 표기 통일), `MAKESHOP_REFRESH_QUEUE` in MONITORED_QUEUES — 중 실질적 충돌은 없다. 주의할 점은 `token_expired` 슬러그가 기존 JWT 만료 에러 코드 `TOKEN_EXPIRED` (REST) 및 계획 중인 WS 이벤트 `auth.token_expired` 와 표기가 유사하다는 점이나, `spec/1-data-model.md` 에 "별개 네임스페이스" 명시 주석이 이미 추가됐다. `unknown` → `unknown_error` 통일도 이번 branch 에서 `spec/2-navigation/4-integration.md:488` 까지 완료됐다. `integration_action_required` 알림 타입은 기존 정의 그대로다.

## 위험도

LOW
