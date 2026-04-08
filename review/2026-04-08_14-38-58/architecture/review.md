### 발견사항

---

**[WARNING]** `ExecutionEngineService`의 단일 책임 원칙(SRP) 위반 심화
- 위치: `execution-engine.service.ts` — `waitForAiConversation` 메서드 (224줄)
- 상세: 대화 루프 제어, NodeExecution 상태 업데이트, WebSocket 이벤트 발송, 핸들러 직접 호출이 한 메서드에 혼재. 기존 `waitForFormInput`, `waitForButtonClick` 패턴을 따르지만 이번 메서드는 훨씬 무거움. 서비스가 이미 orchestrator 역할을 하면서 점점 확장되는 구조.
- 제안: 단기적으로 현 패턴 유지 가능하나, `WaitForInputStrategy` 인터페이스를 추출하여 form/button/ai_conversation 처리를 전략 패턴으로 분리하는 리팩토링 계획을 수립할 것.

---

**[WARNING]** `ExecutionEngineService`가 `AiAgentHandler`를 직접 타입 캐스팅하여 참조
- 위치: `execution-engine.service.ts` — `handler as unknown as AiAgentHandler` (두 곳)
- 상세: 레지스트리에서 핸들러를 꺼낸 후 구체 타입으로 캐스팅하는 것은 의존성 역전 원칙(DIP) 위반. `NodeHandler` 인터페이스 너머로 구체 클래스 메서드(`buildMultiTurnFinalOutput`, `processMultiTurnMessage`)를 직접 호출하므로 결합도가 상승.
- 제안: `NodeHandler` 인터페이스를 확장하거나 별도 `MultiTurnCapable` 인터페이스를 정의하여 타입 안전성을 확보. 또는 `processMultiTurnMessage`/`buildMultiTurnFinalOutput` 로직을 서비스 레이어로 올려 핸들러는 순수 실행만 담당하게 분리.

```typescript
// 예시
interface MultiTurnCapable {
  processMultiTurnMessage(message: string, state: Record<string, unknown>): Promise<unknown>;
  buildMultiTurnFinalOutput(...): unknown;
}
```

---

**[WARNING]** `_multiTurnState` — 내부 상태가 공개 인터페이스(nodeOutputCache)를 오염
- 위치: `ai-agent.handler.ts` — `executeMultiTurn` 반환값, `execution-engine.service.ts` — `nodeOutput._multiTurnState`
- 상세: 핸들러의 내부 상태(`_multiTurnState`)가 노드 출력 캐시에 혼재되어 영속됨. 이 상태는 실행 엔진과 핸들러 간 암묵적 계약으로, 타입 안전성 없이 `Record<string, unknown>` 캐스팅 체인이 길어짐. 상태가 PostgreSQL NodeExecution의 `outputData`에도 저장될 경우 내부 구현 상세가 외부로 누출됨.
- 제안: 멀티턴 상태를 `pendingContinuations`와 유사한 별도 `Map<executionId, MultiTurnState>`으로 서비스 레이어에서 관리하거나, Redis에 별도 키로 저장하여 출력 캐시와 분리.

---

**[INFO]** `execution.ai_message` 이벤트 타입이 `ExecutionEventType` enum 미등록
- 위치: `execution-engine.service.ts` — `'execution.ai_message' as ExecutionEventType`
- 상세: 타입 강제 캐스팅으로 enum을 우회. 컴파일 타임 안전성 부재.
- 제안: `ExecutionEventType` enum에 `EXECUTION_AI_MESSAGE = 'execution.ai_message'` 추가.

---

**[INFO]** RAG 시스템 메시지 삽입 방식의 일관성 부재
- 위치: `ai-agent.handler.ts` — `processMultiTurnMessage` 내 RAG 처리 (~280행)
- 상세: 첫 번째 턴은 시스템 프롬프트에 RAG 컨텍스트를 append하지만, 후속 턴은 `{ role: 'system', content: ragContext }` 메시지를 대화 중간에 삽입. 일부 LLM 프로바이더는 시스템 메시지가 복수이거나 중간에 위치하는 경우 오동작할 수 있음.
- 제안: 후속 턴 RAG 컨텍스트를 user 메시지 앞에 user role로 삽입하거나, 첫 번째 시스템 메시지를 업데이트하는 방식으로 통일.

---

**[INFO]** `buildTools`가 `config`와 `state` 모두에서 동일하게 호출
- 위치: `ai-agent.handler.ts` — `buildTools(config)` vs `buildTools(state)` (processMultiTurnMessage)
- 상세: `processMultiTurnMessage`는 `config`가 아닌 `state`를 전달. `state`에 `toolNodeIds`/`toolOverrides`가 없으면 빈 툴 배열 반환. 멀티턴 도중 Tool Use가 silent하게 비활성화될 수 있음.
- 제안: `_multiTurnState`에 `toolNodeIds`와 `toolOverrides`를 명시적으로 포함하거나, 타입 레벨에서 강제.

---

### 요약

이번 변경은 기존 `waiting_for_input` 메커니즘을 재활용하여 Multi Turn AI 대화를 구현한 실용적인 접근으로, 전반적인 아키텍처 방향성은 타당하다. 다만 `ExecutionEngineService`가 `AiAgentHandler`의 구체 메서드를 직접 캐스팅하여 호출하는 부분이 레이어 경계를 침범하고, 멀티턴 내부 상태(`_multiTurnState`)가 노드 출력 캐시와 혼재되어 타입 안전성과 관심사 분리 측면에서 부채가 누적되고 있다. 현재는 단일 AI 노드 타입만 있어 관리 가능하지만, AI 노드 유형이 늘어날 경우 엔진-핸들러 결합이 병목이 될 수 있으므로 `MultiTurnCapable` 인터페이스 추출 또는 상태 저장소 분리를 중기 과제로 검토하길 권장한다.

### 위험도

**MEDIUM**