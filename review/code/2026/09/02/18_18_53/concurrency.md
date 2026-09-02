# 동시성(Concurrency) 리뷰 — WS 토큰 만료 소켓 수명 종속 (`auth.token_expired`), 2R

## 검증: 1R CRITICAL #1 은 해소되었다

이전 라운드(`review/code/2026/09/02/17_38_12/concurrency.md`)의 CRITICAL — `refreshAndReconnect` 가
이미 연결된 소켓에서 `socket.connect()` 만 호출해 socket.io-client 의 `if (this.connected) return this;`
no-op 가드에 막혀 "정상 경로"(사전 통지 기반 무중단 전환)가 사실상 항상 실패하던 문제 — 는 이번 라운드에서
`codebase/frontend/src/lib/websocket/ws-client.ts:66` (`if (socket.connected) socket.disconnect();` 를
`socket.connect()` 앞에 추가)로 고쳐졌다. 회귀 테스트
(`codebase/frontend/src/lib/websocket/__tests__/ws-client.test.ts:164-171`)가 `mockSocket.connected = true`
로 세팅한 뒤 `disconnect.mock.invocationCallOrder[0] < connect.mock.invocationCallOrder[0]` 순서까지
단언해 vacuous 재발을 막는다. 소스를 직접 열어 확인했고 새 CRITICAL/WARNING 급 결함은 찾지 못했다 —
아래는 구조적 견고성 관점의 INFO 3건이다.

## 발견사항

- **[INFO]** backend `expiryTimers` Map 이 동일 `client.id` 재사용 시 이전 타이머 참조를 방어 없이 덮어쓴다
  - 위치: `codebase/backend/src/modules/websocket/websocket.gateway.ts:209` (`this.expiryTimers.set(client.id, timers);`, `armExpiryTimers` 끝)
  - 상세: `armExpiryTimers` 는 진입 시 `this.expiryTimers.get(client.id)` 를 확인하지 않고 무조건 새 `timers` 객체로 덮어쓴다. 현재 `handleConnection`(`websocket.gateway.ts:212`)은 Socket.IO 가 매 연결마다 새 `client.id` 를 발급하는 정상 경로에서만 호출되므로 동일 id 로 두 번 arm 되는 경로는 지금 도달 불가능하다(1R 리뷰에서도 동일하게 확인된 상태이며 이번 diff 에서도 방어 코드가 추가되지 않았다). 다만 향후 `connectionStateRecovery` 를 켜거나 재인증 흐름에서 같은 소켓에 `handleConnection` 이 재호출되는 경로가 생기면, 이전 `notice`/`cutoff` `NodeJS.Timeout` 참조가 `clearTimeout` 없이 유실돼 타이머 누수 + 이미 재사용된 소켓에 지연 emit/disconnect 가 걸릴 수 있다.
  - 제안: `armExpiryTimers` 진입부에 `handleDisconnect` 와 동일한 clear-then-set 로직을 선제 적용하면(`const prev = this.expiryTimers.get(client.id); if (prev) { clearTimeout(prev.notice); clearTimeout(prev.cutoff); }`) 재진입 경로가 생겨도 안전하다. 우선순위는 낮음(현재 도달 불가).

- **[INFO]** frontend `refreshAndReconnect` 가 클로저 공유 변수 `socket` 을 세대(generation) 구분 없이 참조한다 — in-flight 상태에서 외부 재연결이 끼어들면 stale 리프레시 결과가 새 소켓을 오염시킬 수 있는 구조
  - 위치: `codebase/frontend/src/lib/websocket/ws-client.ts:20`(`let socket: Socket | null = null;`), `:52-71`(`refreshAndReconnect`), `:22-34`(공개 `connect`), `:117-122`(공개 `disconnect`)
  - 상세: `refreshAndReconnect` 는 `await refreshAccessToken()` 동안 양보(yield)한 뒤 재개 시점의 **현재** `socket` 값을 그대로 읽어 `(socket.auth as {token:string}).token = newToken` 후 `disconnect()`/`connect()` 를 건다(`:55-67`). 이 await 구간에 공개 API `disconnect()`(`:117-122`, `socket = null`)가 호출되면 `if (!newToken || !socket) return;` 가 안전하게 걸러 준다 — 문제는 그 **뒤에** 같은 인스턴스에서 공개 `connect(newToken2)`(`:22-34`)가 다시 호출돼 `socket = io(...)` 로 **완전히 새 소켓**이 만들어지는 경우다. 이때 대기 중이던 옛 `refreshAndReconnect` 가 재개되면 `socket` 이 더 이상 null 이 아니므로 조기 반환하지 않고, **옛 갱신 사이클에서 받은 토큰**으로 방금 만들어진 새 소켓의 `auth.token` 을 덮어쓰고 필요 시 그 새 소켓을 즉시 `disconnect()`/`connect()` 시킨다 — 막 맺어진 새 연결이 원인 불명의 churn 을 겪는다. 현재 애플리케이션 호출부(`use-execution-events.ts`, `use-background-run.ts`, `use-kb-events.ts`, `workflow-editor.tsx`)는 모두 같은 싱글턴(`getWsClient()`)에 대해 `connect()` 만 호출하고 `disconnect()`/`resetWsClient()` 를 이어 호출하는 경로가 없으며, `connect()` 자체도 `if (socket && (socket.connected || socket.active)) return;`(`:28`) 가드 때문에 기존 소켓이 살아있는 한(무한 재연결 옵션) 새 `io()` 인스턴스를 만들지 않는다 — 그래서 지금은 도달 불가능하다.
  - 제안: 방어적으로 `refreshAndReconnect` 시작 시점에 처리 대상 소켓 참조(또는 세대 카운터)를 로컬 변수로 캡처해 두고, await 재개 후 `socket !== capturedSocket` 이면 조기 반환하도록 하면 향후 `resetWsClient`/재로그인 흐름이 추가돼도 안전하다. 지금 당장 병합을 막을 사안은 아님.

