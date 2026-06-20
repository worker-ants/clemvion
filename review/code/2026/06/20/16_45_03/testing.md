# Testing Review

## 발견사항

### [INFO] 파일 1 (parallel-p2-integration.spec.ts) — 신규 테스트 2건: signal.aborted 즉시 경로 및 concurrency clamp 하한
- 위치: 파일 1 diff +36~+84 (signal 테스트), +93~+119 (clamp 하한 테스트)
- 상세: 두 테스트 모두 기존 `parallel-executor.spec.ts` 에 이미 동등한 커버리지가 존재한다.
  - **signal.aborted 즉시 경로**: `parallel-executor.spec.ts` L413-433 의 `cascades an already-aborted upstream signal to the branch controller` 가 동일 시나리오를 커버한다. 해당 테스트는 이미 `seenAborted.every((b) => b === true)` 를 단언하며, 분기가 aborted signal 을 보는지 확인한다. 신규 테스트는 거기서 한 걸음 더 나아가 "즉시 경로 발화 vs. listener 경로 미발화" 를 spy 로 구분하는 점에서 세분화된 커버리지는 있으나, 기존 unit spec 의 커버 범위와 상당히 겹친다.
  - **clamp 하한 1**: `parallel-executor.spec.ts` L265-287 의 `inner Parallel clamps effectiveConcurrency when parentParallelConcurrency × internal > 32` 는 parentEffective=8 케이스를 커버하고, L329-341 의 `absent parentParallelConcurrency (outermost Parallel)` 는 clamp 없음을 커버한다. parentEffective=32 → clamp=1 케이스는 통합 spec 에 처음 등장하므로 해당 경계값 커버리지는 추가적 가치가 있다.
- 제안: 중복을 명시적으로 제거할 필요는 없지만, 테스트 의도가 "통합 시나리오(HTTP signal cascade)" 가 아니라 executor 내부 분기 로직을 재검증하는 것이라면 unit spec 에 추가하는 것이 더 적합하다. 현재 배치가 일관성을 다소 낮춘다.

### [INFO] 파일 1 — signal.aborted 즉시 경로 테스트의 동작 가정이 구현과 맞지 않을 수 있음
- 위치: 파일 1 diff +40~+84, 특히 +82~+83 `expect(immediateAbortObserved).toHaveBeenCalled()` / `expect(viaListener).not.toHaveBeenCalled()`
- 상세: 구현(`parallel-executor.ts` L189-203)은 `upstreamSignal.aborted` 가 true 이면 `cancelController.abort()` 를 **즉시 동기** 호출한다. 그러면 `branchSignal`(= `cancelController.signal`)은 분기 함수 진입 전부터 이미 aborted 상태다. 따라서 `immediateAbortObserved` 가 항상 호출되는 것은 올바른 기대다.
  그러나 테스트 주석은 "executor 가 cancelController 로 cascade(§5) → 모든 분기가 시작 즉시 aborted signal 을 본다"고 설명하는데, 실제로는 `pLimit` 내부의 비동기 스케줄링에 따라 첫 번째 분기가 즉시 경로를 타고 throw 하면 나머지 분기도 이미 aborted signal 을 볼 것이 확실하지만, 두 분기 모두 `immediateAbortObserved` 를 호출하는지 단언하지 않는다(`toHaveBeenCalled()` 는 1회 이상). 두 분기 모두 즉시 경로를 밟아야 한다면 `toHaveBeenCalledTimes(2)` 가 더 정확한 단언이다.
- 제안: `expect(immediateAbortObserved).toHaveBeenCalledTimes(2)` 로 변경해 "모든 분기(branchCount=2)가 즉시 경로를 밟았다"는 의도를 명확히 한다.

