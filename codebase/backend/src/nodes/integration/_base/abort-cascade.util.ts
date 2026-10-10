/**
 * Upstream cancellation wiring shared by the integration nodes that own a
 * per-request `AbortController` (HTTP Request · Cafe24 · MakeShop).
 *
 * NERV CLE-EXEC-CANCEL §fetch 자체 타임아웃과의 연쇄: the request keeps its own
 * controller for its timeout and the execution's `context.abortSignal` is
 * linked into it, so either one stops the request. The listener on the
 * execution-wide signal must be removed when the request settles; a request
 * that succeeds never aborts its own controller, so cleanup hung off that
 * controller's abort event leaks one listener per call.
 */

const noop = (): void => {};

/**
 * Aborts `controller` when `upstream` aborts and returns the function that
 * removes the listener. Call it in a `finally` once the request (body read
 * included) has settled. An upstream that is already aborted aborts the
 * controller immediately and adds no listener.
 */
export function linkUpstreamAbort(
  controller: AbortController,
  upstream: AbortSignal | undefined,
): () => void {
  if (!upstream) return noop;
  if (upstream.aborted) {
    controller.abort();
    return noop;
  }
  const onAbort = (): void => controller.abort();
  upstream.addEventListener('abort', onAbort, { once: true });
  return () => upstream.removeEventListener('abort', onAbort);
}

/**
 * True when `err` is an AbortError caused by the execution being cancelled.
 * The caller rethrows it so the engine records the node as `cancelled`
 * (CLE-EXEC-CANCEL rule 19). An AbortError while `upstream` is still open came
 * from the request's own timeout and keeps the caller's transport-failure
 * mapping.
 *
 * Matches on `name` instead of `instanceof Error`: a real `fetch` rejects with
 * a DOMException that may come from another realm (the engine's
 * `isAbortError` checks the same way).
 */
export function isUpstreamAbort(
  err: unknown,
  upstream: AbortSignal | undefined,
): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    (err as { name?: unknown }).name === 'AbortError' &&
    upstream?.aborted === true
  );
}
