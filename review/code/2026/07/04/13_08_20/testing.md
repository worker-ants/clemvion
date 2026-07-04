# 테스트(Testing) Review — exec-intake-pr4-stalled

## 리뷰 범위
- `finalizeStalledExhausted` unit (execution-engine.service.spec.ts)
- `runExecutionFromQueue` RUNNING-분기 unit
- `execution-stalled-redelivery.e2e-spec.ts` (stalled 재배달 e2e)
- 연관: `execution-run.processor.ts`/`.spec.ts`, `execution-run.queue.ts`/`.spec.ts`,
  `execution-run-dlq-monitor.service.ts`/`.spec.ts`, `executions.controller.ts`(신규 e2e 훅)

## 발견사항

- **[WARNING]** 신규 e2e 전용 컨트롤러 엔드포인트 `simulateExecutionRunRedeliveryForTest` 에 대한 unit 게이팅 테스트 부재
  - 위치: `codebase/backend/src/modules/executions/executions.controller.ts:233-253` (엔드포인트), `codebase/backend/src/modules/executions/executions.controller.spec.ts` (테스트 파일 — 신규 케이스 없음)
  - 상세: 동일 파일에 이미 존재하는 자매 엔드포인트 `triggerStuckRecoveryForTest`(`_test/recover-stuck-executions`)는 `describe('triggerStuckRecoveryForTest (test-only gating)', ...)` 블록으로 (1) NODE_ENV=test+E2E_TEST_HOOKS=1 정상 트리거, (2) NODE_ENV≠test → 404, (3) E2E_TEST_HOOKS 미설정 → 404 3케이스를 unit 으로 가드하고 있다(`executions.controller.spec.ts:158-202`). 신규 `simulate-execution-run-redelivery` 엔드포인트는 JSDoc 주석에 "게이팅은 `_test/recover-stuck-executions` 와 동일" 이라고 명시했음에도 그 동일 패턴의 unit 테스트가 하나도 추가되지 않았다. 또한 `mockExecutionEngineService`(controller.spec.ts:30-33)에도 `runExecutionFromQueue` mock 이 없어, 이 엔드포인트를 대상으로 테스트를 작성하면 즉시 `TypeError: ... is not a function` 로 실패할 것이다 — 테스트 용이성 관점에서도 준비가 안 된 상태.
  - e2e(`execution-stalled-redelivery.e2e-spec.ts`)가 "정상 게이트 통과" 경로(NODE_ENV=test)만 실행하므로, 프로덕션 은닉(404) 회귀는 오직 unit 으로만 잡을 수 있다 — 이는 자매 엔드포인트 테스트 주석(`controller.spec.ts:159-160`)이 스스로 명시한 근거이기도 하다.
  - 제안: `triggerStuckRecoveryForTest (test-only gating)` 블록과 동일한 3케이스(정상/NODE_ENV≠test/E2E_TEST_HOOKS 미설정)를 `simulateExecutionRunRedeliveryForTest` 에도 추가하고, `mockExecutionEngineService.runExecutionFromQueue` mock 을 등록한다.

- **[INFO]** `EXECUTION_RUN_STALLED_INTERVAL_MS`(신규 상수, 30_000)에 대한 값 검증 테스트 없음
  - 위치: `codebase/backend/src/modules/execution-engine/queues/execution-run.queue.ts:97` (정의), `codebase/backend/src/modules/execution-engine/queues/execution-run.queue.spec.ts` (검증 없음)
  - 상세: 같은 diff 에서 `EXECUTION_RUN_MAX_STALLED_COUNT`(0→1) 는 `execution-run.queue.spec.ts:857-861`에 전용 테스트(`expect(EXECUTION_RUN_MAX_STALLED_COUNT).toBe(1)`)가 추가됐으나, 나란히 도입된 `EXECUTION_RUN_STALLED_INTERVAL_MS` 는 값 assertion 이 없다. `execution-run.processor.spec.ts` 도 `@Processor` 데코레이터 옵션(`stalledInterval`)을 직접 검증하지 않는다(데코레이터 메타데이터 unit 검증이 일반적으로 어려운 것은 사실이나, 상수 자체 값 회귀는 저비용으로 가드 가능).
  - 제안: `execution-run.queue.spec.ts` 에 `expect(EXECUTION_RUN_STALLED_INTERVAL_MS).toBe(30_000)` 한 줄 추가로 향후 실수 변경(예: BullMQ 기본값과의 의도적 정렬이 깨지는 것)을 회귀 가드.