- **[INFO]** lead time 을 초과하는 느린 `refreshAccessToken()` 하에서 사전 통지 경로와 fallback 경로의 `refreshAndReconnect` 가 겹쳐 실행될 수 있다 — 관측된 오동작은 없으나 안전성이 서드파티(socket.io-client Manager) 내부 가드에 의존한다
  - 위치: `codebase/frontend/src/lib/websocket/ws-client.ts:104-106`(`auth.token_expired` 핸들러) · `:111-114`(`disconnect` fallback 핸들러) · `:52-71`(공유 `refreshAndReconnect`)
  - 상세: 정상적으로는 통지(`exp - 60s`)와 강제 종료(`exp`) 사이에 최소 수십 초의 간격이 있어(백엔드 `websocket.gateway.ts:187-190,201-207`) 두 트리거가 겹치지 않는다. 그런데 `refreshAccessToken()` REST 호출이 그 창보다 오래 걸리면(네트워크 지연), 통지-트리거 `refreshAndReconnect` 가 여전히 `await` 중인 상태에서 서버가 실제로 `client.disconnect()` 하고, 프론트 `disconnect` 핸들러가 fallback 을 통해 두 번째 `refreshAndReconnect` 를 동시에 시작할 수 있다. `refreshAccessToken()` 자체는 `codebase/frontend/src/lib/api/client.ts:65-91` 의 `refreshPromise` 싱글턴이 동시 호출을 dedup 하므로 REST 이중 호출은 없고, 두 continuation 이 이어서 `disconnect()`/`connect()` 를 부르더라도 socket.io-client Manager 의 `open()` 이 `readyState` 가 이미 `"opening"`/`"open"` 이면 no-op 하는 가드(실측: `node_modules/.pnpm/socket.io-client@4.8.3/.../manager.js:139-143`)가 이중 연결 시도를 흡수해 실제 결함으로 이어지지는 않는다. 다만 이 안전성이 이 코드가 명시적으로 표현하는 계약이 아니라 서드파티 라이브러리의 구현 세부에 의존하고 있다는 점은 향후 라이브러리 버전업 시 조용히 깨질 수 있는 잠재 취약점이다.
  - 제안: 지금 당장 수정할 필요는 없으나, 세 트리거를 관통하는 명시적 in-flight 가드(예: `connect_error` 의 `refreshAttempted` 와 유사한 공유 플래그)를 두면 이 안전성이 서드파티 내부 구현이 아니라 이 코드 자체의 계약이 된다.

## 요약

이전 라운드에서 발견된 concurrency CRITICAL(사전 통지 경로가 `connect()` no-op 가드에 막혀 구조적으로 동작하지
않던 문제)은 `disconnect()` → `connect()` 순서로 명시적 재핸드셰이크를 강제하는 수정으로 해소되었고, 회귀
테스트가 `connected=true` fixture 와 호출 순서 단언으로 재발을 막는다. backend 의 소켓별 타이머 arm/disarm
(`handleConnection`/`handleDisconnect` 쌍)은 Node 단일 스레드 이벤트 루프 안에서 동기적으로 완결돼 TOCTOU
경합이 없고, `handleDisconnect` 가 notice·cutoff 두 타이머를 항상 함께 해제해 소켓당 누수도 없다. 새로 찾은
항목은 전부 **현재 도달 불가능한 경로**에 대한 구조적 INFO 로, backend Map 무조건 덮어쓰기(재진입 미방어),
frontend 클로저 공유 `socket` 변수의 세대 구분 부재, 그리고 극단적으로 느린 refresh 시 두 트리거가 겹칠 때
안전성이 서드파티 Manager 가드에 암묵 의존하는 점이다. 병합을 막을 결함은 없다.

## 위험도

LOW
