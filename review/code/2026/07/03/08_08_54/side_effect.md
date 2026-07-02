### 발견사항

- **[WARNING]** `claimResumeEntry` 트랜잭션이 애매한 이중 UPDATE 원자성 — Execution 짝 전이 affected=0 을 무시
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` L862-708 (`claimResumeEntry`)
  - 상세: `manager.transaction` 내부에서 (1) NodeExecution 조건부 UPDATE 후 affected>=1 이면 (2) Execution 도 `WFI→RUNNING` 조건부 UPDATE 를 실행하지만 그 결과의 `affected` 를 확인하지 않고 무조건 `return true` 한다. 만약 어떤 경로로 Execution.status 가 이미 `WAITING_FOR_INPUT` 이 아닌 상태(예: 동시에 `applyCancellation` 이 먼저 Execution 을 `CANCELLED` 로 옮긴 직후, NodeExecution 은 아직 claim 되지 않은 race)라면 이 두 번째 UPDATE 는 조용히 0행에 적용되고, 함수는 그래도 `true` 를 반환해 rehydration 이 계속 진행된다 — 이 경우 `NodeExecution=RUNNING`·`Execution=CANCELLED` 라는 불일치 상태가 만들어진다. 주석은 "node claim 이 유일한 레이스 결정자"라고 명시적으로 이 설계를 인지하고 있으나, cancel-vs-resume 동시 진입 케이스에서 Execution 이 이미 종결(CANCELLED/FAILED/COMPLETED)로 전이된 뒤 NodeExecution claim 이 뒤늦게 성공하면 짝 불일치가 남을 수 있다.
  - 제안: Execution UPDATE 의 `affected` 도 확인해 0이면 트랜잭션을 rollback(예외 throw)하거나 최소한 로그로 불일치를 남기는 방어 코드를 추가 검토. (기존 continuation-execution.processor.ts 주석이 "cancel vs resume 경합은 claim + WAITING_FOR_INPUT andWhere 멱등 가드가 흡수" 라고 주장하므로 실무 영향은 제한적일 수 있으나, 코드상 명시적 가드는 없다.)

- **[WARNING]** `claimResumeEntry` 가 부수적으로 `segmentStartMs` 전역 Map 을 갱신 — `updateExecutionStatus` 우회 경로
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` L900-708 근방 (`this.segmentStartMs.set(executionId, Date.now())`)
  - 상세: 기존에 `segmentStartMs` (인스턴스 공유 Map, active-running 시간 추적용)는 `updateExecutionStatus` 단일 choke point 에서만 set/delete 되는 것이 불변식이었다(주석 L6856 "Execution 상태 전이의 단일 choke point"). 신규 `claimResumeEntry` 는 그 choke point 를 우회해 Execution 을 직접 원자 UPDATE 로 `RUNNING` 전이시키고, 그 직후 `updateExecutionStatus` 밖에서 별도로 `segmentStartMs.set` 을 호출해 보정한다. 두 지점(정규 choke point / claim 우회 경로)에서 같은 전역 상태가 갱신되는 구조가 되어, 향후 `updateExecutionStatus` 로직이 바뀔 때 이 우회 경로가 누락되어 drift 될 위험이 있다. 현재는 주석(L704-706)으로 명시돼 있어 즉각적 버그는 아니나 유지보수 시 놓치기 쉬운 이중 관리 지점이다.
  - 제안: 가능하면 `segmentStartMs` 갱신 로직을 공용 헬퍼로 추출해 `updateExecutionStatus` 와 `claimResumeEntry` 양쪽에서 호출하도록 일원화. 최소한 `updateExecutionStatus` 의 JSDoc(L6856 "단일 choke point")에 `claimResumeEntry` 도 이 상태를 갱신하는 예외 경로임을 상호 참조로 남길 것.

