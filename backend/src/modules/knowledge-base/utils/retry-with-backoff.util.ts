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

/** 백오프 공식의 지수 밑. baseDelayMs * BACKOFF_BASE^attemptIdx → 기본 1s/4s/16s. */
export const BACKOFF_BASE = 4;
/** Thundering-herd 방지용 jitter 비율 (0~JITTER_RATIO 사이 임의값 곱). */
const JITTER_RATIO = 0.3;

export interface RetryOptions {
  /** 추가 재시도 횟수. maxRetries=3 이면 최대 1 + 3 = 4 회 실행. */
  maxRetries: number;
  /** 1차 재시도 대기 (ms). 이후 attempt i 에서 baseDelayMs * BACKOFF_BASE^i ms 대기. */
  baseDelayMs: number;
  /**
   * 매 실패 직후 호출. attemptIdx 는 0-base (0=1차 실패). 비동기 함수 await 됨.
   * willRetry: 이 실패 직후 다시 재시도가 예정되는지. false 면 outer catch 로 throw 가 흐른다.
   */
  onAttempt?: (
    attemptIdx: number,
    error: Error,
    willRetry: boolean,
  ) => Promise<void> | void;
  /**
   * 재시도성 여부 판정. 미지정 시 {@link isRetryableLlmError} 사용.
   * false 를 반환하면 즉시 throw 한다.
   */
  isRetryable?: (error: Error) => boolean;
  /** 테스트에서 결정론적 동작을 강제하기 위한 random 주입점. 기본 Math.random. */
  randomFn?: () => number;
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

// 'not found' 단독 패턴은 DNS 실패("Host not found ...") 와 충돌하므로 사용하지 않는다.
// HTTP 404 는 \b404\b 로 별도 매칭 — 실제 DNS/네트워크 오류는 ENOTFOUND/EAI_AGAIN 등으로 retryable 분기.
const NON_RETRYABLE_PATTERNS: RegExp[] = [
  /\b40[0134]\b/, // 400/401/403/404
  /\b422\b/,
  /unauthorized/i,
  /forbidden/i,
  /unprocessable/i,
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

      const retryable = isRetryable(err);
      const exhausted = attemptIdx >= maxRetries;
      const willRetry = retryable && !exhausted;

      if (opts.onAttempt) {
        try {
          // onAttempt 에 willRetry 를 동반 전달하면 호출자가 동일 attempt 안에서
          // "재시도 진행 중" vs "최종 실패 직전" 을 구분해 한 번의 DB 쓰기로 처리할 수 있다.
          // (기존 시그니처 호환 유지를 위해 3번째 인자로만 추가.)
          await opts.onAttempt(attemptIdx, err, willRetry);
        } catch {
          // onAttempt 의 부수효과 실패는 재시도 자체를 막지 않는다.
        }
      }

      if (!willRetry) {
        throw err;
      }

      // jitter: ±30% — 다수 문서가 동시에 동일 timeout 을 만나도 backoff 만료가 분산되어
      // rate-limit 환경에서 재시도가 한꺼번에 몰리는 thundering herd 를 방지한다.
      const base = baseDelayMs * Math.pow(BACKOFF_BASE, attemptIdx);
      const random = opts.randomFn ?? Math.random;
      const delay = Math.round(base * (1 + random() * JITTER_RATIO));
      await new Promise<void>((resolve) => setTimeout(resolve, delay));
    }
  }
  // unreachable: for 루프가 maxRetries+1 회 실행되며 마지막엔 반드시 throw 함.
  throw lastError ?? new Error('retryWithBackoff: max retries exceeded');
}
