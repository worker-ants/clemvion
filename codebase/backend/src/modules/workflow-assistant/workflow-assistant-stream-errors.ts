/**
 * 어시스턴트 SSE `error` 이벤트의 `message` 를 정하는 단일 출처 (REQ-ASSIST-048).
 *
 * 어시스턴트 모듈(스트림 서비스 · 컨트롤러)이 SSE `error` 이벤트로 보내는 모든
 * `message` 는 이 파일의 표 · 함수에서 온다. 서비스나 컨트롤러에 문구를 인라인
 * 으로 쓰지 않는다. 새 코드를 더할 때 문구를 둘 자리는 이 파일 하나다.
 *
 * 프로바이더 · 라이브러리 예외 원문에는 요청 URL · 키 조각 · 응답 본문이 섞일
 * 수 있어 화면으로 보내지 않고 서버 로그에만 남긴다 (CWE-209, 에러 응답 규약
 * 규칙 2 와 같은 동기). LLM 클라이언트가 사용자용으로 쓴 `message`
 * (`LLM_OUTPUT_MALFORMED` 의 안내문 등)도 같은 규칙으로 로그에만 남는다. 서버는
 * 코드별 고정 영문만 보내고(백엔드 응답에 한국어를 넣지 않는다, CLE-UI-I18N
 * 규칙 3), 프런트엔드 에러 버블이 코드로 사전 문구(`assistant.*`)를 고른다.
 * 사전 문구가 없는 코드만 이 영문으로 폴백한다.
 *
 * 짝이 되는 프런트엔드 표: `codebase/frontend/src/components/editor/assistant-panel/assistant-message.tsx`
 * 의 `ERROR_MESSAGE_KEYS`. 새 코드를 더하면 양쪽을 함께 고친다. 두 패키지가
 * 코드를 공유하는 상수는 만들지 않고, 각 쪽 테스트가 같은 코드 목록을 명시해
 * 한쪽만 바뀌면 깨지게 했다(`workflow-assistant-stream-errors.spec.ts` ·
 * `assistant-message-error.test.tsx`).
 */
export const ASSISTANT_STREAM_ERROR_MESSAGES = {
  ASSISTANT_NO_LLM_CONFIG:
    'No LLM config available. Please configure one first.',
  ASSISTANT_STREAM_FAILED:
    'The assistant could not complete the response. Please try again shortly.',
  LLM_RATE_LIMIT:
    'The LLM provider rate limit was reached. Please retry in a moment.',
  LLM_CONNECTION_ERROR:
    'The connection to the LLM provider failed. Please try again.',
  LLM_OUTPUT_MALFORMED:
    "The model exposed internal control tokens in its response, so the reply was stopped. Switch to another model or check the model's serving settings.",
} as const satisfies Record<string, string>;

/**
 * 위 표에 없는 코드가 LLM 클라이언트에서 올 때 쓰는 고정 영문. 클라이언트의
 * `message` 는 어느 코드에서도 화면으로 보내지 않는다.
 */
export const ASSISTANT_STREAM_ERROR_FALLBACK_MESSAGE =
  'The LLM stream failed. Please try again.';

/**
 * `ASSISTANT_NO_LLM_CONFIG` 의 두 갈래. 설정이 없거나 쓸 수 없어 서비스가
 * `BadRequestException` 을 받으면 표의 문구를, 그 밖의 예외로 설정을 읽지 못하면
 * 아래 문구를 보낸다. 예외 원문은 어느 쪽에서도 싣지 않는다.
 */
const NO_LLM_CONFIG_RESOLVE_FAILED_MESSAGE = 'Failed to resolve LLM config.';

export function noLlmConfigMessage(configUnavailable: boolean): string {
  return configUnavailable
    ? ASSISTANT_STREAM_ERROR_MESSAGES.ASSISTANT_NO_LLM_CONFIG
    : NO_LLM_CONFIG_RESOLVE_FAILED_MESSAGE;
}

/**
 * `ASSISTANT_TOO_MANY_TOOL_CALLS` 의 두 갈래. 한도 숫자가 문구에 들어가는
 * 서버 발행 코드라서 표 대신 함수로 둔다.
 *  - `round-limit`: 한 턴의 LLM 호출 라운드 상한(`MAX_TOOL_LOOP_ROUNDS`)
 *  - `tool-call-budget`: 한 턴의 도구 호출 예산(`computeToolCallsBudget`)
 */
export function tooManyToolCallsMessage(
  kind: 'round-limit' | 'tool-call-budget',
  limit: number,
): string {
  return kind === 'round-limit'
    ? `Per-turn LLM round limit (${limit}) exceeded. Send a follow-up message to continue executing the remaining plan steps.`
    : `Per-turn tool-call budget (${limit}) exhausted. Send a follow-up message to continue executing the remaining plan steps.`;
}

/**
 * LLM 클라이언트의 `error` 이벤트 코드를 화면으로 보낼 `message` 로 바꾼다.
 * 클라이언트의 `message` 원문은 받지 않는다. 호출자가 서버 로그에 남긴다.
 */
export function toClientStreamErrorMessage(code: string): string {
  if (Object.hasOwn(ASSISTANT_STREAM_ERROR_MESSAGES, code)) {
    return ASSISTANT_STREAM_ERROR_MESSAGES[
      code as keyof typeof ASSISTANT_STREAM_ERROR_MESSAGES
    ];
  }
  return ASSISTANT_STREAM_ERROR_FALLBACK_MESSAGE;
}
