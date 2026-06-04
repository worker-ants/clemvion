## 발견사항

### [INFO] `execution-limits.ts`: `resolveMaxActiveRunningMs` 에서 정규식 선검증 후 `Number.isInteger` 이중 검증 — 불필요한 복잡도
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/impl-exec-concurrency-cap/codebase/backend/src/modules/execution-engine/execution-limits.ts` 라인 20–27
- 상세: `^\d+$` 정규식이 통과하면 이미 비음수 정수임이 보장된다. 이후 `Number.isInteger(parsed) && parsed >= 0` 조건은 이론적으로 항상 참이므로 중복이다. `NaN 등 fallback` 주석은 정규식 선검증을 통과한 값에서는 발생할 수 없는 시나리오를 설명하고 있어 독자 혼란을 유발한다.
- 제안: 정규식 통과 후 단순히 `Number(raw)` 반환으로 단순화하거나, 정규식 없이 `Number.isInteger` + `>= 0` 만 유지하되 하나의 방어 경로로 일원화한다.

### [INFO] `execution-engine.service.ts`: `assertActiveTimeWithinLimit` JSDoc 과 실제 동작의 경계 조건 기술 불일치
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/impl-exec-concurrency-cap/codebase/backend/src/modules/execution-engine/execution-engine.service.ts` 라인 8551–8568 (diff 기준 새 메서드 블록)
- 상세: JSDoc 은 "누적 ≥ 한도면 throw" 라고 명시하고, 구현 코드도 `activeNow >= this.maxActiveRunningMs` 이므로 정확하다. 그러나 메서드 시그니처 인자 타입이 `Execution` (전체 엔티티)인데 실제로 사용하는 필드는 `id` 와 `activeRunningMs` 두 개뿐이다. 테스트에서는 `{ id: string; activeRunningMs?: number }` 로 좁혀 호출하는 것과 실 코드의 `Execution` 타입이 불일치한다. 유닛 테스트의 `priv()` 타입 선언이 더 정확한 계약을 표현하고 있다.
- 제안: 메서드 인자 타입을 `Pick<Execution, 'id' | 'activeRunningMs'>` 로 좁히거나, 현 시그니처를 유지하면서 테스트 타입 캐스팅 주석을 정리한다.

### [INFO] `system-status.constants.ts`: `continuationConcurrency` 파싱 방식과 `executionRunConcurrency` 파싱 방식 불일치
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/impl-exec-concurrency-cap/codebase/backend/src/modules/system-status/system-status.constants.ts` 라인 1196–1200
- 상세: `continuationConcurrency` 는 `Number(process.env.CONTINUATION_WORKER_CONCURRENCY) || 1` (인라인, 소수/공학표기 허용, NaN 시 fallback) 방식이고, `executionRunConcurrency` 는 `resolveExecutionRunWorkerConcurrency()` (정규식 선검증, 정수만 허용) 방식이다. 동일 파일에서 두 concurrency 값이 서로 다른 파싱 정책으로 산출되어 일관성이 없다. `CONTINUATION_WORKER_CONCURRENCY=2.5` 는 `2.5` 로 읽히지만 `EXECUTION_RUN_WORKER_CONCURRENCY=2.5` 는 기본값으로 fallback 된다.
- 제안: `continuationConcurrency` 도 별도 `resolveContinuationWorkerConcurrency()` 함수로 래핑하거나, 주석에 "의도적 차이" 임을 명시한다. 향후 PR2b 에서 추가 concurrency 설정이 생길 때 일관성 없는 패턴이 더 넓게 확산될 수 있다.

### [INFO] `execution-engine.service.spec.ts`: `priv()` 헬퍼 함수가 테스트마다 반복 호출 — 가독성 저하
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/impl-exec-concurrency-cap/codebase/backend/src/modules/execution-engine/execution-engine.service.spec.ts` 라인 1937–1958 (새 describe 블록)
- 상세: `priv()` 는 `describe` 블록 상단에 한 번 선언되어 있으나, 각 `it` 블록 내에서 `priv().maxActiveRunningMs = ...`, `priv().segmentStartMs.set(...)` 처럼 반복 호출된다. 함수 호출마다 `as unknown as {...}` 캐스팅이 재평가되는데, 이는 타입 안전성 관점에서 각 호출이 독립적인 타입 단언임을 의미하고 실수로 다른 타입으로 재정의할 위험이 있다. 또한 가독성보다 호출 비용 측면 우려보다, 코드가 같은 블록 내에서 `priv()` 를 6회 이상 호출하는 경우 로컬 변수 `const p = priv()` 로 캐싱하는 것이 관행적으로 더 읽기 쉽다.
- 제안: 기존 `service as unknown as {...}` 패턴 주석이 가리키듯 이는 기존 관행을 따른 것으로 큰 문제는 아니다. 단, 각 `it` 블록 시작부에서 `const p = priv()` 로 캐싱하면 반복 캐스팅 없이 가독성이 높아진다.