- **[INFO]** `finalizeStalledExhausted` unit 테스트가 자식 NodeExecution cascade 의 WHERE 절(scope) 을 검증하지 않음
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.spec.ts:3034-3072` (테스트), `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:2754` 부근 `finalizeStalledExhausted` 구현의 nodeExecutionRepository `.where('execution_id = :executionId', ...)` / `.andWhere('status = :running', ...)`
  - 상세: 테스트는 `nodeQb.set` 이 `{ status: NodeExecutionStatus.FAILED }` 로 호출됨만 확인하고, `nodeQb.where`/`nodeQb.andWhere` 인자(즉 cascade 가 해당 executionId 의 RUNNING 노드에만 조건부로 적용되는지)는 검증하지 않는다. 같은 describe 블록에서 execution 쪽(`execQb.andWhere`)은 인자까지 검증하는 것과 비대칭적이다. 실코드 로직 자체는 단순하고 옳아 보이지만, 향후 리팩터링 시 조건절 실수(예: `andWhere` 누락으로 전체 NodeExecution 오염)를 이 테스트가 잡지 못한다.
  - 제안: `expect(nodeQb.where).toHaveBeenCalledWith('execution_id = :executionId', { executionId: 'exec-stalled' })` 및 `expect(nodeQb.andWhere).toHaveBeenCalledWith('status = :running', { running: NodeExecutionStatus.RUNNING })` 추가.

- **[INFO]** `finalizeStalledExhausted` "RUNNING" 케이스 테스트가 `emitExecution` 호출 인자(payload) 내용을 검증하지 않음
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.spec.ts:3072` (`expect(emitSpy).toHaveBeenCalled();` 만 존재)
  - 상세: 구현(`execution-engine.service.ts` `finalizeStalledExhausted` 본문)은 `EXECUTION_FAILED` 이벤트에 `status: ExecutionStatus.FAILED, error: 'Execution failed: worker crash (stalled 재배달 소진)'` 를 담아 emit 한다. 테스트는 `toHaveBeenCalled()` 만 확인해 이벤트 타입(EXECUTION_FAILED)·payload 필드가 바뀌어도 감지하지 못한다. FE/알림 소비 측이 이 payload 형태에 의존할 수 있어(§1.4 계열 관례) 최소한 이벤트 타입 인자 검증은 유용하다.
  - 제안: `expect(emitSpy).toHaveBeenCalledWith('exec-stalled', ExecutionEventType.EXECUTION_FAILED, expect.objectContaining({ status: ExecutionStatus.FAILED }))` 로 강화.

