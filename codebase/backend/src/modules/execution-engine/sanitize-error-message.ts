/**
 * 실행 실패 에러 메시지를 **알림 표면**(인앱 알림 / 이메일)에 노출하기 전 정리한다.
 *
 * **적용 범위를 좁혀 적는다.** 종전 첫 줄은 "WS 이벤트 / 알림 / 이메일" 이라고 썼는데,
 * 호출부는 실측 **3곳뿐이고 전부 알림 조립 지점**이다
 * (`execution-engine.service` 실패 알림 · `background-execution.processor` · `schedule-runner`).
 * WS/SSE/webhook 종결 이벤트는 이 함수를 **거치지 않았다** — 문서한 보장이 구현보다 넓었다.
 *
 * 그 종결 경로는 `shared/utils/terminal-error-payload.ts` 의 `toTerminalErrorPayload` 가
 * egress 초크포인트에서 `deepRedactSecrets` 로 마스킹한다(EIA §R17 egress-only 원칙).
 * 두 경로가 쓰는 마스킹 SoT 는 `shared/utils/sanitize-error-message.ts` 로 같다.
 *
 * 길이 제한 + stack trace · connection string 패턴 제거 + **secret 토큰 마스킹**.
 * Error.message 안에 평문으로 들어온 내부 호스트명·연결 문자열·파일 경로, 그리고
 * 노드 예외가 echo 한 Bearer/API 키/Authorization 헤더 값이 인앱/이메일(외부 SMTP)·
 * webhook 알림으로 흘러가지 않도록 하는 defense in depth.
 *
 * secret 마스킹은 shared SoT `shared/utils/sanitize-error-message.ts` 의
 * `redactSecrets`(SECRET_LEAK_PATTERNS) 를 재사용한다 — WS 경로의 key-name 기반
 * `sanitizePayloadForWs` 는 자유 텍스트 message 내부의 값-embedded 토큰을 못 잡으므로,
 * 알림/이메일 경로는 본 값-패턴 마스킹이 유일한 방어다 (EIA §R17 잔여 하드닝).
 *
 * Background 본문 실패(`BackgroundExecutionProcessor`)와 top-level 실행 실패
 * (`ExecutionEngineService.dispatchExecutionFailedNotification`) 양 경로가 공유한다
 * — 한쪽만 적용돼 방어 심도가 갈리는 일을 막기 위해 단일 util 로 둔다.
 */
import { redactSecrets } from '../../shared/utils/sanitize-error-message';

const ERROR_MESSAGE_MAX_LENGTH = 500;
const STACK_TRACE_PATTERN = /\s+at\s+.*\(.+\)/g;
const CONNECTION_STRING_PATTERN =
  /(postgres|postgresql|redis|mongodb|mysql):\/\/[^\s]+/gi;

export function sanitizeErrorMessage(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err);
  const stripped = redactSecrets(
    raw
      .replace(STACK_TRACE_PATTERN, '')
      .replace(CONNECTION_STRING_PATTERN, '[REDACTED_URI]')
      .trim(),
  );
  return stripped.length > ERROR_MESSAGE_MAX_LENGTH
    ? `${stripped.slice(0, ERROR_MESSAGE_MAX_LENGTH)}…`
    : stripped;
}
