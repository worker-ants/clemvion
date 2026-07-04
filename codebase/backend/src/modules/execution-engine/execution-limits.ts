/**
 * PR2a — §8 active-running 누적 타임아웃 한도 (spec/5-system/4-execution-engine.md §8).
 *
 * 단일 Execution 의 "최대 실행 시간"(기본 30분)을 active-running 누적 시간 기준으로
 * enforce 한다. spec §8 은 한도 출처를 `Workflow.settings` 로 두지만, 그 설정 필드는
 * 아직 미존재 — PR2a 는 **시스템 기본 상수(env override)** 로 enforce 하고 per-workflow
 * 설정은 후속(Q1=A, 2026-06-04 사용자 승인).
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