- **[INFO]** 공개 메서드 시그니처 변경(`isNodeExecutionWaiting(nodeExecutionId)` → `claimResumeEntry(executionId, nodeExecutionId)`) — 영향 범위 확인됨, 안전
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` L862 / 호출부 `continuation-execution.processor.ts` L87-90
  - 상세: 이름·시그니처(파라미터 1개→2개, 의미도 "조회" → "원자 claim(부작용 있는 쓰기)")가 바뀐 public 메서드다. grep 확인 결과 유일한 프로덕션 호출자는 `continuation-execution.processor.ts` 이며 diff 에서 함께 갱신되었고, `EngineDriver`/`WorkflowExecutor` 인터페이스에는 이 메서드가 선언되어 있지 않아 광역 계약 파손은 없다. 다만 메서드가 이제 **조회가 아니라 상태를 변경하는 부작용을 가진 함수**로 의미가 바뀌었음에도 이름 외에는 그 사실을 알리는 명시적 표식(JSDoc 의 `@sideEffect` 류)이 없어, 향후 이 메서드를 멱등 조회처럼 재호출하는 실수를 유발할 수 있다.
  - 제안: 없음(현행 유지) — 다만 JSDoc 이 이미 상세히 설명하므로 낮은 위험.

- **[INFO]** `recoverStuckExecutions` 가 새로운 cascade 쓰기(자식 NodeExecution FAILED 마감)를 도입 — 의도된 부작용, 범위 적절
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` L2592-2624
  - 상세: 기존에는 stale Execution 만 FAILED 로 회수했으나, 이번 변경은 회수된 Execution 의 자식 중 `RUNNING` 상태인 NodeExecution 도 함께 FAILED 로 cascade 마감한다. `06 C-2` claim 이 Execution·NodeExecution 을 짝으로 `RUNNING` 전이시키므로 필요한 정합성 보정이며, `execution_id IN (:...ids) AND status = RUNNING` 조건으로 스코프가 명확히 제한되어 있어 과도한 부작용은 아니다. cron/스케줄 잡(`recoverStuckExecutions`)이라는 배경상 이미 쓰기 권한을 가진 경로이므로 새로운 권한 확대는 아니다.
  - 제안: 없음 — 의도된 변경으로 판단.

- **[INFO]** `reparkAiResumeTurn` 의 `nodeExec.status` 명시적 재설정 — 상태 전이 assertion 회피를 위한 필수 보정, 부작용 적절
  - 위치: `codebase/backend/src/modules/execution-engine/ai-turn-orchestrator.service.ts` L340-342
  - 상세: `claimResumeEntry` 도입 이후 이 함수 진입 시 `nodeExec` 가 `RUNNING` 으로 로드되므로, 명시적으로 `WAITING_FOR_INPUT` 으로 되돌리지 않으면 `updateExecutionStatus` 가 `linkedNodeExec` 를 그대로 저장해 DB 에 `RUNNING` 이 영속되는 회귀가 발생한다(주석이 이를 정확히 설명). in-memory 객체의 필드를 직접 mutate 하는 부작용이지만, 이 함수가 이미 `nodeExec` 를 소유하고 이후 `driver.updateExecutionStatus` 에 그대로 넘기는 구조라 예상된 범위 내 부작용이다. `state-machine.ts` 의 `ALLOWED_TRANSITIONS[RUNNING]` 이 `RUNNING→RUNNING` 을 포함하지 않는다는 사실도 확인했으며, 이 보정이 없으면 실제로 `assertTransition` 예외가 발생함을 코드로 검증했다.
  - 제안: 없음 — 정확하고 필요한 수정.

