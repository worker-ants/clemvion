/**
 * 어시스턴트 SSE `error` 이벤트의 `message` 를 정한다 (REQ-ASSIST-048).
 *
 * 프로바이더 · 라이브러리 예외 원문에는 요청 URL · 키 조각 · 응답 본문이 섞일
 * 수 있어 화면으로 보내지 않고 서버 로그에만 남긴다 (CWE-209, 에러 응답 규약
 * 규칙 2 와 같은 동기). 서버는 코드별 고정 영문만 보내고, 프런트엔드 에러
 * 버블이 코드로 사전 문구(`assistant.*`)를 고른다. 사전 문구가 없는 코드만
 * 이 영문으로 폴백한다.
 */
export const ASSISTANT_STREAM_ERROR_MESSAGES = {
  ASSISTANT_STREAM_FAILED:
    'The assistant could not get a response from the LLM provider. Please try again shortly.',
  LLM_RATE_LIMIT:
    'The LLM provider rate limit was reached. Please retry in a moment.',
  LLM_CONNECTION_ERROR:
    'The connection to the LLM provider failed. Please try again.',
} as const satisfies Record<string, string>;

/** 위 표에 없는 코드가 LLM 클라이언트에서 올 때 쓰는 고정 영문. */
export const ASSISTANT_STREAM_ERROR_FALLBACK_MESSAGE =
  'The LLM stream failed. Please try again.';

/**
 * LLM 클라이언트가 원문 대신 직접 쓴 고정 안내문을 `message` 로 싣는 코드.
 * 이 코드만 클라이언트 `message` 를 그대로 보낸다. `LLM_OUTPUT_MALFORMED` 는
 * `openai.client.ts` 가 harmony 제어 토큰 원문을 버리고 안내문으로 바꾼다.
 */
const CLIENT_AUTHORED_MESSAGE_CODES: ReadonlySet<string> = new Set([
  'LLM_OUTPUT_MALFORMED',
]);

/**
 * LLM 클라이언트의 `error` 이벤트를 화면으로 보낼 `message` 로 바꾼다.
 * 원문은 호출자가 서버 로그에 남긴다.
 */
export function toClientStreamErrorMessage(
  code: string,
  clientMessage: string,
): string {
  if (Object.hasOwn(ASSISTANT_STREAM_ERROR_MESSAGES, code)) {
    return ASSISTANT_STREAM_ERROR_MESSAGES[
      code as keyof typeof ASSISTANT_STREAM_ERROR_MESSAGES
    ];
  }
  if (CLIENT_AUTHORED_MESSAGE_CODES.has(code)) return clientMessage;
  return ASSISTANT_STREAM_ERROR_FALLBACK_MESSAGE;
}
