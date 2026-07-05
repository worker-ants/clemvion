/**
 * execution-engine 동시성·실행 한도의 **env 파서 응집 모듈** (§8 동시 실행 제한 +
 * §11 worker concurrency env). 모든 한도 resolve* 를 한 곳에 모아, 값을 env → number 로
 * 정규식 선검증(`^\d+$`, 공학표기·소수·음수 배제) 후 문서화된 기본값으로 fallback 한다.
 *
 * SoT: spec/5-system/4-execution-engine.md §8 · §11.
 *
 * - `resolveMaxActiveRunningMs` — 단일 Execution active-running 누적 타임아웃(기본 30분,
 *   `0`=무제한). §8. (한도 출처 `Workflow.settings` 는 아직 미존재 → 시스템 상수 env
 *   override 로 enforce; per-workflow 설정은 후속 — Q1=A, 2026-06-04 사용자 승인.)
 * - `resolveConcurrencyCap` — workspace/workflow 동시 running admission cap(settings 객체). §8.
 * - `resolveQueueWaitTimeoutMs` — intake 큐 대기 한도(기본 5분). §8.
 * - `resolveExecutionRunWorkerConcurrency` — execution-run intake worker concurrency
 *   (env `EXECUTION_RUN_WORKER_CONCURRENCY`, 기본 1). §11.
 *
 * 순수 파서(process.env 외 의존 없음). 소비처: execution-engine.service·execution-run.processor·
 * system-status.constants. 모듈/호출 시 평가 — 변경은 인스턴스 재시작 시 반영.
 */
export const DEFAULT_MAX_ACTIVE_RUNNING_MS = 30 * 60 * 1000; // 30분

/**
 * `EXECUTION_MAX_ACTIVE_RUNNING_MS` env 로 한도(ms)를 결정한다. `0` 은 **무제한**
 * (enforce 안 함, `MAX_NODE_ITERATIONS=0` 과 동일 관용). 비양수가 아닌 정수만 채택,
 * 비숫자·소수·공학표기·음수는 기본값 fallback (`resolveExecutionRunWorkerConcurrency`
 * 와 동일 정규식 선검증 규약).
 *
 * 모듈 초기화 시 1회 평가 — 변경 후 인스턴스 재시작 필요.
 *
 * @returns 0 if unlimited; positive integer = limit in milliseconds.
 */
export function resolveMaxActiveRunningMs(
  env: NodeJS.ProcessEnv = process.env,
): number {
  const raw = env.EXECUTION_MAX_ACTIVE_RUNNING_MS;
  if (raw === undefined || !/^\d+$/.test(raw.trim())) {
    return DEFAULT_MAX_ACTIVE_RUNNING_MS;
  }
  const parsed = Number(raw);
  // 0 = 무제한, 양의 정수 = 한도. 그 외(NaN 등) fallback.
  return Number.isInteger(parsed) && parsed >= 0
    ? parsed
    : DEFAULT_MAX_ACTIVE_RUNNING_MS;
}

/**
 * PR2b — §8 워크스페이스/워크플로우 동시 실행 cap (spec §8).
 *
 * 동시 `running` Execution 수를 workspace(기본 10)·workflow(기본 3) 양쪽에서 제한한다.
 * admission gate(`runExecutionFromQueue` PENDING→RUNNING 직전)가 이 cap 을 원자적으로
 * 검증한다. **주의 — Parallel 노드 `config.maxConcurrency`(노드 내 branch 동시성)와는
 * 스코프가 다른 별개 개념이다.**
 */
export const DEFAULT_WORKSPACE_MAX_CONCURRENT_EXECUTIONS = 10;
export const DEFAULT_WORKFLOW_MAX_CONCURRENT_EXECUTIONS = 3;

/**
 * `settings.maxConcurrentExecutions`(Workspace/Workflow.settings JSONB)를 파싱한다.
 * **양의 정수만** 유효 cap 으로 채택하고, 미설정·0·음수·비정수·비숫자는 `defaultCap`
 * 으로 fallback 한다(무제한 옵션 없음 — 동시성 폭주 방지). Workflow.settings 는
 * unvalidated `Record` 라 런타임 타입 방어가 필요하므로 값 타입을 직접 확인한다.
 */
export function resolveConcurrencyCap(
  settings: Record<string, unknown> | null | undefined,
  defaultCap: number,
): number {
  const raw = settings?.maxConcurrentExecutions;
  return typeof raw === 'number' && Number.isInteger(raw) && raw > 0
    ? raw
    : defaultCap;
}

/** 큐 대기 초과 기본 한도 = 5분 (spec §8). */
export const DEFAULT_QUEUE_WAIT_TIMEOUT_MS = 5 * 60 * 1000;

/**
 * cap 초과로 admission 이 지연될 때 `execution-run` job 을 delayed 재큐하는 backoff(ms).
 * 고정 delay — 재큐 job 이 이 간격 후 재-pick up 되어 admission gate 를 재검사한다.
 */
export const EXECUTION_ADMISSION_RETRY_DELAY_MS = 2_000;

/**
 * `EXECUTION_QUEUE_WAIT_TIMEOUT_MS` env 로 큐 대기(admission 대기) 한도(ms)를 결정한다.
 * 양의 정수만 채택, 그 외(미설정·0·음수·비숫자·소수)는 기본값(300000). `0`=무제한은
 * 두지 않는다(큐 무한 적체 방지). **config-env-coverage 가드 스캔 밖이라 `.env.example`
 * 수동 등록 필요**(선례 `EXECUTION_MAX_ACTIVE_RUNNING_MS` 와 동일).
 *
 * 모듈/호출 시 평가 — 변경 후 인스턴스 재시작 필요.
 */
export function resolveQueueWaitTimeoutMs(
  env: NodeJS.ProcessEnv = process.env,
): number {
  const raw = env.EXECUTION_QUEUE_WAIT_TIMEOUT_MS;
  if (raw === undefined || !/^\d+$/.test(raw.trim())) {
    return DEFAULT_QUEUE_WAIT_TIMEOUT_MS;
  }
  const parsed = Number(raw);
  return Number.isInteger(parsed) && parsed > 0
    ? parsed
    : DEFAULT_QUEUE_WAIT_TIMEOUT_MS;
}

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
