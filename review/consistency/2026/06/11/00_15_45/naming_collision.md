# 신규 식별자 충돌 검토 결과

검토 범위: `spec/2-navigation/` — 구현 완료 후 검토 (--impl-done), diff-base=origin/main

실제 변경 파일: `spec/1-data-model.md`, `spec/2-navigation/4-integration.md`, `spec/data-flow/5-integration.md`, `codebase/backend/src/modules/integrations/integration-status-reason.ts`, `codebase/backend/src/modules/integrations/integration-expiry-scanner.service.ts`, `codebase/backend/src/modules/system-status/system-status.constants.ts`

---

## 발견사항

### [WARNING] `token_expired` — Integration.status_reason 슬러그와 REST/WebSocket `TOKEN_EXPIRED` 에러 코드 간 표기 유사성

- **target 신규 식별자**: `token_expired` — `INTEGRATION_STATUS_REASONS` union 에 추가된 DB 저장값 (`integration-status-reason.ts` line 새 항목). `spec/1-data-model.md` `status_reason` 컬럼 정의에 반영.
- **기존 사용처**:
  - `codebase/backend/src/modules/auth/auth.service.ts:567` — REST 에러 코드 `'TOKEN_EXPIRED'` (UPPER_SNAKE_CASE, JWT 만료)
  - `codebase/backend/src/modules/external-interaction/interaction.guard.ts:176` — 동일 `'TOKEN_EXPIRED'` 반환
  - `spec/5-system/3-error-handling.md:35` — REST API 에러 코드 표 `TOKEN_EXPIRED`
  - `spec/5-system/14-external-interaction-api.md:315` — `TOKEN_EXPIRED` 401 응답 코드
  - `spec/5-system/6-websocket-protocol.md:739` — (계획·미구현) WS 이벤트 `auth.token_expired` (점 표기, lower_snake_case)
- **상세**: `token_expired` (lower_snake_case, DB `status_reason` 슬러그)는 `TOKEN_EXPIRED` (UPPER_SNAKE_CASE, JWT 만료 REST 에러)·`auth.token_expired` (WS 이벤트 계획명)와 표기 체계는 다르나, 세 식별자가 모두 "토큰 만료"를 뜻하는 맥락이라 코드 검색·로그 분석 시 혼동 가능. `spec/1-data-model.md` `status_reason` 정의에는 이미 "별개 네임스페이스" 명시 주석이 추가되어 있어 의도적 분리임을 선언하고 있다.
- **제안**: 현재 spec 주석(`※ token_expired 는 본 컬럼 전용 슬러그 — JWT 만료 REST 에러 TOKEN_EXPIRED·WebSocket 이벤트 auth.token_expired 와 표기가 유사하나 별개 네임스페이스다`)이 명시되어 있어 실질 충돌은 아님. 단, `spec/5-system/3-error-handling.md` 에러 코드 표에도 동일 주석 or 크로스-링크를 추가하면 혼동을 더 줄일 수 있다. 필수 변경 아님.

---

### [INFO] `unknown` (DB Integration 연결 에러 코드) vs `unknown_error` (INTEGRATION_STATUS_REASONS)

- **target 신규 식별자**: `unknown_error` — `INTEGRATION_STATUS_REASONS` union 에 이미 존재하던 미분류 fallback. 이번 branch 의 `spec/1-data-model.md` 변경이 `error` 상태의 사유를 `unknown` → `unknown_error` 로 명칭 정정했다.
- **기존 사용처**: `spec/2-navigation/4-integration.md:488` — DB Integration (`database` service_type) 연결 테스트 결과의 `error.code` 정규화에 `unknown` 이 여전히 잔존 (`auth_failed`, `network`, `unknown`). 이 `unknown` 은 `INTEGRATION_STATUS_REASONS` union 밖 별도 문맥(DB 연결 테스트 결과 코드)으로 보이나, 동일 파일 내에서 둘 다 에러 분류 용도로 쓰여 혼동 가능.
- **상세**: `spec/2-navigation/4-integration.md` line 488 의 `unknown` 은 database integration 전용 연결 테스트 코드(`auth_failed / network / unknown`)이며, `INTEGRATION_STATUS_REASONS` 의 `unknown_error` 와는 별도 문맥이다. 현재 branch 는 이 라인을 수정하지 않았고, 실제 코드(`database-query` 핸들러)에서도 이 값이 `INTEGRATION_STATUS_REASONS` 에 직접 쓰이지 않는 것으로 확인된다.
- **제안**: `spec/2-navigation/4-integration.md:488` 의 `unknown` 을 `unknown_error` 로 통일하거나 "DB 연결 테스트 전용 코드" 주석을 추가하면 일관성이 높아진다. 현재 branch scope 밖이나 후속 정비 대상으로 기록.

---

### [INFO] `isRefreshCapable` 함수명 — 기존 `isCafe24RefreshCapable` 와의 관계

- **target 신규 식별자**: module-scope private 함수 `isRefreshCapable` (`integration-expiry-scanner.service.ts`).
- **기존 사용처**: `isCafe24RefreshCapable` 은 이전 구현에서 사용되던 함수명. 현재 코드·spec·plan 어디에도 남아 있지 않음 (plan 파일에 마이그레이션 문맥으로만 언급).
- **상세**: `isCafe24RefreshCapable` 은 완전히 `isRefreshCapable` 로 교체됐다. 외부 export 가 아니므로 API 충돌 없음. 충돌 없음.
- **제안**: 없음.

---

### [INFO] `MAKESHOP_REFRESH_QUEUE` — `MONITORED_QUEUES` 등록 신규 추가

- **target 신규 식별자**: `MAKESHOP_REFRESH_QUEUE` 를 `system-status.constants.ts` 의 `MONITORED_QUEUES` 에 추가 (큐명 `makeshop-token-refresh`).
- **기존 사용처**: `MAKESHOP_REFRESH_QUEUE` 상수 자체는 이미 `makeshop-token-refresh.constants.ts` 에 존재하며 `makeshop-api.client.ts`, `makeshop-token-refresh.processor.ts`, `makeshop.module.ts` 에서 사용 중. 이번 branch 는 해당 큐를 `MONITORED_QUEUES` 에 추가한 것.
- **상세**: 큐 이름 충돌 없음. `CAFE24_REFRESH_QUEUE` 와 별개 이름이며, `system-status.e2e-spec.ts` `EXPECTED_QUEUE_NAMES` 목록에도 `'makeshop-token-refresh'` 가 이미 추가됨.
- **제안**: 없음.

---

## 요약

이번 branch 가 도입하는 신규 식별자 — `isRefreshCapable` (함수), `token_expired` (status_reason 슬러그), `unknown_error` (spec 명칭 정정), `MAKESHOP_REFRESH_QUEUE` MONITORED_QUEUES 등록 — 중 실질적 충돌은 없다. 주의할 점은 `token_expired` 슬러그가 기존 JWT 만료 에러 코드 `TOKEN_EXPIRED` 및 계획 중인 WS 이벤트 `auth.token_expired` 와 표기가 유사하다는 점인데, `spec/1-data-model.md` 에 "별개 네임스페이스" 명시가 추가되어 의도가 선언됐다. 부수적으로 `spec/2-navigation/4-integration.md:488` 의 DB 연결 테스트 에러 코드 `unknown` 이 `INTEGRATION_STATUS_REASONS` 의 `unknown_error` 와 미정렬 상태로 잔존하나 이는 이번 branch 의 변경 범위 밖 기존 이슈다.

## 위험도

LOW

STATUS: SUCCESS
