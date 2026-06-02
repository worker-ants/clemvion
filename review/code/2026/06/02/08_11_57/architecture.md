# 아키텍처(Architecture) Review

## 발견사항

### [INFO] `number | undefined` 시그니처 강제 — 의도적 명시성 패턴
- 위치: `parallel-executor.ts` line 891 (`parentParallelConcurrency: number | undefined`)
- 상세: optional(`?`) 에서 `number | undefined` 로 바꿔 호출부가 인자를 반드시 전달하도록 강제한 결정(W-1)은 SOLID 의 **인터페이스 분리 원칙(ISP)** 및 **의존성 역전** 관점에서 올바르다. optional 파라미터를 허용하면 컴파일러가 누락을 침묵하기 때문에 미래 중첩 Parallel 호출처가 `parentParallelConcurrency` 전달을 잊어도 타입 에러가 발생하지 않는다. 이 변경은 계약(Contract)을 명확히 한다.
- 제안: 현재 방향 유지. 다만 `execute` 가 `async` public 메서드 하나에 동시성 제어 + AbortSignal cascade + errorPolicy 집계 + clamping 로직을 모두 담고 있어 단일 책임 원칙(SRP) 경계가 살짝 넓다. 향후 clamping 로직을 `computeEffectiveConcurrency(intended, parent)` 순수 함수로 분리하면 단위 테스트와 재사용성이 개선된다 — 이번 변경 범위 밖의 기술 부채로 남길 것.

### [INFO] `branchParentContext` 타입 추론 위임 (W-2) — 타입 은닉 방지
- 위치: `execution-engine.service.ts` diff (`const branchParentContext = ...` 변경)
- 상세: 명시적 `: ExecutionContext` 주석을 제거해 TypeScript 추론에 맡긴 결정은 **레이어 책임** 측면에서 적절하다. 스프레드(`{ ...context, parentNodeExecutionId }`)로 생성된 객체가 실제로는 `ParallelBranchContext` 의 shape 을 가질 수 있는데, 상위 타입으로 강제 캐스팅하면 `parentParallelConcurrency` 와 같은 ghost field 가 타입 뷰에서 사라진다. 추론에 맡기는 것이 타입 정확성 측면에서 우월하다.
- 제안: 이 변경은 코드 정확성을 높이는 좋은 패턴이다. 단, `ExecutionEngineService` 내부 어딴에서 이 변수를 `ExecutionContext` 인터페이스로 명시 좁혀야 할 지점이 생기면 `satisfies ExecutionContext` 키워드를 활용하면 ghost field 손실 없이 인터페이스 호환을 검증할 수 있다.

### [INFO] 테스트에서의 `undefined` 명시 전달 패턴 — 테스트/구현 계약 정렬
- 위치: `parallel-executor.spec.ts` 및 `parallel-p2-integration.spec.ts` 전체 diff (모든 `execute(...)` 호출에 `undefined` 추가)
- 상세: `number | undefined` 시그니처 변경에 따른 기계적 업데이트다. 테스트가 구현 계약을 정확히 반영한다는 점에서 **테스트 레이어와 구현 레이어의 책임 정렬**이 유지된다. 단, 상당수 테스트가 `undefined` 를 단순히 전달하는 공통 패턴을 반복하므로 테스트 파일 내에 helper `const noParent = undefined` 상수를 두면 의도가 더 명확해진다 — 이는 선호 문제이며 아키텍처 결함은 아니다.
- 제안: 기능상 문제 없음. 선택적으로 `const NO_PARENT_CONCURRENCY = undefined as number | undefined` 상수를 테스트 파일 최상단에 두면 "외부 Parallel 없음" 시나리오임을 명시할 수 있다.

### [INFO] `ParallelExecutor` 의 단일 책임 — 현재 범위 내 적절
- 위치: `parallel-executor.ts` 전체
- 상세: `ParallelExecutor` 는 동시성 오케스트레이션 + branch context 격리 + AbortSignal cascade + errorPolicy 집계 + 중첩 concurrency clamping 을 담당한다. 기능이 늘었지만 모두 "Parallel 분기 실행의 조율"이라는 단일 도메인 내에 있으며 `@Injectable()` 로 NestJS DI 에서 교체 가능하다. `ForEachExecutor` / `LoopExecutor` 와 동일 계층(container executor)에 위치해 레이어 책임이 명확하다.
- 제안: 기술 부채 차원에서 `computeConcurrencyClamp` 순수 함수 추출은 고려 가능하지만 긴급 대응 불필요.

### [INFO] `ExecutionEngineService` 의 크기 — 점진적 분해 트래킹 중
- 위치: `execution-engine.service.ts` JSDoc 주석 (`~4200줄, PR-H/I 에서 점진적 분해`)
- 상세: 신규 변경(2줄 diff)이 God Object 문제를 악화시키지는 않는다. 다만 파일 자체가 SRP 위반의 대표 사례이며, 본 PR 의 변경은 그 맥락에서 작은 패치임을 인식해야 한다.
- 제안: 이미 JSDoc 에서 분해 계획이 명시되어 있으므로 현재 변경의 아키텍처 위험은 없음. 점진적 분해 계획(PR-H/I)을 계속 추적할 것.

## 요약

이번 변경의 핵심은 `ParallelExecutor.execute` 의 `parentParallelConcurrency` 파라미터를 optional(`?`)에서 `number | undefined` (required-but-nullable)로 격상시켜, 호출부가 인자를 명시 전달하도록 강제한 W-1 결정이다. 이는 중첩 Parallel 의 silent clamp 회귀를 컴파일 타임에 차단하는 방어적 설계로, 인터페이스 계약의 명확성(ISP)과 의존성 역전 측면에서 올바른 방향이다. W-2 의 타입 추론 위임도 `ParallelBranchContext` ghost field 가 `ExecutionContext` 캐스팅으로 은닉되던 문제를 해결한다. 테스트 파일의 `undefined` 명시 추가는 변경에 따른 정렬 작업으로 계약-구현 동기화가 유지된다. 아키텍처 관점에서 critical 또는 warning 급 문제는 없으며, `ExecutionEngineService` 의 크기는 기존 기술 부채이고 이번 변경이 악화시키지 않는다.

## 위험도

NONE
