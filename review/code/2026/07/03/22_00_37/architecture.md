# 아키텍처(Architecture) Review

## 발견사항

- **[INFO]** `handleSubscribe` 가 인가·동시성가드(tentative-add/rollback)·room 멤버십·snapshot 발행 4가지 관심사를 한 메서드에서 순차 처리
  - 위치: `codebase/backend/src/modules/websocket/websocket.gateway.ts:156-303` (`handleSubscribe`)
  - 상세: `authorize()` await → 한도 사전검사 → `clientSubs.add` → 한도 사후검사(롤백) → `client.join()` await → 실패 시 재차 롤백, 총 3중 방어 지점이 한 메서드(약 148줄)에 몰려 있다. 각 단계 주석은 근거가 명확하고 개별 단위테스트로 커버되어 있어 기능적 결함은 없으나, SRP 관점에서 응집도가 낮아지는 방향(책임 4개)으로 커지고 있다. 이번 diff 는 기존 구조에 join await+롤백 분기(라인 264-281)를 추가한 것으로, 신규 도입이 아니라 기존에 이미 지적된 이슈(SUMMARY.md #2, 이전 architecture 리뷰)를 유지·소폭 확대한 정도다.
  - 제안: 즉시 조치 불필요. 향후 채널 인가 로직이 더 늘어나면 `reserveSubscriptionSlot()` / `joinChannelOrRollback()` 같은 private helper 로 추출해 메서드당 책임을 좁히는 것을 고려.

- **[INFO]** `handleDisconnect` (fire-and-forget leave) vs `handleUnsubscribe` (awaited try/catch leave) 의 정책 비대칭
  - 위치: `codebase/backend/src/modules/websocket/websocket.gateway.ts:140-153` vs `:336-359`
  - 상세: 의도된 설계 차이(주석에 근거 명시: disconnect 시 socket.io 가 room 을 auto-leave 하므로 명시 leave 는 redundant, 소켓이 이미 끊기는 중이라 await 실익 없음)이며 합리적이다. 다만 "leave" 라는 동일 도메인 동작에 대해 두 경로가 서로 다른 실패 처리 전략(무시 vs warn 로그)을 갖는 구조는 신규 기여자가 비일관으로 오인할 여지가 있다. 이번 diff 가 새로 만든 비대칭이 아니라 기존에 있던 비대칭에 대한 근거 주석을 M-3 작업에서 보강한 것.
  - 제안: 현재 주석 설명으로 충분, 조치 불필요. 두 경로가 앞으로 더 벌어지면 정책 재검토.

- **[INFO]** frontend `bind()` off-before-on 헬퍼가 훅 내부 로컬 함수로 캡슐화, 클라이언트 계층(`WsClient`)에는 위임되지 않음
  - 위치: `codebase/frontend/src/lib/websocket/use-execution-events.ts:1020-1099` (`bind` 정의 및 19개 호출부)
  - 상세: `client.on` 직접 호출 19곳을 전부 `bind()` 로 일괄 전환해 멱등 등록 패턴을 한 곳에 캡슐화한 것은 양호한 응집도 개선이다. `WsClient` 인터페이스(`ws-client.ts`) 자체는 이 멱등성을 보장하지 않으므로, 만약 향후 두 번째 소비자가 생기면 동일 `off-before-on` 로직을 중복 구현해야 하는 구조다. 현재는 소비자가 훅 1개뿐이라 클라이언트 계층으로 끌어올리는 것은 과도한 추상화가 될 수 있어 지금 위치가 적절하다 — YAGNI 원칙에 부합.
  - 제안: 두 번째 소비자가 생기는 시점에 `WsClient.on`을 멱등화하거나 `bindOnce` 류 메서드 추가를 재검토.

- **[INFO]** `ws-client.ts` `connect()` pending 가드 확장은 캡슐 경계 내에서 자연스럽게 처리, 레이어 위반 없음
  - 위치: `codebase/frontend/src/lib/websocket/ws-client.ts:28` (`if (socket && (socket.connected || socket.active))`)
  - 상세: `socket.active` 는 socket.io-client 내부 프로퍼티 의존이지만, 기존에도 `socket.connected` 를 동일하게 참조하던 패턴이라 결합도 증가는 미미하다. `WsClient` 가 socket.io 를 캡슐화하고 상위 훅(`use-execution-events.ts`)은 `WsClient` 인터페이스(`connect`/`isConnected`/`on`/`off`/`subscribe` 등)만 사용하는 레이어 경계가 이번 변경으로도 그대로 유지된다.
  - 제안: 없음.

- **[INFO]** 동시성 가드가 4개 계층(backend gateway / frontend ws-client / frontend hook 이벤트 dedup / frontend hook dismiss hysteresis)에 분산되어 있으나 각 계층의 독립적 책임이며 순환·중복 없음
  - 위치: 백엔드 `handleSubscribe` join 원자성(:264-281), 프런트 `ws-client.connect()` pending 가드(:28), 프런트 훅 `bind()` 이벤트 dedup(:1020-1099), 프런트 훅 `snapshotReceived` dismiss hysteresis(:1178-1191, m-5)
  - 상세: 네 곳 모두 넓은 의미의 "race/동시성"을 다루지만 서로 다른 구체적 문제(서버측 room 멤버십 원자성, 클라이언트측 재연결 churn 방지, React 훅 리스너 중복 방지, UX flap 방지)를 해결하며 서로 호출·참조 관계가 없다. 순환 의존 없음, 모듈 경계 명확.
  - 제안: 없음.

- **[INFO]** plan/review 산출물(`06-concurrency.md`, `README.md`, `review/code/**`) 변경은 문서·거버넌스 아티팩트로 코드 아키텍처에 영향 없음
  - 위치: `plan/in-progress/refactor/06-concurrency.md`, `plan/in-progress/refactor/README.md`, `review/code/2026/07/03/21_48_56/*`
  - 상세: 체크박스 갱신·집계 테이블 갱신·이전 리뷰 세션의 SUMMARY/RESOLUTION/개별 reviewer 산출물 추가는 프로젝트 문서 규약(plan 체크박스=실제 상태, review 산출물 커밋)을 따른 정상적인 프로세스 반영이며 아키텍처 검토 대상이 아니다.
  - 제안: 없음.

## 요약

이번 diff 는 refactor 06(concurrency) 잔여 배치(M-3/M-6/m-3/m-5)로, WebSocket 구독/연결 경로에 존재하던 4가지 독립적 race 취약점(서버측 join 실패 시 tentative-subscription 오염, 클라이언트 재연결 churn, React 훅 이벤트 리스너 중복 등록, snapshot flap 으로 인한 toast 깜빡임)을 각 계층의 기존 경계를 넘지 않고 국소적으로 보강했다. 새로운 추상화나 디자인 패턴 도입 없이 기존 구조(`ChannelAuthorizer` DI 전략 맵, `WsClient` 캡슐화, 훅의 stable-ref 콜백)를 그대로 활용했고, 모든 방어 로직에 "왜 필요한지·왜 이 위치인지·부작용이 없는지"를 상세 주석으로 근거를 남겨 유지보수성이 높다. `handleUnsubscribe` 의 leave 실패 회귀 테스트가 추가되어(WARNING fix) 대칭 경로(subscribe join 롤백 vs unsubscribe leave best-effort) 검증이 보완됐다. `handleSubscribe` 가 다소 비대해진 점(3중 롤백 지점, 4개 관심사 응집)과 `handleDisconnect`/`handleUnsubscribe` 간 leave 정책 비대칭이 유일하게 눈에 띄는 이슈이나, 둘 다 이전 리뷰에서 이미 확인된 INFO 수준이며 이번 diff 가 새로 야기한 것이 아니다. 순환 의존·레이어 위반·안티패턴은 발견되지 않았고, 4개 계층에 분산된 동시성 가드는 각각 독립적 책임을 가져 결합도가 낮게 유지된다.

## 위험도
NONE