### [INFO] 파일 1 — clamp 하한 테스트에서 `observedPeak` 측정의 타이밍 불확실성
- 위치: 파일 1 diff +96~+119
- 상세: `observedPeak` 측정은 `setTimeout(r, 5)` 를 이용한 실시간 동시성 카운터에 의존한다. Jest fake timer 없이 실제 타이머를 사용하므로, CI 환경에서 스케줄링 지연이 발생하면 분기들이 순차적으로 실행되어 `observedPeak === 1` 이 clamp 때문이 아니라 스케줄링 때문일 수 있다. 그러나 테스트 의도("하한 1, deadlock 방지")는 `observedPeak >= 1` 이지 `observedPeak === 1` 이 확정이어야 한다는 것이 아니므로, `toBe(1)` 단언이 너무 엄격하다. clamp 실제 동작은 `result.clampedConcurrency` 단언으로 이미 충분히 검증된다.
- 제안: `expect(observedPeak).toBeGreaterThanOrEqual(1)` 로 완화하고, 정확한 clamp 값은 `result.clampedConcurrency.actual === 1` 로 검증. 또는 기존 `parallel-executor.spec.ts` 의 패턴처럼 barrier 기반 동기화로 peak 측정을 정밀화한다.

### [INFO] 파일 2 (node-components.module.spec.ts) — 포매팅 전용 변경, 테스트 로직 무변경
- 위치: 파일 2 diff +379~+381 (3줄 Prettier 래핑)
- 상세: `ALL_NODE_COMPONENTS.map(…)` 의 단순 줄바꿈 포매팅. 테스트 의미·커버리지·격리·가독성에 영향 없음. 회귀 위험 없음.
- 제안: 변경 불필요, 코드 스타일 일관성 유지 차원에서 무해하다.

### [INFO] parallel-p2-integration.spec.ts — baseContext 가 abortSignal 을 포함하지 않아 신규 signal 테스트와 불일치
- 위치: 파일 1 전체 컨텍스트 L149-158 (`baseContext` 정의)
- 상세: `baseContext` 에는 `abortSignal` 필드가 없다. 기존 테스트들은 필요 시 로컬 override(`{ ...baseContext, abortSignal: ... }`)를 사용하는데, 신규 signal.aborted 즉시 경로 테스트도 동일 패턴을 올바르게 따른다. 다만, `errorPolicy=stop` 테스트(L208-234)에서 `expect(branchCtx.abortSignal).toBeUndefined()` 를 단언하는데 이는 `baseContext` 에 `abortSignal` 이 없다는 가정에 의존한다. `baseContext` 가 변경되면 이 단언이 깨질 수 있으므로, 테스트 격리 측면에서 이 단언의 전제가 명시적이면 더 좋다.
- 제안: 해당 단언 위에 `// baseContext에 abortSignal 없음 → stop 정책은 signal 없음 확인` 주석 추가 정도로 충분하다.

## 요약

이번 변경은 `parallel-executor` 의 두 가지 엣지 케이스(signal.aborted 즉시 경로, concurrency clamp 하한 1)에 대한 통합 테스트를 추가하고, `node-components.module.spec.ts` 에 포매팅 조정을 가했다. 신규 테스트들은 ai-review 지적(INFO#3, INFO#4)에 대한 대응으로 의도가 명확하고, 구현(`parallel-executor.ts` L189-203의 즉시 abort cascade 로직 및 L161-164의 `Math.max(1, ...)` clamp 하한)과 직접 대응되는 코드 경로를 커버한다. 다만 `parallel-executor.spec.ts` 에 이미 유사 시나리오 커버리지가 존재해 통합 spec 의 추가적 가치가 부분적이고, `observedPeak === 1` 단언이 타이머 기반 측정의 불확실성으로 인해 CI 환경에서 flaky 할 소지가 있으며, `immediateAbortObserved` 의 호출 횟수 단언이 "모든 분기"를 명시하지 않는 점이 테스트 의도의 완전성을 약간 낮춘다. 포매팅 변경은 무해하다. Critical 이슈는 없다.

## 위험도

LOW
