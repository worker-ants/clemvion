import { VariableModificationHandler } from './variable-modification.handler.js';
import { ExecutionContext } from '../node-handler.interface.js';

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
      expect(result.errors).toContain('modifications must be an array');
    });

    it('should reject non-array modifications', () => {
      const result = handler.validate({ modifications: 'nope' });
      expect(result.valid).toBe(false);
    });

    it('should reject empty modifications array', () => {
      const result = handler.validate({ modifications: [] });
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('modifications must not be empty');
    });

    it('should reject modification with missing variable', () => {
      const result = handler.validate({
        modifications: [{ operation: 'set', value: 1 }],
      });
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('variable');
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
      )) as { output: unknown };
      expect(result.output).toEqual({ hello: 'world' });
    });

    it('should echo modifications in config', async () => {
      const modifications = [{ variable: 'x', operation: 'set', value: 1 }];
      const result = (await handler.execute(
        null,
        { modifications },
        context,
      )) as { config: { modifications: unknown } };
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
});
