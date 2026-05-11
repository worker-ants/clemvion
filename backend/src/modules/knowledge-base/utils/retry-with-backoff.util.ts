/**
 * LLM 호출 / KB 임베딩 · 그래프 추출 같은 외부 호출에 대해 지수 백오프 재시도를 적용한다.
 *
 * 호출자가 외부 LLM 호출에 직접 `withTimeout` 을 걸어 둔 상태에서, timeout 등 일시 오류를
 * 일정 횟수까지 자동 재시도해 영구 stuck 상태를 방지하기 위한 유틸. 비대상 오류 (4xx 인증/
 * 입력 검증 · 차원 mismatch · JSON parse) 는 즉시 throw 한다.
 *
 * 사용 예:
 *   await retryWithBackoff(
 *     () => llmService.chat(config, params, { timeoutMs: 90_000 }),
 *     {
 *       maxRetries: 3,
 *       baseDelayMs: 1000,
 *       onAttempt: async (attemptIdx, err) => recordRetry(attemptIdx, err),
 *     },
 *   );
 *
 *   백오프 시간: baseDelayMs * 4^attemptIdx → 1s, 4s, 16s (3회 재시도 기준).
 */

export interface RetryOptions {
  /** 추가 재시도 횟수. maxRetries=3 이면 최대 1 + 3 = 4 회 실행. */
  maxRetries: number;
  /** 1차 재시도 대기 (ms). 이후 attempt i 에서 baseDelayMs * 4^i ms 대기. */
  baseDelayMs: number;
  /** 매 실패 직후 호출. attemptIdx 는 0-base (0=1차 실패). 비동기 함수 await 됨. */
  onAttempt?: (attemptIdx: number, error: Error) => Promise<void> | void;
  /**
   * 재시도성 여부 판정. 미지정 시 {@link isRetryableLlmError} 사용.
   * false 를 반환하면 즉시 throw 한다.
   */
  isRetryable?: (error: Error) => boolean;
}

const RETRYABLE_PATTERNS: RegExp[] = [
  /timed out/i,
  /timeout/i,
  /socket hang up/i,
  /ECONNRESET/i,
  /ETIMEDOUT/i,
  /ENETUNREACH/i,
  /EAI_AGAIN/i,
  /\b429\b/,
  /rate[ _-]?limit/i,
  /\b5\d{2}\b/, // 5xx
  /service unavailable/i,
  /bad gateway/i,
  /gateway timeout/i,
];

const NON_RETRYABLE_PATTERNS: RegExp[] = [
  /\b40[0134]\b/, // 400/401/403/404
  /\b422\b/,
  /unauthorized/i,
  /forbidden/i,
  /unprocessable/i,
  /not found/i,
  /dimension mismatch/i,
  /vector is empty/i,
  /JSON parse/i,
  /Extraction response/i,
];

export function isRetryableLlmError(error: Error): boolean {
  const msg = error.message ?? '';
  // 비재시도 패턴이 먼저 매칭되면 false (예: "401 Rate limit ..." 같은 false positive 방지)
  if (NON_RETRYABLE_PATTERNS.some((p) => p.test(msg))) {
    return false;
  }
  return RETRYABLE_PATTERNS.some((p) => p.test(msg));
}

export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  opts: RetryOptions,
): Promise<T> {
  const { maxRetries, baseDelayMs } = opts;
  const isRetryable = opts.isRetryable ?? isRetryableLlmError;

  let lastError: Error | undefined;
  for (let attemptIdx = 0; attemptIdx <= maxRetries; attemptIdx++) {
    try {
      return await fn();
    } catch (rawErr) {
      const err = rawErr instanceof Error ? rawErr : new Error(String(rawErr));
      lastError = err;

      if (opts.onAttempt) {
        try {
          await opts.onAttempt(attemptIdx, err);
        } catch {
          // onAttempt 의 부수효과 실패는 재시도 자체를 막지 않는다.
        }
      }

      const retryable = isRetryable(err);
      const exhausted = attemptIdx >= maxRetries;
      if (!retryable || exhausted) {
        throw err;
      }

      const delay = baseDelayMs * Math.pow(4, attemptIdx);
      await new Promise<void>((resolve) => setTimeout(resolve, delay));
    }
  }
  // unreachable: for 루프가 maxRetries+1 회 실행되며 마지막엔 반드시 throw 함.
  throw lastError ?? new Error('retryWithBackoff: max retries exceeded');
}
