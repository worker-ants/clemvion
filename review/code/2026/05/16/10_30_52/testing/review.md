# Testing Review — AI Thread Source Marker (ai-thread-source-mark-7c4f2a)

## 발견사항

---

### [INFO] LlmService의 `source` 필드 스트리핑 로직에 대한 단위 테스트 부재

- 위치: `backend/src/modules/llm/llm.service.ts` — `sanitized` 블록 (lines ~222–228)
- 상세: `llm.service.ts`에 추가된 `source` 필드 스트리핑 로직(`params.messages.map(({ source, ...rest }) => ...)`)은 LLM 프로바이더에 노출되어선 안 되는 WebSocket 메타데이터를 제거하는 핵심 경계 역할을 한다. 그러나 해당 변경에 대한 단위 테스트가 diff에 존재하지 않는다. `llm.service.spec.ts`(또는 동등 파일)에서 (a) `source: 'live'` 및 `source: 'injected'`가 있는 메시지가 client에 전달될 때 해당 필드가 제거되는지, (b) `source`가 없는 메시지는 그대로 전달되는지, (c) 메시지 내 다른 필드(`content`, `toolCalls`, `toolCallId`)가 손상되지 않는지를 검증하는 테스트가 필요하다.
- 제안: `llm.service.spec.ts`에 `describe('source field stripping before provider call')` 블록을 추가하고, mock client의 `chat()` 호출 인자를 캡처하여 `source` 필드 부재를 assert한다.

---

### [WARNING] `mapTurnsToChatMessages`의 `source: 'injected'` 태깅에 대한 단위 테스트 부재

- 위치: `backend/src/nodes/ai/ai-agent/ai-agent.handler.ts` — `mapTurnsToChatMessages` 함수 (lines ~262–310)
- 상세: `mapTurnsToChatMessages`의 모든 분기(`presentation_user`, `ai_user`, `ai_assistant`, `ai_tool`, `system`, default)에서 `source: 'injected'`가 설정되도록 변경되었다. 이에 대한 테스트는 `ai-agent.thread.spec.ts`에 통합 테스트 형태로 추가되었으나, 해당 테스트는 핸들러 전체 실행(`handler.execute` + `processMultiTurnMessage`)에 의존하기 때문에 `mapTurnsToChatMessages` 함수 자체의 각 `switch` 분기가 올바르게 `source: 'injected'`를 붙이는지 격리 검증하기 어렵다. 특히 `ai_tool` 분기와 `default` 분기는 통합 테스트에서 실제로 실행되는지 확인하기 어렵다.
- 제안: `mapTurnsToChatMessages`를 export하거나 별도 모듈로 분리한 뒤, 각 `ConversationTurn.source` 케이스별 독립 단위 테스트를 추가한다. 최소한 `system`, `ai_tool`, `default` 분기에 대한 직접 검증이 필요하다.

---

### [WARNING] `withSourceMarker` 함수의 엣지 케이스 테스트 부족

- 위치: `backend/src/modules/execution-engine/execution-engine.service.ts` — `withSourceMarker` 함수 (lines ~96–104) 및 `execution-engine.service.spec.ts`
- 상세: `withSourceMarker`는 `source`가 이미 `'live'` 또는 `'injected'`인 메시지는 그대로 두고, 그 외에는 `source: 'live'`를 backfill한다. 추가된 테스트 2개는 핵심 시나리오를 잘 커버하지만, 다음 케이스가 누락되어 있다:
  1. `source`가 `'live'`인 기존 메시지가 중복 덮어쓰기 없이 그대로 유지되는지 (현재 첫 번째 테스트에서 `source: 'live'` 입력값이 없음 — 모두 unmarked).
  2. `source`가 알 수 없는 값(예: `'other'`)으로 들어왔을 때 `'live'`로 대체되는지(의도적 동작이지만 테스트 없음).
  3. `messages` 배열이 빈 배열일 때 빈 배열을 반환하는지.
  4. `system` 메시지가 이미 필터링된 후에 `withSourceMarker`가 적용되므로, `system` 메시지에 `source`가 적용되지 않음은 검증되나, 필터링 순서가 바뀌었을 때의 방어 케이스는 없다.
