### 발견사항

- **[INFO]** `handleSubscribe` 의 tentative-add + 사후 검증(TOCTOU 가드)이 올바르게 원자적
  - 위치: `codebase/backend/src/modules/websocket/websocket.gateway.ts:1532-1567` (`isNewSubscription` 재확인 → `clientSubs.add(channel)` → `size > MAX` 사후 롤백)
  - 상세: `authorizer.authorize()` 의 `await` 이후 재개되는 시점과 `clientSubs.add(channel)` 사이에는 동기 코드만 있어(Node 싱글 스레드 이벤트 루프) 두 concurrent `handleSubscribe` 호출이 이 구간에서 교차 실행될 수 없다. 첨부된 스펙 테스트(`websocket.gateway.spec.ts:678-721`, "enforces MAX_SUBSCRIPTIONS across concurrent subscribe with deferred authorize")가 이 불변식을 정확히 검증한다 — `await` 경계에서 두 handler 가 동시에 pending 상태가 되어도 재개 시 각각 `Set.add` 직전 재검사를 수행하므로 20 한도를 초과하지 않는다. 설계·구현·테스트가 일치한다.
  - 제안: 없음(정상).

- **[INFO]** `join()` await + 실패 시 tentative-add 롤백 — 상태 정합성 확보
  - 위치: `websocket.gateway.ts:1568-1585` (`handleSubscribe`), `websocket.gateway.spec.ts:318-333`
  - 상세: 기존에는 `void client.join(channel)` 로 fire-and-forget 하여, `clientSubs`(in-memory 구독 상태)와 실제 socket.io room 멤버십이 어긋날 가능성이 있었다(join 실패해도 성공 ack). 현재 변경은 `await client.join(channel)` 후 실패 시 `clientSubs.delete(channel)` 롤백 + `success:false` ack 로 두 상태를 재동기화한다. in-memory adapter 에서는 `join` 이 사실상 동기라 현재는 영향이 작지만, Redis adapter 도입 시 실질적으로 유효해지는 방어적 수정이다. 커밋 주석이 이 트레이드오프(현재 무해, 향후 유효)를 명확히 문서화하고 있다.
  - 제안: 없음(정상). 다만 Redis adapter 도입 시점에 이 경로가 실제로 동작하는지 e2e/통합 테스트로 재확인 권장(현재는 in-memory adapter 특성상 join reject 시나리오가 mock 을 통해서만 검증됨).

- **[INFO]** `handleUnsubscribe` 를 async 로 전환 + `client.leave()` await, 단 실패해도 성공 ack 유지
  - 위치: `websocket.gateway.ts:1640-1668`
  - 상세: `clientSubs.delete(channel)` 을 먼저 수행한 뒤 `leave()` 를 await 하되 실패해도 warn 만 하고 `success:true` 로 응답한다. in-memory 상태(`clientSubs`)와 room 멤버십이 leave 실패 시 일시적으로 어긋날 수 있으나(구독 안 한다고 응답했지만 room 에는 남아있을 수도), unsubscribe 의 의미상 이후 `broadcastToChannel` 은 `clientSubs` 기반이 아니라 socket.io room 기반이라는 점을 고려하면 이 어긋남이 이벤트 오수신으로 이어질 수 있다(client 는 unsubscribed 로 알지만 서버 room 엔 남아 이벤트를 계속 받을 가능성). 다만 코드 주석이 "멤버십은 disconnect 시 정리" 라고 명시하며 의도적 trade-off 로 보인다.
  - 제안: 낮은 우선순위 — leave 실패가 실제로 얼마나 발생 가능한지(in-memory adapter 에서는 사실상 발생 안 함) 고려하면 현재 수준으로 충분. 다만 다음 subscribe 시도에서 `isNewSubscription` 판정이 `clientSubs.has(channel)` 기준이라 leave 실패로 room 에 잔류한 상태에서 재구독하면 snapshot 재발행이 스킵되지 않고 정상 발행되므로(코드상 `clientSubs`가 이미 delete 되었으므로) 실질적 위험은 낮다.

