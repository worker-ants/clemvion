import { PG_INT4_MAX } from '../../../shared/utils/terminal-duration';
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
 * - 측정되지 않았다. 컬럼이 `NOT NULL DEFAULT 0` 이라 V083 이전 실행이 0 으로 남아 있다.
 *   실행 중에 REST 중지로 끝난 실행은 엔진이 다음 상태 전이에서 마지막 구간을 더하기 전까지
 *   0 일 수 있고, 그 전에 프로세스가 끝나면 0 으로 남는다(CLE-T-ES1J1E).
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

/**
 * 엔진이 닫은 RUNNING 구간 길이를 앞선 실행 시간에 더한다. 아래 `ADD_STOPPED_SEGMENT_SQL` 과 같은 규칙이다.
 *
 * - 구간 길이가 음수면(시계 어긋남) 0 으로 본다.
 * - 합은 `PG_INT4_MAX` 에서 멈춘다. 컬럼이 int4 라 넘는 값을 쓰면 상태 전이 UPDATE 가 실패한다.
 */
export function addRunningSegmentMs(
  priorMs: number,
  segmentMs: number,
): number {
  return Math.min(priorMs + Math.max(0, segmentMs), PG_INT4_MAX);
}

/**
 * REST 중지로 `cancelled` 가 된 행의 `active_running_ms` 에 엔진이 닫은 마지막 RUNNING 구간을 더하는
 * UPDATE 문이다. 실행 시간(`active_running_ms`)을 쓰는 규칙은 이 파일이 한 곳에서 정한다.
 *
 * 파라미터: `$1` 실행 id, `$2` 구간 길이(ms, 엔진 시계), `$3` 구간 시작(epoch ms, 엔진 시계),
 * `$4` 더할 수 있는 상태(`cancelled`).
 *
 * - 구간 끝은 중지 시각(`finished_at`)과 지금 중 이른 쪽이다. 앞쪽은 `$2`(시작부터 지금까지),
 *   뒤쪽은 `finished_at - $3`(시작부터 중지까지)이다.
 * - `finished_at` 과 `$3` 은 서로 다른 인스턴스의 시계일 수 있어 증가분이 음수면 0 으로 자른다.
 * - 합은 `PG_INT4_MAX` 에서 멈춘다. 상한은 `duration_ms` 와 같은 상수를 쓴다
 *   (`TERMINAL_DURATION_MS_SQL` 과 같은 규칙).
 * - 쓰는 컬럼은 `active_running_ms` 하나다. 종결 행의 status · finished_at · duration_ms 는 건드리지 않는다.
 */
export const ADD_STOPPED_SEGMENT_SQL = `UPDATE execution
            SET active_running_ms = LEAST(
                  active_running_ms::bigint + GREATEST(
                    0,
                    LEAST(
                      $2::bigint,
                      (EXTRACT(EPOCH FROM finished_at) * 1000)::bigint - $3::bigint
                    )
                  ),
                  ${PG_INT4_MAX}
                )
          WHERE id = $1
            AND status = $4`;
