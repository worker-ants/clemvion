# 동시성(Concurrency) 리뷰 — node-cancellation §4 cascade (Cafe24 / MakeShop)

## 발견사항

- **[WARNING]** 429 backoff sleep / 401 reactive-refresh 대기 구간이 cascade 된 `abortSignal` 을 관측하지 않는다
  - 위치: `codebase/backend/src/nodes/integration/cafe24/cafe24-api.client.ts:1290` (`await this.sleepImpl(sleepMs)`, 429 재시도 백오프), `codebase/backend/src/nodes/integration/cafe24/cafe24-api.client.ts:1339` (`await this.performAuthRefresh(integration)`, 401 reactive refresh — 내부적으로 `refreshViaQueue` 의 `job.waitUntilFinished(events, REFRESH_JOB_WAIT_TIMEOUT_MS)` 또는 DB `pessimistic_write` lock 대기로 이어짐). MakeShop 은 대칭 구조: `codebase/backend/src/nodes/integration/makeshop/makeshop-api.client.ts:908`(sleep), `:939`(`performAuthRefresh`).
  - 상세: 이번 diff 가 추가한 cascade 는 `executeWithRateLimit`/`executeWithRetry` 진입 시점에만 `upstream.aborted` 를 검사하고(이미 aborted 면 즉시 `controller.abort()`), 개별 `fetchImpl` 호출의 `controller.signal` 에 리스너를 건다. 하지만 429 status 를 받은 뒤의 `sleepImpl(sleepMs)` (재귀 재시도 전 대기, 서버가 내려준 `callRemain`/`timeRemain` 초 기반이라 상한이 클라이언트 쪽에 없음)와 401 self-recovery 의 `performAuthRefresh` 내부 대기(BullMQ `waitUntilFinished` 또는 DB row lock)는 어떤 abort 신호도 참조하지 않는 plain `setTimeout` 기반(`defaultSleep`) 이거나 signal 을 전혀 받지 않는 경로다. 즉 execution 이 이 두 대기 구간 도중 취소되더라도, 코드는 대기를 끝까지 마친 뒤 **다음 재귀 호출이 시작될 때에야** `upstream.aborted` 를 확인해 즉시 abort 한다 — 이 PR 의 주석/문서(§4)가 명시한 "cancelled execution 이 `timeoutMs` 를 기다리지 않고 in-flight 호출을 즉시 멈춘다"는 보장이 이 두 구간에는 적용되지 않는다. `MAX_RATE_LIMIT_RETRIES=2` 로 재시도 횟수는 제한되지만 개별 sleep 길이는 서버 응답값에 좌우되어 수 초~수십 초까지 늘어날 수 있다.
  - 제안: (a) 최소한 sleep 을 signal-aware 로 바꾸거나(`Promise.race([sleep, abortPromise])`), (b) 범위 밖으로 명시적으로 문서화(plan 의 "best-effort" 각주에 이 두 구간을 구체적으로 추가) 중 하나를 택할 것. 현재 RESOLUTION.md/plan 문서는 in-flight fetch 자체의 cascade 만 다루고 이 gap 은 언급이 없다.

- **[INFO]** per-integration in-process mutex(`withIntegrationLock`)가 cascade 의 응답성을 우회할 수 있는 경로
  - 위치: `codebase/backend/src/nodes/integration/cafe24/cafe24-api.client.ts:251-269`(`withIntegrationLock`), 호출부 `:321`; MakeShop 대칭 `codebase/backend/src/nodes/integration/makeshop/makeshop-api.client.ts:226`대.
  - 상세: 같은 `integration.id` 에 대한 호출은 프로세스 전역 `Map<string, Promise>` 체인으로 직렬화된다(사전 존재하는 인프라, 이번 diff 의 변경 대상 아님). 취소된 호출 B 가, 같은 integration 에 대해 **먼저 큐에 들어간, 취소되지 않은** 다른 실행의 호출 A 뒤에서 대기 중이라면 — B 의 task 본문(그리고 그 안의 `upstream.aborted` 체크·리스너 등록)은 A 가 끝날 때까지 아예 시작되지 않는다. A 가 자신의 `timeoutMs`(기본 30s)를 다 채우고 나서야 B 가 실행되어 즉시 abort 된다. 같은 execution 안의 두 fetch 가 같은 `abortSignal` 을 공유하는 경우(ParallelExecutor 형제 브랜치)는 A 도 함께 취소되어 문제가 작지만, **서로 다른 execution 이 같은 integration 을 동시에 호출**하는 경우 B 의 취소 반영 지연은 A 의 잔여 실행 시간에 좌우된다.
  - 제안: 신규 결함은 아니므로 이번 PR 의 차단 사유는 아니지만, "cancelled execution 이 즉시 멈춘다"는 §4 계약을 완전하게 만들려면 후속 항목으로 인지해 둘 가치가 있다.

