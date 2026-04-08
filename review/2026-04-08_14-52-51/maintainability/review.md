### 발견사항

---

**[WARNING]** `waitForAiConversation` 메서드 과대 크기 및 다중 책임 (~130줄)
- 위치: `execution-engine.service.ts` — `waitForAiConversation()`
- 상세: 상태 업데이트, WS 이벤트 발송, 대화 루프 제어, 핸들러 직접 호출, 노드 실행 완료 기록이 단일 메서드에 혼재. 기존 `waitForPresentation`/`waitForButtonInteraction` 패턴과 구조적으로 이질적이어서 일관성 저하.
- 제안: `emitConversationWaiting()`, `handleAiEndAction()`, `handleAiMessageAction()`, `finalizeNodeExecution()` 등 서브 메서드로 분리

---

**[WARNING]** LLM 호출 + tool calling 루프가 3개 메서드에 중복
- 위치: `ai-agent.handler.ts` — `executeSingleTurn`, `executeMultiTurn`, `processMultiTurnMessage`
- 상세: `while (result.toolCalls?.length && toolCallCount < maxToolCalls)` 블록이 세 메서드에 거의 동일하게 반복됨. 로직 변경 시 3곳 모두 수정 필요.
- 제안: `runLlmWithToolLoop(llmConfig, messages, options): Promise<LlmResult>` 공통 메서드 추출

---

**[WARNING]** `Record<string, unknown>` 과용으로 타입 안전성 및 가독성 저하
- 위치: `execution-engine.service.ts` — `waitForAiConversation` 전반, `ai-agent.handler.ts` — `processMultiTurnMessage`, `buildMultiTurnFinalOutput`
- 상세: `nodeOutput._multiTurnState as Record<string, unknown>`, `multiTurnState.messages as Array<Record<string, unknown>>` 등 런타임 캐스팅이 광범위하게 사용됨. 필드 추가/삭제 시 전파 파악이 어려움.
- 제안: `MultiTurnState`, `ConversationConfig`, `AiAgentOutput` 인터페이스 정의하여 타입 안전성 확보

---

**[WARNING]** `handlerRegistry.get('ai_agent') as unknown as AiAgentHandler` 이중 캐스팅
- 위치: `execution-engine.service.ts` — `waitForAiConversation` (두 곳)
- 상세: `unknown`으로 우회하는 이중 캐스팅은 타입 시스템을 의도적으로 무력화하며, 이 패턴이 다른 핸들러로 확산될 위험이 있음. 또한 루프 내 두 분기에서 각각 핸들러를 가져오는 것도 비효율적.
- 제안: 루프 진입 전 한 번만 핸들러를 추출하거나, `MultiTurnCapable` 인터페이스 정의 후 DI로 직접 주입

---

**[WARNING]** `processMultiTurnMessage`의 config 추출 패턴이 `executeMultiTurn`과 중복
- 위치: `ai-agent.handler.ts` — `processMultiTurnMessage` 상단 (~13개 변수 추출)
- 상세: `state`에서 `llmConfigId`, `model`, `temperature`, `maxTokens`, `knowledgeBases` 등을 매번 타입 캐스팅으로 추출하는 패턴이 `executeMultiTurn`의 config 추출과 동일 구조. `MultiTurnState` 인터페이스가 없어 오타/누락에 취약.
- 제안: `MultiTurnState` 인터페이스 정의 후 타입 안전하게 접근

---

**[INFO]** `'execution.ai_message' as ExecutionEventType` 리터럴 캐스팅
- 위치: `execution-engine.service.ts` — `waitForAiConversation`
- 상세: `ExecutionEventType` enum에 `EXECUTION_AI_MESSAGE`가 없어 문자열 리터럴 + 캐스팅으로 우회. 이벤트 타입 추가 시 일관성 없이 누락될 수 있음.
- 제안: `ExecutionEventType.EXECUTION_AI_MESSAGE = 'execution.ai_message'` enum 값 추가

---

**[INFO]** `setTimeout` 반환 핸들 미관리
- 위치: `execution-engine.service.ts` — `waitForAiConversation` 대화 루프 내 `setTimeout`
- 상세: `setTimeout` 반환값을 저장하지 않아 Promise가 이미 resolve된 이후에도 타이머가 GC되지 않고 잔류 가능. 기존 `waitForPresentation` 패턴과 일관성 없음. (동시에 concurrency 버그이기도 함)
- 제안: `const timerId = setTimeout(...)` 저장 후 resolve 시 `clearTimeout(timerId)` 호출

---

**[INFO]** `handleSubmitMessage`, `handleEndConversation`에서 `nodeId` 파라미터 수신 후 미사용
- 위치: `websocket.gateway.ts` — 두 핸들러
- 상세: `data.nodeId`를 받지만 실제 서비스 호출 시 전달하지 않음. 향후 혼동 요소이며 프로토콜 명세상 필수/선택 여부가 불명확.
- 제안: 미사용 파라미터 제거 또는 검증 로직에 활용

---

**[INFO]** 테스트의 `state` 픽스처 중복 정의
- 위치: `ai-agent.handler.spec.ts` — `processMultiTurnMessage` describe 블록
- 상세: 동일한 기본 state 구조가 3개 테스트에 중복 정의됨. 필드 추가/변경 시 모든 테스트에서 수정 필요.
- 제안: `const baseMultiTurnState = { ... }` 공통 픽스처로 추출, 테스트별 override 패턴 사용

---

### 요약

이번 변경은 Multi Turn AI 대화 기능을 기존 `waiting_for_input` 메커니즘 위에 기능적으로 잘 구현했으나, 유지보수성 측면에서 여러 부채가 발생했습니다. 가장 심각한 문제는 **LLM+tool calling 루프가 3개 메서드에 중복**되어 있어 로직 변경 시 3곳을 동시에 수정해야 한다는 점과, `MultiTurnState` 인터페이스 미정의로 인한 **`Record<string, unknown>` 캐스팅 체인**이 코드 전반에 확산된 점입니다. `waitForAiConversation`의 ~130줄 단일 메서드도 이해와 테스트가 어렵습니다. `ExecutionEventType` enum 미등록과 `setTimeout` 핸들 미관리는 소규모이지만 실제 버그로 이어질 수 있는 사항입니다. `runLlmWithToolLoop()` 공통 메서드 추출과 `MultiTurnState` 타입 정의가 선행되어야 장기 유지보수가 용이해집니다.

### 위험도
**MEDIUM**