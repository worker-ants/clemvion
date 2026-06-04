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
