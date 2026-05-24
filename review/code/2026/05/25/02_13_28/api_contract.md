# API 계약(API Contract) 리뷰 결과

## 리뷰 대상

- `execution-event-emitter.service.ts` — `registerExecutionRouting` / `releaseExecutionRouting` 위임 추가
- `execution-engine.service.ts` — execute() 진입 시 routing context 등록 로직
- `websocket.service.ts` — `ExecutionRoutingContext` 인터페이스 export + wire/fanout envelope 분리
- `mcp-tool-provider.ts` — `openServer` null sentinel / silent skip
- 테스트 파일 3종, plan 문서 1종, consistency 산출물 2종

---

## 발견사항

### [INFO] `ExecutionRoutingContext` 인터페이스 신규 export — 하위 호환성 유지 확인

- 위치: `websocket.service.ts` (변경 diff +692~+707)
- 상세: `ExecutionRoutingContext`가 새로운 export로 추가됐다. 기존 클라이언트(내부 모듈)가 이 타입을 import 하지 않았으므로 breaking change가 없다. `ExecutionChannelEvent.payload`의 타입 서명은 기존 `Record<string, unknown>` 유지 — 기존 subscriber 코드가 타입 에러 없이 컴파일된다. 단, fanout envelope이 이제 `triggerId`/`chatChannel` 키를 조건부로 포함할 수 있어, 내부 subscriber(`ChatChannelDispatcher`, `NotificationFanout`, `SseAdapter`)는 이 키의 존재를 가정하거나 무시해야 한다.
- 제안: 이미 subscriber 측(plan 설명 기준 `ChatChannelDispatcher`/`NotificationFanout`)이 `triggerId` 유무 가드를 쥐고 있으므로 현행 설계로 충분하다. 추가 조치 불필요.

### [INFO] wire envelope shape 미변경 — WS spec §4.4 하위 호환성 유지

- 위치: `websocket.service.ts` (변경 diff +780~+797, `emitExecutionEvent` 내부)
- 상세: `gateway.broadcastToChannel`에 전달하는 `wireEnvelope`는 기존과 동일한 shape(`executionId`, payload spread, `seq`, `timestamp`)이다. `triggerId`/`chatChannel`은 `fanoutEnvelope`에만 첨부되어 `executionEventSubject.next`로 흐른다. Frontend WebSocket 클라이언트가 받는 이벤트 shape에는 어떤 변화도 없으므로 기존 클라이언트 코드는 영향받지 않는다.
- 제안: 해당 없음. 설계가 명확하게 분리되어 있다.

### [INFO] `emitNodeEvent` 에서 terminal event 후 routing context release 미수행

- 위치: `websocket.service.ts` 변경 diff +815 (`emitNodeEvent` 내 `fanoutEnvelope` 첨부 추가)
- 상세: `emitExecutionEvent`는 terminal event 감지 후 `releaseExecutionRouting`을 자동 호출하지만(+796), `emitNodeEvent`에는 동일한 자동 release 로직이 없다. 이는 정상 흐름(terminal execution event가 node event보다 늦게 emit됨)을 전제로 설계되었으므로 문제가 아니다. Node event가 terminal execution event보다 나중에 emit되는 경로가 없다면 누수 위험 없음.
- 제안: 코드 주석에 "node event 이후 반드시 terminal execution event가 follow-up된다는 invariant에 의존"임을 명시하면 향후 유지보수 시 의도를 전달하는 데 도움이 된다. 필수 수정은 아님.

### [INFO] `extractChatChannelFromInput` — `channelUserKey` 미검증

- 위치: `execution-engine.service.ts` (변경 diff +267~+290)
- 상세: 함수가 `provider`와 `conversationKey`만 필수로 검증하고 `channelUserKey`는 선택적으로 처리한다. 주석에 "raw 전체를 그대로 통과"라고 명시되어 있고 sanitize는 WebsocketService 측에서 한다고 기술되어 있어 설계 의도가 명확하다. `ChatChannelDispatcher`가 `channelUserKey`를 필수로 요구하는 경우 upstream에서 누락된 값을 silent pass하는 결과가 나올 수 있으나, dispatcher가 자체 가드를 가지고 있다면 문제없다.
- 제안: dispatcher 측에서 `channelUserKey` 유효성을 검증하는 가드가 실제로 존재하는지 확인. 만약 dispatcher가 `channelUserKey`를 무조건 신뢰한다면 여기서도 검증을 추가하는 것이 방어적으로 더 안전하다.

### [INFO] `McpToolProvider.openServer` null sentinel — API 계약 범위 내 변경

- 위치: `mcp-tool-provider.ts` (변경 diff +997~+1021)
- 상세: `openServer`의 반환 타입이 `Promise<ServerEntry>`에서 `Promise<ServerEntry | null>`로 변경됐다. 이는 내부 private 메서드이므로 외부 API 계약에 영향 없다. `buildTools`의 public 인터페이스(매개변수 shape, 반환 타입 `ToolDef[]`)는 변경 없음.
- 제안: 해당 없음.

---

## 요약

이번 변경은 backend 내부 이벤트 라우팅 계층(WebSocket fanout envelope)과 MCP tool provider 내부 분기 로직만 수정한다. 외부에 노출되는 HTTP API endpoint, WebSocket wire 프로토콜(spec §4.4), 또는 공개 모듈 인터페이스에는 breaking change가 없다. `ExecutionRoutingContext` export 추가와 `ExecutionChannelEvent.payload`의 조건부 키 확장은 내부 subscriber 전용이며 기존 클라이언트 호환성을 명시적으로 보호한다. `extractChatChannelFromInput`의 부분 검증(provider + conversationKey만 필수)은 의도된 설계이나 dispatcher 측 가드 존재 여부 확인이 권장된다. 전체적으로 API 계약 관점에서 위험 요소가 없는 변경이다.

---

## 위험도

NONE
