/**
 * Upstream cancellation wiring shared by the integration nodes that own a
 * per-request `AbortController` (HTTP Request · Cafe24 · MakeShop).
 *
 * [노드 취소 「fetch 자체 타임아웃과의 연쇄」](CLE-EXEC-CANCEL-NODES#fetch-자체-타임아웃과의-연쇄): the request keeps its own
 * controller for its timeout and the execution's `context.abortSignal` is
 * linked into it, so either one stops the request. The listener on the
 * execution-wide signal must be removed when the request settles; a request
 * that succeeds never aborts its own controller, so cleanup hung off that
 * controller's abort event leaks one listener per call.
 */
import { isAbortErrorLike } from '../../core/abort-error.util.js';

const noop = (): void => {};

/**
 * Aborts `controller` when `upstream` aborts and returns the function that
 * removes the listener. Call it in a `finally`. An upstream that is already
 * aborted aborts the controller immediately and adds no listener.
 *
 * The caller decides when the listener comes off, and that is also how far a
 * cancellation reaches. All three callers unlink only after the response body
 * has been read, so a cancellation during the body read still aborts the read.
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
