/**
 * 취소 종결 이벤트의 `cancelledBy` · `error` 를 DB 행의 `error` 에서 정한다(CLE-T-NP5VPK).
 *
 * `ExecutionCancelledError` 나 guarded UPDATE 0행으로 "DB 가 이미 CANCELLED" 를 본 종결자는
 * 누가 취소했는지 모른다. 취소를 쓴 쪽이 남긴 `error.code` 만이 그 사유다. 대응은
 * CLE-EIA-NOTIFY-EVENTS 「`execution.cancelled` 행동 계약」의 표를 따른다.
 *
 * | `error.code` | `cancelledBy` |
 * | --- | --- |
 * | `RESUME_*` | `system` |
 * | `EXECUTION_QUEUE_WAIT_TIMEOUT` · `WEBCHAT_IDLE_TIMEOUT` | `timeout` |
 * | 그 밖의 코드 · 코드 없음 | `user` |
 *
 * - 코드가 없으면 `error` 를 싣지 않는다. 일반 사용자 취소는 `error` 키가 없어야 한다.
 * - 코드가 있으면 표에 없는 코드라도 행의 `error` 를 그대로 싣는다. 모르는 사유를 지우지
 *   않는다. `message` 가 문자열이 아니면 코드를 `message` 로 쓴다(시스템 취소는 `message`
 *   가 늘 있다는 계약).
 * - `cancelledBy` 는 닫힌 세 값이다. 새 사유는 새 값을 만들지 않고 `error.code` 로 가른다.
 */
export interface CancellationReason {
  cancelledBy: 'user' | 'system' | 'timeout';
  error?: { code: string; message: string };
}

const TIMEOUT_CODES: ReadonlySet<string> = new Set([
  'EXECUTION_QUEUE_WAIT_TIMEOUT',
  'WEBCHAT_IDLE_TIMEOUT',
]);

export function cancellationReasonFromError(
  error: Record<string, unknown> | null | undefined,
): CancellationReason {
  const code = error?.code;
  if (typeof code !== 'string' || code === '') return { cancelledBy: 'user' };
  const message = typeof error?.message === 'string' ? error.message : code;
  const cancelledBy = code.startsWith('RESUME_')
    ? 'system'
    : TIMEOUT_CODES.has(code)
      ? 'timeout'
      : 'user';
  return { cancelledBy, error: { code, message } };
}
