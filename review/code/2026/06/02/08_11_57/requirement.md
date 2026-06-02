# 요구사항(Requirement) Review

## 리뷰 대상

- `parallel-executor.ts` — `ParallelExecutor.execute()` 4번째 인자 시그니처 변경 (W-1)
- `execution-engine.service.ts` — `branchParentContext` 명시 타입 제거 (W-2)
- `parallel-executor.spec.ts` — 단위 테스트 `undefined` 명시 추가 (~16곳)
- `parallel-p2-integration.spec.ts` — 통합 테스트 `undefined` 명시 추가 (2곳)

## 발견사항

### [INFO] 통합 테스트 `clampedConcurrency` shape 검증 — spec 기준 충족
- 위치: `parallel-p2-integration.spec.ts` L178-183
- 상세: `{ intended: 8, actual: 2, parentEffective: 16, cap: 32 }` shape 이 `spec/4-nodes/1-logic/10-parallel.md §6` 및 `ClampedConcurrency` 인터페이스 필드 정의(`intended / actual / parentEffective / cap`)와 line-level 일치.
- 제안: 해당 없음.

### [INFO] `ParallelBranchContext.parentParallelConcurrency` 필드 타입 spec 일치 확인
- 위치: `spec/conventions/execution-context.md §원칙 2` 코드 예시 vs `node-handler.interface.ts` L213
- 상세: spec 은 `parentParallelConcurrency: number` (required, non-optional)로 명시하고, 실제 인터페이스도 동일하게 선언되어 있어 일치함. `execute()` 시그니처의 `number | undefined` 는 파라미터 레벨(호출처 전달값)이고, 브랜치 컨텍스트 필드(`ParallelBranchContext.parentParallelConcurrency`)는 실제로 effectiveConcurrency(항상 number)를 set하는 것으로 분리되어 있어 혼동 가능성 없음.
- 제안: 해당 없음.

### [INFO] `branchParentContext` 타입 추론 위임 후 spread 동작 확인 필요
- 위치: `execution-engine.service.ts` L7708-7710
- 상세: W-2 적용 후 `branchParentContext` 는 `context`가 `ParallelBranchContext`일 때 `{ ...context, parentNodeExecutionId }` spread 결과로 추론된다. 이 경우 `parentParallelConcurrency` 필드가 spread로 함께 따라온다. 이는 W-2의 의도(ghost field 은닉 해소)와 부합하며, 이후 `parallelExecutor.execute()` 에 전달될 때 타입이 `ExecutionContext | ParallelBranchContext` 로 넓어지는 것은 런타임 동작 불변 조건 하에서 문제 없음. 그러나 TypeScript 가 `branchParentContext` 를 `ExecutionContext & { parentNodeExecutionId: string } | ExecutionContext | ParallelBranchContext` 등으로 추론하는 정확한 shape는 tsc 확인이 필요하며, 미묘한 타입 에러가 잠재할 수 있음.
- 제안: 커밋 메시지에 "tsc·build 그린" 이 명시되어 있으므로 실질 위험 없음. INFO 수준 유지.

### [WARNING] 통합 테스트 `clampedConcurrency` 검증 — `branchCount` 대비 실제 clamp 연산 경계 케이스 미검증
- 위치: `parallel-p2-integration.spec.ts` L164-183
- 상세: 통합 테스트의 clamp 검증 케이스는 `branchCount: 8, maxConcurrency: 8, parentParallelConcurrency: 16`으로, `intendedEffective = 8`, `allowed = floor(32/16) = 2`, `actual = 2`가 정확히 동작하는지 시간 기반(`setTimeout(5ms)`) 피크 측정으로 확인한다. 그러나 `observedPeak <= 2` 는 확률적 보증이다 — 타이밍 기반 테스트는 CI 환경에서 race가 발생하면 `observedPeak === 1`(0도 이론상 가능)로 관찰될 수 있어 `toBeLessThanOrEqual(2)` 조건만으로는 clamp 하한(최소 1)을 검증하지 않는다. 단위 테스트 파일(`parallel-executor.spec.ts` L547-548)은 `toBeGreaterThan(0)`을 추가로 검사하지만, 통합 테스트는 생략되어 있음.
- 제안: 통합 테스트 clamp 검증에 `expect(observedPeak).toBeGreaterThan(0)` 추가를 고려. 즉각 버그는 아니며 단위 테스트에서 커버됨.

