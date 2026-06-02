# Testing Review

## 발견사항

### [INFO] `undefined` 명시 전달로 컴파일 타임 회귀 방지 — 의도는 명확하나 추가 케이스 미커버
- 위치: 파일 1(`parallel-p2-integration.spec.ts`) 35, 43번째 라인 / 파일 2(`parallel-executor.spec.ts`) 전반
- 상세: `parentParallelConcurrency` 파라미터가 `optional`에서 `number | undefined` (required)로 변경됨에 따라 기존 테스트 호출에 `undefined` 를 명시 추가한 변경이다. 컴파일 타임에 누락 감지가 가능해지는 긍정적 효과가 있으며, 기존 테스트 의도가 보존된다. 다만, 테스트 케이스들이 전부 `undefined` 를 전달하는 "최상위 Parallel" 케이스와 `number`를 전달하는 "중첩 Parallel" 케이스로 구분돼 있어 중간 경계값(0, 음수, 1, NaN 등) 에 대한 `parentParallelConcurrency` 입력 테스트는 없다.
- 제안: `parentParallelConcurrency` 가 0 또는 음수일 때 clamp 로직이 `parentEffective > 0` 조건에서 분기되는 경로를 단위 테스트로 커버하는 것이 좋다. `NaN` 전달 시 `Math.floor(32/NaN)` 이 `NaN`이 돼 `allowed = Math.max(1, NaN) = 1` 이 되므로 의도치 않게 clamp가 발동할 수 있다. 이 엣지 케이스 테스트 추가를 권장한다.

---

### [INFO] 통합 테스트(`parallel-p2-integration.spec.ts`)의 `clampedConcurrency` 검증과 단위 테스트 간 경계 중복
- 위치: 파일 1, `nested Parallel concurrency cap silent clamp` describe 블록 (라인 158-198)
- 상세: 통합 테스트에서 `clampedConcurrency` 반환 객체의 필드 일치를 검증한다(`intended`, `actual`, `parentEffective`, `cap`). 동일 검증이 `parallel-executor.spec.ts`(파일 2)의 단위 테스트에도 일부 중복된다. 통합 테스트의 목적이 "ParallelExecutor + planParallelBody 의 dispatch chain 검증"이라는 주석과 달리 `ParallelExecutor` 직접 호출만 수행하고 있어, 실제 `planParallelBody`와의 연계 검증은 빠져 있다.
- 제안: 통합 테스트의 주석("planParallelBody dispatch chain 검증")과 실제 테스트 대상 일치를 재검토할 것. `planParallelBody` 를 직접 포함하는 케이스가 없다면 파일명 또는 describe 설명을 수정해 오해를 방지하는 것이 좋다.

---

### [INFO] `errorPolicy=stop` 에서 `branch1Completed` 가 `true` 가 되는 타이밍 의존성
- 위치: 파일 1, `errorPolicy=stop 은 cancel-others 효과 없음` 테스트 (라인 129-155)
- 상세: branch_1 은 `await new Promise((r) => setTimeout(r, 10))` 뒤 `branch1Completed = true` 를 set 한다. `executor.execute(...)` await 완료 이후에 이 값을 검증하므로 구조적으로는 안전하다. 그러나 `Promise.allSettled` 가 모든 분기 완료를 보장하므로 타이밍 의존성은 없다. 현재 구조는 문제없다.
- 제안: 해당 없음.

---

### [WARNING] 중첩 Parallel 실제 피크 동시성 측정의 타이밍 불확실성
- 위치: 파일 1, `외부 effective × 내부 effective > 32 시 내부 effective 가 silent clamp` 테스트 (라인 159-183) / 파일 2, `inner Parallel clamps effectiveConcurrency when parentParallelConcurrency × internal > 32` 테스트
- 상세: `currentRunning++` / `currentRunning--` 는 비원자적(non-atomic) 조작이다. Node.js 단일 스레드 특성상 `await` 경계 없이는 레이스 컨디션이 없으므로 대부분의 경우 안전하다. 그러나 `setTimeout(r, 5)` 를 사용하는 각 브랜치가 macrotask 큐에서 처리될 때 p-limit 의 슬롯 해제와 다음 브랜치 진입 사이의 microtask 순서에 따라 `observedPeak` 가 실제 동시 실행 수를 정확히 반영하지 않을 가능성이 소폭 있다. 현재 테스트에서 `toBeLessThanOrEqual(2)` 같은 상한 검증만 하므로 false negative 위험은 낮지만, 하한(`toBeGreaterThan(0)`)도 보완된 것은 긍정적이다.
- 제안: 현재 구조로 실용적 검증이 가능하나, 타이밍에 의존하는 피크 측정 테스트에는 짧은 delay + `jest.useFakeTimers()` 조합 또는 Barrier 패턴(`resolve` 배열 방식 — `should respect maxConcurrency limit` 테스트가 이미 사용 중)을 적용하면 결정적(deterministic) 검증이 가능하다.

---

