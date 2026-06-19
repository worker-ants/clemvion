# 부작용(Side Effect) 리뷰 결과

## 발견사항

### [INFO] 인터페이스 분할 — 기존 `EngineDriver` 이름이 상위 합집합 인터페이스로 재정의됨
- 위치: `codebase/backend/src/modules/execution-engine/engine-driver.interface.ts`
- 상세: 기존의 단일 `EngineDriver` 인터페이스가 `CoreEngineDriver`, `InteractionEngineDriver`, `ReentryStateDriver`, `AiTurnEngineDriver`, `RetryEngineDriver`로 분해되고, `EngineDriver`는 `AiTurnEngineDriver & RetryEngineDriver`의 합집합 별칭으로 유지됐다. 이름(`EngineDriver`)이 보존되고 `ExecutionEngineService implements EngineDriver`는 변함없으므로 런타임 바인딩(`ENGINE_DRIVER useExisting`)에 영향이 없다. 각 소비자 서비스는 더 좁은 부분 인터페이스 타입(`AiTurnEngineDriver`, `InteractionEngineDriver`, `RetryEngineDriver`)으로 교체됐는데, 이는 컴파일 타임 가시성 축소일 뿐 런타임 동작에 아무 변화가 없다.
- 제안: 이슈 없음.

### [INFO] `ExecutionEventEmitter`에 `forwardRef` 추가 — 동작 동일, 초기화 순서 방어
- 위치: `codebase/backend/src/modules/execution-engine/events/execution-event-emitter.service.ts`
- 상세: `WebsocketService` 생성자 주입에 `@Inject(forwardRef(() => WebsocketService))`가 추가됐다. `forwardRef`는 NestJS가 DI 그래프를 해석할 때 모듈 로드 순서와 무관하게 동작하도록 지연 참조를 제공한다. 이는 `websocketService` 필드 접근 동작을 변경하지 않으며 실제 주입 대상 인스턴스도 동일하다. 이벤트 발행 메서드(`emitExecution`, `emitNode`, `registerExecutionRouting`, `releaseExecutionRouting`) 내용은 변경되지 않았다.
- 제안: 이슈 없음.

