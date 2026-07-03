# 동시성(Concurrency) Review

대상: refactor 06-concurrency 잔여 배치(M-3/M-6/m-3/m-5) — WebSocket gateway `join`/`leave` await+롤백(백엔드), frontend `WsClient.connect()` pending 가드, `useExecutionEvents` 이벤트 리스너 이중 등록 방어(`bind` off-before-on), warning toast dismiss hysteresis. 나머지 파일(plan/review 산출물)은 문서로 동시성 코드 없음.

## 발견사항

- **[INFO]** `handleSubscribe` join await 전환은 안전 — `Socket.join()` 시그니처가 `Promise<void> | void` 라 in-memory(sync) / Redis(async) adapter 양쪽에서 `await` 가 정상 동작
  - 위치: `codebase/backend/src/modules/websocket/websocket.gateway.ts` `handleSubscribe` (join try/catch), `node_modules/socket.io/dist/socket.d.ts:251` (`join(rooms): Promise<void> | void`)
  - 상세: `await client.join(channel)` 은 sync 완결 케이스에서도 `Promise.resolve(undefined)` 로 마이크로태스크 1틱 지연만 추가하고 정상 동작한다. 실패 시 `clientSubs.delete(channel)` 롤백 후 `success:false` ack — tentative-add(먼저 `clientSubs.add`) → join → 실패 시 롤백 순서가 정확해 "구독했다고 응답했으나 실제 room 미가입" 불일치를 막는다. `leave()`도 동일 시그니처.
  - 제안: 없음(양호).

- **[INFO]** `clientSubs`(Set) 원자성 — Node.js 단일 스레드 event loop 특성상 `Set.add`/`Set.delete`/`Set.has` 자체는 synchronous 하여 인터리빙 걱정 없음. 다만 `handleSubscribe` 내 `await authorizer.authorize(...)` 와 `await client.join(...)` 사이에 비동기 갭이 있어, 같은 클라이언트가 동시에 같은 채널을 두 번 구독 요청하면 두 핸출력이 인터리브될 수 있음
  - 위치: `websocket.gateway.ts` `handleSubscribe` (authorize await → 원자 블록 add → join await)
  - 상세: 코드 자체 주석(“원자 블록: authorize() await 이후의 한도 검사와 Set add 를 한 동기 구간 안에 묶는다”)이 이미 이 gap 을 인지하고 있고, `isNewSubscription` 체크 + tentative-add 후 사후 size 검증으로 한도 초과를 방지한다. 동일 채널 중복 구독 요청 경합의 worst case 는 `Set.add`가 멱등이라 두 번째 요청도 `isNewSubscription=false` 로 처리되어 실질 피해 없음(join 이 두 번 호출될 수 있으나 socket.io room join 도 멱등). 새로 발견된 결함 아님, 기존 설계의 연장.
  - 제안: 없음(기존 방어로 충분, 이번 diff 가 새로 도입한 리스크 아님).

- **[INFO]** `handleDisconnect` 의 leave 는 fire-and-forget(`void`) 유지 vs `handleUnsubscribe` 는 awaited try/catch — 비대칭이나 의도적
  - 위치: `websocket.gateway.ts:140-151` (`handleDisconnect`), `websocket.gateway.ts` `handleUnsubscribe`(`await client.leave(channel)` + catch)
  - 상세: `handleDisconnect`는 반환형이 `void`(NestJS 라이프사이클 훅) 이고 socket.io 가 disconnect 시 모든 room 을 auto-leave 하므로 `leave()` 호출 자체가 방어적 redundant 코드다. `await` 해도 이 시점엔 소켓이 이미 끊기는 중이라 실익이 없다는 주석 근거가 타당하다. 두 경로 모두 공유 자원(`this.subscriptions` Map)에 대한 경쟁 조건은 없음 — `handleDisconnect`는 진입 시 `this.subscriptions.delete(client.id)`로 정리, `handleUnsubscribe`는 `clientSubs.delete(channel)`을 leave 호출 이전에 먼저 수행해 leave 실패와 무관하게 구독 상태 일관성을 보장.
  - 제안: 없음. 조치 불요로 확인.

- **[INFO]** frontend `bind()` 헬퍼(off-before-on) — React StrictMode 이중 mount/cleanup 누락 시나리오의 리스너 중복 등록을 정확히 방어
  - 위치: `codebase/frontend/src/lib/websocket/use-execution-events.ts` (`bind` 헬퍼, effect 내 로컬 함수)
  - 상세: `client.off(event, handler); client.on(event, handler);` 시퀀스는 동일 참조 핸들러에 대해서만 동작하며, `handleExecutionStarted` 등은 모두 `useCallback` 안정 참조(또는 effect-scope 상수)라 매 effect 재실행마다 참조가 바뀌지 않는 한 정확히 매칭된다. `WsClient`는 싱글턴(모듈 스코프 `socket` 변수)이라 여러 훅 인스턴스/재마운트가 동일 `EventEmitter`를 공유하는 구조에서, 이 패턴이 없으면 실제로 리스너가 누적되어 이벤트 핸들러가 N중 실행되는 문제가 발생할 수 있었음 — 방어가 유효하다.
  - 제안: 없음. 단, `WsClient` 인터페이스 자체에 멱등 등록을 넣지 않고 소비자(훅)측에 위임한 설계는 향후 다른 소비자가 생기면 반복 구현 필요(이미 architecture reviewer가 지적, 동시성 관점에서는 문제 아님).

