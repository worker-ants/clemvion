### 발견사항

- **[WARNING]** `AiAgentHandler`를 핸들러 레지스트리에서 직접 이중 캐스팅하여 참조
  - 위치: `execution-engine.service.ts` — `waitForAiConversation()` 내 두 곳 (`handler as unknown as AiAgentHandler`)
  - 상세: `handlerRegistry`는 `NodeHandler` 인터페이스로 추상화되어 있으나, 서비스 레이어가 구체 구현체(`AiAgentHandler`)의 공개 메서드(`processMultiTurnMessage`, `buildMultiTurnFinalOutput`)를 직접 호출하기 위해 타입 시스템을 우회함. 이는 핸들러 레지스트리 추상화를 형해화하고, 향후 `AiAgentHandler` 시그니처 변경 시 컴파일 에러 없이 런타임 오류로만 발견됨. `AiAgentHandler` 임포트가 서비스 레이어에 추가되어 레이어 간 의존 방향이 역전됨.
  - 제안: 아래 중 하나를 선택:
    1. `MultiTurnCapable` 인터페이스를 정의하고 `AiAgentHandler`가 구현하도록 한 뒤, 서비스에서 해당 인터페이스로 캐스팅
    2. `ExecutionEngineService`가 `AiAgentHandler`를 직접 DI로 주입받아 명시적 의존성으로 관리
    3. `processMultiTurnMessage` / `buildMultiTurnFinalOutput` 로직을 서비스 레이어로 이동

- **[WARNING]** `ExecutionEngineService` ↔ `WebsocketGateway` 순환 의존성 심화
  - 위치: `websocket.gateway.ts` 생성자, `execution-engine.service.ts`의 `websocketService` 주입
  - 상세: 기존에도 `forwardRef`로 처리 중이던 순환 의존성이 이번 변경으로 상호 호출 경로가 추가됨. `continueAiConversation`/`endAiConversation`은 WebSocket → ExecutionEngine 방향이고, `emitExecutionEvent` / `emitNodeEvent`는 ExecutionEngine → WebSocket 방향. 멀티턴 대화 루프 내에서 두 방향 호출이 반복되는 구조로, `forwardRef`에 대한 의존도가 증가하고 모듈 초기화 순서 문제 발생 가능성이 높아짐.
  - 제안: NestJS `EventEmitter2` 또는 내부 이벤트 버스를 도입하여 양방향 직접 참조를 단방향 이벤트 발행으로 분리. 단기적으로는 현 구조 유지 가능하나 확장 전 해소 권장.

- **[WARNING]** `ExecutionEventType` enum 미등록 값의 강제 캐스팅
  - 위치: `execution-engine.service.ts` — `'execution.ai_message' as ExecutionEventType`
  - 상세: `execution.ai_message` 이벤트가 `ExecutionEventType` enum에 추가되지 않아 문자열 리터럴을 enum 타입으로 강제 캐스팅. `ExecutionEventType`에 의존하는 switch문, 필터, 로깅 코드에서 이 이벤트가 누락될 수 있음. `emitExecutionEvent` 메서드의 타입 안전성이 실질적으로 무력화됨.
  - 제안: `ExecutionEventType` enum에 `EXECUTION_AI_MESSAGE = 'execution.ai_message'` 추가 후 캐스팅 제거.

- **[INFO]** `buildTools`가 `config`와 `state`를 동일한 `Record<string, unknown>` 타입으로 혼용
  - 위치: `ai-agent.handler.ts` — `buildTools(config)` vs `buildTools(state)`
  - 상세: `buildTools`는 `Record<string, unknown>`을 받아 `toolNodeIds`/`toolOverrides`를 추출하는데, `processMultiTurnMessage`에서는 `config` 대신 `state(_multiTurnState)`를 전달함. `state`에 해당 필드가 없어 항상 빈 배열 반환 (ND-AG-14 위반). 타입 시스템이 이 혼용을 감지하지 못하는 것이 근본 원인.
  - 제안: `MultiTurnState` 인터페이스에 `toolNodeIds`/`toolOverrides`를 명시적으로 포함하고, `executeMultiTurn`의 `_multiTurnState` 구성 시 해당 필드 추가.

- **[INFO]** 새로운 외부 패키지 의존성 없음
  - 상세: 이번 변경에서 추가된 npm 패키지는 없음. 번들 크기, 라이선스, 알려진 취약점 측면에서 추가 위험 없음. 모든 기능은 기존 내부 서비스(`LlmService`, `RagSearchService`, `WebsocketService`)와 NestJS 내장 기능으로 구현됨.

---

### 요약

이번 변경은 외부 패키지를 추가하지 않아 번들·라이선스·취약점 측면의 의존성 위험은 없다. 그러나 내부 의존성 설계에서 두 가지 구조적 문제가 있다. 첫째, `ExecutionEngineService`가 추상화된 핸들러 레지스트리를 우회하여 `AiAgentHandler` 구체 클래스를 직접 이중 캐스팅으로 참조함으로써 레이어 분리 원칙이 위반되고 타입 안전성이 훼손된다. 둘째, 기존부터 존재하던 `ExecutionEngineService` ↔ `WebsocketGateway` 순환 의존성이 이번 멀티턴 대화 기능 추가로 상호 호출 경로가 증가하여 결합도가 심화되었다. `ExecutionEventType` enum 미등록으로 인한 강제 캐스팅과 `buildTools`의 config/state 혼용은 타입 계약의 신뢰성을 낮추는 부채로, `MultiTurnCapable` 인터페이스 정의 또는 `AiAgentHandler` 직접 DI 주입이 단기 해결책으로 권장된다.

### 위험도
**MEDIUM**