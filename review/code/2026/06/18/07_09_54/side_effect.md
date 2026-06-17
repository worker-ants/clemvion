# 부작용(Side Effect) 리뷰

## 발견사항

### [INFO] `private` -> `public` 가시성 변경으로 엔진 내부 메서드 5개 노출
- 위치: `/codebase/backend/src/modules/execution-engine/execution-engine.service.ts` 라인 1106, 1240, 1316, 5055, 5376
- 상세: `rehydrateContext`, `loadAndBuildGraph`, `runNodeDispatchLoop`, `clearLlmDefaultConfigCache`, `findActivatedBackEdge` 가 `private` → `public` 으로 변경됨. TypeScript `public` 은 컴파일 타임에만 의미 있고 런타임 NestJS DI 에서는 이미 동일 주소를 참조하므로 기능적 부작용 없음. 단, 엔진 서비스를 직접 주입받는 외부 소비자(`websocket.gateway.ts`, `continuation-execution.processor.ts`, `executions.controller.ts` 등 다수)가 이들 메서드에 직접 접근 가능해진다. 현재 외부 소비자가 이 메서드를 직접 호출하는 코드는 없음을 확인. 의도된 노출이며 `EngineDriver` 인터페이스를 통해서만 계약이 기술됨.
- 제안: 문서 주석에 "내부 capability — EngineDriver 를 통해서만 호출해야 함" 경고를 명시적으로 추가하면 향후 오용 방지에 유용함.

### [INFO] `ExecutionGraphState`, `NodeDispatchLoopParams` 인터페이스 `export` 추가
- 위치: `/codebase/backend/src/modules/execution-engine/execution-engine.service.ts` 라인 401-402, 443
- 상세: 기존 `interface`(비공개) → `export interface` 로 변경. `engine-driver.interface.ts` 가 이 타입들을 import 해 `EngineDriver` 계약에 사용하며, 이는 의도된 변경임. 외부 소비자가 이 타입을 직접 사용하는 경우 모듈 내부 구현 타입 누출이 될 수 있으나 현재 소비자가 없음을 확인.
- 제안: 현 단계 위험도 없음. 단, 이 타입들이 `execution-engine.service` 가 아닌 별도 `types.ts` 에 위치했다면 계층이 더 명확함.

### [INFO] `ExecutionCancelledError` 를 god-class 에서 leaf 에러 모듈로 이동
- 위치: `/codebase/backend/src/modules/execution-engine/execution-engine.service.ts`(삭제) → `/codebase/backend/src/modules/execution-engine/workflow-errors.ts`(추가)
- 상세: 클래스 본문은 완전히 동일하게 보존(`super()` 메시지, `this.name` 값 동일). 엔진 서비스와 `retry-turn.service.ts` 모두 `workflow-errors` 에서 import 하므로 `instanceof` 체크(`error instanceof ExecutionCancelledError`)가 동일 클래스 참조를 보장함. 부작용 없음.
- 제안: 없음.

### [INFO] `RetryTurnService.applyRetryLastTurn` 의 공유 상태 변경 - `contextService.setNodeOutput` 호출
- 위치: `/codebase/backend/src/modules/execution-engine/retry-turn.service.ts` 라인 353-360
- 상세: `RetryTurnService` 가 `ExecutionContextService`(싱글턴, 모듈 공유)의 `setNodeOutput` 을 직접 호출해 nodeOutputCache 에 `{ _resumeState }` 를 주입한다. 이 패턴은 엔진 서비스의 기존 코드(라인 2249 등)와 동일하며 verbatim 이전임. 동일 executionId 에 대해 엔진과 RetryTurnService 가 동시에 이 캐시를 수정하는 경로는 존재하지 않음(retry 경로는 별도 continuation 흐름).
- 제안: 없음.