- **[INFO]** 프론트엔드 WS 이벤트 리스너 이중 등록 방어 (`bind` off-before-on 패턴)
  - 위치: `codebase/frontend/src/lib/websocket/use-execution-events.ts:2579-2645` (payload diff 상 라인, 실제 파일 라인은 상이)
  - 상세: React 18/19 StrictMode 이중 mount 나 effect 재실행 시 동일 핸들러가 중복 등록되는 것을 `client.off(event, handler); client.on(event, handler);` 로 방지한다. 핸들러가 `useCallback` 으로 stable ref 를 유지하므로 off 가 정확히 같은 참조를 제거해 멱등성이 보장된다. 테스트(`use-execution-events.test.ts:2232-2249`, `2286-2308`)가 off/on 호출 쌍과 cleanup 시 이중 off 횟수(`connectOffCalls.length === 4`, dedup-off 1 + cleanup-off 1 각 핸들러당)를 정확히 검증한다.
  - 제안: 없음(정상). 리스너 누수·중복 이벤트 처리(예: `execution.node.completed` 중복 dispatch 로 인한 store 이중 갱신) 방지에 효과적인 패턴.

- **[INFO]** `dismissTimer` hysteresis — 지연된 setState 의 effect cleanup 관리 정상
  - 위치: `use-execution-events.ts` (payload diff 라인 2654-2661, `snapshotReceived` effect)
  - 상세: snapshot 수신 시 즉시 dismiss 하지 않고 1초 지연 후 dismiss 하도록 변경. `setTimeout` 을 effect 내부에서 생성하고 `return () => clearTimeout(dismissTimer)` 로 cleanup 함수를 반환해, effect 재실행(예: `snapshotReceived` 가 다시 false 로 바뀌는 reconnect flap) 시 이전 타이머가 확실히 취소된다. React effect cleanup 패턴을 올바르게 따르고 있어 stale timer 로 인한 잘못된 dismiss 호출(레이스)이 발생하지 않는다.
  - 제안: 없음(정상).

- **[INFO]** `ws-client.ts` connect() pending 가드 — `active` 플래그로 재진입 시 churn 방지
  - 위치: `codebase/frontend/src/lib/websocket/ws-client.ts:1441-1449`
  - 상세: 기존에는 `socket?.connected` 만 확인해 연결 진행 중(handshake 대기)에 `connect()` 가 재호출되면 기존 소켓을 disconnect 하고 새로 생성하는 churn 이 발생했다. `socket.active`(연결 시도·reconnect 대기 포함)를 추가로 확인해 진행 중인 연결 시도를 보존한다. 이 모듈은 단일 모듈-스코프 `let socket` 변수를 사용하는 클로저 기반 싱글턴으로, JS 이벤트 루프의 단일 스레드 특성상 `connect()` 함수 호출 자체는 원자적이다(동기 코드 블록 — 중간에 await 없음). React StrictMode 의 effect 이중 실행이나 여러 컴포넌트에서의 동시 `connect()` 호출 시나리오에서 유효한 방어.
  - 제안: 없음(정상).

- **[INFO]** `getWsClient()` 싱글턴의 스레드 안전성 — Node/브라우저 단일 스레드 전제하에 문제 없음
  - 위치: `ws-client.ts:3569-3574`
  - 상세: `singletonInstance` 는 모듈 레벨 mutable 변수로, `if (!singletonInstance) { singletonInstance = createWsClient(); }` 는 lazy 초기화의 고전적인 non-atomic 패턴(TOCTOU)이지만, JS 는 단일 스레드이며 이 블록에 `await` 가 없으므로 실제 경쟁 조건은 발생하지 않는다. 리뷰 대상 범위 밖(기존 코드, 변경 없음)이나 참고로 명시.
  - 제안: 없음.

### 요약

이번 변경 세트는 "06 concurrency" 리팩터 배치로, WS 구독 파이프라인의 TOCTOU 레이스(구독 한도 초과), `join`/`leave` 의 fire-and-forget 을 await + 롤백으로 전환, 프론트엔드 이벤트 리스너 이중 등록 방지, 소켓 재연결 churn 방지 등 동시성 이슈를 정면으로 다루고 있다. 각 변경은 Node.js/브라우저의 단일 스레드 이벤트 루프 특성(동기 구간에서 인터리빙 불가)을 정확히 활용해 "await 경계 이후 tentative-add + 사후 재검증" 이라는 검증된 패턴으로 원자성을 확보했으며, 특히 concurrent subscribe 레이스를 재현하는 deferred-promise 테스트(`enforces MAX_SUBSCRIPTIONS across concurrent subscribe with deferred authorize`)가 회귀 가드로 잘 작성되어 있다. `handleUnsubscribe` 의 leave-await-but-ack-success 는 의도된 best-effort trade-off 로 문서화되어 있고 실질적 위험은 낮다. 전반적으로 설계 의도, 구현, 테스트가 모두 일치하며 심각한 결함은 발견되지 않았다.

### 위험도

NONE
