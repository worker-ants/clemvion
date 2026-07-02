### 발견사항

- **[CRITICAL]** 기존 회귀 테스트가 새 "재개 가능 상태(WAITING_FOR_INPUT ∪ RUNNING)" 분기 도입으로 인해 의도한 경로를 더 이상 검증하지 못하는 false-positive 로 퇴화
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.spec.ts:10863` (`it('Execution not WAITING_FOR_INPUT → RESUME_CHECKPOINT_MISSING (execution 만 cancelled)', ...)`), 대응 프로덕션 코드 `execution-engine.service.ts:949-953`
  - 상세: `rehydrateAndResume` 가드는 이제 `execution.status !== WAITING_FOR_INPUT && execution.status !== RUNNING` 일 때만 throw 한다. 그런데 해당 테스트는 여전히 `status: ExecutionStatus.RUNNING` 을 "거부되어야 할" 값으로 세팅해 놓았다. RUNNING 은 신규 코드에서 **허용** 값이므로 이 가드에서 더 이상 throw 되지 않고, 그 다음 줄 `nodeExecutionRepository.findOneBy` 호출로 흘러가는데 이 describe 블록엔 그 mock 이 설정돼 있지 않아 `TypeError: findOneBy is not a function` 이 발생 → catch 블록이 이를 잡아 동일하게 "execution 만 cancelled, nodeExec createQueryBuilder 미호출" 결과를 만든다. 실제로 `npx jest -t "Execution not WAITING_FOR_INPUT"` 실행 결과 테스트는 **green** 이지만, 검증 대상이 "Execution not resumable 가드"가 아니라 "예상치 못한 TypeError 처리 경로"로 완전히 바뀌었다. 즉 이 테스트는 지금 아무 것도 실질적으로 보장하지 않는 상태다(silently masked regression 위험 — 향후 가드 로직이 깨져도 이 테스트는 계속 통과할 것).
  - 제안: 이 테스트를 (a) 진짜 거부 상태(`ExecutionStatus.CANCELLED`/`COMPLETED`/`FAILED` 등 terminal)로 교체해 여전히 "not resumable" 가드를 검증하도록 고치고, (b) `RUNNING` 이 이제 통과(허용)됨을 검증하는 **신규 positive 테스트**를 별도로 추가해야 한다 (claim 이후 RUNNING 으로 로드된 Execution 이 정상적으로 rehydration 을 계속 진행하는 경로).

- **[WARNING]** `reparkAiResumeTurn` 의 신규 `nodeExec.status = WAITING_FOR_INPUT` 대입 로직이 어떤 테스트에서도 검증되지 않음 (nodeExec=null 케이스만 구동)
  - 위치: `codebase/backend/src/modules/execution-engine/ai-turn-orchestrator.service.ts:340-342` / 테스트 `ai-turn-orchestrator.service.spec.ts:211-329` (W5 describe 블록)
  - 상세: diff 의 핵심 변경(파일 1)은 claim 도입 이후 `nodeExec` 가 RUNNING 상태로 로드되므로 re-park 시 명시적으로 WAITING_FOR_INPUT 로 되돌리는 로직이다. 그런데 `driveResumeTurn` 헬퍼는 `processAiResumeTurn(..., null, ...)` 처럼 nodeExec 인자에 항상 `null` 을 넘긴다 — `if (nodeExec)` 분기가 3개 W5 테스트(64자 슬라이스/stale button_click/malformed payload) 어디서도 실행되지 않는다. 이 diff 에 대한 직접적 단위 테스트가 전무하다.
  - 제안: `nodeExec` 를 `{ status: NodeExecutionStatus.RUNNING, ... }` 형태의 mock 객체로 채워 `reparkAiResumeTurn`(또는 `processAiResumeTurn` 경유) 호출 후 `nodeExec.status === NodeExecutionStatus.WAITING_FOR_INPUT` 로 되돌아갔는지, 그리고 `driver.updateExecutionStatus` 가 그 갱신된 `nodeExec` 객체와 함께 호출됐는지 단언하는 테스트를 추가한다.

- **[WARNING]** `claimResumeEntry` 성공 시 부수효과인 `segmentStartMs.set(executionId, ...)` 가 신규 테스트에서 전혀 검증되지 않음
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:899-901` / 테스트 `execution-engine.service.spec.ts:483-571` (`describe('claimResumeEntry ...')`)
  - 상세: JSDoc(§8, PR2a) 은 "claim 이 Execution→RUNNING 을 `updateExecutionStatus` 우회로 수행하므로 그 세그먼트 tracking 을 여기서 보정" 한다고 명시할 만큼 이 부수효과를 중요하게 다루는데, 3개 신규 테스트(성공/실패/동시성) 어디도 `segmentStartMs` 상태를 확인하지 않는다. 이 필드는 `private readonly` 라 테스트하려면 `as unknown as {...}` 캐스팅이 필요하지만, 이미 파일 내 다른 곳(`priv().segmentStartMs`, L2826 등)에서 그 패턴을 사용 중이므로 재사용 가능하다.
  - 제안: `claimResumeEntry` 성공 테스트에 `expect((service as unknown as {segmentStartMs: Map<string,number>}).segmentStartMs.has('exec-1')).toBe(true)` 류 단언 추가, 실패(affected=0) 테스트에는 `.has(...)` 가 `false` 임을 추가 검증.

