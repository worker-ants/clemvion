/**
 * Upstream cancellation wiring shared by the integration nodes that own a
 * per-request `AbortController` (HTTP Request · Cafe24 · MakeShop).
 *
 * [노드 취소 「fetch 자체 타임아웃과의 연쇄」](CLE-EXEC-CANCEL#fetch-자체-타임아웃과의-연쇄): the request keeps its own
 * controller for its timeout and the execution's `context.abortSignal` is
 * linked into it, so either one stops the request. The listener on the
 * execution-wide signal must be removed when the request settles; a request
 * that succeeds never aborts its own controller, so cleanup hung off that
 * controller's abort event leaks one listener per call.
 */

const noop = (): void => {};

/**
 * Aborts `controller` when `upstream` aborts and returns the function that
 * removes the listener. Call it in a `finally`. An upstream that is already
 * aborted aborts the controller immediately and adds no listener.
 *
 * The caller decides when the listener comes off, and that is also how far a
 * cancellation reaches. HTTP Request reads the response body inside its `try`
 * and unlinks afterwards, so a cancellation during the body read still aborts
 * the read. The Cafe24 and MakeShop clients unlink as soon as `fetchImpl`
 * returns the headers and read the body afterwards (`safeReadJson`, which
 * swallows every error), so a cancellation during their body read is not seen.
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
 * True when `err` looks like an `AbortError`. Matches on `name` instead of
 * `instanceof Error`: a real `fetch` rejects with a DOMException that may come
 * from another realm (jest's VM sandbox), and `instanceof Error` would miss it.
 * HTTP Request · Cafe24 · MakeShop use this check for an abort. The engine's
 * `isAbortError` (`execution-engine.service.ts`) decides the same way. The two
 * stay separate so node modules do not import the execution-engine module, and
 * `abort-error-parity.spec.ts` next to the engine fails when their verdicts
 * drift apart.
 */
export function isAbortErrorLike(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    (err as { name?: unknown }).name === 'AbortError'
  );
}

/**
 * True when `err` is an AbortError caused by the execution being cancelled.
 * The caller rethrows it so the engine records the node as `cancelled`
 * ([노드 취소](CLE-EXEC-CANCEL#취소-에러-분류) rule 19). An AbortError while `upstream` is still open came
 * from the request's own timeout and keeps the caller's transport-failure
 * mapping.
 *
 * Unlike the engine's `isAbortError`, which looks at the error alone, this also
 * requires `upstream` to be aborted. Using `isAbortError` here would classify
 * the request's own timeout as a cancellation.
 */
export function isUpstreamAbort(
  err: unknown,
  upstream: AbortSignal | undefined,
): boolean {
  return isAbortErrorLike(err) && upstream?.aborted === true;
}