- **[INFO]** `finalizeStalledExhausted` 에 대한 에러 전파(예외) 경로 테스트 부재
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.spec.ts:3017-3099` (RUNNING/terminal 두 케이스만 존재)
  - 상세: `executionRepository.createQueryBuilder().execute()` 가 reject 하는 경우(DB 커넥션 오류 등) 함수가 어떻게 동작하는지(그대로 throw 하여 호출부 `ExecutionRunProcessor.onFailed` 의 `.catch(err_ => logger.error(...))` 로 흡수되는지) 를 검증하는 테스트가 없다. `execution-run.processor.spec.ts` 쪽에서도 `finalizeStalledExhausted` 가 reject 하는 케이스의 `logger.error` 호출을 검증하지 않는다(항상 `mockResolvedValue(undefined)` 로만 스텁).
  - 제안: (a) service 쪽에 `executionRepository.createQueryBuilder` 가 reject 하면 그대로 throw 하는지 명시적 테스트, (b) processor 쪽에 `engine.finalizeStalledExhausted.mockRejectedValueOnce(...)` 를 준 뒤 `logger.error` 스파이가 호출되는지 확인하는 회귀 테스트 — fire-and-forget(`void ...catch`) 경로가 조용히 실패를 삼키지 않는지 보장.

## 긍정적으로 확인된 사항 (회귀/격리 관점)
- `finalizeStalledExhausted (PR4)` describe 블록과 기존 `recoverStuckExecutions (PR3 — 크래시 re-drive)` 블록(`execution-engine.service.spec.ts:992` 부근, "옛 fail-only 회귀 가드 — WORKER_HEARTBEAT_TIMEOUT 을 쓰지 않는다" 포함)은 서로 다른 함수를 겨냥하며 mock 대상(`mockExecutionRepo.createQueryBuilder`)을 각 `it`/`describe` 진입 시 재할당하므로 실행 순서에 의존하지 않고 독립적이다. 회귀 충돌 없음.
- `runExecutionFromQueue` RUNNING-분기 테스트(`recordRunningSegmentStart`/`redriveStuckExecution` 스텁, `runExecution` 미호출 검증)와 CANCELLED-분기(ack-discard) 테스트는 실제 3-way 분기 로직(§7.5 case B 재구동 vs ack-discard)과 정합하며, 소스 코드 상 RUNNING 분기가 routing 재등록 이전에 `return` 하므로 테스트가 `registerExecutionRouting` 을 검증하지 않는 것도 타당하다(라우팅은 `redriveStuckExecution` 내부에서 별도 처리 — 이미 PR3 범위에서 커버).
- e2e(`execution-stalled-redelivery.e2e-spec.ts`)는 실제 DB row 를 조작해 "codeA 완료 후 codeB 크래시" 상태를 합성하고, (1) frontier 재실행에 의한 무손실 completed, (2) 완료 노드 미재실행(row count 불변, exactly-once), (3) WORKER_HEARTBEAT_TIMEOUT 오발동 안 함 을 모두 검증한다 — unit 으로는 검증 불가능한 실제 DB 상태 전이/멱등성 교차를 잘 커버한다. `_test/simulate-execution-run-redelivery` 훅을 통한 재현 방식도 실제 BullMQ stall 타이밍 재현 불가 제약을 합리적으로 우회한다.
- `execution-run-dlq-monitor.service.spec.ts` 는 env 파싱(기본값/override/비정상 입력/enabled 문자열 variants) + `checkOnce`(threshold 이상 알람/미만 미알람/cooldown 억제-재발/조회 실패 시 삼킴)까지 엣지 케이스를 폭넓게 커버하며, `ContinuationDlqMonitorService`(기존 패턴)와 병렬 구조라 가독성도 좋다.
- `mkExecQb`/`nodeQb` mock 은 실제 TypeORM `QueryBuilder` 체이닝 인터페이스(`update/set/where/andWhere/returning/execute`)를 얕게 모사하며, 반환 `affected` 값으로 조건부 UPDATE 의 두 분기(RUNNING 발동/이미 terminal no-op)를 구분하는 실제 동작과 정합적이다 — mock 이 과도하게 단순화되어 실제 SQL 의미를 왜곡하지 않는다.

## 요약
핵심 신규 로직(`finalizeStalledExhausted`, `runExecutionFromQueue` RUNNING 분기, `execution-run-dlq-monitor`, `execution-run.processor.onFailed`)은 정상/이미-terminal/threshold 안팎 등 주요 분기를 unit 으로 잘 커버하고, e2e 는 실제 BullMQ stall 을 in-network 로 재현할 수 없는 제약을 `_test/` 훅으로 합리적으로 우회해 무손실 재구동·exactly-once·오탐 방지(WORKER_HEARTBEAT_TIMEOUT 미발동)를 실 DB 상태로 검증한다. 다만 새로 추가된 e2e 전용 컨트롤러 엔드포인트(`simulate-execution-run-redelivery`)는 동일 파일에 이미 존재하는 자매 엔드포인트의 게이팅 테스트 패턴을 그대로 재사용할 수 있었음에도 unit 테스트가 전혀 추가되지 않아 프로덕션 은닉(404) 회귀를 unit 레벨에서 잡을 수 없다는 것이 유일한 WARNING 급 갭이다. 나머지는 cascade WHERE 절 인자 미검증, emit payload 미검증, 에러 전파 경로 미검증, 신규 상수 값 미검증 등 저위험 INFO 성격의 강화 여지다.

## 위험도
LOW

STATUS: SUCCESS
