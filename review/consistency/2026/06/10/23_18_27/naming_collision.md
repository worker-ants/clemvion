# 신규 식별자 충돌 검토 결과

검토 모드: 구현 착수 전 (--impl-prep, scope=spec/2-navigation/)
Target: `spec/2-navigation/` 영역 + plan `integration-expiry-fixes.md` 의 V-01/V-07/V-15 fix 묶음

---

## 발견사항

### 1. **[WARNING]** `token_expired` — IntegrationStatusReason vs TOKEN_EXPIRED(auth) 명명 충돌 가능성

- **target 신규 식별자**: `token_expired` — V-07 fix 의 일환으로 `INTEGRATION_STATUS_REASONS` union 에 추가 예정 (`integration-status-reason.ts`). `expired` status 의 사유 코드로 "refresh_token 없는 provider 의 token_expires_at 만료" 를 의미.
- **기존 사용처**:
  - `spec/5-system/3-error-handling.md` 에 `TOKEN_EXPIRED` 가 "Access Token 만료" 의 REST 에러 코드로 정의됨 (401 응답 코드).
  - `spec/5-system/6-websocket-protocol.md §4.5` 에 `auth.token_expired` 가 WS 이벤트 이름으로 등장 (미구현/Planned 상태).
  - `codebase/backend/src/modules/auth/auth.service.ts:567` 에서 `code: 'TOKEN_EXPIRED'` 로 실제 사용.
- **상세**: 세 식별자는 별개 네임스페이스(Integration.statusReason DB 값 vs HTTP 에러 코드 vs WS 이벤트)에 속해 런타임 충돌은 없다. 그러나 동일한 의미("토큰 만료")를 세 표기(`token_expired` / `TOKEN_EXPIRED` / `auth.token_expired`)로 나누어 쓰므로, 향후 코드 검색·문서 참조 시 연결이 끊길 수 있다. `spec/1-data-model.md §2.10 status_reason` 열의 서술이 세 표기 간 관계를 명시적으로 구분하고 있지 않다.
- **제안**: `INTEGRATION_STATUS_REASONS` 에 `token_expired` 를 추가할 때 spec/1-data-model.md §2.10 의 status_reason 주석에 "이 값은 Integration.status_reason DB 저장 전용이며, JWT Access Token 만료 에러 코드 `TOKEN_EXPIRED`(REST) · `auth.token_expired`(WS, 미구현) 와 문자열이 유사하나 별개 네임스페이스"임을 한 줄 명기. 혼동 방지에 충분.

---

### 2. **[WARNING]** `data-flow/5-integration.md` 에 `token_expired` 가 "폐기됨" 으로 명기되어 있어 spec 정합 선행 갱신 필요

- **target 신규 식별자**: `token_expired` (INTEGRATION_STATUS_REASONS 추가 + 스캐너 0d 격하 시 `statusReason = 'token_expired'` 설정)
- **기존 사용처**: `/Volumes/project/private/clemvion/spec/data-flow/5-integration.md:438-441` —
  > "refresh_token 없는 provider 는 `status_reason='token_expired'` 로 격하" — **폐기**. `token_expired` 문자열은 백엔드 어디에도 없고 `INTEGRATION_STATUS_REASONS` union 에도 없다.
- **상세**: 현재 data-flow spec 은 `token_expired` 를 명시적으로 "폐기됨 + 미구현" 으로 선언하고 있다. V-07 fix 가 이 값을 새로 구현하면, data-flow 문서의 "폐기" 선언이 틀린 서술로 남는다. 이미 plan 체크리스트에 "spec 정합" 항목이 있으나, data-flow/5-integration.md §2026-06 재작성 폐기 섹션이 명시적으로 수정되지 않으면 이 문서를 독립적으로 읽는 독자에게 구현 상태를 오도한다.
- **제안**: 구현 전 또는 동시에 `spec/data-flow/5-integration.md` 의 438-442 라인("`token_expired` ... 폐기" 서술)을 삭제 또는 "V-07 fix 로 구현 완료" 로 교체. plan 체크리스트의 "spec 정합" 에 data-flow/5-integration.md 를 명시적으로 추가.

---

### 3. **[WARNING]** `isCafe24RefreshCapable` → `isRefreshCapable` 함수 이름 변경 — data-flow spec 참조 연동 갱신 필요

