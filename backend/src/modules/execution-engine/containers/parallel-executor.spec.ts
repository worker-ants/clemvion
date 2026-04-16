import { ParallelExecutor } from './parallel-executor';
import { ExecutionContext } from '../handlers/node-handler.interface';

describe('ParallelExecutor', () => {
  let executor: ParallelExecutor;
  const baseContext: ExecutionContext = {
    executionId: 'exec-1',
    workflowId: 'wf-1',
    variables: {},
    nodeOutputCache: {},
    structuredOutputCache: {},
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
        { branchCount: 3, maxConcurrency: 0, waitAll: true, errorPolicy: 'stop' },
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
    expect(
      result.settled.filter((s) => s.status === 'fulfilled').length,
    ).toBe(2);
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
});
