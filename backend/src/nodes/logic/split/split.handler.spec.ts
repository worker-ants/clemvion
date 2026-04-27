import { SplitHandler } from './split.handler';
import { ExecutionContext } from '../../core/node-handler.interface';

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
  };

  describe('validate', () => {
    it('fails when fieldPath is missing', () => {
      const result = handler.validate({});
      expect(result.valid).toBe(false);
      // Schema warningRule "Field path 를 입력해야 합니다." fires.
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
        output: [
          { index: 0, value: { id: 1 } },
          { index: 1, value: { id: 2 } },
        ],
      });
    });

    it('returns an empty array when the target value is not an array', async () => {
      const result = await handler.execute(
        { id: 1, items: 'not-an-array' },
        { fieldPath: 'items' },
        context,
      );
      expect(result).toEqual({
        config: { fieldPath: 'items' },
        output: [],
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
        output: [
          { index: 0, value: { name: 'a' } },
          { index: 1, value: { name: 'b' } },
        ],
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
        output: [
          { index: 0, value: 'a' },
          { index: 1, value: 'b' },
          { index: 2, value: 'c' },
        ],
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
        output: [
          { index: 0, value: { sku: 'X1' } },
          { index: 1, value: { sku: 'X2' } },
        ],
      });
    });

    it('returns empty output for an empty array', async () => {
      const result = await handler.execute(
        { items: [] },
        { fieldPath: 'items' },
        context,
      );
      expect(result).toEqual({
        config: { fieldPath: 'items' },
        output: [],
      });
    });
  });
});
