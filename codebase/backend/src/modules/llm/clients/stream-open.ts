import type { ChatStreamEvent } from '../interfaces/llm-client.interface';

/**
 * 스트림을 열다가 취소됐을 때 내는 마지막 이벤트다. 아직 토큰을 쓰지 않았으므로 사용량은 0 이다.
 *
 * 세 클라이언트는 스트림을 열 때의 실패를 `error` 이벤트로 바꾸지만 취소는 실패가 아니라서
 * 도중 취소와 같은 `done(aborted)` 로 끝낸다(CLE-T-0R5SYN).
 */
export function abortedBeforeOpen(model: string): ChatStreamEvent {
  return {
    type: 'done',
    usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
    model,
    finishReason: 'aborted',
  };
}
