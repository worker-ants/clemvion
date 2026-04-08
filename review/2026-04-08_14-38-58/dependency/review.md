### 발견사항

- **[WARNING]** `AiAgentHandler`를 레지스트리에서 직접 캐스팅하여 사용
  - 위치: `execution-engine.service.ts` — `waitForAiConversation()`
  - 상세: `this.handlerRegistry.get('ai_agent') as unknown as AiAgentHandler` 패턴은 런타임 타입 안전성이 없으며, `AiAgentHandler`에 대한 직접 의존성을 서비스 레이어에 도입함. 핸들러 레지스트리의 추상화를 깨는 설계 결함.
  - 제안: `NodeHandler` 인터페이스를 확장하거나, `AiAgentHandler`만 사용하는 별도 메서드를 인터페이스에 추가하거나, 실행 엔진이 직접 `AiAgentHandler`를 DI로 주입받는 방식으로 변경할 것.

- **[WARNING]** 순환 의존성 위험 — `ExecutionEngineService` ↔ `WebsocketGateway`
  - 위치: `websocket.gateway.ts` 생성자, `execution-engine.service.ts`의 `websocketService` 주입
  - 상세: 기존에도 `forwardRef`로 처리 중이지만, AI 대화 기능 추가로 두 서비스 간 상호 호출 경로가 증가함. `continueAiConversation`, `endAiConversation`이 WebSocket에서 ExecutionEngine을 직접 호출하고, ExecutionEngine은 다시 WebSocket으로 이벤트를 emit하는 구조.
  - 제안: 이벤트 기반 아키텍처(NestJS EventEmitter 또는 Redis Pub/Sub)로 분리하여 순환 의존성 제거 권장.

- **[WARNING]** `execution.ai_message`를 `ExecutionEventType` 열거형 외부 문자열로 사용
  - 위치: `execution-engine.service.ts:176` — `'execution.ai_message' as ExecutionEventType`
  - 상세: 타입 캐스팅으로 열거형 타입 안전성을 우회함. `ExecutionEventType`에 해당 값이 정의되어 있지 않으면 런타임 오류나 의도치 않은 이벤트 누락 가능.
  - 제안: `ExecutionEventType` 열거형에 `EXECUTION_AI_MESSAGE = 'execution.ai_message'`를 추가할 것.

- **[INFO]** `processMultiTurnMessage`에서 `buildTools(state)`를 호출 시 `state` 타입 사용
  - 위치: `ai-agent.handler.ts` — `processMultiTurnMessage()`
  - 상세: `buildTools`는 `Record<string, unknown>` 파라미터를 받으며, `state` 객체를 config로 재사용. `toolNodeIds`, `toolOverrides` 등 키가 `state`에 반드시 존재한다는 보장이 없음. 두 역할(config, state)을 동일 타입으로 처리하는 것은 내부 의존성 설계 혼란.
  - 제안: `MultiTurnState` 전용 타입/인터페이스를 분리하고, `buildTools`를 config와 state 각각에서 명시적으로 호출하도록 분리할 것.

- **[INFO]** 새로운 외부 패키지 의존성 없음
  - 상세: 이번 변경에서 추가된 외부 라이브러리(npm 패키지)는 없음. 모든 기능은 기존 내부 서비스(`LlmService`, `RagSearchService`, `WebsocketService`)와 NestJS 내장 기능을 활용.

- **[INFO]** 테스트에서 `AiAgentHandler`를 직접 인스턴스화
  - 위치: `ai-agent.handler.spec.ts` — `beforeEach`
  - 상세: `new AiAgentHandler(mockLlmService, mockRagService)` 형태로 직접 생성. NestJS DI 컨테이너를 사용하지 않으므로 핸들러의 내부 의존성 변경 시 테스트도 함께 수정 필요. 현재로서는 적절한 단위 테스트 방식.

---

### 요약

이번 변경은 새로운 외부 패키지를 추가하지 않아 번들 크기, 라이선스, 취약점 측면에서는 위험이 없다. 그러나 **내부 의존성 설계**에서 주목할 문제가 있다: `ExecutionEngineService`가 추상화된 핸들러 레지스트리를 통하지 않고 `AiAgentHandler`를 직접 캐스팅하여 참조함으로써 레이어 분리 원칙이 위반되고, 향후 핸들러 교체나 확장 시 서비스 코드 수정이 필요해진다. `ExecutionEventType` 열거형 미등록 값의 강제 캐스팅도 타입 안전성을 해친다. 기존부터 존재하는 `ExecutionEngineService` ↔ `WebsocketGateway` 순환 의존성은 이번 기능 추가로 결합도가 더 높아졌으므로 장기적으로 이벤트 기반 분리를 고려할 필요가 있다.

### 위험도
**MEDIUM**