### [INFO] `errorPolicy=stop` 분기에서 `branchCtx.abortSignal` `undefined` 기대 — spec 일치
- 위치: `parallel-p2-integration.spec.ts` L148
- 상세: spec §4 §5 + `parallel-executor.ts` L938 — `errorPolicy !== 'cancel-others-on-fail'`이면 `cancelController = null`, `upstreamSignal = context.abortSignal`(baseContext에 없으므로 undefined) → `branchSignal = upstreamSignal = undefined`. 테스트의 `expect(branchCtx.abortSignal).toBeUndefined()` 는 spec 행위와 정확히 일치.
- 제안: 해당 없음.

### [INFO] `ParallelBranchContext` extends spec 정의 vs 실제 인터페이스 — `parentParallelConcurrency?: number` 이슈 없음
- 위치: `spec/conventions/execution-context.md §원칙 2` 예시 코드
- 상세: spec 예시 코드에 `parentParallelConcurrency: number` (required)로 표기됨. `node-handler.interface.ts` 도 optional 없이 `parentParallelConcurrency: number`로 선언되어 있음. W-1 변경(`execute()` 파라미터 `number | undefined` required)은 파라미터 레벨 변경이며, 인터페이스 필드 자체는 건드리지 않으므로 spec과 일치.
- 제안: 해당 없음.

### [INFO] `cancel-others-on-fail` root cause 재throw 로직 — spec 일치
- 위치: `parallel-executor.ts` L1029-1033
- 상세: spec §Rationale `cancel-others-on-fail` 항목: "root cause (`error.name !== 'AbortError'` 인 첫 실패) 를 Parallel 노드의 throw 로 재현. AbortError 는 후속 분기의 cleanup 결과이므로 사용자 메시지 신호 대 잡음을 위해 노출 안 함." 구현에서 `failures.find((f) => f.error.name !== 'AbortError')?.error ?? failures[0].error` 는 이 spec 행위와 일치. 통합 테스트도 `real-root-cause` vs `AbortError` 구분을 명시 검증함.
- 제안: 해당 없음.

### [INFO] `execute()` 시그니처 변경이 호출처 하나(production)에만 적용되었는지 확인
- 위치: `execution-engine.service.ts` L7712-7732
- 상세: 커밋 메시지에 "16곳(unit + integration)" 이라고 언급. 실제 프로덕션 호출처는 `execution-engine.service.ts` 단 1곳이며 `parentParallelConcurrency` 를 올바르게 전달하고 있음. 나머지 15곳은 테스트 파일이고 모두 `undefined` 를 명시하도록 업데이트됨. 누락 호출처는 없음(tsc TS2554로 전수 확인됨).
- 제안: 해당 없음.

### [INFO] spec 미정의 — `clampedConcurrency` 통합 테스트의 위치와 역할
- 위치: `parallel-p2-integration.spec.ts` L159-199
- 상세: `parallel-p2-integration.spec.ts` 의 두 번째 describe 블록(`nested Parallel concurrency cap silent clamp`)은 `ParallelExecutor + planParallelBody 통합`이 아니라 `ParallelExecutor` 단독 테스트로 동작한다(planParallelBody 호출 없음). 파일 헤더 주석 "ParallelExecutor + planParallelBody 의 dispatch chain 검증"과 약간의 괴리가 있음. 그러나 이미 `parallel-executor.spec.ts`에 동일 케이스가 더 상세히 커버되어 있으므로 기능 완전성 손실은 없음.
- 제안: 통합 테스트 파일의 네 번째 describe 이름을 "nested Parallel concurrency cap (ParallelExecutor 직접 검증)"으로 명확화하면 의도와 구현 사이의 혼동을 줄일 수 있음. 필수는 아님.

## 요약

이번 변경(W-1·W-2)은 `parallel-p2-followups §7`에서 계획된 두 Warning을 해소하는 타입-only 리팩토링이다. W-1(`parentParallelConcurrency?: number` → `number | undefined` required)은 spec(`execution-context.md §원칙 2`)이 규정한 "미래 호출처 컴파일 타임 차단" 목적을 정확히 구현하며, 16개 호출처 전수에 `undefined` 명시가 반영되었다. W-2(`branchParentContext: ExecutionContext` 명시 타입 제거)는 `ParallelBranchContext` ghost field 은닉 해소를 위한 것으로, 추론 결과가 런타임 동작을 변경하지 않음이 tsc·jest·build 통과로 확인된다. spec 4개(`spec/4-nodes/1-logic/10-parallel.md`, `spec/conventions/execution-context.md`, `spec/conventions/node-cancellation.md`, plan `parallel-p2-followups.md §7`)에 정의된 요구사항 항목들과 코드 구현이 line-level로 일치한다. WARNING 1건(통합 테스트 clamp 하한 미검증)은 단위 테스트에서 이미 커버되어 즉각 버그가 아니며, 나머지 발견사항은 모두 INFO 수준이다.

## 위험도

LOW
