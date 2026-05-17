/**
 * 타임아웃 시 AbortController 로 내부 HTTP 요청을 취소해 소켓이 백그라운드에
 * 남지 않도록 하고, 동시에 Promise.race 로 즉시 타임아웃 에러를 던진다.
 *
 * Promise.race 의미상 inner/timer 중 **먼저 settle 된 쪽의 결과만 전파** 된다:
 * - inner 가 먼저 reject  → 원본 에러 (예: 401, ECONNREFUSED) 가 상위로 전달
 * - timer 가 먼저 fire    → "Request timed out ..." 에러만 전달
 *                           (이후 inner 의 지연 rejection 은 .catch 로 삼킴)
 */
export async function withTimeout<T>(
  run: (signal: AbortSignal) => Promise<T>,
  ms: number,
): Promise<T> {
  const controller = new AbortController();
  const inner = run(controller.signal);
  inner.catch(() => undefined);
  let timer: NodeJS.Timeout | undefined;
  try {
    return await Promise.race([
      inner,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          controller.abort();
          reject(new Error(`Request timed out after ${ms}ms`));
        }, ms);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}