### [INFO] `ExecutionEngineService`에서 `RetryTurnService` 역방향 주입 제거 — thin delegator 두 메서드 삭제
- 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts`
- 상세: 엔진에서 `retryTurnService` 필드가 제거됐고, thin delegator인 `retryLastTurn()`과 `applyRetryLastTurn()` 두 메서드가 삭제됐다. 이 메서드들을 외부에서 호출하던 진입점(websocket.gateway, continuation-execution.processor)은 이번 변경에서 동시에 `RetryTurnService`를 직접 호출하도록 교체됐다. 따라서 엔진의 공개 API 감소가 현재 알려진 호출자를 깨뜨리지 않는다.
  - 주의: 만약 이 두 메서드를 참조하는 다른 코드(예: 외부 모듈, e2e 테스트, 또는 변경 범위에 포함되지 않은 통합 진입점)가 존재한다면 런타임 오류가 발생한다. 변경된 파일 목록 내에서는 모든 호출 사이트가 교체됐음을 확인했다.
- 제안: 삭제된 두 메서드에 대해 다른 소비자가 없는지 코드베이스 전체 grep 확인을 권장한다(`executionEngineService.retryLastTurn`, `executionEngineService.applyRetryLastTurn`, `service.retryLastTurn`, `service.applyRetryLastTurn`).

### [INFO] `WebsocketGateway`에 `RetryTurnService` 직접 주입 추가 — `forwardRef` 사용
- 위치: `codebase/backend/src/modules/websocket/websocket.gateway.ts`
- 상세: `WebsocketGateway` 생성자에 `@Inject(forwardRef(() => RetryTurnService)) private readonly retryTurnService: RetryTurnService`가 추가됐다. `WebsocketModule`이 `ExecutionEngineModule`을 import(또는 forwardRef로 import)해야 `RetryTurnService`를 주입받을 수 있다. `execution-engine.module.ts`에서 `RetryTurnService`가 `exports`에 추가됐음을 확인했으므로 DI 해석은 정상이다. `handleRetryLastTurn` 핸들러의 로직 자체(validate+consume+spawn → publish)는 동일하게 유지된다.
- 제안: 이슈 없음.

### [INFO] `ContinuationExecutionProcessor`에 `RetryTurnService` 직접 주입 추가
- 위치: `codebase/backend/src/modules/execution-engine/continuation/continuation-execution.processor.ts`
- 상세: 프로세서 생성자에 `private readonly retryTurnService: RetryTurnService`가 추가됐다. `retry_last_turn` 케이스에서 `this.engine.applyRetryLastTurn(...)` 대신 `this.retryTurnService.applyRetryLastTurn(...)`을 호출한다. 프로세서가 같은 모듈 내 서비스를 사용하므로 DI 해석에 문제가 없다. 나머지 dispatch 케이스(continue, cancel, button_click, ai_message, ai_end_conversation)는 여전히 `this.engine`을 통한다.
- 제안: 이슈 없음.

### [INFO] `execution-engine.module.ts`에서 `RetryTurnService` export 추가
- 위치: `codebase/backend/src/modules/execution-engine/execution-engine.module.ts`
- 상세: `RetryTurnService`가 module exports에 추가됐다. 이로 인해 다른 모듈(WebsocketModule 등)이 `RetryTurnService`를 import하여 주입받을 수 있다. 이것은 의도된 변경이다(`WebsocketGateway`가 직접 주입받도록). 기존 providers 목록에 `RetryTurnService`가 이미 있었으므로 providers 변경은 없다.
- 제안: 이슈 없음.

### [INFO] 테스트 파일의 타입 참조 교체 — 런타임 영향 없음
- 위치: 파일 1, 3, 12, 14, 16 (각 `.spec.ts`)
- 상세: 모든 테스트 파일에서 `EngineDriver` 타입 참조가 대응하는 부분 인터페이스(`AiTurnEngineDriver`, `InteractionEngineDriver`, `RetryEngineDriver`)로 교체됐다. TypeScript 타입은 컴파일 타임 전용이므로 런타임 동작에 영향이 없다. 모의 객체가 실제로 구현하는 메서드 집합도 변경 전과 동일하다(`as unknown as jest.Mocked<...>` 캐스팅 유지).
- 제안: 이슈 없음.

### [INFO] 일관성 검토 산출물 파일 추가 — 코드 동작과 무관
- 위치: `review/consistency/2026/06/19/17_39_03/` 하위 5개 파일
- 상세: 이 파일들은 구현 착수 전 일관성 검토 결과물이며 런타임 코드에 포함되지 않는다. 부작용 관점에서 검토 대상 외.
- 제안: 이슈 없음.

---

## 요약

이 변경은 C-1 후속 ④(ISP 적용 + engine→Retry 순환 DI 제거)로, 단일 `EngineDriver` 인터페이스를 소비자별 부분 인터페이스로 분해하고, `ExecutionEngineService`에서 `RetryTurnService` 역방향 의존성을 제거한 리팩터링이다. 런타임 DI 바인딩(`ENGINE_DRIVER useExisting ExecutionEngineService`)과 모든 메서드 본문은 변경 전과 완전히 동일하게 보존됐다. 삭제된 엔진 thin delegator 두 메서드(`retryLastTurn`, `applyRetryLastTurn`)는 변경 범위 내의 모든 호출 사이트(websocket.gateway, continuation-execution.processor, 관련 spec 파일)에서 동시에 교체됐다. `ExecutionEventEmitter`의 `forwardRef` 추가도 초기화 순서 방어 목적으로 동작을 변경하지 않는다. 의도치 않은 전역 상태 변경, 파일시스템 부작용, 네트워크 호출, 환경 변수 접근, 이벤트·콜백 변경은 발견되지 않았다. 유일하게 주의할 점은 삭제된 엔진 메서드에 대해 변경 범위 밖의 다른 호출자가 없는지 확인하는 것이나, 이는 컴파일 타임에 TypeScript가 즉시 검출하므로 런타임 위험은 낮다.

---

## 위험도

LOW