- 제안: 위 케이스들에 대한 테스트를 `execution-engine.service.spec.ts`의 `withSourceMarker` describe 블록에 추가한다.

---

### [WARNING] `ai-agent.thread.spec.ts` 통합 테스트의 Mock 적절성 및 불확정성

- 위치: `backend/src/nodes/ai/ai-agent/ai-agent.thread.spec.ts` — 신규 테스트 (lines ~337–391)
- 상세: 새로 추가된 테스트 `"tags injected messages with source: 'injected' and leaves handler-pushed messages unmarked"`는 `handler.execute()` 및 `processMultiTurnMessage()`를 실제로 호출한다. 이 테스트는 다음 점에서 취약하다:
  1. `expect(injected.length).toBeGreaterThanOrEqual(2)` — 정확한 주입 메시지 수를 단언하지 않고 하한만 검사하므로, 미래 구현 변경이 injected 수를 늘렸을 때 이를 감지하지 못한다.
  2. `expect(live.length).toBe(0)` 단언과 `expect(unmarked.filter(...))` 단언이 실제로 `withSourceMarker`가 backfill하기 전의 raw output을 보는 것인지, backfill 후를 보는 것인지 코드 상 명확하지 않다. `turnResult.output.messages`가 `buildConversationConfigFromOutput`을 거친 후인지, handler의 raw output인지에 따라 테스트의 의미가 달라진다.
  3. `seedThreadFromOtherNode`에 의존하는 외부 fixture의 상태(inject되는 메시지 수와 역할)가 테스트 코드 안에서 명시되지 않아 가독성이 저하된다.
- 제안: `injected.length`를 정확한 값으로 단언하고, `turnResult.output.messages`의 출처(raw vs backfilled)를 주석으로 명확히 한다. `seedThreadFromOtherNode`가 주입하는 메시지 목록을 테스트 상단에 인라인 주석으로 문서화한다.

---

### [INFO] `frontend/src/lib/conversation/conversation-utils.ts`의 `tool` 메시지 `isInjected` 전파에 대한 테스트 커버리지 제한

- 위치: `frontend/src/lib/conversation/__tests__/conversation-utils.test.ts` — tool message 테스트 (lines ~504–527)
- 상세: `tool` 메시지에 `isInjected`가 추가되었으나, 해당 필드는 `msg.source`를 직접 보지 않고 `toolCallMap`에서 가져온 `info.isInjected`(또는 동등한 값)를 통해 설정될 가능성이 있다. 추가된 테스트(`tool message inherits turnIndex of its originating assistant call`)는 `turnIndex`만 검증하고, `isInjected` 값 자체를 assert하지 않는다. 또한 `source: 'injected'`인 assistant의 tool call에 연결된 `tool` 메시지가 `isInjected: true`로 propagate되는지 검증하는 케이스가 없다.
- 제안: 해당 테스트에 `expect(tool).toMatchObject({ isInjected: false })` (현재 시나리오) 단언을 추가하고, injected assistant의 tool call에 대한 별도 케이스를 추가한다.

---

### [INFO] `use-execution-events.ts`의 `source` 필드 추가에 대한 테스트 부재

- 위치: `frontend/src/lib/websocket/use-execution-events.ts` (lines ~684, ~693)
- 상세: WebSocket 이벤트 핸들러의 인라인 타입 정의에 `source?: "live" | "injected"`가 추가되었다. 이 변경은 타입 레벨이므로 런타임 오동작 가능성이 낮지만, 수신된 `source` 필드가 `messagesToConversationItems`에 올바르게 전달되는지 확인하는 테스트가 없다. `use-execution-events`의 기존 테스트(있다면)에서 `source` 필드가 포함된 WebSocket payload를 전달했을 때 store의 `ConversationItem.isInjected`가 올바르게 설정되는지 검증하는 케이스가 없다.
- 제안: `use-execution-events` 관련 테스트(또는 통합 테스트)에서 `source: 'injected'`가 포함된 WebSocket 이벤트를 시뮬레이션하고, 결과적으로 store에 쌓이는 `ConversationItem`의 `isInjected` 값을 검증한다.

