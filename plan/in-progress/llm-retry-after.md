---
worktree: llm-retry-after-a24e5e
started: 2026-05-19
completed: 2026-05-22
owner: developer
---

# LlmService.withRetry — Retry-After 헤더 존중

## 배경

ai-agent-turn-fail-finalize PR (#209) 후속 plan §"본 PR 범위 외" 항목.

`LlmService.withRetry` (`llm.service.ts:289-310`) 는 429 rate-limit 응답을 받았을 때 1s + 2s + 4s 고정 exponential backoff 만 사용한다. LLM provider (Anthropic / OpenAI / Google) 가 표준 RFC 7231 `Retry-After` 헤더를 응답에 포함하면 그 값을 신뢰하는 것이 적절하다 — provider 가 알려준 최소 대기 시간이라 그보다 짧게 재시도하면 같은 429 가 반복된다.

현재 회귀 시나리오 (PR #209 의 finalize 픽스 후에도 잔존):
- LLM 429 → 1s 후 retry → 같은 429 → 2s 후 retry → 같은 429 → 4s 후 retry → 같은 429 → throw → finalizeAiNode FAILED.
- provider 가 `Retry-After: 30` 을 보냈더라도 7s 안에 throw 됨.
- Retry-After 를 신뢰하면 적은 retry 횟수로도 진짜 회복 가능성이 높아짐.

## 변경 범위

### 1) `codebase/backend/src/modules/llm/llm.service.ts`

- [x] `withRetry` 안에 신규 helper `extractRetryAfterMs(err)` 추가 (PR #213, commit 62b170c1):
  - `err.headers['retry-after']` 또는 `err.response.headers['retry-after']` 추출.
  - RFC 7231 정의: delta-seconds (`30`) 또는 HTTP-date (`Mon, 11 Jun 2025 00:00:00 GMT`).
  - 양쪽 모두 ms 로 정규화. 음수/NaN/parse 실패는 null.
- [x] `withRetry` backoff 결정 분기 (PR #213, commit 62b170c1):
  - `retryAfterMs` 가 있으면 `Math.min(retryAfterMs, MAX_BACKOFF_MS)` (상한 60s)
  - 없으면 기존 `Math.pow(2, attempt) * 1000`
- [x] warn 로그에 backoff 출처 (Retry-After / exponential) 명시 (PR #213, commit 62b170c1).

### 2) `codebase/backend/src/modules/llm/llm.service.spec.ts` (또는 신규)

- [x] `extractRetryAfterMs` 단위 테스트 (PR #213, commit 62b170c1 — 9건):
  - `headers['retry-after'] = '30'` → 30_000ms
  - `headers['Retry-After'] = '30'` (대소문자 무관) → 30_000ms
  - `response.headers['retry-after']` → OK
  - HTTP-date 형식 (`new Date(Date.now() + 5_000).toUTCString()`) → ~5_000ms
  - 음수 / 잘못된 string / 누락 → null
- [x] `withRetry` 통합 테스트 (본 PR — `Retry-After header behavior` describe 블록, fake timer + setTimeout spy):
  - 429 + Retry-After=2 → 2_000ms backoff
  - 429 + Retry-After 없음 → 1_000ms exponential fallback
  - 429 + Retry-After=100 (> 60s 상한) → 60_000ms 로 capped

## 결정 사항

- **상한 60s**: Retry-After 가 매우 큰 값일 경우 그 turn 자체가 stuck. 사용자 입장에서 60s 이상 대기 시 차라리 빠르게 실패해 retry 가시화. 60s 는 일반적 rate-limit window (1분) 의 합리적 상한.
- **HTTP-date 지원**: RFC 7231 정의에 따라 지원. Anthropic / OpenAI / Google 모두 delta-seconds 만 보내는 경향이지만 정확성 위해 포함.
- **변경 위치 — 단일 `withRetry`**: provider client 의 catch 단을 수정하지 않고 `withRetry` 안에서 error 객체의 headers 를 살피는 방식. SDK 가 throw 한 raw error 가 그대로 propagate 되어 headers 가 살아있음 (Anthropic / OpenAI SDK 의 `APIError` / `RateLimitError` 클래스가 headers / response 속성을 노출).

## §ISSUE FIX 기록

- **sidebar.tsx `react-hooks/set-state-in-effect` lint 수정** (본 브랜치 포함):
  - TEST WORKFLOW 의 lint 단계가 `useEffect` 내 `setNotifFilter("all")` 호출로 인해 차단됨.
  - §ISSUE FIX 정책에 따라 `closeNotif` / `toggleNotif` useCallback 으로 이전 처리.
  - ai-review SUMMARY W6(toggleNotif updater 순수성), W7(exhaustive-deps) 도 동반 수정.
  - ai-review SUMMARY W1(setTimeout spy toHaveBeenNthCalledWith 강건화) 도 동반 수정.

## 후속 (별도 PR — 본 plan 범위 외)

없음. 본 plan 으로 ai-agent-turn-fail-finalize PR #209 의 후속 4건 모두 처리 완료.
