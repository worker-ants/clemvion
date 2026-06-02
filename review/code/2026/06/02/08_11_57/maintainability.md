# 유지보수성(Maintainability) 리뷰

## 발견사항

### [INFO] `undefined` 명시 인자의 가독성 — 테스트 파일 전체에 걸쳐 동일 패턴
- 위치: `parallel-executor.spec.ts` 29, 53, 86, 122, 135, 154, 173, 180, 264, 286, 321, 345, 356, 364, 376, 404행; `parallel-p2-integration.spec.ts` 35, 43행
- 상세: `execute(config, context, fn, undefined)` 형태로 매 테스트마다 `undefined` 네 번째 인자가 반복된다. 변경 의도(W-1: 미전달 시 컴파일 오류 차단)는 JSDoc 에 충분히 서술되어 있으나, 테스트 파일 내 `undefined` 18 회 반복은 시각적 노이즈다. 테스트 가독성을 높이고 싶다면 `const NO_PARENT = undefined as number | undefined` 형태의 네임드 상수를 테스트 파일 최상단에 두는 선택지가 있다. 의도를 주석 없이도 전달하며, 타입 안전성도 유지된다.
- 제안: 필수 사항 아님. 단, 향후 테스트 파일이 더 추가될 경우 `NO_PARENT_CONCURRENCY` 같은 상수를 공유 테스트 픽스처로 추출하면 의도 전달과 유지보수 부담 모두 개선된다.

### [INFO] `parentEffective` 중간 변수 — 불필요한 별칭
- 위치: `parallel-executor.ts` 908행 (`const parentEffective = parentParallelConcurrency;`)
- 상세: 파라미터 이름 `parentParallelConcurrency` 가 충분히 서술적이며, 동일한 값을 `parentEffective` 라는 짧은 별칭으로 재바인딩한다. 이후 로직에서 두 이름이 모두 등장하면 독자가 동일 값임을 머릿속에서 한 번 더 추적해야 한다. 현재는 `parentEffective` 만 실제로 사용되므로 단일 이름으로 통일하는 것이 더 명확하다.
- 제안: 별칭을 제거하고 이후 조건문·로그에서 `parentParallelConcurrency` 를 직접 사용하거나, 반대로 파라미터 이름을 `parentEffective` 로 단축해 별칭 계층을 없앤다.

### [INFO] `execute()` 메서드 길이 — 단일 메서드에 과도한 책임
- 위치: `parallel-executor.ts` `execute()` 메서드 전체 (~150줄)
- 상세: `execute()` 는 (1) branchCount/maxConcurrency 클램핑, (2) 중첩 concurrency cap 계산, (3) AbortController 생성 및 upstream cascade 연결, (4) p-limit 분기 실행, (5) 실패 수집, (6) errorPolicy 분기(stop/cancel-others-on-fail)라는 여섯 단계를 순차로 처리한다. 각 단계 사이에 인라인 주석 블록이 붙어 있어 의도 파악은 가능하지만, 전체 흐름을 파악하려면 메서드 전체를 읽어야 한다. 현재 구조는 단일 클래스이므로 과도한 분리가 오히려 역효과를 낼 수 있으나, 중첩 cap 계산 블록과 AbortController cascade 블록은 각각 private 헬퍼(`computeEffectiveConcurrency`, `buildBranchAbortSignal`)로 추출할 여지가 있다.
- 제안: 즉각적 리팩터링보다는 향후 `execute()` 에 기능이 추가될 때의 분리 기준으로 참고. 현재 규모에서는 WARNING 수준 아님.

### [INFO] `clampedConcurrency` 타입 — 반환 타입과 내부 리터럴 객체 중복
- 위치: `parallel-executor.ts` 918-923행 (ClampedConcurrency 리터럴)
- 상세: `ClampedConcurrency` 인터페이스와 내부 리터럴 객체가 완전히 동일한 필드 셋을 유지해야 한다. 현재는 네 필드(`intended`, `actual`, `parentEffective`, `cap`)로 단순하므로 유지보수 부담이 낮지만, 필드가 늘어날 경우 두 곳을 동시 수정해야 하는 연결점이 된다.
- 제안: 현재 상태에서 개선 불필요. 인터페이스 변경 시 유지보수 주의점으로 메모.

### [INFO] 테스트의 매직 넘버
- 위치: `parallel-executor.spec.ts` 570행 (`expect(observedConcurrencyPeak).toBeGreaterThanOrEqual(5)`), 546행 (`toBeLessThanOrEqual(4)`)
- 상세: `5` 와 `4` 가 각각 어디서 유도됐는지 주석이 없다. 바로 위 테스트(526행)는 "outer=8, inner=8, cap=32 → floor(32/8)=4" 를 주석으로 설명하지만, 570행의 `5` 는 "8×4=32 ≤ 32 이므로 clamp 없음, peak ≥ 5" 라는 추론이 묵시적이다.
- 제안: `// clamp 없이 최대 8 개 동시 실행 가능 — 과반수 이상 (≥5) 이면 clamp 미발동 증명` 형태의 짧은 주석 추가.

### [INFO] `execution-engine.service.ts` W-2 변경 — 주석이 변수 선언보다 길다
- 위치: `execution-engine.service.ts` 7057-7062행(diff 기준)
- 상세: `const branchParentContext = parentNodeExecutionId ? ... : context;` 한 줄을 설명하는 인라인 주석이 4줄이다. 이유 자체는 충분히 중요(ghost field 타입 은닉 방지)하지만, 미래 독자가 주석 내용을 파악하려면 `ParallelBranchContext`, 타입 추론, spread 메커니즘을 동시에 이해해야 한다. 핵심 이유를 한 줄로 압축하고 나머지는 commit message 나 JSDoc 으로 옮기는 것이 가독성에 유리하다.
- 제안: `// ParallelBranchContext spread 시 ghost field 은닉 방지 — 타입 추론에 위임 (W-2)` 처럼 한 줄로 압축.

## 요약

이번 변경의 핵심인 `parentParallelConcurrency: number | undefined` 필수화(W-1)는 타입 시스템을 활용한 회귀 방지로 유지보수성 관점에서 긍정적이다. 관련 테스트 파일에서 `undefined` 를 18회 명시하는 것은 단기적으로 시각적 반복이지만, 미전달 누락을 컴파일 타임에 잡는다는 트레이드오프가 타당하다. `execute()` 메서드의 길이와 책임 다양성, `parentEffective` 별칭, 일부 테스트 매직 넘버는 현 단계에서 즉각적 리팩터링이 필요한 수준은 아니지만, 기능 확장 시 분리 기준을 미리 인식해 두는 것이 권장된다. 전반적으로 코드의 의도 서술(JSDoc + 인라인 주석)이 충실하며 기존 코드베이스의 스타일·패턴을 일관되게 준수하고 있다.

## 위험도

LOW
