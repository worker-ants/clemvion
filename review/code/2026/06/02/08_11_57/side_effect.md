# 부작용(Side Effect) 리뷰 결과

## 발견사항

### [INFO] `parallel-executor.ts`: `parentParallelConcurrency` 시그니처 변경 — `optional` → `required (number | undefined)`
- 위치: `parallel-executor.ts` 라인 796 (`parentParallelConcurrency?: number` → `parentParallelConcurrency: number | undefined`)
- 상세: TypeScript 컴파일러 관점에서 `?: number`(optional) 와 `number | undefined`(required) 는 런타임 동작이 동일하다. 그러나 컴파일 타입 규칙이 달라진다. optional 은 인자를 아예 생략해도 허용되지만, `number | undefined` 는 생략 불가 — 반드시 `undefined` 를 명시해야 한다. 변경 이후 `execute()` 를 호출하는 모든 호출처가 명시 전달하지 않으면 컴파일 오류가 발생한다. diff 상 테스트 파일 두 곳(`parallel-executor.spec.ts`, `parallel-p2-integration.spec.ts`) 모두 기존 `undefined`-생략 호출에 `undefined` 를 명시적으로 추가했으므로 테스트 측 대응은 완료됐다. 그러나 실제 엔진 호출처(`execution-engine.service.ts`)의 `runParallel` → `parallelExecutor.execute(...)` 호출 부분은 이번 diff 에 포함되지 않아 직접 확인할 수 없다. 해당 호출처가 이미 4번째 인자를 전달하고 있다면 컴파일은 통과한다. 하지만 전달하지 않고 있다면 컴파일 오류가 발생한다.
- 제안: `execution-engine.service.ts` 의 `runParallel` 내부에서 `parallelExecutor.execute(...)` 를 호출하는 라인을 확인해 4번째 인자가 명시 전달되고 있는지 검증한다. `ParallelBranchContext.parentParallelConcurrency` 를 읽어 `undefined` 또는 숫자로 전달하는 패턴이 이미 있어야 한다.

### [INFO] `execution-engine.service.ts`: `branchParentContext` 타입 어노테이션 제거 — 타입 추론 위임
- 위치: `execution-engine.service.ts` 라인 7701 (`const branchParentContext: ExecutionContext` → `const branchParentContext`)
- 상세: 런타임 동작에는 영향 없다. 명시 타입 어노테이션(`ExecutionContext`)이 제거되면 TypeScript 가 spread 결과를 실제 shape 으로 추론한다. `context` 가 `ParallelBranchContext`(= `ExecutionContext & { parentParallelConcurrency?: number; abortSignal?: AbortSignal }`)일 때 `{ ...context, parentNodeExecutionId }` 의 추론 타입에 `parentParallelConcurrency` 가 드러나게 된다. 이는 의도된 변경으로, 기존 명시 어노테이션이 ghost field 를 은닉하던 문제를 해소한다. 부작용 관점에서 negative 없음.
- 제안: 없음. 의도된 정확한 수정.

### [INFO] 테스트 파일에서 `undefined` 명시 추가 — 기존 동작 보존
- 위치: `parallel-executor.spec.ts` (13개 호출처), `parallel-p2-integration.spec.ts` (2개 호출처)
- 상세: 모두 기존에 4번째 인자 없이 호출되던 자리에 `undefined` 를 추가한 것이다. 런타임 동작은 동일하며, 시그니처 변경(`?: number` → `number | undefined`)에 맞춰 컴파일 오류를 해소하는 기계적 수정이다. 의도치 않은 상태 변경, 전역 변수, 파일시스템, 네트워크, 이벤트 측면의 부작용은 없다.
- 제안: 없음.

## 요약

이번 변경의 핵심은 `ParallelExecutor.execute()` 의 4번째 파라미터 타입을 `optional`에서 `required (number | undefined)`로 강화해 미래 호출처가 인자를 누락해도 컴파일 타임에 검출되도록 한 것이다. 런타임 동작은 변경 전과 동일하며, 의도치 않은 전역 상태 변경, 파일시스템 부작용, 환경 변수 접근, 외부 네트워크 호출, 이벤트/콜백 변경은 없다. 유일한 관심 지점은 실제 엔진 호출처(`execution-engine.service.ts`의 `runParallel` 내부)가 이 시그니처 변경에 맞춰 4번째 인자를 이미 명시 전달하고 있는지 여부인데, 이는 이번 diff 범위 밖이라 컴파일 통과 여부로 확인해야 한다.

## 위험도

LOW