- **[INFO]** `upstream.aborted` 기반 취소/타임아웃 분류는 인과관계가 아닌 상태 스냅샷에 의존
  - 위치: `codebase/backend/src/nodes/integration/cafe24/cafe24-api.client.ts:1244-1252`(diff 게이트 라인), MakeShop 대칭 `:875-881`(diff 게이트 라인).
  - 상세: catch 블록은 "이 fetch 를 abort 시킨 게 로컬 timeout 인지 upstream cascade 인지"를 실제로 추적하지 않고, catch 시점에 `upstream.aborted` 가 true 인지만 본다. 로컬 `timeoutMs` 만료로 `controller.abort()` 가 먼저 발생한 극히 좁은 시간창 안에서 **완전히 무관한 이유로** execution 전체가 별도로 취소되면(예: 다른 형제 브랜치 실패로 인한 ParallelExecutor cancel), 이 fetch 는 원래 진짜 timeout 이었음에도 `recordNetworkFailure` 를 건너뛰고 재throw 된다 — 어차피 execution 이 취소되는 흐름이라 사용자 관측 결과는 동일하지만, `consecutiveNetworkFailures` 라는 **영속·공유 카운터**가 미세하게 과소 집계될 수 있다.
  - 제안: 발생 확률이 극히 낮고(동일 tick 내 두 독립 abort 소스 충돌) 실제 피해도 경미해 즉시 조치가 필요하진 않으나, 리뷰 이력에 기록해 두면 향후 유사 패턴(예: `spec-update-node-cancellation-shutdown-classification.md` 가 다루는 "같은 row 를 두고 두 메커니즘이 경합" 클래스)과 함께 재검토할 수 있다.

## 참고 — 이미 해결된 항목 (직전 리뷰 라운드, RESOLUTION.md 확인)

이 diff 는 `review/code/2026/07/25/21_02_33` 에서 지적된 세 가지 실제 동시성/정확성 결함(취소가 `cancelled` 로 분류되지 않음, 취소가 `recordNetworkFailure` 를 오발동시킴, 성공 경로에서 리스너가 해제되지 않아 `executeWithRetry` 재귀마다 리스너가 누적되던 문제)을 이미 수정 완료한 상태다. 현재 코드는 `finally` 블록에서 항상 `clearTimeout`+`removeEventListener` 를 수행하고, `upstream?.aborted` 로 로컬 timeout 과 cascaded cancel 을 구분하며, `{ once: true }` 로 리스너 중복 실행을 막고 있어 이 세 축은 재발하지 않았음을 코드로 확인했다.

## 요약

Cafe24/MakeShop API 클라이언트에 `context.abortSignal` 을 per-call `AbortController` 로 cascade 하는 이번 변경은, 직전 리뷰 라운드에서 지적된 취소 오분류·네트워크 실패 카운터 오발동·리스너 누수 세 결함을 정확히 고쳤고 `finally` 기반 정리·`once: true`·already-aborted 분기가 모두 견고하다. 다만 cascade 의 적용 범위가 개별 `fetchImpl` 호출로 한정되어, 429 재시도 백오프 sleep 과 401 reactive-refresh 대기(BullMQ/DB lock) 구간은 signal 을 전혀 참조하지 않아 그 구간 동안은 취소가 즉시 반영되지 않는다 — "cancelled execution 이 timeoutMs 를 기다리지 않는다"는 이 기능의 목표가 fetch 구간에는 충족되지만 재시도/리프레시 대기 구간에는 부분적으로만 충족된다. 하드 데드락·스레드 안전성 문제나 신규 경쟁 조건은 발견되지 않았다.

## 위험도

MEDIUM