- **[INFO]** `dismissTimer`/`warnTimer` — cleanup 을 통한 안전한 타이머 관리, 메모리 누수·stale closure 없음
  - 위치: `use-execution-events.ts` snapshot-received effect (`setTimeout(..., 1000)` + `clearTimeout` cleanup)
  - 상세: `useEffect`의 정석적인 cleanup 패턴을 따른다 — `snapshotReceived`가 재차 `false`로 바뀌어 effect 가 재실행되면 이전 `dismissTimer`가 `clearTimeout`으로 취소되고, `warnTimer`도 동일 패턴. reconnect flap 시나리오(짧은 시간 내 반복 toggling)에서도 각 effect 인스턴스가 자신의 타이머만 책임지므로 경쟁 조건이나 중복 타이머 누적이 없다. `toast.dismiss`가 멱등(라이브러리 계약상 존재하지 않는 id 호출도 안전)이라는 전제하에 안전.
  - 제안: 없음.

- **[INFO]** `ws-client.ts` `connect()` pending 가드 — `socket.connected || socket.active` 확장이 churn 방지에 정확
  - 위치: `codebase/frontend/src/lib/websocket/ws-client.ts` `connect`
  - 상세: 기존 `socket?.connected`만 보는 가드는 "연결 진행 중(handshake pending, reconnect 대기)"을 놓쳐 재호출 시 `socket.disconnect()` + `io()` 재생성이 발생했다. 이는 진행 중이던 handshake 를 취소하고 새 소켓·리스너 세트를 만드는 전형적 "connect churn" 이며, 구독 이벤트 순서 꼬임·listener 누수(이전 소켓 인스턴스에 등록된 핸들러가 GC 안 되고 남을 가능성)로 이어질 수 있었다. `socket.active`(연결 시도 중 + reconnect 대기 포함)를 함께 가드해 이 race window 를 닫았다. 주석에서 토큰 갱신 재연결 경로(`connect_error` 핸들러)와의 상호작용도 명시적으로 분석되어 있어 회귀 리스크가 낮다.
  - 제안: 없음. 단, `socket.active`는 socket.io-client 내부 구현 프로퍼티라 향후 라이브러리 메이저 업그레이드 시 시맨틱 변경 여부를 재확인 권장(동시성 결함이 아닌 유지보수 참고 사항).

- **[INFO]** `handleUnsubscribe`의 `leave()` 실패 best-effort 경로 — 회귀 테스트 존재 확인
  - 위치: `codebase/backend/src/modules/websocket/websocket.gateway.spec.ts` (`'should still ack success when leave() rejects (best-effort)'`)
  - 상세: RESOLUTION.md 기록대로 이번 diff 에 이미 해당 테스트가 포함되어 있음을 소스에서 직접 확인(`leave.mockRejectedValueOnce` → `success:true` + 구독 Set 정리 단언). 이전 라운드에서 testing reviewer 가 지적한 WARNING 은 이미 해소된 상태로 diff 에 반영됨.
  - 제안: 없음(이미 조치됨).

## 요약

이번 변경은 WebSocket 구독/연결 경로의 4개 독립적 race 취약점(서버측 join 실패 시 tentative-subscription 과 실제 room 멤버십 불일치, 클라이언트 재연결 churn, React 훅 이벤트 리스너 중복 등록, snapshot flap 으로 인한 toast 깜빡임)을 각 계층 경계 내에서 정교하게 보강했다. `Socket.join`/`leave`의 `Promise<void> | void` 시그니처를 정확히 이해하고 `await`+try/catch 로 전환해 in-memory/Redis adapter 양쪽에서 안전하며, tentative-add → join await → 실패 시 롤백의 순서가 정확해 원자성이 보존된다. `clientSubs`(Set) 는 단일 스레드 event loop 특성상 동기 연산 간 경쟁이 없고, `authorize()` await 로 인한 비동기 갭에 대한 기존 tentative-add/사후검증 방어도 유효하다(이번 diff 이전부터 존재, 새 리스크 없음). frontend 의 `bind()` off-before-on 패턴은 싱글턴 `WsClient`와 결합했을 때 실질적으로 유효한 리스너 중복 방지책이며, `connect()`의 `active` 가드 확장은 진행 중인 handshake 취소로 인한 churn/listener 누수를 정확히 막는다. 타이머(dismiss hysteresis) 관리도 표준 `useEffect` cleanup 패턴을 따라 안전하다. 새로운 경쟁 조건, 데드락, 미보호 공유 자원, await 누락은 발견되지 않았다.

## 위험도
NONE

STATUS=success ISSUES=0
