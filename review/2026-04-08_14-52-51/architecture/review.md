### 발견사항

---

**[WARNING]** `ExecutionEngineService`의 SRP 위반 심화 — `waitForAiConversation` 메서드 과다 책임
- 위치: `execution-engine.service.ts` — `waitForAiConversation()` (~224줄)
- 상세: 단일 메서드가 ①DB 상태 전이, ②WebSocket 이벤트 발송, ③대화 루프 제어, ④핸들러 직접 호출, ⑤NodeExecution 완료 처리를 모두 담당. 기존 `waitForFormInput`, `waitForButtonClick`이 확립한 패턴보다 훨씬 무거운 구조로, orchestrator 역할에서 점차 핸들러 구현 세부사항까지 알게 되는 방향으로 확장되고 있음.
- 제안: 단기적으로는 현 패턴 허용. 중기적으로 `WaitForInputStrategy` 인터페이스 추출 후 form/button/ai_conversation 처리를 전략 패턴으로 위임.

---

**[WARNING]** 의존성 역전 원칙(DIP) 위반 — `AiAgentHandler` 직접 타입 캐스팅 참조
- 위치: `execution-engine.service.ts` — `handler as unknown as AiAgentHandler` (두 곳)
- 상세: 핸들러 레지스트리의 추상화를 통해 `NodeHandler` 인터페이스만 사용해야 하는 서비스 레이어가 구체 클래스 `AiAgentHandler`의 메서드(`processMultiTurnMessage`, `buildMultiTurnFinalOutput`)를 직접 호출. 레지스트리의 의미가 퇴색되고 향후 AI 핸들러 교체/확장 시 서비스 코드 수정이 필요해짐.
- 제안: 두 가지 선택지: ① `MultiTurnCapable` 인터페이스 추출 후 `AiAgentHandler`가 구현 (`instanceof` 체크로 안전하게 캐스팅 가능), ② `processMultiTurnMessage`/`buildMultiTurnFinalOutput` 로직 자체를 서비스 레이어로 끌어올려 핸들러는 단순 LLM 실행만 담당.

```typescript
interface MultiTurnCapable {
  processMultiTurnMessage(
    message: string,
    state: MultiTurnState,
  ): Promise<MultiTurnResult>;
  buildMultiTurnFinalOutput(
    messages: ChatMessage[],
    lastResponse: string,
    turnCount: number,
    endReason: 'user_ended' | 'max_turns' | 'timeout',
    metadata: MultiTurnMetadata,
  ): AiAgentFinalOutput;
}
```

---

**[WARNING]** 내부 상태(`_multiTurnState`)가 공개 인터페이스(nodeOutputCache)를 오염
- 위치: `ai-agent.handler.ts` — `executeMultiTurn` 반환값, `execution-engine.service.ts` — `nodeOutput._multiTurnState` 접근
- 상세: 핸들러와 서비스 간의 암묵적 계약(`_multiTurnState` 구조)이 공개 출력 캐시(`nodeOutputCache`)에 혼재. 이 상태가 `NodeExecution.outputData`에 영속될 경우 구현 세부사항이 DB에 누출됨. 타입 안전성도 `Record<string, unknown>` 체인으로 완전히 소실됨.
- 제안: 멀티턴 대화 상태를 `pendingContinuations`와 유사한 별도 `Map<executionId, MultiTurnState>`으로 서비스 레이어에서 관리. 핸들러는 순수 실행 결과만 반환하고 내부 상태는 서비스가 독립적으로 보관.

---

**[WARNING]** `ExecutionEngineService` ↔ `WebsocketGateway` 순환 의존성 심화
- 위치: `websocket.gateway.ts` 생성자, `execution-engine.service.ts` — `websocketService` 주입
- 상세: 기존 `forwardRef`로 처리 중이던 순환 의존성이 AI 대화 기능으로 상호 호출 경로가 추가되면서 결합도 상승. `continueAiConversation`/`endAiConversation`이 Gateway → Engine을 직접 호출하고, Engine은 Gateway를 통해 이벤트를 emit하는 양방향 구조.
- 제안: NestJS `EventEmitter2` 또는 Redis Pub/Sub 기반 이벤트 버스 도입으로 분리. 단기적으로는 현 `forwardRef` 유지 가능하나 중기 리팩토링 과제로 관리 필요.

---

**[INFO]** `ExecutionEventType` enum에 `EXECUTION_AI_MESSAGE` 미등록
- 위치: `execution-engine.service.ts` — `'execution.ai_message' as ExecutionEventType`
- 상세: enum 외부 문자열을 강제 캐스팅하여 컴파일 타임 안전성 소실. 열거형 스위치문이나 타입 가드에서 누락될 위험.
- 제안: `ExecutionEventType` enum에 `EXECUTION_AI_MESSAGE = 'execution.ai_message'` 즉시 추가.

---

**[INFO]** `buildTools` 시그니처 이중 역할 — config와 state를 동일 타입으로 처리
- 위치: `ai-agent.handler.ts` — `buildTools(config)` vs `buildTools(state)`
- 상세: `buildTools`가 `Record<string, unknown>`을 받아 config, state 두 역할 모두에서 호출됨. `state`에 `toolNodeIds`/`toolOverrides`가 없으면 빈 배열을 반환하는 silent failure 발생(ND-AG-14 위반). 단일 메서드가 두 가지 다른 계약을 처리하는 설계 혼란.
- 제안: `_multiTurnState` 초기화 시 `toolNodeIds`와 `toolOverrides`를 명시적으로 포함시키거나, `buildTools` 호출을 `executeMultiTurn` 시점 한 번으로 제한하고 결과를 state에 캐싱.

---

**[INFO]** RAG 컨텍스트 삽입 방식의 레이어 일관성 부재
- 위치: `ai-agent.handler.ts` — `executeMultiTurn` vs `processMultiTurnMessage` RAG 처리
- 상세: 첫 번째 턴은 시스템 프롬프트에 append, 후속 턴은 `role: 'system'` 메시지를 대화 중간에 삽입. 일관성 없는 두 전략이 같은 클래스 내에 혼재. Anthropic 등 시스템 메시지 단일 제약 프로바이더에서 오동작 가능.
- 제안: RAG 컨텍스트 삽입 전략을 단일 private 메서드(`injectRagContext`)로 추출하여 일관된 방식(user 메시지 prefix 또는 system 프롬프트 업데이트) 적용.

---

### 요약

이번 변경은 기존 `waiting_for_input` 메커니즘을 확장하여 Multi Turn AI 대화를 구현한 실용적인 접근이며, 하위 호환성 유지와 빠른 기능 구현이라는 면에서 타당한 선택이다. 그러나 `ExecutionEngineService`가 `AiAgentHandler`의 구체 클래스 메서드를 직접 캐스팅·호출하는 부분이 레이어 경계를 침범하고, `_multiTurnState`가 출력 캐시에 혼재되어 타입 안전성과 관심사 분리 측면에서 부채가 누적되고 있다. 현재는 AI 노드 유형이 단일(`ai_agent`)이라 관리 가능하지만, 유형이 늘어날 경우 `handler as unknown as AiAgentHandler` 패턴이 확산되어 엔진-핸들러 결합이 병목이 될 수 있다. 즉시 `ExecutionEventType` enum 등록과 `_multiTurnState`의 `toolNodeIds`/`toolOverrides` 포함을 적용하고, 중기 과제로 `MultiTurnCapable` 인터페이스 추출 및 대화 상태 저장소 분리를 계획할 것을 권장한다.

### 위험도

**MEDIUM**