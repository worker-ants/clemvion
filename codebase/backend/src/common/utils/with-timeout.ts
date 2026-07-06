/**
 * Wrap a Promise with a soft deadline. The underlying operation is NOT
 * cancelled — for transports that don't accept an AbortSignal we accept that
 * the call may continue running in the background until the surrounding code
 * (e.g. `session.close()`) tears down the resource.
 *
 * Used by both `McpClientService` and `McpToolProvider` — extracted so the
 * timeout shape stays identical across MCP code paths.
 */
/**
 * Thrown when a {@link withTimeout} deadline elapses. A distinct class lets
 * callers classify timeout-vs-other-failure robustly (e.g. mapping to
 * `MCP_TIMEOUT` vs `MCP_CONNECT_FAILED`) without matching on the message string.
 * Still an `Error` subclass, so existing `instanceof Error` / message-based
 * handling is unaffected.
 */
export class TimeoutError extends Error {
  constructor(label: string, ms: number) {
    super(`${label} timed out after ${ms}ms`);
    this.name = 'TimeoutError';
  }
}

export function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  label: string,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new TimeoutError(label, ms)), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err: unknown) => {
        clearTimeout(timer);
        reject(err instanceof Error ? err : new Error(String(err)));
      },
    );
  });
}