- **[INFO]** `execution-engine.service.ts` 내 두 rehydration 경로(`driveResumeAwaited`, `processAiResumeTurn` 계열)에서 `updateExecutionStatus` 호출을 조건부 skip — 기존 호출자(레거시 직접 호출 경로) 영향 확인 필요
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` L1865-1772, L2044-1789 부근 (`if (savedExecution.status !== ExecutionStatus.RUNNING) { ... }`)
  - 상세: `claimResumeEntry` 경로로 진입한 경우 이미 `RUNNING` 이므로 중복 전이를 skip 하고, "legacy/직접 호출 경로"는 여전히 `WAITING_FOR_INPUT` 이라 정상 전이한다고 주석에 명시. `assertTransition` 표에서 `RUNNING→RUNNING` 이 허용되지 않는다는 사실을 코드로 재확인했으므로 이 분기 로직은 정확하다. 다만 `savedExecution.status !== ExecutionStatus.RUNNING` 조건은 "RUNNING 이 아니면 항상 전이 시도" 이므로, 만약 `savedExecution.status` 가 예기치 않게 `CANCELLED`/`FAILED` 같은 terminal 상태로 로드되는 엣지 케이스가 있다면 `assertTransition` 이 여전히 올바르게 예외를 던져 방어된다 — 이 점은 안전.
  - 제안: 없음 — 회귀 방지 목적의 정확한 조건부 skip.

- **[INFO]** spec/plan/review 산출물(파일 6-19)은 코드 실행에 영향 없는 문서 변경
  - 위치: `plan/in-progress/spec-draft-c2-atomic-claim.md`, `review/consistency/2026/07/02/23_23_49/**`, `review/consistency/2026/07/02/23_32_43/**`, `spec/5-system/4-execution-engine.md`, `spec/data-flow/3-execution.md`
  - 상세: 부작용(Side Effect) 관점에서 실행 가능한 부작용은 없음(문서·리뷰 산출물). 다만 `rationale_continuity` 체커가 지적한 CRITICAL(rev1, 2단계 전이가 과거 spec Rationale L1252 기각 대안과 구조적으로 일치)이 rev2 에서 "실질 해소"로 판정되었는데, 이번 코드 diff 는 실제로 claim(WFI→RUNNING) 후 rehydration 실패 시 `markNodeExecutionFailed` 가 RUNNING→FAILED 로 마감하는 **2단계 전이**를 구현하고 있다 — 즉 code 레벨에서는 과거 기각되었던 "두 트랜잭션 분리" 패턴이 재도입된 것이 사실이다. 다만 claim 은 단일 조건부 UPDATE(트랜잭션 1) + 후속 실패 마감(별도 트랜잭션)의 구조이므로 spec draft 가 주장한 대로 "claim 자체는 원자적, 실패 롤백은 독립적으로 안전"이라는 논거가 성립하는지는 spec 영역이라 본 리뷰(side-effect) 범위 밖이다. 코드 자체의 트랜잭션 경계는 확인했고 (claim UPDATE 1개 tx, 실패 시 markNodeExecutionFailed 별도 실행) 크래시 시 orphan 은 `recoverStuckExecutions` 가 회수하도록 설계돼 있어 데이터 정합성 관점의 부작용은 통제되어 있다.
  - 제안: 없음 — rationale-continuity 판정은 consistency-checker 영역이므로 참고만.

### 요약

핵심 변경은 `isNodeExecutionWaiting`(비원자 SELECT 재검증) → `claimResumeEntry`(DB 원자 UPDATE claim, 부작용을 갖는 쓰기)로의 전환이며, 이 public 메서드의 유일한 프로덕션 호출자(`continuation-execution.processor.ts`)와 대응 테스트가 diff 내에서 함께 갱신되어 orphan 호출자는 없다. `claimResumeEntry` 는 Execution·NodeExecution 짝 상태를 단일 트랜잭션으로 전이시키되 Execution UPDATE 의 `affected` 를 검증하지 않는 점, 그리고 정규 상태 전이 choke point(`updateExecutionStatus`) 밖에서 전역 `segmentStartMs` Map 을 별도로 갱신하는 점은 향후 유지보수 시 drift 위험이 있는 이중 관리 지점으로 WARNING 처리했다. `reparkAiResumeTurn` 의 `nodeExec.status` 명시적 리셋과 `driveResumeAwaited`/`processAiResumeTurn` 의 조건부 `updateExecutionStatus` skip 은 `assertTransition` 상태표(`RUNNING→RUNNING` 미허용)를 코드로 재확인한 결과 필요하고 정확한 보정으로 판단된다. `recoverStuckExecutions` 의 신규 cascade FAILED 쓰기는 스코프가 명확히 제한되어 있고 기존 쓰기 권한 범위 내의 의도된 확장이다. spec/plan/review 문서 변경은 실행 부작용이 없다.

### 위험도
LOW
