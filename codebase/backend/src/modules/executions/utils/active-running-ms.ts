import { ExecutionStatus } from '../entities/execution.entity';

/** 실행이 끝났다고 보는 상태. 이 밖의 상태는 실행 시간이 아직 쌓이는 중이다. */
const FINISHED_STATUSES: ReadonlySet<ExecutionStatus> = new Set([
  ExecutionStatus.COMPLETED,
  ExecutionStatus.FAILED,
  ExecutionStatus.CANCELLED,
]);

/**
 * 저장된 `active_running_ms` 를 응답의 「실행 시간」(`activeRunningMs`) 값으로 바꾼다.
 *
 * `null` 을 돌려주는 경우는 둘이다.
 * - 실행이 끝나지 않았다(`pending` · `running` · `waiting_for_input`). 이때 저장 값에는 끝난
 *   구간만 들어 있다.
 * - 측정되지 않았다. 컬럼이 `NOT NULL DEFAULT 0` 이라 V083 이전 실행이 0 으로 남아 있고,
 *   실행 중에 REST 중지로 끝난 실행은 마지막 구간이 빠져 0 일 수 있다(후속 CLE-T-ES1J1E).
 *   저장 값이 0 인데 전체 경과(`durationMs`)가 0 보다 크면 이 경우로 본다.
 *
 * 0 을 그대로 내보내면 실제로 0ms 걸린 것처럼 읽힌다. 판정을 이 함수 한 곳에서 해서 실행
 * 응답과 대시보드 최근 실행이 같은 값을 싣게 한다.
 *
 * 근거: [실행 내역 「API」](CLE-EXEC-HISTORY#api)
 */
export function toActiveRunningMsForResponse(row: {
  status: ExecutionStatus;
  activeRunningMs: number | null | undefined;
  durationMs: number | null | undefined;
}): number | null {
  if (!FINISHED_STATUSES.has(row.status)) return null;
  const active = row.activeRunningMs ?? 0;
  if (active === 0 && (row.durationMs ?? 0) > 0) return null;
  return active;
}
