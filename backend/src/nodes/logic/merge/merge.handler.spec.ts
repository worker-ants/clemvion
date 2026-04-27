import { MergeHandler } from './merge.handler.js';
import { ExecutionContext } from '../../core/node-handler.interface.js';

describe('MergeHandler', () => {
  let handler: MergeHandler;
  let context: ExecutionContext;

  beforeEach(() => {
    handler = new MergeHandler();
    context = {
      executionId: 'test-exec-1',
      workflowId: 'test-wf-1',
      variables: {},
      nodeOutputCache: {},
    };
  });

  describe('validate', () => {
    it('should return valid for correct config', () => {
      const result = handler.validate({
        strategy: 'wait_all',
        outputFormat: 'array',
      });
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should warn when strategy is missing (schema warningRule)', () => {
      const result = handler.validate({ outputFormat: 'array' });
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('strategy'))).toBe(true);
    });

    it('should warn when both fields are missing (schema warningRule)', () => {
      const result = handler.validate({});
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('strategy'))).toBe(true);
    });

    it('should return invalid for unknown strategy', () => {
      const result = handler.validate({
        strategy: 'unknown',
        outputFormat: 'array',
      });
      expect(result.valid).toBe(false);
      expect(result.errors).toContain(
        'strategy must be one of: wait_all, first, append',
      );
    });

    it('should accept missing outputFormat (defaults to array per schema)', () => {
      const result = handler.validate({ strategy: 'wait_all' });
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should return invalid for unknown outputFormat', () => {
      const result = handler.validate({
        strategy: 'wait_all',
        outputFormat: 'unknown',
      });
      expect(result.valid).toBe(false);
      expect(result.errors).toContain(
        'outputFormat must be one of: array, merge_object, indexed',
      );
    });

    it('should allow timeout = 0 (no timeout)', () => {
      const result = handler.validate({
        strategy: 'wait_all',
        outputFormat: 'array',
        timeout: 0,
      });
      expect(result.valid).toBe(true);
    });

    it('should reject negative timeout', () => {
      const result = handler.validate({
        strategy: 'wait_all',
        outputFormat: 'array',
        timeout: -5,
      });
      expect(result.valid).toBe(false);
      expect(result.errors).toContain(
        'timeout must be a non-negative number (0 = no timeout)',
      );
    });

    it('should collect multiple errors when multiple fields are invalid', () => {
      const result = handler.validate({
        strategy: 'unknown',
        outputFormat: 'unknown',
      });
      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(2);
    });
  });

  describe('execute — default config fallbacks', () => {
    it('applies strategy=wait_all and outputFormat=array when config is empty', async () => {
      const input = { nodeA: 'a', nodeB: 'b' };
      const result = await handler.execute(input, {}, context);
      expect(result).toMatchObject({
        config: { strategy: 'wait_all', outputFormat: 'array' },
        output: ['a', 'b'],
      });
    });

    it('applies only the missing default while keeping provided values', async () => {
      const input = { nodeA: 1, nodeB: 2 };
      const result = await handler.execute(
        input,
        { outputFormat: 'indexed' },
        context,
      );
      expect(result).toMatchObject({
        config: { strategy: 'wait_all', outputFormat: 'indexed' },
        output: { in_0: 1, in_1: 2 },
      });
    });
  });

  describe('execute', () => {
    const baseConfig = { strategy: 'wait_all', outputFormat: 'array' };

    describe('input normalization', () => {
      it('should handle object input keyed by source node IDs', async () => {
        const input = { nodeA: { a: 1 }, nodeB: { b: 2 } };
        const result = await handler.execute(input, baseConfig, context);
        expect(result.output).toMatchObject([{ a: 1 }, { b: 2 }]);
      });

      it('should handle array input as-is', async () => {
        const input = [{ a: 1 }, { b: 2 }];
        const result = await handler.execute(input, baseConfig, context);
        expect(result.output).toMatchObject([{ a: 1 }, { b: 2 }]);
      });

      it('should wrap single value in array', async () => {
        const result = await handler.execute('hello', baseConfig, context);
        expect(result.output).toMatchObject(['hello']);
      });

      it('should sort object keys for deterministic ordering', async () => {
        const input = { z_node: 'last', a_node: 'first' };
        const result = await handler.execute(input, baseConfig, context);
        expect(result.output).toMatchObject(['first', 'last']);
      });
    });

    describe('strategy: wait_all', () => {
      it('should return all inputs', async () => {
        const input = { nodeA: 1, nodeB: 2, nodeC: 3 };
        const config = { strategy: 'wait_all', outputFormat: 'array' };
        const result = await handler.execute(input, config, context);
        expect(result.output).toMatchObject([1, 2, 3]);
      });
    });

    describe('strategy: first', () => {
      it('should return only the first input', async () => {
        const input = { a_node: 'first', b_node: 'second' };
        const config = { strategy: 'first', outputFormat: 'array' };
        const result = await handler.execute(input, config, context);
        expect(result.output).toMatchObject(['first']);
      });
    });

    describe('strategy: append', () => {
      it('should return all inputs same as wait_all', async () => {
        const input = { nodeA: 1, nodeB: 2 };
        const config = { strategy: 'append', outputFormat: 'array' };
        const result = await handler.execute(input, config, context);
        expect(result.output).toMatchObject([1, 2]);
      });
    });

    describe('outputFormat: array', () => {
      it('should return inputs as array', async () => {
        const input = { nodeA: 'a', nodeB: 'b' };
        const config = { strategy: 'wait_all', outputFormat: 'array' };
        const result = await handler.execute(input, config, context);
        expect(result.output).toMatchObject(['a', 'b']);
      });
    });

    describe('outputFormat: merge_object', () => {
      it('should shallow merge object inputs', async () => {
        const input = { nodeA: { a: 1, b: 2 }, nodeB: { b: 3, c: 4 } };
        const config = { strategy: 'wait_all', outputFormat: 'merge_object' };
        const result = await handler.execute(input, config, context);
        expect(result.output).toMatchObject({ a: 1, b: 3, c: 4 });
      });

      it('should skip non-object inputs during merge', async () => {
        const input = { nodeA: { a: 1 }, nodeB: 'not-an-object' };
        const config = { strategy: 'wait_all', outputFormat: 'merge_object' };
        const result = await handler.execute(input, config, context);
        expect(result.output).toMatchObject({ a: 1 });
      });

      it('should block __proto__ key to prevent prototype pollution', async () => {
        const input = {
          nodeA: { safe: 1, __proto__: { polluted: true } },
        };
        const config = { strategy: 'wait_all', outputFormat: 'merge_object' };
        const result = await handler.execute(input, config, context);
        expect(result.output).toMatchObject({ safe: 1 });
        expect(
          (result.output as Record<string, unknown>).__proto__,
        ).toBeUndefined();
        expect(({} as Record<string, unknown>).polluted).toBeUndefined();
      });

      it('should block constructor and prototype keys', async () => {
        const input = {
          nodeA: { constructor: 'bad', prototype: 'bad', valid: 1 },
        };
        const config = { strategy: 'wait_all', outputFormat: 'merge_object' };
        const result = await handler.execute(input, config, context);
        expect(result.output).toMatchObject({ valid: 1 });
      });
    });

    describe('outputFormat: indexed', () => {
      it('should create indexed object with in_N keys', async () => {
        const input = { nodeA: 'first', nodeB: 'second' };
        const config = { strategy: 'wait_all', outputFormat: 'indexed' };
        const result = await handler.execute(input, config, context);
        expect(result.output).toMatchObject({ in_0: 'first', in_1: 'second' });
      });
    });

    describe('edge cases', () => {
      it('should handle null input', async () => {
        const result = await handler.execute(null, baseConfig, context);
        expect(result.output).toMatchObject([null]);
      });

      it('should handle undefined input', async () => {
        const result = await handler.execute(undefined, baseConfig, context);
        expect(result.output).toMatchObject([undefined]);
      });

      it('should handle empty object input', async () => {
        const result = await handler.execute({}, baseConfig, context);
        expect(result.output).toMatchObject([]);
      });

      it('should handle empty array input', async () => {
        const result = await handler.execute([], baseConfig, context);
        expect(result.output).toMatchObject([]);
      });
    });
  });
});
