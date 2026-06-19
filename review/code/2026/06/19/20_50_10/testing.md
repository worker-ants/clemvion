# 테스트(Testing) 리뷰 결과

## 발견사항

### **[INFO]** `ack-and-discard` `it.each` 목록에 `retry_last_turn` 제외 여부 미명시
- 위치: `/codebase/backend/src/modules/execution-engine/continuation/continuation-execution.processor.spec.ts` 라인 79-92
- 상세: `ack-and-discard (isNodeExecutionWaiting=false)` 블록의 `it.each` 가 4개 타입(`continue`, `button_click`, `ai_message`, `ai_end_conversation`)만 포함하며 `retry_last_turn` 은 제외된다. 프로세서 본문 주석과 별도 `bypasses isNodeExecutionWaiting guard` 테스트(라인 212)에서 제외 근거(spawned row 는 WAITING 아님)를 설명하고 있어 의도적 설계이다. 그러나 `it.each` 배열에 제외 이유를 한 줄 주석으로 남기면 미래 독자가 의도를 바로 파악할 수 있다.
- 제안: `it.each` 목록 상단에 `// retry_last_turn 은 isNodeExecutionWaiting 가드 외부 — 별도 describe 블록 참조` 주석 추가.

### **[INFO]** `ExecutionEventEmitter` 의 `forwardRef` 변경이 단위 테스트에서 검증되지 않음
- 위치: `/codebase/backend/src/modules/execution-engine/events/execution-event-emitter.service.ts`, 대응 spec `events/execution-event-emitter.service.spec.ts`
- 상세: 변경된 `forwardRef(() => WebsocketService)` 주입은 ES-module 순환 해소 목적이며 런타임 동작은 불변이다. 기존 단위 테스트는 `WebsocketService` 를 직접 생성자 인자로 넘겨 `forwardRef` 를 우회하므로 순환 해소 효과 자체를 검증하지 않는다. `forwardRef` 는 통합/e2e 레벨에서만 검증되며 이 점은 허용 가능하다.
- 제안: 테스트 추가 의무 없음.

### **[INFO]** `EngineDriver` 분해 후 인터페이스 계층 자체에 대한 타입 정합 테스트 부재
- 위치: `/codebase/backend/src/modules/execution-engine/engine-driver.interface.ts`
- 상세: `EngineDriver extends AiTurnEngineDriver, RetryEngineDriver` 합집합 선언이 `ExecutionEngineService implements EngineDriver` 와 연결된다. 각 소비자 spec 이 `jest.Mocked<XxxEngineDriver>` 로 슬라이스 타입을 선언하는 방식으로 컴파일 타임 정합이 확인되므로 별도 타입 레벨 단위 테스트는 불필요하며 현재 구조는 적절하다.
- 제안: 현행 유지.

### **[INFO]** `websocket.gateway.spec.ts` 의 `RetryTurnService` mock 이 `retryLastTurn` 만 선언
- 위치: `/codebase/backend/src/modules/websocket/websocket.gateway.spec.ts` 라인 85-89
- 상세: gateway spec 의 `RetryTurnService` mock 은 `retryLastTurn` 만 선언한다. `applyRetryLastTurn` 은 gateway 에서 직접 호출하지 않고 continuation processor 가 호출하므로 mock 표면이 실제 사용 표면과 정확히 일치한다. Mock 적절성 문제 없음.
- 제안: 현행 유지.

### **[INFO]** `execution-engine.service.spec.ts` 의 `retryTurnService.applyRetryLastTurn` 통합 테스트 구조
- 위치: `/codebase/backend/src/modules/execution-engine/execution-engine.service.spec.ts` 라인 1530-1539
- 상세: 변경 후 `service.applyRetryLastTurn` → `retryTurnService.applyRetryLastTurn` 으로 15개 호출 지점이 일괄 갱신됐다. `retryTurnService` 는 `module.get<RetryTurnService>(RetryTurnService)` 로 실 인스턴스를 취득해 `driver = 엔진` 협력이 그대로 exercise 되는 구조다. 엔진 delegator 제거 후에도 통합 테스트가 동일 시나리오를 유효하게 커버한다.
- 제안: 현행 유지.

---

## 요약

이번 변경은 `EngineDriver` 단일 인터페이스를 ISP 원칙에 따라 `CoreEngineDriver`, `InteractionEngineDriver`, `ReentryStateDriver`, `AiTurnEngineDriver`, `RetryEngineDriver` 로 분해하고 `engine→Retry` 순환 DI 를 단방향으로 정리하는 리팩터링이다. 각 서비스 spec 은 각자의 슬라이스 인터페이스로 mock 타입을 교체했고 동작 어서션은 변경 없이 보존됐다. `continuation-execution.processor.spec.ts` 는 `applyRetryLastTurn` mock 을 엔진에서 `RetryTurnService` 로 정확히 이전했으며, `retry_last_turn` 이 `isNodeExecutionWaiting` 가드를 우회하는 별도 테스트도 보완됐다. `websocket.gateway.spec.ts` 도 `retryLastTurn` 호출 대상을 `RetryTurnService` mock 으로 이전해 에러 ack 시나리오 4종을 모두 검증한다. 기존 15개 `applyRetryLastTurn` 통합 테스트는 실 인스턴스로 교체돼 엔진 delegator 제거 후에도 커버리지가 유효하게 유지된다. 발견된 사항은 모두 INFO 수준이며 테스트 격리·독립 실행·가독성·Mock 적절성 모두 양호하다.

## 위험도

NONE
