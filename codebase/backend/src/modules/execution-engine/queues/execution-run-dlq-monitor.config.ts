/**
 * PR4 — ExecutionRunDlqMonitorService 설정. DI token + 환경변수 로더.
 *
 * `execution-run` 큐는 PR4 에서 `maxStalledCount:1` + `removeOnFail:false` 로
 * 운영되므로, 크래시 세그먼트가 stalled 재배달 한도를 소진하면 `failed`(dead-letter)
 * 로 누적된다. 지속적 crash-loop(poison workflow, 배포 회귀 등)는 DLQ depth 급증으로
 * 나타난다. 본 config 는 `ContinuationDlqMonitorService` 와 동일한 useFactory 주입
 * 패턴(서비스가 `process.env` 직접 읽지 않음, DIP)을 따른다 — 단위 테스트는 본 config
 * 객체를 직접 주입한다(env mock 불필요).
 */
export const EXECUTION_RUN_DLQ_MONITOR_CONFIG =
  'EXECUTION_RUN_DLQ_MONITOR_CONFIG';

export interface ExecutionRunDlqMonitorConfig {
  /** dead-letter(`failed`) job 수 알람 임계. */
  thresholdJobs: number;
  /** depth polling 주기 (ms). */
  intervalMs: number;
  /** 알람 재발 최소 간격 (ms). */
  cooldownMs: number;
  /** 모니터 활성 여부. */
  enabled: boolean;
}

/** disabled 로 간주하는 환경변수 값 (직관적 falsy 표현 폭넓게 수용). */
const DISABLED_VALUES = new Set(['false', '0', 'no', 'off']);

export function loadExecutionRunDlqMonitorConfig(
  env: NodeJS.ProcessEnv = process.env,
): ExecutionRunDlqMonitorConfig {
  return {
    thresholdJobs: parsePositiveInt(env.EXECUTION_RUN_DLQ_ALARM_THRESHOLD, 20),
    intervalMs: parsePositiveInt(
      env.EXECUTION_RUN_DLQ_MONITOR_INTERVAL_MS,
      60_000,
    ),
    cooldownMs: parsePositiveInt(
      env.EXECUTION_RUN_DLQ_ALARM_COOLDOWN_MS,
      300_000,
    ),
    enabled: !DISABLED_VALUES.has(
      (env.EXECUTION_RUN_DLQ_MONITOR_ENABLED ?? '').trim().toLowerCase(),
    ),
  };
}

/**
 * 양의 정수 파싱. 비숫자 / 0 / 음수 / 비정수(소수·공학표기)는 기본값 fallback
 * (`1e10` 같은 공학표기 차단을 위해 정규식 선검증).
 */
function parsePositiveInt(raw: string | undefined, fallback: number): number {
  if (raw === undefined || !/^\d+$/.test(raw.trim())) return fallback;
  const parsed = Number(raw);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}
