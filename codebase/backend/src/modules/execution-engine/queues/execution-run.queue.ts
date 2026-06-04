/**
 * PR1 — Execution Intake Queue (`execution-run`).
 *
 * SoT: spec/5-system/4-execution-engine.md §4.1–4.3 / §9.3 / §11.
 *
 * `execute()` 가 새 Execution 시작을 발행하는 BullMQ 영속 큐. 현 fire-and-forget
 * in-process `runExecution` 호출을 대체해 N 개 backend 인스턴스가 work-stealing
 * 으로 실행을 분산 처리한다 (수평 처리량 + backpressure). 워커는 실행 1건을
 * 통째로(한 active 세그먼트: 시작 → 첫 BLOCK/완료) 처리한다. 세그먼트 내부 노드
 * dispatch 는 여전히 in-process (per-node task queue 없음).
 *
 * `waiting_for_input` 은 본 큐의 대상이 아니다 — 큐 없는 durable DB park (§4.x).
 * 재개 세그먼트는 `execution-continuation` 큐(§7.4)가 운반한다.
 *
 * PR 범위 (exec-intake-queue-impl.md):
 * - PR1 (본 파일): intake 큐 + work-stealing. crash 재개·동시성 cap·타임아웃 제외.
 * - PR2: §8 동시성 cap + active-running 타임아웃.
 * - PR3/PR4: crash RUNNING 재개(멱등 rehydration) + BullMQ stalled-job 일원화.
 */
export const EXECUTION_RUN_QUEUE = 'execution-run';

/**
 * Trigger 종류 → BullMQ job priority. 낮은 숫자가 높은 우선순위 (BullMQ 규약).
 * spec §4.3: `manual` > `webhook` > `schedule`. 값은 `Trigger.type` enum
 * (`spec/1-data-model.md §2.8`) 어휘를 그대로 사용한다 (naming collision 회피).
 */
export const EXECUTION_RUN_PRIORITY = {
  manual: 1,
  webhook: 2,
  schedule: 3,
} as const;

export type ExecutionRunTriggerType = keyof typeof EXECUTION_RUN_PRIORITY;

/**
 * triggerType → priority 매핑. 미상/누락은 가장 낮은 우선순위(schedule)로 둔다
 * — 알 수 없는 발화 경로가 수동/웹훅을 굶기지 않도록 보수적으로 처리.
 */
export function resolveExecutionRunPriority(
  triggerType: ExecutionRunTriggerType | undefined,
): number {
  if (triggerType && triggerType in EXECUTION_RUN_PRIORITY) {
    return EXECUTION_RUN_PRIORITY[triggerType];
  }
  return EXECUTION_RUN_PRIORITY.schedule;
}

/**
 * BullMQ jobId 스키마.
 *
 * PR1 은 Execution row 생성당 정확히 1회 enqueue 하므로 `executionId` 자체가
 * 유일 키이고, BullMQ 가 동일 jobId 의 중복 add 를 자동 dedup 한다 (네트워크
 * 재시도·동시 호출에 대한 idempotency). 따라서 seq 를 붙이지 않는다.
 *
 * spec §4.2 의 `<executionId>:run:<seq>` 표기는 향후 re-enqueue(PR3/PR4 crash
 * 재개) 시나리오를 위한 일반형이다 — PR1 은 re-enqueue 하지 않으므로 seq 가
 * 불필요하고, 필요해지는 시점에 본 함수만 확장하면 된다.
 */
export function buildExecutionRunJobId(executionId: string): string {
  return executionId;
}

/**
 * BullMQ 큐 옵션 기본값 (PR1).
 *
 * - `attempts: 1` — PR1 은 crash-retry 를 도입하지 않는다. 멱등 resume(§7.5
 *   확장)은 PR3, BullMQ stalled-job 재배달 일원화는 PR4. attempts > 1 로 두면
 *   비멱등 노드(Integration write 등)가 이중 실행될 수 있어 명시적으로 1.
 * - `removeOnComplete: true` — 정상 완료 job 즉시 제거 (Redis 메모리 보호).
 * - `removeOnFail: false` — 실패 job 보존(관측). 크래시로 orphan 된 RUNNING row
 *   는 현행대로 `recoverStuckExecutions` 가 수거(PR4 에서 stalled 로 일원화).
 */
export const EXECUTION_RUN_QUEUE_DEFAULT_OPTS = {
  attempts: 1,
  removeOnComplete: true,
  removeOnFail: false,
};

/**
 * worker 가 stalled(워커 사망 등) job 을 재배달하지 않도록 0 으로 둔다 — PR1 은
 * crash 재개를 구현하지 않으므로 stalled 재실행이 비멱등 노드 이중 실행을
 * 유발하면 안 된다. PR4 에서 멱등 rehydration 과 함께 상향한다.
 */
export const EXECUTION_RUN_MAX_STALLED_COUNT = 0;

export const DEFAULT_EXECUTION_RUN_WORKER_CONCURRENCY = 1;

/**
 * SoT: spec §11 `EXECUTION_RUN_WORKER_CONCURRENCY`. intake worker 의 BullMQ
 * concurrency 를 환경변수로 결정 — work-stealing 처리량·backpressure·§8 동시성
 * cap(PR2)의 토대. `resolveContinuationWorkerConcurrency` 와 동일 규약:
 * `@Processor` 데코레이터가 DI 이전 평가되므로 순수 파서, 비양수·비정수·비숫자·
 * 공학표기는 기본값 fallback (정규식 선검증).
 */
export function resolveExecutionRunWorkerConcurrency(
  env: NodeJS.ProcessEnv = process.env,
): number {
  const raw = env.EXECUTION_RUN_WORKER_CONCURRENCY;
  if (raw === undefined || !/^\d+$/.test(raw.trim())) {
    return DEFAULT_EXECUTION_RUN_WORKER_CONCURRENCY;
  }
  const parsed = Number(raw);
  return Number.isInteger(parsed) && parsed > 0
    ? parsed
    : DEFAULT_EXECUTION_RUN_WORKER_CONCURRENCY;
}

/**
 * `execution-run` job payload.
 *
 * - `executionId`: 이미 `execute()` 가 `pending` 으로 저장한 Execution row 의 id.
 *   워커는 이 id 로 row 를 재조회해 status 재검증(idempotency) 후 실행한다.
 * - `input`: 실행 입력. row.inputData 와 동일하나, raw input 의 정확한 의미를
 *   보존하기 위해 job 에 함께 실어 워커가 `runExecution(row, input)` 에 그대로
 *   전달한다.
 */
export interface ExecutionRunJob {
  executionId: string;
  input?: unknown;
}
