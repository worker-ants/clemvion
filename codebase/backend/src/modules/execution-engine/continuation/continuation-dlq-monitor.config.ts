/**
 * Phase 3.1 — ContinuationDlqMonitorService 설정. DI token + 환경변수 로더.
 *
 * `SHUTDOWN_GRACE_MS` (execution-engine.module.ts) 와 동일하게 `useFactory` 로
 * 주입해 서비스가 `process.env` 를 직접 읽지 않게 한다 (review W-9, DIP).
 * 서비스 단위 테스트는 본 config 객체를 직접 주입할 수 있다 (env mock 불필요).
 */
export const CONTINUATION_DLQ_MONITOR_CONFIG =
  'CONTINUATION_DLQ_MONITOR_CONFIG';

export interface ContinuationDlqMonitorConfig {
  /** dead-letter(`failed`) job 수 알람 임계. */
  thresholdJobs: number;
  /** depth polling 주기 (ms). */
  intervalMs: number;
  /** 알람 재발 최소 간격 (ms). */
  cooldownMs: number;
  /** 모니터 활성 여부. */
  enabled: boolean;
}

/** disabled 로 간주하는 환경변수 값 (review W-6 — 직관적 falsy 표현 폭넓게 수용). */
const DISABLED_VALUES = new Set(['false', '0', 'no', 'off']);

export function loadContinuationDlqMonitorConfig(
  env: NodeJS.ProcessEnv = process.env,
): ContinuationDlqMonitorConfig {
  return {
    thresholdJobs: parsePositiveInt(env.CONTINUATION_DLQ_ALARM_THRESHOLD, 50),
    intervalMs: parsePositiveInt(
      env.CONTINUATION_DLQ_MONITOR_INTERVAL_MS,
      60_000,
    ),
    cooldownMs: parsePositiveInt(
      env.CONTINUATION_DLQ_ALARM_COOLDOWN_MS,
      300_000,
    ),
    enabled: !DISABLED_VALUES.has(
      (env.CONTINUATION_DLQ_MONITOR_ENABLED ?? '').trim().toLowerCase(),
    ),
  };
}

/**
 * 양의 정수 파싱. 비숫자 / 0 / 음수 / 비정수(소수·공학표기) 는 기본값 fallback
 * (review I-4 — `1e10` 같은 공학표기 차단을 위해 정규식 선검증).
 */
function parsePositiveInt(raw: string | undefined, fallback: number): number {
  if (raw === undefined || !/^\d+$/.test(raw.trim())) return fallback;
  const parsed = Number(raw);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}
