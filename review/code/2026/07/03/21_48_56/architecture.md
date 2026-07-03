# 아키텍처(Architecture) Review

## 발견사항

- **[INFO]** `handleSubscribe` 의 join 원자성 처리 방식이 매우 방어적이나 tentative-add/rollback 로직이 함수 하나에 응집
  - 위치: `codebase/backend/src/modules/websocket/websocket.gateway.ts:1529-1582` (`handleSubscribe`)
  - 상세: `authorize()` await 이후 한도 재검사 → `clientSubs.add` → 사후 한도 검사(재차 롤백) → `client.join()` await → 실패 시 재차 롤백, 총 3중 롤백 지점이 한 메서드에 몰려 있다. 각 단계 주석은 훌륭하지만 메서드가 인가·동시성 가드·room 멤버십·snapshot 발행까지 4가지 관심사를 한 곳에서 처리해 SRP 관점에서 다소 무겁다(약 150줄, cyclomatic complexity 높음).
  - 제안: 현재 기능적으로는 문제 없음(테스트 커버리지 양호). 다만 향후 채널 인가 로직이 더 늘어난다면 "tentative-add + join + rollback" 시퀀스를 `subscribeToChannel(client, channel, clientSubs)` 같은 private helper로 추출해 메서드당 책임을 좁히는 걸 고려. 즉시 조치 불필요.

- **[INFO]** `handleDisconnect`와 `handleUnsubscribe`의 `leave()` await 정책이 비대칭
  - 위치: `codebase/backend/src/modules/websocket/websocket.gateway.ts:1441-1454` (disconnect, fire-and-forget) vs `1637-1665` (unsubscribe, awaited try/catch)
  - 상세: 의도적 설계 차이(주석에 명시: disconnect 시 socket.io가 auto-leave하므로 방어적/redundant, await 실익 없음)이며 합리적 근거가 있다. 다만 두 경로가 유사한 "leave" 동작에 대해 서로 다른 실패 처리 전략(무시 vs warn 로그)을 갖는 것은 코드를 처음 보는 개발자에게 비일관으로 오인될 소지가 있다.
  - 제안: 현재 주석 설명이 충분하므로 문제 삼지 않음. 향후 두 경로가 더 벌어지면 (예: disconnect 시에도 명시적 정리가 필요해지면) 정책을 재검토.

- **[INFO]** frontend `bind()` 헬퍼(off-before-on)가 훅 내부 로컬 함수로 중복 방지
  - 위치: `codebase/frontend/src/lib/websocket/use-execution-events.ts:2580-2589`
  - 상세: 20개 가까운 이벤트 등록을 `client.on` 직접 호출에서 `bind()` 래퍼로 일괄 전환한 것은 좋은 리팩터링(멱등 등록 패턴을 한 곳에 캡슐화). `ws-client.ts`의 `WsClient` 인터페이스 자체에는 이 멱등성 보장이 없고, 소비자(훅)가 매번 `off-before-on` 패턴을 직접 구현해야 하는 구조다.
  - 제안: 만약 향후 다른 소비자(예: 다른 훅)가 동일 패턴이 필요해지면 `WsClient.on`을 멱등하게 만들거나 `WsClient`에 `bindOnce`류 메서드를 추가해 클라이언트 계층으로 책임을 옮기는 것을 고려. 현재는 단일 소비자라 과도한 추상화가 될 수 있어 지금 상태가 적절.

- **[INFO]** `ws-client.ts`의 `connect()` pending 가드 확장이 캡슐 경계 내에서 자연스럽게 처리됨
  - 위치: `codebase/frontend/src/lib/websocket/ws-client.ts:3410` (`if (socket && (socket.connected || socket.active))`)
  - 상세: `socket.active`는 socket.io-client의 내부 프로퍼티에 대한 의존이지만, 이미 `socket.connected`도 동일하게 라이브러리 내부 상태에 의존하는 기존 패턴을 따른 것이라 결합도 증가는 미미하다. 레이어 경계(WsClient가 socket.io를 캡슐화하고 상위 훅은 `WsClient` 인터페이스만 사용)가 잘 지켜졌다.
  - 제안: 없음.

- **[INFO]** 동시성 가드 로직이 세 레이어(backend gateway / frontend ws-client / frontend hook)에 분산되어 있으나 중복이 아니라 계층별 책임 분리
  - 위치: 백엔드 `handleSubscribe` join 원자성, 프런트 `ws-client.connect()` pending 가드, 프런트 훅 `bind()` 이벤트 dedup, 및 `snapshotReceived` dismiss hysteresis
  - 상세: 네 곳 모두 "동시성/경합 상태(concurrency race)"를 다루지만 각기 다른 계층의 다른 문제(서버측 room 멤버십 원자성, 클라이언트측 재연결 churn 방지, React 훅 이벤트 리스너 중복 방지, UX flap 방지)를 해결한다. 서로 호출 관계가 없고 순환 의존도 없다. 레이어 경계가 명확하게 유지된 좋은 예.
  - 제안: 없음.

## 요약

이번 diff는 refactor 06(concurrency) 마무리 배치로, WebSocket 구독/연결 경로에 존재하던 4가지 독립적 race 취약점(서버측 join 실패 시 tentative-subscription 오염, 클라이언트 재연결 churn, React 훅 이벤트 리스너 중복 등록, snapshot flap으로 인한 toast 깜빡임)을 각 계층의 기존 경계를 넘지 않고 국소적으로 보강한 성격의 변경이다. 새로운 추상화나 패턴 도입 없이 기존 구조(`ChannelAuthorizer` DI, `WsClient` 캡슐화, 훅의 `useCallback` 안정 참조)를 그대로 활용했고, 방어 로직마다 "왜 필요한지·왜 이 위치인지·부작용이 없는지"를 상세 주석으로 근거를 남겨 유지보수성이 높다. `handleSubscribe`가 다소 비대해진 점(3중 롤백 지점)이 유일하게 눈에 띄는 응집도 이슈이나 즉각적 리팩터링이 필요한 수준은 아니며, 순환 의존·레이어 위반·안티패턴은 발견되지 않았다.

## 위험도
NONE
