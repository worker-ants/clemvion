# API 계약(API Contract) 리뷰

대상: WebSocket gateway(`websocket.gateway.ts`) 의 M-3(join/leave await + 실패 롤백) 변경과 frontend WS client(`ws-client.ts`, `use-execution-events.ts`) 의 대응 변경(m-3 active 가드, M-6 이중 등록 방어, m-5 dismiss hysteresis), 그리고 관련 스펙 테스트. REST 엔드포인트 변경은 없고 전부 WebSocket(`/ws` namespace) 이벤트/ack 계약 범위.

### 발견사항

- **[INFO]** `subscribe` join 실패 ack 를 frontend 가 소비하지 않음 (fire-and-forget emit)
  - 위치: `codebase/backend/src/modules/websocket/websocket.gateway.ts:264-278` (join 실패 시 `{ success: false, error: 'Subscription failed — please retry' }` ack), `codebase/frontend/src/lib/websocket/ws-client.ts:87-89` (`subscribe()` 가 ack 콜백 없이 `socket.emit("subscribe", ...)` 만 호출)
  - 상세: 이번 변경으로 서버가 join 실패 시 명시적 실패 ack(`success:false`)를 새로 반환하지만, `WsClient.subscribe()` 는 socket.io ack 콜백을 등록하지 않아 이 payload 를 아무도 읽지 않는다. `use-execution-events.ts` 는 `execution.snapshot` 미수신을 근거로 한 별도 timeout/REST-polling fallback 에 의존한다(`client.subscribe(channel)` 호출부, 1081행 부근). 즉 새 ack 자체는 서버 로그(`this.logger.warn`)와 테스트 검증에만 유효하고 client 런타임 동작에는 영향을 주지 않는다 — 계약 위반은 아니지만 "실패를 알렸다"는 주석 의도와 실제 client 소비 사이에 갭이 있다.
  - 제안: 이 PR 범위에서 수정이 필수는 아님(pre-existing 패턴, 이번 diff 가 새로 만든 회귀 아님). 다만 join 실패가 실제 UX 신호로 이어지길 원한다면 향후 `subscribe` emit 에 ack 콜백을 추가하거나, REST fallback 타이머를 join 실패 시 즉시 트리거하도록 연결하는 후속 작업을 고려.

- **[INFO]** `handleUnsubscribe` 반환 타입이 sync → `Promise` 로 변경됨 (wire 계약 자체는 불변)
  - 위치: `codebase/backend/src/modules/websocket/websocket.gateway.ts:337-338` (`async handleUnsubscribe(...): Promise<{...}>`)
  - 상세: NestJS `@SubscribeMessage` 핸들러는 sync/`Promise` 반환 모두 지원하며 ack payload shape(`{event:'unsubscribed', data:{success, channel}}`)은 그대로다. `client.leave()` 를 이제 `await` 하지만 실패해도 성공 ack 를 반환하는 것으로 유지(best-effort, warn 로그만). 하위 호환성 문제 없음 — client 관점에서 ack 도착 시점이 아주 약간 늦어질 수 있으나(leave 완료까지 대기) 이는 in-memory adapter 에서는 사실상 동기라 실질 영향 없음.
  - 제안: 변경 없음. 참고용 기록.

- **[INFO]** join 실패 ack 의 `error` 문자열이 fixed literal — 기존 subscribe 실패 계열과 필드 shape 일관
  - 위치: `codebase/backend/src/modules/websocket/websocket.gateway.ts:275-278`
  - 상세: `subscribed` ack 의 리턴 타입 선언(`{success, channel?, error?}`)에는 `errorCode` 가 없다 — continuation 명령 4종(`errorCode` 포함) 및 `retry_last_turn`(nested `{code,message}`) 과는 별개 계층으로 이미 문서화되어 있다(코드 주석 §7.2 참조). 신규 join 실패 분기도 이 기존 flat `{success,error}` shape 을 그대로 따르고 있어 계약 일관성 훼손 없음.
  - 제안: 없음(확인용).

- **[INFO]** `execution.snapshot` IDOR 차단(verifyOwnership) 로직은 이번 diff 범위 밖(기존 코드), 변경 없이 유지 확인
  - 위치: `codebase/backend/src/modules/websocket/websocket.gateway.ts:280-286`(신규 join await 삽입 지점)와 `emitExecutionSnapshot` 전체
  - 상세: join await 삽입이 인가 체크(`authorizer.authorize`) *이후*, snapshot 발행(`emitExecutionSnapshot`) *이전*에 위치해 순서가 유지됨을 확인. join 실패 시 조기 return 하므로 미인가 경로로의 우회는 없음.
  - 제안: 없음(확인용).

### 요약

이번 변경분은 REST API 표면이 아니라 WebSocket `/ws` namespace 의 `subscribe`/`unsubscribe` ack 처리와 frontend WS client 재연결/이벤트 바인딩 로직에 국한된다. `handleSubscribe` 에 join 실패 시 tentative 구독 롤백 + 명시적 실패 ack(`{success:false, error:'Subscription failed — please retry'}`)를 추가했고, `handleUnsubscribe` 는 sync→async 로 내부 구현만 바뀌었을 뿐 ack wire shape(`{event, data:{success, channel}}`)은 완전히 하위 호환이다. 새 join 실패 ack 는 기존 `subscribed` 이벤트의 flat `{success, channel?, error?}` shape 을 그대로 따르며 다른 명령 핸들러(`errorCode`/nested `error:{code,message}`) 와 혼용하지 않아 기존 계층 분리 원칙을 지킨다. IDOR 인가 체크(authorizer → join → snapshot) 순서도 그대로 보존됐다. frontend 측 변경(`active` 가드, 이중 리스너 등록 방지, warning toast dismiss hysteresis)은 클라이언트 내부 동작 개선이며 서버와 주고받는 이벤트/ack 페이로드 스키마에는 영향이 없다. 유일한 갭은 새로 도입된 join 실패 ack 를 frontend `subscribe()` 호출부가 ack 콜백 없이 fire-and-forget 으로 보내 소비하지 않는다는 점이나, 이는 이번 PR 이전부터 있던 패턴이고 회귀도 아니므로 INFO 로만 기록한다. REST 버전관리·페이지네이션·URL 설계 관점은 본 diff 에 해당 없음.

### 위험도

LOW