### [INFO] `workflow-errors.ts`: `ExecutionTimeLimitError` 에러 메시지에 `waiting_for_input` 영문 혼재
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/impl-exec-concurrency-cap/codebase/backend/src/modules/execution-engine/workflow-errors.ts` 라인 954–961
- 상세: 에러 메시지가 영문으로 작성되어 있는데 (`Execution exceeded the maximum active-running time ...`), 마지막 문장 `waiting_for_input park time is excluded.` 은 DB/코드 상태명인 `waiting_for_input` 을 자연어 문장 안에 섞어 쓰는 형태다. 동일 파일의 다른 에러 클래스(`SubWorkflowTimeoutError` 등)도 모두 영문이므로 언어 일관성은 맞다. 그러나 파일 상단 JSDoc 과 코드 주석은 한국어로 작성되어 있어 파일 내 언어 이중성이 있다.
- 제안: 이 패턴은 기존 파일 전체에서 사용하는 방식이므로 현재 변경 범위 내 위반은 아니다. INFO 수준으로 기록.

### [INFO] `.env.example` 주석에 PR 식별자(`PR2a`) 포함
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/impl-exec-concurrency-cap/codebase/backend/.env.example` 라인 35
- 상세: `.env.example` 주석에 `# PR2a — §8 single-Execution max **active-running** cumulative time (ms).` 처럼 내부 PR 추적 식별자(`PR2a`)가 포함되어 있다. 외부 기여자나 신규 개발자에게 `.env.example` 은 런타임 설정 레퍼런스인데, 내부 계획 추적 기호는 노이즈다. 동일 파일의 다른 주석(예: `W-15 fix (SUMMARY#W-15)`)도 같은 패턴이나, 이는 일관성 있는 내부 규약 선택으로 보인다.
- 제안: 내부 식별자(`PR2a`, `SUMMARY#W-15` 등)를 env 파일 주석에서 제외하거나, 프로젝트 규약으로 허용 여부를 명시한다. 기존 패턴을 따른 것이므로 현재 변경 자체는 일관성 유지에 해당한다.

## 요약

PR2a 변경 전반은 유지보수성 관점에서 양호하다. 핵심 로직인 `assertActiveTimeWithinLimit` 와 `updateExecutionStatus` 의 상태 전이 추적은 단일 choke point 에 집중되어 있어 추후 변경 시 수정 범위가 명확하다. `execution-limits.ts` 의 분리로 설정 파싱 로직이 독립 테스트 가능해졌고, `ExecutionTimeLimitError` 가 `ErrorPortFallbackError` 와 동일한 sentinel 패턴을 따르는 것도 일관성 있다. 주요 관찰 사항은: (1) `resolveMaxActiveRunningMs` 의 이중 검증 중복이 주석 혼란을 유발하고, (2) `system-status.constants.ts` 에서 두 concurrency 설정의 파싱 방식이 불일치하며, (3) `assertActiveTimeWithinLimit` 인자 타입이 실제 사용 필드보다 넓게 선언되어 있다. 세 항목 모두 즉각적 버그는 아니나 코드베이스가 확장될 때 혼란 원인이 될 수 있다.

## 위험도

LOW

STATUS: OK
