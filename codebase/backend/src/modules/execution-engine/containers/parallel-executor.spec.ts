import { ParallelExecutor } from './parallel-executor';
import { ExecutionContext } from '../../../nodes/core/node-handler.interface';
import { createEmptyConversationThread } from '../../../shared/conversation-thread/conversation-thread.types';

describe('ParallelExecutor', () => {
  let executor: ParallelExecutor;
  const baseContext: ExecutionContext = {
    executionId: 'exec-1',
    workflowId: 'wf-1',
    variables: {},
    nodeOutputCache: {},
    structuredOutputCache: {},
    engineResolvedConfigCache: {},
    conversationThread: createEmptyConversationThread(),
    recursionDepth: 0,
    itemContext: { item: 'stale', index: 99, isFirst: false, isLast: false },
    loopContext: { index: 99, count: 99, isFirst: false, isLast: false },
  };

  beforeEach(() => {
    executor = new ParallelExecutor();
  });

  it('should run 2 branches concurrently', async () => {
    const calls: number[] = [];
    const result = await executor.execute(
      { branchCount: 2, maxConcurrency: 0, waitAll: true },
      baseContext,
      async (branchIndex) => {
        calls.push(branchIndex);
      },
    );
    expect(calls.sort()).toEqual([0, 1]);
    expect(result.settled.length).toBe(2);
    expect(result.failures.length).toBe(0);
  });

  it('should run 3 branches and clear itemContext/loopContext per branch', async () => {
    const received: Array<{
      branchIndex: number;
      hasItem: boolean;
      hasLoop: boolean;
    }> = [];

    await executor.execute(
      { branchCount: 3, maxConcurrency: 0, waitAll: true },
      baseContext,
      async (branchIndex, branchCtx) => {
        received.push({
          branchIndex,
          hasItem: branchCtx.itemContext !== undefined,
          hasLoop: branchCtx.loopContext !== undefined,
        });
      },
    );

    expect(received.length).toBe(3);
    for (const r of received) {
      expect(r.hasItem).toBe(false);
      expect(r.hasLoop).toBe(false);
    }
    // Original context not mutated
    expect(baseContext.itemContext).toBeDefined();
    expect(baseContext.loopContext).toBeDefined();
  });

  it('should respect maxConcurrency limit', async () => {
    let running = 0;
    let maxRunning = 0;
    const resolve: Array<() => void> = [];
    const barriers: Promise<void>[] = [];
    for (let i = 0; i < 4; i++) {
      barriers.push(
        new Promise<void>((r) => {
          resolve.push(r);
        }),
      );
    }

    const promise = executor.execute(
      { branchCount: 4, maxConcurrency: 2, waitAll: true },
      baseContext,
      async (branchIndex) => {
        running++;
        maxRunning = Math.max(maxRunning, running);
        await barriers[branchIndex];
        running--;
      },
    );

    // Let the first 2 start (microtask flush)
    await new Promise((r) => setTimeout(r, 10));
    expect(running).toBe(2);

    // Release first 2
    resolve[0]();
    resolve[1]();
    await new Promise((r) => setTimeout(r, 10));

    // Release remaining
    resolve[2]();
    resolve[3]();

    const result = await promise;
    expect(maxRunning).toBeLessThanOrEqual(2);
    expect(result.failures.length).toBe(0);
  });

  it('errorPolicy=stop: re-throws first branch failure', async () => {
    await expect(
      executor.execute(
        {
          branchCount: 3,
          maxConcurrency: 0,
          waitAll: true,
          errorPolicy: 'stop',
        },
        baseContext,
        async (branchIndex) => {
          if (branchIndex === 1) throw new Error('branch-1-fail');
        },
      ),
    ).rejects.toThrow('branch-1-fail');
  });

  it('errorPolicy=continue: collects failures without throwing', async () => {
    const result = await executor.execute(
      {
        branchCount: 3,
        maxConcurrency: 0,
        waitAll: true,
        errorPolicy: 'continue',
      },
      baseContext,
      async (branchIndex) => {
        if (branchIndex === 2) throw new Error('branch-2-fail');
      },
    );

    expect(result.failures.length).toBe(1);
    expect(result.failures[0].branchIndex).toBe(2);
    expect(result.failures[0].error.message).toBe('branch-2-fail');
    // Other branches still succeeded
    expect(result.settled.filter((s) => s.status === 'fulfilled').length).toBe(
      2,
    );
  });

  it('should clamp branchCount to 2..16 range', async () => {
    const calls: number[] = [];
    await executor.execute(
      { branchCount: 1, maxConcurrency: 0, waitAll: true },
      baseContext,
      async (i) => {
        calls.push(i);
      },
    );
    expect(calls.length).toBe(2);
  });

  describe('nested Parallel concurrency clamp (parallel-p2 결정 #3 + G, cap=32)', () => {
    it('propagates effectiveConcurrency to branch context via parentParallelConcurrency', async () => {
      const seen: Array<number | undefined> = [];
      await executor.execute(
        { branchCount: 4, maxConcurrency: 0, waitAll: true },
        baseContext,
        async (_idx, branchCtx) => {
          seen.push(branchCtx.parentParallelConcurrency);
        },
      );
      // effectiveConcurrency = maxConcurrency(0) → branchCount(4)
      expect(seen).toEqual([4, 4, 4, 4]);
    });

    it('uses explicit maxConcurrency when set', async () => {
      const seen: Array<number | undefined> = [];
      await executor.execute(
        { branchCount: 4, maxConcurrency: 2, waitAll: true },
        baseContext,
        async (_idx, branchCtx) => {
          seen.push(branchCtx.parentParallelConcurrency);
        },
      );
      expect(seen).toEqual([2, 2, 2, 2]);
    });

    it('inner Parallel clamps effectiveConcurrency when parentParallelConcurrency × internal > 32', async () => {
      // outer parentParallelConcurrency = 8, inner branchCount=8, maxConcurrency=8
      // intended product = 8 × 8 = 64 > 32 → inner effective = floor(32/8) = 4
      const branchCount = 8;
      let observedConcurrencyPeak = 0;
      let currentRunning = 0;
      await executor.execute(
        { branchCount, maxConcurrency: 8, waitAll: true },
        { ...baseContext, parentParallelConcurrency: 8 },
        async () => {
          currentRunning++;
          observedConcurrencyPeak = Math.max(
            observedConcurrencyPeak,
            currentRunning,
          );
          await new Promise((r) => setTimeout(r, 5));
          currentRunning--;
        },
      );
      expect(observedConcurrencyPeak).toBeLessThanOrEqual(4);
      expect(observedConcurrencyPeak).toBeGreaterThan(0);
    });

    it('inner Parallel does NOT clamp when product ≤ 32', async () => {
      // outer parentParallelConcurrency = 4, inner branchCount=8, maxConcurrency=8
      // intended product = 4 × 8 = 32 ≤ 32 → inner effective stays at 8
      const branchCount = 8;
      let observedConcurrencyPeak = 0;
      let currentRunning = 0;
      await executor.execute(
        { branchCount, maxConcurrency: 8, waitAll: true },
        { ...baseContext, parentParallelConcurrency: 4 },
        async () => {
          currentRunning++;
          observedConcurrencyPeak = Math.max(
            observedConcurrencyPeak,
            currentRunning,
          );
          await new Promise((r) => setTimeout(r, 5));
          currentRunning--;
        },
      );
      expect(observedConcurrencyPeak).toBeGreaterThanOrEqual(5);
      expect(observedConcurrencyPeak).toBeLessThanOrEqual(8);
    });

    it('inner Parallel propagates its own (clamped) effectiveConcurrency to its branch context', async () => {
      const seen: Array<number | undefined> = [];
      await executor.execute(
        { branchCount: 8, maxConcurrency: 16, waitAll: true },
        { ...baseContext, parentParallelConcurrency: 8 },
        async (_idx, branchCtx) => {
          seen.push(branchCtx.parentParallelConcurrency);
        },
      );
      // intended inner effective = min(16, 8) = 8 (capped to branchCount semantics)
      // but with parent=8: clamped = floor(32/8) = 4
      // branch context sees the (clamped) effective concurrency
      expect(new Set(seen)).toEqual(new Set([4]));
    });

    it('absent parentParallelConcurrency (outermost Parallel) — no clamp', async () => {
      const seen: Array<number | undefined> = [];
      await executor.execute(
        { branchCount: 16, maxConcurrency: 16, waitAll: true },
        baseContext, // no parentParallelConcurrency
        async (_idx, branchCtx) => {
          seen.push(branchCtx.parentParallelConcurrency);
        },
      );
      // no parent → effective = 16, propagated as-is
      expect(new Set(seen)).toEqual(new Set([16]));
    });
  });

  describe('errorPolicy=cancel-others-on-fail (parallel-p2 §5, 결정 A + H)', () => {
    it('propagates the same AbortSignal to every branch (signal !== upstream)', async () => {
      const signals: Array<AbortSignal | undefined> = [];
      await executor
        .execute(
          {
            branchCount: 3,
            maxConcurrency: 0,
            waitAll: true,
            errorPolicy: 'cancel-others-on-fail',
          },
          baseContext, // no upstream signal
          async (_idx, branchCtx) => {
            signals.push(branchCtx.abortSignal);
          },
        )
        .catch(() => undefined);
      expect(signals).toHaveLength(3);
      // all share the same controller.signal
      expect(signals[0]).toBe(signals[1]);
      expect(signals[1]).toBe(signals[2]);
      expect(signals[0]).toBeDefined();
      // no branch was aborted (none threw)
      expect(signals[0]!.aborted).toBe(false);
    });

    it('first failure aborts the shared signal for the remaining branches', async () => {
      const observed: Array<boolean> = []; // signal.aborted snapshots
      const result = await executor
        .execute(
          {
            branchCount: 3,
            maxConcurrency: 0,
            waitAll: true,
            errorPolicy: 'cancel-others-on-fail',
          },
          baseContext,
          async (i, branchCtx) => {
            if (i === 0) {
              // First branch fails fast → triggers abort on shared controller
              throw new Error('root-cause');
            }
            // Others observe the cancellation by listening for abort
            await new Promise<void>((resolve) => {
              if (branchCtx.abortSignal?.aborted) {
                observed.push(true);
                resolve();
              } else {
                branchCtx.abortSignal?.addEventListener(
                  'abort',
                  () => {
                    observed.push(true);
                    resolve();
                  },
                  { once: true },
                );
              }
            });
          },
        )
        .catch((e: Error) => e);
      // root cause re-thrown
      expect((result as Error).message).toBe('root-cause');
      // both other branches observed the abort
      expect(observed.length).toBe(2);
    });

    it('cascades an already-aborted upstream signal to the branch controller', async () => {
      const upstream = new AbortController();
      upstream.abort();
      const seenAborted: boolean[] = [];
      await executor
        .execute(
          {
            branchCount: 2,
            maxConcurrency: 0,
            waitAll: true,
            errorPolicy: 'cancel-others-on-fail',
          },
          { ...baseContext, abortSignal: upstream.signal },
          async (_i, branchCtx) => {
            seenAborted.push(branchCtx.abortSignal?.aborted ?? false);
          },
        )
        .catch(() => undefined);
      expect(seenAborted.every((b) => b === true)).toBe(true);
    });

    it('errorPolicy=stop / continue do NOT add a fresh abort controller', async () => {
      const signalsStop: Array<AbortSignal | undefined> = [];
      await executor
        .execute(
          {
            branchCount: 2,
            maxConcurrency: 0,
            waitAll: true,
            errorPolicy: 'stop',
          },
          baseContext, // no upstream
          async (_i, branchCtx) => {
            signalsStop.push(branchCtx.abortSignal);
          },
        )
        .catch(() => undefined);
      // No upstream + no cancel-others-on-fail → branch signal is undefined
      expect(signalsStop.every((s) => s === undefined)).toBe(true);
    });

    // SUMMARY#5 — root cause re-throw race condition: abort 완료된 분기가 AbortError 를
    // throw 하더라도 첫 non-AbortError 가 최종 throw 로 선택되어야 함
    it('re-throws the original error (not AbortError) even when abort-completed branch settles first', async () => {
      // branch 0: root cause (real error)
      // branch 1: receives abort signal → throws AbortError (simulates abort-completed branch)
      const abortError = new Error('Operation aborted');
      abortError.name = 'AbortError';

      const result = await executor
        .execute(
          {
            branchCount: 2,
            maxConcurrency: 0,
            waitAll: true,
            errorPolicy: 'cancel-others-on-fail',
          },
          baseContext,
          async (i, branchCtx) => {
            if (i === 0) {
              throw new Error('real-root-cause');
            }
            // Simulate: this branch was already being aborted when allSettled ran
            await new Promise<void>((_, reject) => {
              if (branchCtx.abortSignal?.aborted) {
                reject(abortError);
              } else {
                branchCtx.abortSignal?.addEventListener(
                  'abort',
                  () => reject(abortError),
                  { once: true },
                );
              }
            });
          },
        )
        .catch((e: Error) => e);

      expect((result as Error).message).toBe('real-root-cause');
      expect((result as Error).name).not.toBe('AbortError');
    });
  });
});
