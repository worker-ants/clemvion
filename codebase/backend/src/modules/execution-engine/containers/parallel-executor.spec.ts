import { ParallelExecutor, FREEZE_BRANCH_CACHE } from './parallel-executor';
import {
  ExecutionContext,
  ParallelBranchContext,
} from '../../../nodes/core/node-handler.interface';
import { createEmptyConversationThread } from '../../../shared/conversation-thread/conversation-thread.types';

// SUMMARY#4 (W-1): parentParallelConcurrency 는 required `number | undefined` —
// 최외각 Parallel 테스트에서 `undefined` 를 명시 전달하는 이유:
// W-1 시그니처 강화로 optional → required number|undefined 로 바뀌어
// 타입 체커가 인자 누락을 오류로 잡기 위해 undefined 를 명시해야 한다.
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
      undefined,
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
      undefined,
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

  // refactor 06-concurrency M-5 — dev/test 환경에서 branch 의 공유 nodeOutputCache
  // 값 객체를 freeze 해 "값 내부 mutate 금지" invariant 위반을 즉시 검출.
  describe('M-5 — 공유 cache 값 freeze (dev/test invariant 가드)', () => {
    // ai-review W2 — 본 describe 의 가드는 freeze 가 켜진 환경(test)을 전제한다.
    // Jest 가 NODE_ENV=production 으로 돌면 freeze 가 꺼져 아래 가드가 무의미
    // (false positive)하므로 전제를 명시 단언한다.
    it('전제: 본 테스트 환경에서 FREEZE_BRANCH_CACHE 가 활성이다', () => {
      expect(FREEZE_BRANCH_CACHE).toBe(true);
    });

    it('branch 가 공유 nodeOutputCache 값 객체 내부를 mutate 하면 TypeError 로 검출된다', async () => {
      const ctxWithCache: ExecutionContext = {
        ...baseContext,
        nodeOutputCache: { nodeA: { output: { count: 1 } } },
      };

      // ai-review W3 — `try/catch` 대신 collected mutator 를 `toThrow` 로 단언해
      // non-strict 환경에서 silent-pass(mutationError===null) 가능성을 제거한다.
      let mutator: (() => void) | null = null;
      await executor.execute(
        { branchCount: 1, maxConcurrency: 0, waitAll: true },
        ctxWithCache,
        async (_branchIndex, branchCtx: ParallelBranchContext) => {
          mutator = () => {
            (
              branchCtx.nodeOutputCache.nodeA as { output: { count: number } }
            ).output.count = 999;
          };
        },
        undefined,
      );

      expect(mutator).not.toBeNull();
      // frozen 값 내부 mutate 는 (strict mode 모듈에서) TypeError.
      expect(mutator!).toThrow(TypeError);
      // 원본 공유 값도 변경되지 않아야 한다 (freeze 가 막았으므로).
      expect(
        (ctxWithCache.nodeOutputCache.nodeA as { output: { count: number } })
          .output.count,
      ).toBe(1);
    });

    it('top-level 키 추가는 branch 간 격리되어 정상 동작한다 (freeze 는 값 객체만)', async () => {
      const ctxWithCache: ExecutionContext = {
        ...baseContext,
        nodeOutputCache: { nodeA: { output: { count: 1 } } },
      };

      await executor.execute(
        { branchCount: 1, maxConcurrency: 0, waitAll: true },
        ctxWithCache,
        async (_branchIndex, branchCtx: ParallelBranchContext) => {
          // top-level 키 추가는 shallow copy 덕에 격리 — freeze 대상 아님.
          branchCtx.nodeOutputCache.nodeB = { output: { v: 2 } };
        },
        undefined,
      );

      // 원본에는 nodeB 가 누출되지 않아야 한다.
      expect(ctxWithCache.nodeOutputCache.nodeB).toBeUndefined();
    });
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
      undefined,
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
        undefined,
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
      undefined,
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
      undefined,
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
        undefined,
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
        undefined,
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
        baseContext,
        async () => {
          currentRunning++;
          observedConcurrencyPeak = Math.max(
            observedConcurrencyPeak,
            currentRunning,
          );
          await new Promise((r) => setTimeout(r, 5));
          currentRunning--;
        },
        8,
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
        baseContext,
        async () => {
          currentRunning++;
          observedConcurrencyPeak = Math.max(
            observedConcurrencyPeak,
            currentRunning,
          );
          await new Promise((r) => setTimeout(r, 5));
          currentRunning--;
        },
        4,
      );
      expect(observedConcurrencyPeak).toBeGreaterThanOrEqual(5);
      expect(observedConcurrencyPeak).toBeLessThanOrEqual(8);
    });

    it('inner Parallel propagates its own (clamped) effectiveConcurrency to its branch context', async () => {
      const seen: Array<number | undefined> = [];
      await executor.execute(
        { branchCount: 8, maxConcurrency: 16, waitAll: true },
        baseContext,
        async (_idx, branchCtx) => {
          seen.push(branchCtx.parentParallelConcurrency);
        },
        8,
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
        undefined,
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
          undefined,
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
          undefined,
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
          undefined,
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
          undefined,
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
          undefined,
        )
        .catch((e: Error) => e);

      expect((result as Error).message).toBe('real-root-cause');
      expect((result as Error).name).not.toBe('AbortError');
    });
  });

  // SUMMARY#2 (W-2) 타입 레벨 회귀 테스트 — 컴파일 타임 전용, 런타임 assertion 없음.
  //
  // W-2 결정: `branchParentContext` 에서 명시 `: ExecutionContext` 어노테이션을 제거해
  // TypeScript 추론에 위임. 이유: context 가 ParallelBranchContext 일 때 spread 로
  // 따라오는 `parentParallelConcurrency` ghost field 가 명시 타입으로 은닉되는 버그 방지.
  //
  // 아래 테스트는 세 가지 타입 불변식을 컴파일 시점에 검증한다:
  //   1. ParallelBranchContext spread → 결과에 parentParallelConcurrency 접근 가능
  //   2. 명시 `: ExecutionContext` 어노테이션 적용 시 위 접근이 컴파일 에러 (은닉 증명)
  //   3. ParallelBranchContext 자체에 parentParallelConcurrency 필드 존재
  describe('W-2 type-level regression (compile-time only)', () => {
    it('branchParentContext spread preserves parentParallelConcurrency when inferred', () => {
      const branchCtx: ParallelBranchContext = {
        executionId: 'e',
        workflowId: 'w',
        variables: {},
        nodeOutputCache: {},
        structuredOutputCache: {},
        engineResolvedConfigCache: {},
        conversationThread: createEmptyConversationThread(),
        recursionDepth: 0,
        parentParallelConcurrency: 4,
      };
      const extra = { parentNodeExecutionId: 'pne-1' };

      // 추론에 위임 — 결과 타입이 parentParallelConcurrency 를 포함해야 한다.
      const inferred = { ...branchCtx, ...extra };
      // 접근 가능 여부를 컴파일 타임 검증 (런타임은 항상 통과).
      const _val: number = inferred.parentParallelConcurrency;
      expect(_val).toBe(4);

      // 반대 증명: 명시 `: ExecutionContext` 어노테이션 하에서는 동일 접근이 타입 에러.
      const explicit: ExecutionContext = { ...branchCtx, ...extra };
      // @ts-expect-error — ExecutionContext 에는 parentParallelConcurrency 가 없어
      // 명시 타입으로 은닉됨. 이 라인이 에러를 기대하는 한 W-2 의 "은닉" 문제가
      // 재현 가능하다는 컴파일 타임 증명이다.
      const _hidden: number = explicit.parentParallelConcurrency;
      void _hidden; // suppress unused warning
    });
  });
});
