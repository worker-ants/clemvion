import { isAbortErrorLike } from '../../integration/_base/abort-cascade.util';

/**
 * Throws an `AbortError` when an LLM call failed after the node was cancelled.
 * Call it first in the `catch` around `llmService.chat`. When it returns, the
 * failure is the node's own and keeps the node's error mapping.
 *
 * [노드 취소](CLE-EXEC-CANCEL#노드-핸들러-의무) rule 3: a cancellation must reach the engine as an
 * `AbortError` so the node execution ends `cancelled` instead of going out the
 * `error` port. The provider SDKs do not agree on what an aborted request
 * rejects with. Anthropic and OpenAI throw `APIUserAbortError`, whose `name`
 * stays `'Error'`, so the engine's name check misses it. A fetch-based client
 * rejects with a DOMException named `AbortError`. The node signal decides
 * instead: once `context.abortSignal` has aborted, the failed call is the
 * cancellation. An `AbortError` is rethrown as it is. Anything else is wrapped
 * in a new `AbortError` that keeps it as `cause`. The wrapper's message is
 * fixed: the engine copies it into the node execution's `error` and the
 * `execution.node.cancelled` event, and a failure that only lost the race to
 * the cancellation (a 401, a 5xx) carries provider text that should not go
 * there.
 *
 * The LLM call timeout (`withTimeout`) aborts its own controller and leaves
 * `context.abortSignal` open, so a timeout stays the node's failure.
 */
export function rethrowIfNodeCancelled(
  err: unknown,
  signal: AbortSignal | undefined,
): void {
  if (signal?.aborted !== true) return;
  if (isAbortErrorLike(err)) throw err;
  const abortError = new Error('LLM call was aborted', { cause: err });
  abortError.name = 'AbortError';
  throw abortError;
}
