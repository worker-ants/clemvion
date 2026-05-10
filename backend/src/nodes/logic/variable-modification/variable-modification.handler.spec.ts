import { VariableModificationHandler } from './variable-modification.handler.js';
import { ExecutionContext } from '../../core/node-handler.interface.js';

describe('VariableModificationHandler', () => {
  let handler: VariableModificationHandler;
  let context: ExecutionContext;

  beforeEach(() => {
    handler = new VariableModificationHandler();
    context = {
      executionId: 'exec-1',
      workflowId: 'wf-1',
      variables: {},
      nodeOutputCache: {},
      structuredOutputCache: {},
      engineResolvedConfigCache: {},
      recursionDepth: 0,
    };
  });

  describe('validate', () => {
    it('should accept valid modifications', () => {
      const result = handler.validate({
        modifications: [{ variable: 'x', operation: 'set', value: 1 }],
      });
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should accept all valid operations', () => {
      const ops = ['set', 'increment', 'decrement', 'append', 'push', 'pop'];
      for (const op of ops) {
        const result = handler.validate({
          modifications: [{ variable: 'x', operation: op, value: 1 }],
        });
        expect(result.valid).toBe(true);
      }
    });

    it('should reject missing modifications', () => {
      const result = handler.validate({});
      expect(result.valid).toBe(false);
      // Schema warningRule "최소 1개 이상의 변경을 추가해야 합니다." fires.
      expect(result.errors.some((e) => e.includes('변경'))).toBe(true);
    });

    it('should reject non-array modifications', () => {
      const result = handler.validate({ modifications: 'nope' });
      expect(result.valid).toBe(false);
    });

    it('should reject empty modifications array', () => {
      const result = handler.validate({ modifications: [] });
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('변경'))).toBe(true);
    });

    it('should reject modification with missing variable', () => {
      const result = handler.validate({
        modifications: [{ operation: 'set', value: 1 }],
      });
      expect(result.valid).toBe(false);
      // Per-item error message contains "variable" word.
      expect(result.errors.some((e) => e.includes('variable'))).toBe(true);
    });

    it('should reject modification with non-string variable', () => {
      const result = handler.validate({
        modifications: [{ variable: 42, operation: 'set', value: 1 }],
      });
      expect(result.valid).toBe(false);
    });

    it('should reject modification with unknown operation', () => {
      const result = handler.validate({
        modifications: [{ variable: 'x', operation: 'bogus', value: 1 }],
      });
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('operation');
    });

    it('should reject modification with missing operation', () => {
      const result = handler.validate({
        modifications: [{ variable: 'x', value: 1 }],
      });
      expect(result.valid).toBe(false);
    });

    it('should report index in error for invalid entries', () => {
      const result = handler.validate({
        modifications: [
          { variable: 'x', operation: 'set', value: 1 },
          { variable: 'y', operation: 'invalid', value: 2 },
        ],
      });
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('[1]');
    });
  });

  describe('execute', () => {
    it('should pass input through untouched', async () => {
      const input = { hello: 'world' };
      const result = (await handler.execute(
        input,
        {
          modifications: [{ variable: 'x', operation: 'set', value: 1 }],
        },
        context,
      )) as unknown as { output: unknown };
      expect(result.output).toEqual({ hello: 'world' });
    });

    it('should echo modifications in config', async () => {
      const modifications = [{ variable: 'x', operation: 'set', value: 1 }];
      const result = (await handler.execute(
        null,
        { modifications },
        context,
      )) as unknown as { config: { modifications: unknown } };
      expect(result.config.modifications).toEqual(modifications);
    });

    describe('operation: set', () => {
      it('should set a new variable', async () => {
        await handler.execute(
          null,
          {
            modifications: [{ variable: 'x', operation: 'set', value: 42 }],
          },
          context,
        );
        expect(context.variables.x).toBe(42);
      });

      it('should overwrite an existing variable', async () => {
        context.variables.x = 'old';
        await handler.execute(
          null,
          {
            modifications: [{ variable: 'x', operation: 'set', value: 'new' }],
          },
          context,
        );
        expect(context.variables.x).toBe('new');
      });

      it('should allow setting null and undefined', async () => {
        context.variables.a = 1;
        context.variables.b = 2;
        await handler.execute(
          null,
          {
            modifications: [
              { variable: 'a', operation: 'set', value: null },
              { variable: 'b', operation: 'set', value: undefined },
            ],
          },
          context,
        );
        expect(context.variables.a).toBeNull();
        expect(context.variables.b).toBeUndefined();
      });
    });

    describe('operation: increment', () => {
      it('should increment an existing number by value', async () => {
        context.variables.count = 5;
        await handler.execute(
          null,
          {
            modifications: [
              { variable: 'count', operation: 'increment', value: 3 },
            ],
          },
          context,
        );
        expect(context.variables.count).toBe(8);
      });

      it('should default to +1 when value is omitted', async () => {
        context.variables.count = 5;
        await handler.execute(
          null,
          {
            modifications: [{ variable: 'count', operation: 'increment' }],
          },
          context,
        );
        expect(context.variables.count).toBe(6);
      });

      it('should treat non-number current as 0', async () => {
        context.variables.count = 'not-a-number';
        await handler.execute(
          null,
          {
            modifications: [
              { variable: 'count', operation: 'increment', value: 2 },
            ],
          },
          context,
        );
        expect(context.variables.count).toBe(2);
      });

      it('should create variable when missing', async () => {
        await handler.execute(
          null,
          {
            modifications: [
              { variable: 'new', operation: 'increment', value: 5 },
            ],
          },
          context,
        );
        expect(context.variables.new).toBe(5);
      });
    });

    describe('operation: decrement', () => {
      it('should decrement an existing number by value', async () => {
        context.variables.count = 10;
        await handler.execute(
          null,
          {
            modifications: [
              { variable: 'count', operation: 'decrement', value: 3 },
            ],
          },
          context,
        );
        expect(context.variables.count).toBe(7);
      });

      it('should default to -1 when value is omitted', async () => {
        context.variables.count = 5;
        await handler.execute(
          null,
          {
            modifications: [{ variable: 'count', operation: 'decrement' }],
          },
          context,
        );
        expect(context.variables.count).toBe(4);
      });
    });

    describe('operation: append', () => {
      it('should append to an existing string', async () => {
        context.variables.msg = 'hello';
        await handler.execute(
          null,
          {
            modifications: [
              { variable: 'msg', operation: 'append', value: ' world' },
            ],
          },
          context,
        );
        expect(context.variables.msg).toBe('hello world');
      });

      it('should treat non-string current as empty string', async () => {
        context.variables.msg = 42;
        await handler.execute(
          null,
          {
            modifications: [
              { variable: 'msg', operation: 'append', value: 'x' },
            ],
          },
          context,
        );
        expect(context.variables.msg).toBe('x');
      });

      it('should coerce appended value to string', async () => {
        context.variables.msg = 'num=';
        await handler.execute(
          null,
          {
            modifications: [
              { variable: 'msg', operation: 'append', value: 42 },
            ],
          },
          context,
        );
        expect(context.variables.msg).toBe('num=42');
      });
    });

    describe('operation: push', () => {
      it('should push to an existing array (mutating)', async () => {
        context.variables.list = [1, 2];
        await handler.execute(
          null,
          {
            modifications: [{ variable: 'list', operation: 'push', value: 3 }],
          },
          context,
        );
        expect(context.variables.list).toEqual([1, 2, 3]);
      });

      it('should create a new array when variable missing', async () => {
        await handler.execute(
          null,
          {
            modifications: [
              { variable: 'list', operation: 'push', value: 'a' },
            ],
          },
          context,
        );
        expect(context.variables.list).toEqual(['a']);
      });

      it('should replace non-array current with a new array', async () => {
        context.variables.list = 'not-array';
        await handler.execute(
          null,
          {
            modifications: [{ variable: 'list', operation: 'push', value: 1 }],
          },
          context,
        );
        expect(context.variables.list).toEqual([1]);
      });
    });

    describe('operation: pop', () => {
      it('should pop from an existing array', async () => {
        context.variables.list = [1, 2, 3];
        await handler.execute(
          null,
          {
            modifications: [{ variable: 'list', operation: 'pop' }],
          },
          context,
        );
        expect(context.variables.list).toEqual([1, 2]);
      });

      it('should leave non-array untouched', async () => {
        context.variables.list = 'not-array';
        await handler.execute(
          null,
          {
            modifications: [{ variable: 'list', operation: 'pop' }],
          },
          context,
        );
        expect(context.variables.list).toBe('not-array');
      });

      it('should leave missing variable as undefined', async () => {
        await handler.execute(
          null,
          {
            modifications: [{ variable: 'missing', operation: 'pop' }],
          },
          context,
        );
        expect(context.variables.missing).toBeUndefined();
      });
    });

    describe('multiple modifications', () => {
      it('should apply modifications in order', async () => {
        await handler.execute(
          null,
          {
            modifications: [
              { variable: 'n', operation: 'set', value: 0 },
              { variable: 'n', operation: 'increment', value: 5 },
              { variable: 'n', operation: 'decrement', value: 2 },
            ],
          },
          context,
        );
        expect(context.variables.n).toBe(3);
      });
    });
  });

  // ENG-RC-* — Phase 3 raw-echo migration.
  describe('config echoes rawConfig modification.value templates', () => {
    it('preserves `{{ ... }}` value templates while applying evaluated values', async () => {
      context.variables.counter = 0;
      const rawMods = [
        { variable: 'counter', operation: 'increment', value: '{{ $delta }}' },
      ];
      const evaluatedMods = [
        { variable: 'counter', operation: 'increment', value: 5 },
      ];
      const result = (await handler.execute(
        {},
        { modifications: evaluatedMods },
        {
          ...context,
          rawConfig: Object.freeze({ modifications: rawMods }),
        },
      )) as unknown as { config: { modifications: unknown } };

      expect(result.config.modifications).toEqual(rawMods);
      expect(context.variables.counter).toBe(5);
    });
  });

  // Phase 2 (C) — meta metrics for debugging / audit.
  describe('meta metrics', () => {
    it('records each modification as applied with variable + operation', async () => {
      context.variables.count = 5;
      const result = (await handler.execute(
        null,
        {
          modifications: [
            { variable: 'count', operation: 'increment', value: 1 },
            { variable: 'msg', operation: 'set', value: 'hi' },
          ],
        },
        context,
      )) as unknown as { meta: { modifications: unknown } };
      expect(result.meta.modifications).toEqual([
        { variable: 'count', operation: 'increment', applied: true },
        { variable: 'msg', operation: 'set', applied: true },
      ]);
    });

    it('reports createdVariables for set on missing variable', async () => {
      const result = (await handler.execute(
        null,
        {
          modifications: [{ variable: 'fresh', operation: 'set', value: 1 }],
        },
        context,
      )) as unknown as { meta: { createdVariables: string[] } };
      expect(result.meta.createdVariables).toEqual(['fresh']);
    });

    it('does not list createdVariables when the variable already exists', async () => {
      context.variables.existing = 'old';
      const result = (await handler.execute(
        null,
        {
          modifications: [
            { variable: 'existing', operation: 'set', value: 'new' },
          ],
        },
        context,
      )) as unknown as { meta: { createdVariables: string[] } };
      expect(result.meta.createdVariables).toEqual([]);
    });

    it('reports createdVariables for increment / append / push on missing variable', async () => {
      const result = (await handler.execute(
        null,
        {
          modifications: [
            { variable: 'a', operation: 'increment', value: 1 },
            { variable: 'b', operation: 'append', value: 'x' },
            { variable: 'c', operation: 'push', value: 1 },
          ],
        },
        context,
      )) as unknown as { meta: { createdVariables: string[] } };
      expect(result.meta.createdVariables).toEqual(['a', 'b', 'c']);
    });

    it('records coercionWarnings on type-mismatch fallback (increment on string)', async () => {
      context.variables.count = 'not-a-number';
      const result = (await handler.execute(
        null,
        {
          modifications: [
            { variable: 'count', operation: 'increment', value: 2 },
          ],
        },
        context,
      )) as unknown as { meta: { coercionWarnings: unknown[] } };
      expect(result.meta.coercionWarnings).toEqual([
        { variable: 'count', operation: 'increment', fromType: 'string' },
      ]);
    });

    it('records coercionWarnings on append over non-string', async () => {
      context.variables.msg = 42;
      const result = (await handler.execute(
        null,
        {
          modifications: [{ variable: 'msg', operation: 'append', value: 'x' }],
        },
        context,
      )) as unknown as { meta: { coercionWarnings: unknown[] } };
      expect(result.meta.coercionWarnings).toEqual([
        { variable: 'msg', operation: 'append', fromType: 'number' },
      ]);
    });

    it('records coercionWarnings on push over non-array', async () => {
      context.variables.list = 'not-array';
      const result = (await handler.execute(
        null,
        {
          modifications: [{ variable: 'list', operation: 'push', value: 1 }],
        },
        context,
      )) as unknown as { meta: { coercionWarnings: unknown[] } };
      expect(result.meta.coercionWarnings).toEqual([
        { variable: 'list', operation: 'push', fromType: 'string' },
      ]);
    });

    it('records coercionWarnings on pop over non-array (and marks not coerced as no-op)', async () => {
      context.variables.list = 'not-array';
      const result = (await handler.execute(
        null,
        {
          modifications: [{ variable: 'list', operation: 'pop' }],
        },
        context,
      )) as unknown as {
        meta: {
          coercionWarnings: unknown[];
          modifications: Array<{ applied: boolean }>;
        };
      };
      expect(result.meta.coercionWarnings).toEqual([
        { variable: 'list', operation: 'pop', fromType: 'string' },
      ]);
      // pop on non-array is a no-op — applied=false (CONVENTIONS Principle 2).
      expect(result.meta.modifications[0].applied).toBe(false);
    });

    it('does NOT emit a coercionWarning when the variable is missing (initial create)', async () => {
      const result = (await handler.execute(
        null,
        {
          modifications: [
            { variable: 'count', operation: 'increment', value: 5 },
          ],
        },
        context,
      )) as unknown as { meta: { coercionWarnings: unknown[] } };
      expect(result.meta.coercionWarnings).toEqual([]);
    });

    it('returns empty meta arrays when nothing notable occurs', async () => {
      context.variables.n = 1;
      const result = (await handler.execute(
        null,
        {
          modifications: [{ variable: 'n', operation: 'increment', value: 1 }],
        },
        context,
      )) as unknown as {
        meta: {
          modifications: unknown[];
          coercionWarnings: unknown[];
          createdVariables: string[];
        };
      };
      expect(result.meta.coercionWarnings).toEqual([]);
      expect(result.meta.createdVariables).toEqual([]);
      expect(result.meta.modifications).toEqual([
        { variable: 'n', operation: 'increment', applied: true },
      ]);
    });
  });
});
