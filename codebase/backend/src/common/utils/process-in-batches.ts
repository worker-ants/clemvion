/**
 * Run `worker` over `items` in fixed-size chunks of at most `concurrency`
 * in-flight promises, awaiting each chunk before starting the next. Bounds the
 * fan-out so a large candidate list can't open thousands of DB/Redis round-trips
 * at once, while still parallelising within a chunk to avoid serial N+1 latency.
 *
 * Uses `Promise.allSettled` so one item's rejection never aborts the batch — the
 * settled result for every item is returned in the **same order as `items`**, and
 * the caller decides how to aggregate fulfilled values and how to log rejections
 * (the aggregation shape differs per caller: boolean counts vs numeric sums, and
 * each has its own fail-open warn message). Because ordering is preserved, callers
 * can map `results[i]` back to `items[i]` for per-item logging.
 *
 * Extracted from the two BullMQ sweep paths that shared this exact loop:
 * `WebChatIdleReaperService.reap` (per-execution cancel) and
 * `InteractionTokenService.reconcileTerminalRevocations` (per-execution revoke).
 *
 * `concurrency` is floored at 1 so a mis-configured `0`/negative value degrades
 * to serial processing instead of an infinite loop.
 *
 * The `worker` call is wrapped in an `async` thunk so a **synchronous** throw
 * (e.g. a non-`async` worker that throws before returning a promise) still
 * settles as a rejected result rather than escaping `Promise.allSettled` and
 * aborting the whole batch — the fail-open contract holds regardless of whether
 * the worker is async.
 */
export async function processInBatches<T, R>(
  items: readonly T[],
  concurrency: number,
  worker: (item: T) => Promise<R> | R,
): Promise<PromiseSettledResult<R>[]> {
  const chunkSize = Math.max(1, Math.floor(concurrency));
  const results: PromiseSettledResult<R>[] = [];
  for (let i = 0; i < items.length; i += chunkSize) {
    const chunk = items.slice(i, i + chunkSize);
    const settled = await Promise.allSettled(
      chunk.map(async (item) => worker(item)),
    );
    results.push(...settled);
  }
  return results;
}
