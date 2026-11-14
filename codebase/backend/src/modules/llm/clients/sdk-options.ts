/**
 * OpenAI · Anthropic SDK 가 429 · 5xx · 연결 실패 · 요청 타임아웃을 다시 보내는 횟수다.
 * SDK 기본값과 같은 2 를 생성자에 적어 SDK 기본값이 바뀌어도 그대로 가게 한다(CLE-T-0R5SYN).
 *
 * - `LlmService.chat` 은 이 재전송 위에 앱 재시도(`withRetry`, 429 만)를 한 번 더 건다.
 * - `LlmService.chatStream` 에는 앱 재시도가 없어서 스트림을 열 때는 이 재전송만 있다.
 *   열기 실패는 클라이언트가 스트림 `error` 이벤트로 바꾼다.
 */
export const LLM_SDK_MAX_RETRIES = 2;
