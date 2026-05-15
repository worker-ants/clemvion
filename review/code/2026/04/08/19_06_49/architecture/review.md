## 아키텍처 코드 리뷰

### 발견사항

---

**[WARNING] `execution-engine.service.ts`에서 핸들러 내부 상태를 직접 캐스팅하여 접근**
- 위치: `execution-engine.service.ts:884–893`
- 상세: `resultObj._multiTurnState`를 `Record<string, unknown>`으로 캐스팅하여 `newState.model`, `newState.totalInputTokens` 등을 접근하고 있음. `_multiTurnState`는 `AiAgentHandler` 내부 구현 세부사항임에도 ExecutionEngine이 그 형태를 알고 있음. 이는 레이어 간 결합도가 높아지는 문제.
- 제안: `processMultiTurnMessage()`의 반환 타입을 명시적 인터페이스(예: `MultiTurnTurnResult`)로 정의하고, 디버깅용 페이로드는 핸들러가 구조화된 형태로 노출하도록 수정.

```typescript
// ai-agent.handler.ts
interface MultiTurnTurnResult {
  status: 'waiting_for_input' | 'completed';
  conversationConfig: ConversationConfig;
  _multiTurnState: MultiTurnState;
  debug?: {
    lastTurnRequest: unknown;
    lastTurnResponse: unknown;
    lastTurnDurationMs: number;
  };
}
```

---

**[WARNING] `AiAgentHandler`가 `NodeHandler` 인터페이스를 벗어난 공개 메서드를 노출**
- 위치: `ai-agent.handler.ts` — `processMultiTurnMessage()`, `buildMultiTurnFinalOutput()`
- 상세: `NodeHandler` 인터페이스는 `execute()`와 `validate()`만 정의하지만, ExecutionEngine은 `AiAgentHandler`로 직접 다운캐스팅(`as unknown as AiAgentHandler`)하여 내부 메서드를 호출함. 이는 개방-폐쇄 원칙(OCP) 및 인터페이스 분리 원칙(ISP) 위반.
- 제안: `NodeHandler` 인터페이스를 확장하거나, multi-turn 처리를 위한 별도 인터페이스(`MultiTurnNodeHandler`) 도입.

```typescript
// node-handler.interface.ts
export interface MultiTurnNodeHandler extends NodeHandler {
  processMultiTurnMessage(message: string, state: unknown): Promise<unknown>;
  buildMultiTurnFinalOutput(...): unknown;
}
```

---

**[WARNING] `waitForAiConversation()`에서 핸들러 참조를 Registry를 통해 반복 조회**
- 위치: `execution-engine.service.ts` — `waitForAiConversation()` 내 while 루프
- 상세: 루프 내에서 매 턴마다 `this.handlerRegistry.get('ai_agent')` 호출 후 다운캐스팅. Registry lookup이 반복되며 타입 안전성도 없음. 다운캐스팅 패턴이 두 번 중복됨 (end conversation, process message 분기).
- 제안: 메서드 진입 시 핸들러를 한 번만 조회하고 지역 변수로 보관.

---

**[INFO] 디버그 페이로드(`requestPayload`, `responsePayload`)가 WebSocket 이벤트를 통해 클라이언트로 전송됨**
- 위치: `execution-engine.service.ts:887–892`, `use-execution-events.ts:240–253`
- 상세: LLM 요청/응답 전체가 WebSocket 이벤트 페이로드에 포함되어 클라이언트로 전송됨. 대화가 길어질수록 메시지 배열 전체가 매 턴마다 전달되어 네트워크 부담 증가. 또한 API 키 관련 정보가 응답 객체에 포함될 경우 보안 리스크.
- 제안: 개발/디버그 모드에서만 활성화하거나, `messages` 배열을 제외한 요약 정보만 전송. 환경 변수로 제어 가능하도록 구성.

---

**[INFO] `ConversationItem` 타입이 디버깅 전용 필드와 도메인 필드를 혼재**
- 위치: `execution-store.ts:45–60`
- 상세: `requestPayload`, `responsePayload`, `durationMs`는 디버깅 목적이고, `content`, `turnIndex`, `metadata`는 도메인 데이터임. 하나의 인터페이스에 혼재되어 단일 책임 원칙(SRP)을 약화시킴. 향후 타입이 비대해질 가능성.
- 제안: 디버그 정보를 별도 타입으로 분리하거나 선택적 `debug` 네임스페이스로 묶기.

```typescript
interface ConversationItem {
  type: "user" | "assistant" | "tool";
  content: string;
  turnIndex: number;
  timestamp?: string;
  metadata?: ConversationItemMetadata;
  debug?: ConversationItemDebug; // 디버그 전용
}
```

---

**[INFO] `chatParams` 캡처 시 tool call 루프 이후의 메시지 변경이 반영되지 않음**
- 위치: `ai-agent.handler.ts:393–400`
- 상세: `chatParams`는 첫 번째 LLM 호출 직전에 캡처되지만, 이후 tool call 루프에서 `messages`가 변경될 수 있음. `requestPayload`로 전달되는 내용이 실제 마지막 LLM 요청과 다를 수 있어 디버깅 목적에 부합하지 않음.
- 제안: tool call 루프 완료 후 마지막 LLM 호출 직전에 `chatParams`를 캡처하거나, 각 LLM 호출 파라미터를 별도 추적.

---

### 요약

이번 변경은 AI 멀티턴 대화의 디버깅 가시성을 높이기 위한 기능 추가로, 전반적인 흐름은 합리적이다. 그러나 핵심 아키텍처 문제는 `ExecutionEngineService`가 `AiAgentHandler`의 내부 상태 구조(`_multiTurnState`)와 인터페이스를 넘어선 메서드에 직접 의존하고 있다는 점이다. 핸들러 다운캐스팅 패턴은 `NodeHandler` 추상화를 무력화하며, 새로운 AI 핸들러가 추가될 때 Engine 코드 수정이 불가피한 구조가 된다. 단기적으로는 동작하지만, multi-turn 지원 핸들러를 위한 명시적 인터페이스(`MultiTurnNodeHandler`)를 도입하여 타입 안전성과 확장성을 확보하는 것이 권장된다. 디버그 페이로드의 WebSocket 전송도 프로덕션 환경에서의 네트워크 비용과 잠재적 보안 노출을 고려하여 환경별 제어 메커니즘이 필요하다.

### 위험도

**MEDIUM**