- **[INFO]** `claimResumeEntry` 가 `dataSource.transaction` 콜백 내부에서 throw 하는 경우(예: DB 에러)의 처리 경로가 테스트되지 않음
  - 위치: `execution-engine.service.ts:876-901` (claim 로직 전체가 `try/catch` 없이 `dataSource.transaction` 을 그대로 await), 대응 caller `continuation-execution.processor.ts:87-96`
  - 상세: transaction 콜백 안에서 QueryBuilder `execute()` 가 reject 되는 경우 `claimResumeEntry` 는 rejected Promise 를 그대로 전파한다. `continuation-execution.processor.ts` 의 `process()` 는 이 reject 를 캐치하지 않으므로 BullMQ 의 재시도/attempts 로직으로 위임되는 것이 의도인 듯한데, 이 흐름을 검증하는 테스트가 없다. Critical 은 아니지만("정상 동작"일 가능성이 높음) 명시적 커버리지가 있으면 향후 무음 삼킴(swallow) 회귀를 방지할 수 있다.
  - 제안: (선택) `dataSource.transaction` 이 reject 하는 케이스에서 `claimResumeEntry` 가 그대로 reject 전파함을 확인하는 짧은 테스트 1개 추가.

- **[INFO]** `recoverStuckExecutions` cascade 마감 로직의 `recoveredIds.length === 0`(빈 raw) no-op 분기와 다중 id 케이스가 명시적으로 검증되지 않음
  - 위치: `execution-engine.service.ts:924-947` / 테스트 `execution-engine.service.spec.ts:439-473` (`06 C-2 — 회수된 Execution 의 자식 RUNNING NodeExecution 도 cascade FAILED`)
  - 상세: 신규 테스트 1개만 `raw: [{ id: 'exec-stuck-1' }]` (단일 id) 케이스를 검증한다. `beforeEach` 기본값 `raw: []` 를 쓰는 기존 테스트들이 결과적으로 no-op 분기를 우회 실행하지만, `mockNodeExecutionRepo.createQueryBuilder` 가 호출되지 **않았음**을 명시적으로 단언하는 테스트는 없다(암묵적 커버리지에 불과). 다중 execution 동시 회수(`raw` 배열에 2개 이상 id) 시나리오도 없다.
  - 제안: (선택) "raw=[] → nodeExecutionRepo.createQueryBuilder 미호출" 명시 단언 1개, "raw 다중 id → ids 배열에 모두 포함" 단언 1개를 추가하면 이 신규 cascade 로직의 경계가 더 견고해진다.

- **[INFO]** Mock 적절성 — `claimResumeEntry` 테스트의 `dataSource.transaction` mock 이 실제 TypeORM 트랜잭션 격리·롤백 시맨틱을 반영하지 않음
  - 위치: `execution-engine.service.spec.ts:491-507` (`installTx` 헬퍼)
  - 상세: `installTx` 는 tx 콜백을 즉시 in-memory 실행하고 순서대로 준비된 2개 QueryBuilder(`nodeQb`, `execQb`)를 반환하는 단순 mock 이다. 실제 DB 트랜잭션의 원자성(콜백 내 두 번째 UPDATE 가 실패하면 첫 번째도 롤백)은 검증 대상이 아니며 unit 레벨에서는 합리적인 선택이다. 다만 이 원자성(§1.1 페어링 전이의 핵심 주장)은 순수 unit mock으로는 원천적으로 검증 불가능하므로, 이 부분은 e2e/integration 레벨(dockerized, 실제 Postgres 트랜잭션)에서 별도로 커버되어야 한다.
  - 제안: plan draft(`spec-draft-c2-atomic-claim.md`)의 "착수 조건" 섹션이 이미 "동일 (executionId, nodeExecutionId) 2회 동시 재개 시 한쪽만 진행 unit + form park 에 continuation job 2건 인위 enqueue 후 turn 이중 실행 0 dockerized e2e" 를 명시하고 있음 — 이 e2e 가 실제로 작성/완료됐는지 확인 필요(본 diff 페이로드에는 e2e 파일이 포함되어 있지 않음).

- **[INFO]** 테스트 가독성/명명 — mock 이름 변경(`isNodeExecutionWaiting` → `claimResumeEntry`)이 diff 전반에 일관되게 반영되어 있고 describe/it 제목도 함께 갱신되어 가독성이 양호함 (`continuation-execution.processor.spec.ts`)
  - 위치: `continuation-execution.processor.spec.ts` 전체
  - 상세: 별도 조치 불필요 — 긍정적 관찰.

### 요약
핵심 신규 로직(`claimResumeEntry` 원자 claim, `markNodeExecutionFailed` RUNNING 롤백, `recoverStuckExecutions` cascade)에 대해서는 성공/실패/동시성 레이스까지 포함한 신규 unit 테스트가 잘 작성되어 있고 mock 구조도 명확하다. 그러나 이번 diff 는 "재개 가능 상태"를 WAITING_FOR_INPUT 단일 값에서 `WAITING_FOR_INPUT ∪ RUNNING` 으로 넓히는 침습적 변경인데, 그로 인해 기존 negative 테스트 하나(`execution-engine.service.spec.ts:10863`)가 실질적으로 무효화되어 green 이지만 의도한 가드를 더 이상 검증하지 않는 상태로 퇴화했다(직접 실행으로 확인). 또한 이번 diff 의 핵심 파일인 `ai-turn-orchestrator.service.ts` 의 `nodeExec.status` 재설정 로직은 대응하는 신규/기존 테스트가 전혀 실행하지 않는 사각지대다. `segmentStartMs` 부수효과 검증 누락도 문서화된 설계 의도(§8 세그먼트 tracking)에 비추어 커버리지 갭이다. Critical 1건 수정과 Warning 2건 보강이 이 PR 의 회귀 안전성 확보에 필요하다.

### 위험도
HIGH
