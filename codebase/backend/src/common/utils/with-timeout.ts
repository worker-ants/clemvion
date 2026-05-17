/**
 * Wrap a Promise with a soft deadline. The underlying operation is NOT
 * cancelled — for transports that don't accept an AbortSignal we accept that
 * the call may continue running in the background until the surrounding code
 * (e.g. `session.close()`) tears down the resource.
 *
 * Used by both `McpClientService` and `McpToolProvider` — extracted so the
 * timeout shape stays identical across MCP code paths.
 */
export function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  label: string,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`${label} timed out after ${ms}ms`)),
      ms,
    );
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
