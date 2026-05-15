## 유지보수성 코드 리뷰

### 발견사항

---

**[WARNING]** `waitForAiConversation` 메서드가 너무 많은 책임을 가짐 (함수 길이 ~130줄)
- 위치: `execution-engine.service.ts` — `waitForAiConversation`
- 상세: 상태 업데이트, WS 이벤트 방출, 대화 루프, 종료 처리, 노드 실행 완료 기록까지 단일 메서드에 혼재. 기존 `waitForPresentation`/`waitForButtonInteraction` 패턴과도 구조적으로 차별화되어 일관성이 낮음.
- 제안: `emitConversationWaiting()`, `handleAiEndAction()`, `handleAiMessageAction()`, `finalizeNodeExecution()` 등 서브 메서드로 분리

---

**[WARNING]** `executeMultiTurn`과 `executeSingleTurn`에 LLM 호출 + tool calling 루프가 중복
- 위치: `ai-agent.handler.ts` — `executeMultiTurn` (L~230-270), `executeSingleTurn` (L~110-145)
- 상세: `while (result.toolCalls?.length && toolCallCount < maxToolCalls)` 블록이 두 메서드에서 거의 동일하게 반복됨. `processMultiTurnMessage`에도 동일 패턴 세 번째 등장.
- 제안: `runLlmWithToolLoop(llmConfig, messages, options): Promise<LlmResult>` 공통 메서드 추출

---

**[WARNING]** `processMultiTurnMessage`에서 config 해석 패턴이 `executeMultiTurn`과 중복
- 위치: `ai-agent.handler.ts` — `processMultiTurnMessage` (L~280-300)
- 상세: `state`에서 `llmConfigId`, `model`, `temperature`, `maxTokens`, `knowledgeBases`, `ragTopK`, `ragThreshold` 등을 매번 타입 캐스팅으로 추출. `executeMultiTurn`의 config 추출과 동일 구조이며 오타/누락에 취약.
- 제안: `MultiTurnState` 인터페이스 정의 후 타입 안전하게 사용

---

**[WARNING]** `Record<string, unknown>` 과용으로 타입 안전성 및 가독성 저하
- 위치: `execution-engine.service.ts` — `waitForAiConversation` 전반, `ai-agent.handler.ts` — `processMultiTurnMessage`, `buildMultiTurnFinalOutput`
- 상세: `nodeOutput._multiTurnState as Record<string, unknown>`, `multiTurnState.messages as Array<Record<string, unknown>>` 등 런타임 캐스팅이 광범위하게 사용됨. 내부 도메인 상태임에도 불구하고 인터페이스가 없어 필드 추가/삭제 시 전파 파악이 어려움.
- 제안: `MultiTurnState`, `ConversationConfig`, `AiAgentOutput` 인터페이스 정의

---

**[WARNING]** `handlerRegistry.get('ai_agent') as unknown as AiAgentHandler` 이중 캐스팅
- 위치: `execution-engine.service.ts` — `waitForAiConversation` (두 곳)
- 상세: 핸들러를 `unknown`으로 우회하는 이중 캐스팅은 타입 시스템을 의도적으로 무력화. 이 패턴이 다른 핸들러로 확산될 위험이 있음.
- 제안: `NodeHandlerRegistry.get<T>(type): T` 제네릭 오버로드 추가 또는 `AiAgentHandler`를 직접 주입

---

**[INFO]** `'execution.ai_message' as ExecutionEventType` 리터럴 캐스팅
- 위치: `execution-engine.service.ts` — `waitForAiConversation`
- 상세: `ExecutionEventType` enum에 `EXECUTION_AI_MESSAGE`가 없어 문자열 리터럴 + 캐스팅으로 우회함. 이벤트 타입 추가 시 일관성 없이 누락될 수 있음.
- 제안: `ExecutionEventType.EXECUTION_AI_MESSAGE = 'execution.ai_message'` enum 값 추가

---

**[INFO]** `setTimeout`의 타임아웃 핸들 미관리 (메모리 누수 가능성)
- 위치: `execution-engine.service.ts` — `waitForAiConversation` 대화 루프 내 `setTimeout`
- 상세: `setTimeout` 반환값을 저장하지 않아 Promise가 이미 resolve된 이후에도 타이머가 실행 시도될 수 있음. 기존 `waitForPresentation` 패턴과 일관성이 없음.
- 제안: `const timer = setTimeout(...)` 후 resolve 시 `clearTimeout(timer)` 호출

---

**[INFO]** `handleSubmitMessage`에서 `nodeId` 파라미터가 수신되지만 미사용
- 위치: `websocket.gateway.ts` — `handleSubmitMessage`, `handleEndConversation`
- 상세: 두 핸들러 모두 `data.nodeId`를 받지만 내부에서 사용하지 않음. 향후 혼동 요소가 될 수 있으며 프로토콜 명세상 필수 필드인지 선택 필드인지 불명확.
- 제안: 미사용 파라미터 제거 또는 검증 로직에 활용

---

**[INFO]** `processMultiTurnMessage` 테스트에서 state 객체 중복 정의
- 위치: `ai-agent.handler.spec.ts` — `processMultiTurnMessage` describe 블록
- 상세: 동일한 기본 state 구조가 세 테스트에 중복 정의됨. 필드 추가/변경 시 모든 테스트에서 수정 필요.
- 제안: `const baseMultiTurnState = { ... }` 공통 픽스처로 추출, 테스트별 override 패턴 사용

---

### 요약

이번 변경은 Multi Turn AI 대화 기능을 기존 `waiting_for_input` 메커니즘 위에 잘 녹여냈으나, 빠른 구현 과정에서 유지보수성 부채가 다수 발생했습니다. 특히 LLM+tool calling 루프의 세 번 중복, `MultiTurnState`에 대한 인터페이스 부재로 인한 광범위한 `Record<string, unknown>` 캐스팅, `waitForAiConversation`의 과도한 함수 크기가 주요 문제입니다. `ExecutionEventType` enum 미등록과 타이머 미관리는 소규모 버그로 이어질 수 있습니다. 전반적으로 기능은 완성되어 있으나, `MultiTurnState` 타입 정의와 tool loop 추출 리팩터링이 선행되어야 장기 유지보수가 용이해집니다.

### 위험도

**MEDIUM**