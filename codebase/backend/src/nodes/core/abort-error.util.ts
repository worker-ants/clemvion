/**
 * True when `err` looks like an `AbortError`. Matches on `name` instead of
 * `instanceof Error`: a real `fetch` rejects with a DOMException that may come
 * from another realm (jest's VM sandbox), and `instanceof Error` would miss it.
 *
 * Every node that has to let a cancellation reach the engine uses this check:
 * HTTP Request · Cafe24 · MakeShop (through `isUpstreamAbort` in
 * `nodes/integration/_base/abort-cascade.util.ts`), Database Query, and the AI
 * nodes' `rethrowIfNodeCancelled` (`nodes/ai/shared`). It lives in
 * `nodes/core` so those node families share it without importing each other.
 *
 * The engine's `isAbortError` (`execution-engine.service.ts`) decides the same
 * way. The two stay separate so node modules do not import the
 * execution-engine module, and `abort-error-parity.spec.ts` next to the engine
 * fails when their verdicts drift apart.
 */
export function isAbortErrorLike(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    (err as { name?: unknown }).name === 'AbortError'
  );
}