### [WARNING] `errorPolicy=cancel-others-on-fail` 에서 upstream 시그널이 없을 때의 signal 공유 검증 누락
- 위치: 파일 2, `propagates the same AbortSignal to every branch` 테스트 (라인 606-630)
- 상세: 3개 브랜치 모두 abort 없이 정상 완료한 경우만 검증한다(`signal.aborted === false`). 이 경우 `cancelController` 가 생성되고 모든 브랜치에 같은 signal 이 공유됨을 확인한다. 그러나 브랜치 중 일부가 await 중에 abort 를 받아 AbortError 를 throw 할 때 나머지 브랜치의 signal 이 `aborted === true` 상태인지는 별도 케이스(`first failure aborts the shared signal`)에서 검증한다. 두 케이스의 조합 커버리지는 충분하다.
- 제안: 현재 커버리지로 충분하나, upstream signal 이 있고 그것이 abort 된 후에 cancel-others controller 의 signal 도 같이 abort 되는지를 명시적으로 검증하는 케이스(`cascades an already-aborted upstream signal` 테스트가 존재)가 이미 있으므로 추가 불필요.

---

### [WARNING] `execution-engine.service.ts` 의 `branchParentContext` 타입 추론 변경에 대한 테스트 부재
- 위치: 파일 4(`execution-engine.service.ts`), 라인 7701-7063(diff 기준)
- 상세: `const branchParentContext: ExecutionContext = ...` 에서 명시 타입 어노테이션을 제거하고 TypeScript 추론에 위임했다. 이 변경의 의도(ParallelBranchContext 의 `parentParallelConcurrency` ghost field 은닉 방지)는 JSDoc에 잘 설명돼 있으나, 이 경로를 검증하는 통합 테스트 또는 타입 수준 테스트(`tsd`, `expect-type` 등)가 존재하지 않는다. 추론된 타입이 `ParallelBranchContext | ExecutionContext` 유니온이 되는지, 또는 `ExecutionContext` 로 좁혀지는지 런타임 테스트에서는 확인이 불가능하다.
- 제안: 해당 코드 경로가 `context` 가 `ParallelBranchContext` 일 때 `branchParentContext.parentParallelConcurrency` 를 읽을 수 있는지를 확인하는 타입 레벨 테스트 또는 통합 테스트를 추가하는 것이 좋다. 현재 변경은 컴파일 타임에만 의미가 있으므로 `tsd` 또는 `ts-expect-error` 패턴의 타입 단언 테스트가 적합하다.

---

### [INFO] `re-throws the original error (not AbortError) even when abort-completed branch settles first` — root cause 선택 로직의 순서 보장 미검증
- 위치: 파일 2, 라인 719-757
- 상세: 테스트에서 branch 0이 실제 에러, branch 1이 AbortError 를 throw 할 때 최종 throw 가 `real-root-cause` 임을 확인한다. 이는 `failures.find((f) => f.error.name !== 'AbortError')` 로직을 검증하는 긍정 케이스다. 그러나 `failures` 배열이 브랜치 인덱스 순서(`i`)가 아닌 `Promise.allSettled` 완료 순서로 채워지기 때문에, `AbortError` 가 먼저 failures 배열에 들어오는 시나리오(branch 0 이 느리고 branch 1 이 abort 후 즉시 reject 하는 경우)에서도 올바르게 동작하는지 검증하는 케이스는 없다.
- 제안: branch 0 이 약간 지연 후 실제 에러를 throw 하고, branch 1 이 abort 를 받아 먼저 AbortError 로 settle 하는 시나리오를 추가하면 `failures` 배열 내 AbortError 선행 케이스의 root cause 선택을 결정적으로 검증할 수 있다.

---

### [INFO] `baseContext` 공유 객체 불변성 — 변경 없음 확인
- 위치: 파일 1, 2 전반
- 상세: `baseContext` 가 `const` 로 선언되고, 각 `executor.execute` 호출이 내부에서 shallow clone 을 생성하는 구조이므로 테스트 간 `baseContext` 오염 위험은 없다. 파일 2 의 `beforeEach` 에서 `executor` 를 재생성하므로 executor 상태 격리도 충분하다.
- 제안: 해당 없음.

---

## 요약

이번 변경의 핵심은 `ParallelExecutor.execute()` 의 `parentParallelConcurrency` 파라미터를 optional 에서 `number | undefined` (required)로 변환해 호출자가 인자를 명시적으로 전달하도록 강제한 것이다. 기존 테스트 전체에 `undefined` 를 명시 추가한 기계적 수정은 올바르며 의도를 잘 보존한다. 테스트 자체의 품질(격리·가독성·Mock 적절성)은 전반적으로 양호하다. 주요 우려 사항은 두 가지다: (1) 동시성 피크 측정이 타이밍 의존 방식(`setTimeout`)으로 구현되어 결정적이지 않으며, Barrier 패턴 적용이 권장된다. (2) `execution-engine.service.ts` 의 타입 어노테이션 제거는 컴파일 타임 효과만 있는 변경인데, 이를 검증하는 타입 레벨 테스트가 없어 회귀 방어가 불완전하다. `parentParallelConcurrency` 엣지 입력(0, 음수, NaN)과 `failures` 배열 내 AbortError 선행 시나리오에 대한 케이스 보완도 중간 우선순위로 권장한다.

## 위험도

LOW