### [INFO] `RetryTurnService.applyRetryLastTurn` finally 블록 - `contextService.deleteContext` 직접 호출
- 위치: `/codebase/backend/src/modules/execution-engine/retry-turn.service.ts` 라인 409
- 상세: RetryTurnService 가 `finally` 에서 `contextService.deleteContext(executionId)` 를 호출해 공유 in-memory context Map 에서 항목을 제거한다. 이는 원본 엔진 코드의 동일 위치에서 동일한 호출을 verbatim 이전한 것임. 엔진 서비스의 `runExecution` / `resumeFromCheckpoint` 가 동일 executionId 에 대해 동시에 deleteContext 를 호출하는 경로와 교차할 가능성이 이론상 있으나, retry 경로는 기존 실행이 FAILED 상태가 된 이후에만 진입하므로 실제 교차 없음.
- 제안: 없음.

### [INFO] forwardRef 순환 DI 체인 복잡도 증가
- 위치: `/codebase/backend/src/modules/execution-engine/execution-engine.module.ts`, `/codebase/backend/src/modules/execution-engine/retry-turn.service.ts` 라인 75-76
- 상세: `RetryTurnService` → `ENGINE_DRIVER`(=`ExecutionEngineService`) + `AiTurnOrchestrator`(forwardRef). `ExecutionEngineService` → `RetryTurnService`(forwardRef). `AiTurnOrchestrator` → `ENGINE_DRIVER`(=`ExecutionEngineService`). 3개 서비스 간 transitive 순환이 형성됨. NestJS forwardRef 로 해소되며 PR2/PR3 의 동일 패턴 선례가 있음. 부작용 위험은 낮으나, forwardRef 는 DI 컨테이너가 초기화 완료 전 참조를 취득하는 것이므로 생성자에서 주입된 서비스를 즉시 사용하면 `undefined` 가 된다. `RetryTurnService` 생성자 본문에 DI 외 코드가 없으므로 현재 안전함.
- 제안: 현 구조 문제 없음. 향후 이 체인에 생성자 로직이 추가될 경우 forwardRef 순환 위험을 인지해야 함.

### [INFO] 테스트 코드 `(service as unknown as { dataSource: unknown }).dataSource = ...` - 내부 상태 직접 수정 패턴
- 위치: `/codebase/backend/src/modules/execution-engine/retry-turn.service.spec.ts` 라인 1666
- 상세: `installRetryMocks` 가 `(service as unknown as { dataSource: unknown }).dataSource` 를 per-test 로 교체하는 패턴은 엔진 spec 에서 verbatim 이전된 것임. `@InjectDataSource()` 로 주입된 `dataSource` 를 테스트에서 교체하므로 다른 테스트와 `dataSource` 상태가 간섭하지 않도록 `beforeEach` 에서 서비스를 재생성하는 구조가 보장되어야 함. `beforeEach` 에서 `service = new RetryTurnService(...)` 로 새 인스턴스를 생성하므로 테스트 격리 정상. 단, `installRetryMocks` 호출이 없는 테스트가 추가될 경우 기본 `{ transaction: jest.fn() }` 이 사용되어 silent 통과 위험이 있음.
- 제안: 이 패턴은 기존 엔진 spec 과 동일하며 현 테스트 범위에서 안전. 향후 테스트 추가 시 주의.

## 요약

이번 변경은 `RetryTurnService` 신규 추출(strangler-fig C-1 step4)이다. 부작용 관점에서 핵심 위험 요소는 모두 선제적으로 처리되어 있다. `ExecutionCancelledError` 의 leaf 모듈 이동은 `instanceof` 동일 클래스 참조를 보장하며, `ExceutionGraphState`/`NodeDispatchLoopParams` 의 export 추가는 `EngineDriver` 인터페이스 계약 만족을 위한 최소 노출이다. 5개 메서드의 `private` → `public` 전환은 TypeScript 컴파일 타임 가시성 변경이며 현재 외부 직접 호출 경로가 없음을 확인했다. 공유 상태(`contextService`, `llmDefaultConfigCache`)에 대한 접근은 verbatim 이전이며 retry 경로의 격리성으로 동시성 간섭이 없다. forwardRef 순환 DI 복잡도는 PR2/PR3 선례를 따르며 현 생성자 패턴에서 안전하다. 전반적으로 의도하지 않은 부작용 없음.

## 위험도

NONE