---

### [INFO] `third-party-oauth.controller.spec.ts`의 Content-Type 타입 정제 — 회귀 리스크 미미

- 위치: `backend/src/modules/integrations/third-party-oauth.controller.spec.ts` (lines ~154–160)
- 상세: `String(contentType ?? '')`에서 `contentType ?? ''`로의 변경은 `contentType`이 이미 `string` 타입으로 좁혀지므로 이중 형변환을 제거한 타입 정제다. 기능적으로 동일하며 회귀 리스크는 없다. 다만 `res.headers`의 타입을 `Record<string, unknown>`에서 `Record<string, string>`으로 좁힌 것이 실제 mock 구현과 일치하는지 확인이 필요하다. mock에서 헤더 값이 `string` 외 타입(예: `string[]`)으로 설정될 경우 타입 단언이 잘못된 안도감을 줄 수 있다.
- 제안: mock의 `headers['Content-Type']` 설정값 타입이 실제로 `string`임을 확인하거나, 필요 시 타입 단언 대신 실제 구조를 반영하는 타입을 사용한다.

---

### [INFO] `buildConversationConfigFromOutput`의 두 번째 호출 경로(`condMessages`) 에 대한 전용 테스트 부재

- 위치: `backend/src/modules/execution-engine/execution-engine.service.ts` (lines ~2182–2131) 및 `execution-engine.service.spec.ts`
- 상세: `withSourceMarker`는 `buildConversationConfigFromOutput` 내부뿐 아니라 `condMessages` 계산 경로(line ~2129)에도 적용되었다. `buildConversationConfigFromOutput`에 대한 테스트는 추가되었으나, `condMessages` 경로에서 `withSourceMarker`가 올바르게 동작하는지를 직접 검증하는 테스트가 없다. 두 경로는 코드 상 동일한 함수를 사용하므로 회귀 가능성은 낮지만, 리팩토링 등으로 두 경로가 분리될 경우 커버리지 갭이 드러날 수 있다.
- 제안: `condMessages` 경로를 실행하는 통합 테스트 또는 해당 경로를 직접 호출하는 단위 테스트를 추가하여 `source` 마커가 양쪽 경로에서 일관되게 적용됨을 보장한다.

---

## 요약

이번 변경은 WebSocket `source` 마커(`'live'` / `'injected'`) 도입에 대해 전반적으로 잘 구성된 테스트를 동반하고 있다. 핵심 비즈니스 로직인 `buildConversationConfigFromOutput`의 backfill 동작과 `messagesToConversationItems`의 turn 카운터 보정은 의도를 명확히 표현하는 테스트로 커버된다. 그러나 LLM 프로바이더로의 경계 역할을 하는 `LlmService`의 `source` 스트리핑 로직에 전용 단위 테스트가 없고, `mapTurnsToChatMessages`의 개별 분기(`ai_tool`, `system`, `default`)가 통합 테스트를 통해서만 간접적으로 검증된다는 점이 주요 갭이다. `ai-agent.thread.spec.ts`의 신규 통합 테스트는 `greaterThanOrEqual` 불정확 단언과 external fixture 의존성으로 인해 미래 유지보수 시 테스트 의도가 희석될 위험이 있다. 전체적인 테스트 용이성(testability)은 `withSourceMarker`를 단독 함수로 추출한 설계 덕분에 양호하며, `mapTurnsToChatMessages`도 export 경계만 조정하면 단위 테스트가 용이하다.

## 위험도

LOW
