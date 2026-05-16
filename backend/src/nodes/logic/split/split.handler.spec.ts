import { SplitHandler } from './split.handler';
import { ExecutionContext } from '../../core/node-handler.interface';
import { createEmptyConversationThread } from '../../../shared/conversation-thread/conversation-thread.types';

describe('SplitHandler', () => {
  let handler: SplitHandler;

  beforeEach(() => {
    handler = new SplitHandler();
  });

  const context: ExecutionContext = {
    executionId: 'exec-1',
    workflowId: 'wf-1',
    variables: {},
    nodeOutputCache: {},
    structuredOutputCache: {},
    engineResolvedConfigCache: {},
    conversationThread: createEmptyConversationThread(),
    recursionDepth: 0,
  };

  describe('validate', () => {
    it('fails when fieldPath is missing', () => {
      const result = handler.validate({});
      expect(result.valid).toBe(false);
      // Schema warningRule "Field path must be entered." fires.
      expect(result.errors.some((e) => e.includes('Field path'))).toBe(true);
    });

    it('fails when fieldPath is empty string', () => {
      const result = handler.validate({ fieldPath: '' });
      expect(result.valid).toBe(false);
    });

    it('passes with a string path', () => {
      const result = handler.validate({ fieldPath: 'items' });
      expect(result.valid).toBe(true);
    });

    it('passes when fieldPath is already a resolved array (inline expression)', () => {
      // {{ $var.a }} resolves to the array itself before reaching the handler.
      const result = handler.validate({ fieldPath: [1, 2, 3] });
      expect(result.valid).toBe(true);
    });
  });

  describe('execute', () => {
    it('uses an already-resolved array directly (inline expression)', async () => {
      // Mirrors the runtime behaviour after the expression resolver has
      // replaced `{{ $var.a }}` with the underlying array value.
      const result = await handler.execute(
        {},
        { fieldPath: [{ id: 1 }, { id: 2 }] },
        context,
      );
      expect(result).toEqual({
        config: { fieldPath: [{ id: 1 }, { id: 2 }] },
        output: {
          items: [
            { index: 0, value: { id: 1 } },
            { index: 1, value: { id: 2 } },
          ],
          count: 2,
        },
        meta: { itemCount: 2, fellBackToEmpty: false },
      });
    });

    it('returns an empty items collection when the target value is not an array', async () => {
      const result = await handler.execute(
        { id: 1, items: 'not-an-array' },
        { fieldPath: 'items' },
        context,
      );
      expect(result).toEqual({
        config: { fieldPath: 'items' },
        output: { items: [], count: 0 },
        meta: { itemCount: 0, fellBackToEmpty: true },
      });
    });

    it('returns an empty items collection when the target value is null/undefined (Principle 10)', async () => {
      const result = await handler.execute(
        { items: null },
        { fieldPath: 'items' },
        context,
      );
      expect(result).toEqual({
        config: { fieldPath: 'items' },
        output: { items: [], count: 0 },
        meta: { itemCount: 0, fellBackToEmpty: true },
      });
    });

    it('wraps each object item under { index, value }', async () => {
      const result = await handler.execute(
        {
          id: 1,
          items: [{ name: 'a' }, { name: 'b' }],
        },
        { fieldPath: 'items' },
        context,
      );
      expect(result).toEqual({
        config: { fieldPath: 'items' },
        output: {
          items: [
            { index: 0, value: { name: 'a' } },
            { index: 1, value: { name: 'b' } },
          ],
          count: 2,
        },
        meta: { itemCount: 2, fellBackToEmpty: false },
      });
    });

    it('wraps scalar items under { index, value }', async () => {
      const result = await handler.execute(
        { items: ['a', 'b', 'c'] },
        { fieldPath: 'items' },
        context,
      );
      expect(result).toEqual({
        config: { fieldPath: 'items' },
        output: {
          items: [
            { index: 0, value: 'a' },
            { index: 1, value: 'b' },
            { index: 2, value: 'c' },
          ],
          count: 3,
        },
        meta: { itemCount: 3, fellBackToEmpty: false },
      });
    });

    it('supports nested fieldPath', async () => {
      const result = await handler.execute(
        { order: { items: [{ sku: 'X1' }, { sku: 'X2' }] } },
        { fieldPath: 'order.items' },
        context,
      );
      expect(result).toEqual({
        config: { fieldPath: 'order.items' },
        output: {
          items: [
            { index: 0, value: { sku: 'X1' } },
            { index: 1, value: { sku: 'X2' } },
          ],
          count: 2,
        },
        meta: { itemCount: 2, fellBackToEmpty: false },
      });
    });

    it('returns empty output for an empty array', async () => {
      // Empty array is a real array — fellBackToEmpty must remain false.
      const result = await handler.execute(
        { items: [] },
        { fieldPath: 'items' },
        context,
      );
      expect(result).toEqual({
        config: { fieldPath: 'items' },
        output: { items: [], count: 0 },
        meta: { itemCount: 0, fellBackToEmpty: false },
      });
    });
  });

  // ENG-RC-* — Phase 3 raw-echo migration.
  describe('config echoes rawConfig templates over evaluated config', () => {
    it('preserves `{{ ... }}` fieldPath template', async () => {
      const result = (await handler.execute(
        { items: ['a', 'b'] },
        { fieldPath: 'items' },
        {
          ...context,
          rawConfig: Object.freeze({ fieldPath: '{{ $input.items }}' }),
        },
      )) as unknown as {
        config: { fieldPath: unknown };
        output: { items: unknown[]; count: number };
        meta: { itemCount: number; fellBackToEmpty: boolean };
      };

      expect(result.config.fieldPath).toBe('{{ $input.items }}');
      expect(result.output).toEqual({
        items: [
          { index: 0, value: 'a' },
          { index: 1, value: 'b' },
        ],
        count: 2,
      });
      expect(result.meta).toEqual({ itemCount: 2, fellBackToEmpty: false });
    });
  });

  // CONVENTIONS Principle 2 — meta exposes execution metrics.
  describe('meta metrics (Principle 2)', () => {
    it('emits itemCount = output.count and fellBackToEmpty = false on normal arrays', async () => {
      const result = await handler.execute(
        { items: [1, 2, 3, 4] },
        { fieldPath: 'items' },
        context,
      );
      expect(result.meta).toEqual({ itemCount: 4, fellBackToEmpty: false });
      const output = result.output as { count: number };
      expect((result.meta as { itemCount: number }).itemCount).toBe(
        output.count,
      );
    });

    it('emits fellBackToEmpty = true when the target is undefined (Principle 10 fallback)', async () => {
      const result = await handler.execute(
        {},
        { fieldPath: 'missing' },
        context,
      );
      expect(result.meta).toEqual({ itemCount: 0, fellBackToEmpty: true });
    });

    it('emits fellBackToEmpty = false for an empty (but real) array — distinguishes empty-input vs fallback', async () => {
      const result = await handler.execute(
        { items: [] },
        { fieldPath: 'items' },
        context,
      );
      expect(result.meta).toEqual({ itemCount: 0, fellBackToEmpty: false });
    });
  });
});
