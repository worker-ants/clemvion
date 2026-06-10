# 신규 식별자 충돌 검토

검토 모드: 구현 완료 후 검토 (--impl-done, scope=spec/2-navigation/ 외 코드·데이터플로 spec)
diff-base: origin/main

---

## 발견사항

### [INFO] `token_expired` — Integration.status_reason 신규 슬러그 vs JWT/WebSocket 기존 어휘 유사

- **target 신규 식별자**: `'token_expired'` — `INTEGRATION_STATUS_REASONS` union 에 추가된 `Integration.status_reason` DB 슬러그 (`integration-status-reason.ts` line 18). `connected-expiry` 0d 격하 시 `refresh_token` 없는 provider 의 사유로 기록된다.
- **기존 사용처**:
  - `spec/5-system/3-error-handling.md` line 35: `TOKEN_EXPIRED` — REST API JWT 만료 에러 코드 (401 응답, UPPER_SNAKE_CASE).
  - `spec/5-system/6-websocket-protocol.md` line 739: `auth.token_expired` — (계획·미구현) WebSocket 이벤트 이름.
  - `codebase/backend/src/modules/auth/auth.service.ts` line 567: `code: 'TOKEN_EXPIRED'` — JWT 만료 REST 에러 코드 실제 사용처.
  - `codebase/backend/src/modules/external-interaction/interaction.guard.ts` line 176: `return 'TOKEN_EXPIRED'` — External Interaction API 401 코드.
- **상세**: 세 식별자 모두 "토큰 만료" 라는 동일 도메인 개념을 가리키지만 네임스페이스가 다르다. `token_expired` (lowercase snake_case) 는 `Integration.status_reason` DB 컬럼 전용이고, `TOKEN_EXPIRED` (UPPER_SNAKE_CASE) 는 REST API 에러 코드, `auth.token_expired` 는 WebSocket 이벤트명이다. 의도적 분리이며 target `spec/1-data-model.md` diff 마지막 줄에 "별개 네임스페이스" 명시 주석이 추가되어 있다. 그러나 프론트엔드 코드가 두 값 중 하나를 오인해 조건 분기하는 실수 가능성이 있다.
- **제안**: 현재 명시 주석 수준으로 충분하다. 추가로 `integration-status-reason.ts` 의 `token_expired` 항목 주석에도 "JWT REST 에러 코드 `TOKEN_EXPIRED`·WS 이벤트 `auth.token_expired` 와 별개" 라는 짧은 경고를 두면 코드 리뷰 시 혼동 차단에 도움이 된다.

---

### [INFO] `unknown_error` — 구 `unknown` 슬러그 대체, DB 기존 행·프론트엔드 처리 잔존 가능

- **target 신규 식별자**: `'unknown_error'` — `INTEGRATION_STATUS_REASONS` union 의 미분류 fallback 값. spec diff 에서 `error.code` 정규화 표기를 `unknown` → `unknown_error` 로 변경 (`spec/2-navigation/4-integration.md` line 488 diff).
- **기존 사용처**:
  - `integration-status-reason.ts` 는 이미 이전 커밋에서 `unknown_error` 를 채택하고 있었다 (본 diff 의 변경 대상이 아님). `normalizeStatusReason` 헬퍼가 unknown raw 값을 `unknown_error` 로 정규화한다.
  - `codebase/backend/src/modules/integrations/integrations.service.ts` line 880, 898: `code: params.error.code ?? 'unknown'` — 이는 `Integration.status_reason` 이 아니라 `last_error.code` / `integration_usage_log.error.code` 필드다. `INTEGRATION_STATUS_REASONS` union 밖에 있는 별도 필드라 충돌 없음.
- **상세**: `spec/2-navigation/4-integration.md` line 488 의 DB 연결 테스트 오류 코드 정규화 표기가 `unknown` → `unknown_error` 로 정정됐다. 이는 코드 실제 동작(이미 `normalizeStatusReason` 가 `unknown_error` 를 쓰고 있음)과 spec 을 일치시키는 수정이다. DB 에 `status_reason='unknown'` 으로 이미 기록된 legacy 행이 존재할 수 있으나, `normalizeStatusReason` 의 union 체크가 `'unknown'` 을 `'unknown_error'` 로 변환하므로 API 응답 레벨에서는 노출되지 않는다. 새 값이 구 값의 논리적 대체이므로 별개 의미 충돌은 없다.
- **제안**: 이슈 없음. 단, DB에 잔존하는 `status_reason='unknown'` 행을 정리하는 마이그레이션이 향후 필요할 수 있다(운영 점검 사항).

---

### [INFO] `isRefreshCapable` — 모듈 내부 함수, 기존 `isCafe24RefreshCapable` 완전 대체 확인

- **target 신규 식별자**: `isRefreshCapable` (file-private function, `integration-expiry-scanner.service.ts` line 531).
- **기존 사용처**: `isCafe24RefreshCapable` — 동일 파일에 존재하던 기존 함수. diff 에서 완전히 제거됨.
- **상세**: 함수 범위가 파일 내부(private, exported 아님)라 외부 충돌 없음. `isRefreshCapable` 이라는 이름이 다른 모듈에도 존재하는지 검사한 결과 없음. 옛 함수가 남아있지 않으므로 중복 정의 없음.
- **제안**: 이슈 없음.

---

### [INFO] `MAKESHOP_REFRESH_QUEUE` — `MONITORED_QUEUES` 추가, 기존 큐 이름 중복 여부

- **target 신규 식별자**: `MAKESHOP_REFRESH_QUEUE` 상수를 `MONITORED_QUEUES` 에 추가 (`system-status.constants.ts`).
- **기존 사용처**: `MAKESHOP_REFRESH_QUEUE` 상수는 `codebase/backend/src/modules/integrations/makeshop-token-refresh.constants.ts` 에 기존 정의. 본 diff 는 해당 상수를 import 해 등록만 한다.
- **상세**: `CAFE24_REFRESH_QUEUE` 는 이미 등록되어 있고, `MAKESHOP_REFRESH_QUEUE` 는 별개 큐 이름 상수를 참조한다. 두 상수 값이 동일한 queue 이름 문자열을 갖지 않는지 별도 확인 필요하나, 각 provider 가 독립 큐를 사용하는 것은 `spec/data-flow/5-integration.md` 에서 "cafe24 와 큐를 공유하지 않는다" 로 명시되어 있어 충돌 없음.
- **제안**: 이슈 없음. `system-status.e2e-spec.ts` 의 `EXPECTED_QUEUE_NAMES` 도 동기화됐음을 `system-status.constants.ts` 주석에서 안내하고 있어 관리 누락 위험 낮음.

---

## 요약

이 diff 가 도입하는 신규 식별자는 4종이다 (`token_expired` status_reason 슬러그, `unknown_error` 대체 확정, `isRefreshCapable` 내부 함수, `MAKESHOP_REFRESH_QUEUE` 등록). `token_expired` 는 JWT REST 에러 코드 `TOKEN_EXPIRED` 및 WebSocket 이벤트 `auth.token_expired` 와 표기가 유사하나, 네임스페이스(DB 컬럼 슬러그 vs REST API 에러 코드 vs WS 이벤트명)가 명확히 분리되어 있고 spec diff 에도 명시 주석이 추가됐다. 나머지 식별자는 기존 사용처와 의미 중복이나 충돌이 없다. 전체적으로 식별자 충돌 위험은 낮다.

## 위험도

LOW