- **target 신규 식별자**: `isRefreshCapable` (V-01 fix: `isCafe24RefreshCapable` 의 일반화 대체 함수명)
- **기존 사용처**:
  - `/Volumes/project/private/clemvion/spec/data-flow/5-integration.md:251` — "`isCafe24RefreshCapable` (= `service_type='cafe24'` AND `credentials.refresh_token` 존재)"
  - `/Volumes/project/private/clemvion/spec/data-flow/5-integration.md:256` — "스캐너의 refresh-capable 판별은 cafe24 한정 (`isCafe24RefreshCapable` 이 `serviceType !== 'cafe24'` 면 무조건 false)"
  - `/Volumes/project/private/clemvion/spec/data-flow/5-integration.md:434` — "(스캐너의 refresh-capable 판별은 `isCafe24RefreshCapable` 로 cafe24 한정, 'makeshop' 분기 부재)"
- **상세**: data-flow 문서 3 곳에서 `isCafe24RefreshCapable` 를 코드 내부 함수명으로 직접 인용하고 있다. V-01 fix 로 해당 함수가 `isRefreshCapable` 로 바뀌면 인용이 stale 해진다. 기능 변화("cafe24 전용" → "cafe24+makeshop+refresh_token 보유 일반화")도 문서 서술과 달라져 교차 독자에게 혼선을 줄 수 있다.
- **제안**: V-01 fix 구현과 함께 data-flow/5-integration.md 의 해당 3 라인에서 `isCafe24RefreshCapable` 를 `isRefreshCapable` 로 교체하고, "cafe24 한정" 주석을 "cafe24·makeshop + credentials.refresh_token 보유 일반화" 로 갱신. plan 체크리스트에 이 갱신을 추가.

---

### 4. **[INFO]** `MAKESHOP_REFRESH_QUEUE` — 상수 자체는 이미 존재, MONITORED_QUEUES 등록만 누락

- **target 신규 식별자**: V-15 fix — `MONITORED_QUEUES` 에 `MAKESHOP_REFRESH_QUEUE` 항목 추가
- **기존 사용처**: `codebase/backend/src/modules/integrations/makeshop-token-refresh.constants.ts:20` — `export const MAKESHOP_REFRESH_QUEUE = 'makeshop-token-refresh'` 이미 존재. `codebase/backend/src/nodes/integration/makeshop/` 전반에서 사용 중.
- **상세**: 식별자 자체는 기존 코드에 이미 정의되어 있으며 충돌 없음. `MONITORED_QUEUES` 등록만 누락된 상태로, V-15 fix 는 신규 식별자 도입이 아니라 기존 상수를 레지스트리에 추가하는 단순 보완이다. 이름 충돌 위험은 없다.
- **제안**: 없음. 단순 누락 보완이며 충돌 불발.

---

### 5. **[INFO]** `unknown` vs `unknown_error` status_reason — spec/data-model 과 코드 간 경미한 표기 불일치

- **target 신규 식별자**: V-07 fix 는 `INTEGRATION_STATUS_REASONS` union 에 `token_expired` 를 추가. union 의 미분류 fallback 항목은 `unknown_error`.
- **기존 사용처**: `spec/1-data-model.md §2.10` status_reason 열 서술에 `error` → `unknown` 이라고 적혀 있는 반면, 코드의 `INTEGRATION_STATUS_REASONS` 배열에는 `'unknown_error'` 가 존재(`integration-status-reason.ts:34`).
- **상세**: spec 본문의 `unknown` 과 코드의 `unknown_error` 는 같은 의미를 가리키지만 문자열 값이 다르다. V-07 fix 범위 밖이지만, `token_expired` 추가와 함께 spec 정합 작업이 일어날 때 이 경미한 오기를 같이 수정하면 좋다.
- **제안**: spec/1-data-model.md §2.10 status_reason 열의 `unknown` 표기를 `unknown_error` 로 교정.

---

## 요약

V-01/V-07/V-15 fix 묶음이 도입하는 신규 식별자 중 런타임 충돌은 없다. 주요 위험은 **문서 정합성**에 있다: `token_expired` 는 data-flow/5-integration.md 에서 명시적으로 "폐기·미구현" 으로 선언되어 있어 구현 시 이 서술이 틀린 상태로 남으며(WARNING), `isCafe24RefreshCapable` → `isRefreshCapable` 전환도 같은 문서 3곳에서 stale 인용을 발생시킨다(WARNING). `MAKESHOP_REFRESH_QUEUE` 는 이미 정의된 상수를 레지스트리에 추가하는 것이어서 충돌 없음. `token_expired` 가 auth 에러 코드 `TOKEN_EXPIRED` 및 WS 이벤트 `auth.token_expired` 와 유사 표기로 보이는 점은 별개 네임스페이스이므로 경미한 혼동 위험(WARNING)으로 분류하며 spec 한 줄 주석으로 충분히 완화 가능하다.

## 위험도

MEDIUM
