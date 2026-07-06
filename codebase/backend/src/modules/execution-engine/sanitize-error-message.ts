/**
 * 실행 실패 에러 메시지를 사용자向 표면(WS 이벤트 / 알림 / 이메일)에 노출하기 전 정리한다.
 *
 * 길이 제한 + stack trace · connection string 패턴 제거. credential 자체는 상위 계층
 * (WS 마스킹 등)이 추가 차단하지만, Error.message 안에 평문으로 들어온 내부 호스트명·
 * 연결 문자열·파일 경로가 인앱/이메일 알림으로 흘러가지 않도록 하는 defense in depth.
 *
 * Background 본문 실패(`BackgroundExecutionProcessor`)와 top-level 실행 실패
 * (`ExecutionEngineService.dispatchExecutionFailedNotification`) 양 경로가 공유한다
 * — 한쪽만 적용돼 방어 심도가 갈리는 일을 막기 위해 단일 util 로 둔다.
 */
const ERROR_MESSAGE_MAX_LENGTH = 500;
const STACK_TRACE_PATTERN = /\s+at\s+.*\(.+\)/g;
const CONNECTION_STRING_PATTERN =
  /(postgres|postgresql|redis|mongodb|mysql):\/\/[^\s]+/gi;

export function sanitizeErrorMessage(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err);
  const stripped = raw
    .replace(STACK_TRACE_PATTERN, '')
    .replace(CONNECTION_STRING_PATTERN, '[REDACTED_URI]')
    .trim();
  return stripped.length > ERROR_MESSAGE_MAX_LENGTH
    ? `${stripped.slice(0, ERROR_MESSAGE_MAX_LENGTH)}…`
    : stripped;
}
