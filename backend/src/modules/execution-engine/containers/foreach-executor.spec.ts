import { ForEachExecutor } from './foreach-executor';
import { ExecutionContext } from '../../../nodes/core/node-handler.interface';
import { createEmptyConversationThread } from '../../../shared/conversation-thread/conversation-thread.types';

describe('ForEachExecutor', () => {
  let executor: ForEachExecutor;
  let context: ExecutionContext;

  beforeEach(() => {
    executor = new ForEachExecutor();
    context = {
      executionId: 'exec-1',
      workflowId: 'wf-1',
      variables: {},
      nodeOutputCache: {},
      structuredOutputCache: {},
      engineResolvedConfigCache: {},
      conversationThread: createEmptyConversationThread(),
      recursionDepth: 0,
    };
  });

  it('returns success items with empty skipped[] on the happy path', async () => {
    const result = await executor.execute(
      { array: [1, 2, 3], errorPolicy: 'stop', collectResults: true },
      context,
      async (item) => ({ value: (item as number) * 10 }),
    );
    expect(result.items).toEqual([{ value: 10 }, { value: 20 }, { value: 30 }]);
    expect(result.skipped).toEqual([]);
    expect(result.skippedCount).toBe(0);
  });

  it('throws on the first error when errorPolicy = stop', async () => {
    await expect(
      executor.execute(
        { array: [1, 2, 3], errorPolicy: 'stop', collectResults: true },
        context,
        async (item) => {
          if (item === 2) throw new Error('boom');
          return item;
        },
      ),
    ).rejects.toThrow('boom');
  });

  // Phase 1 (D — spec/4-nodes/1-logic/9-foreach.md §5.3): skip / continue
  // separate failed iterations into `skipped[]` and leave `null` in
  // `items[index]` to preserve index alignment with the input array.
  describe.each(['skip', 'continue'] as const)('errorPolicy = %s', (policy) => {
    it(`leaves null placeholder in items[index] and records skipped[] (${policy})`, async () => {
      const result = await executor.execute(
        { array: [1, 2, 3, 4], errorPolicy: policy, collectResults: true },
        context,
        async (item) => {
          if (item === 2 || item === 4) throw new Error(`bad-${String(item)}`);
          return { ok: item };
        },
      );
      expect(result.items).toEqual([{ ok: 1 }, null, { ok: 3 }, null]);
      expect(result.skipped).toEqual([
        { index: 1, error: { code: 'Error', message: 'bad-2' } },
        { index: 3, error: { code: 'Error', message: 'bad-4' } },
      ]);
      expect(result.skippedCount).toBe(2);
    });

    it(`captures non-Error throwables with UNKNOWN_ERROR code (${policy})`, async () => {
      const result = await executor.execute(
        { array: [1, 2], errorPolicy: policy, collectResults: true },
        context,
        async (item) => {
          if (item === 1) {
            // eslint-disable-next-line @typescript-eslint/only-throw-error -- intentionally exercises the non-Error branch (executor coerces to UNKNOWN_ERROR)
            throw 'plain-string';
          }
          return { ok: item };
        },
      );
      expect(result.items).toEqual([null, { ok: 2 }]);
      expect(result.skipped).toEqual([
        {
          index: 0,
          error: { code: 'UNKNOWN_ERROR', message: 'plain-string' },
        },
      ]);
      expect(result.skippedCount).toBe(1);
    });

    it(`returns empty struct for empty input array (${policy})`, async () => {
      const result = await executor.execute(
        { array: [], errorPolicy: policy, collectResults: true },
        context,
        async () => ({ never: true }),
      );
      expect(result.items).toEqual([]);
      expect(result.skipped).toEqual([]);
      expect(result.skippedCount).toBe(0);
    });
  });

  it('omits items / skipped accumulation when collectResults = false', async () => {
    const seen: unknown[] = [];
    const result = await executor.execute(
      { array: [1, 2, 3], errorPolicy: 'skip', collectResults: false },
      context,
      async (item) => {
        seen.push(item);
        if (item === 2) throw new Error('boom');
        return item;
      },
    );
    expect(seen).toEqual([1, 2, 3]);
    // collectResults: false suppresses both success and skip recording so the
    // executor stays a pure side-effect driver (e.g. fire-and-forget loops).
    expect(result.items).toEqual([]);
    expect(result.skipped).toEqual([]);
    expect(result.skippedCount).toBe(0);
  });

  it('binds itemContext (item / index / isFirst / isLast) per iteration', async () => {
    const observed: Array<{
      item: unknown;
      index: number;
      isFirst: boolean;
      isLast: boolean;
    }> = [];
    await executor.execute(
      { array: ['a', 'b', 'c'], errorPolicy: 'stop', collectResults: true },
      context,
      async (_item, ctx) => {
        observed.push({ ...(ctx.itemContext as (typeof observed)[number]) });
        return null;
      },
    );
    expect(observed).toEqual([
      { item: 'a', index: 0, isFirst: true, isLast: false },
      { item: 'b', index: 1, isFirst: false, isLast: false },
      { item: 'c', index: 2, isFirst: false, isLast: true },
    ]);
  });

  it('restores prior itemContext after execution (nested-container safe)', async () => {
    const outer = { item: 'outer', index: 99, isFirst: true, isLast: true };
    context.itemContext = outer;
    await executor.execute(
      { array: [1], errorPolicy: 'stop', collectResults: true },
      context,
      async () => null,
    );
    expect(context.itemContext).toEqual(outer);
  });

  it('restores prior itemContext even when errorPolicy = stop throws', async () => {
    const outer = { item: 'outer', index: 99, isFirst: true, isLast: true };
    context.itemContext = outer;
    await expect(
      executor.execute(
        { array: [1, 2], errorPolicy: 'stop', collectResults: true },
        context,
        async () => {
          throw new Error('boom');
        },
      ),
    ).rejects.toThrow('boom');
    expect(context.itemContext).toEqual(outer);
  });
});
