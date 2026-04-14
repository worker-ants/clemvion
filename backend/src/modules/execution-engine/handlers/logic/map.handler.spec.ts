import { MapHandler } from './map.handler.js';
import { ExecutionContext } from '../node-handler.interface.js';

describe('MapHandler', () => {
  let handler: MapHandler;
  let context: ExecutionContext;

  beforeEach(() => {
    handler = new MapHandler();
    context = {
      executionId: 'exec-1',
      workflowId: 'wf-1',
      variables: {},
      nodeOutputCache: {},
    };
  });

  describe('validate', () => {
    it('should accept a dot-path inputField', () => {
      const result = handler.validate({
        inputField: 'items',
        errorPolicy: 'stop',
      });
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should accept inline resolved array as inputField', () => {
      const result = handler.validate({ inputField: [1, 2, 3] });
      expect(result.valid).toBe(true);
    });

    it('should reject missing inputField', () => {
      const result = handler.validate({ errorPolicy: 'stop' });
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('inputField is required');
    });

    it('should reject empty string inputField', () => {
      const result = handler.validate({ inputField: '' });
      expect(result.valid).toBe(false);
    });

    it('should reject null inputField', () => {
      const result = handler.validate({ inputField: null });
      expect(result.valid).toBe(false);
    });

    it('should reject undefined inputField', () => {
      const result = handler.validate({ inputField: undefined });
      expect(result.valid).toBe(false);
    });

    it('should reject unknown errorPolicy', () => {
      const result = handler.validate({
        inputField: 'items',
        errorPolicy: 'bogus',
      });
      expect(result.valid).toBe(false);
      expect(result.errors).toContain(
        'errorPolicy must be one of: stop, skip, continue',
      );
    });

    it('should accept each valid errorPolicy', () => {
      for (const policy of ['stop', 'skip', 'continue']) {
        const result = handler.validate({
          inputField: 'items',
          errorPolicy: policy,
        });
        expect(result.valid).toBe(true);
      }
    });

    it('should allow errorPolicy to be omitted', () => {
      const result = handler.validate({ inputField: 'items' });
      expect(result.valid).toBe(true);
    });
  });

  describe('execute', () => {
    it('should resolve inputField as path against input', async () => {
      const input = { items: ['a', 'b', 'c'] };
      const result = (await handler.execute(
        input,
        { inputField: 'items' },
        context,
      )) as { output: unknown[] };
      expect(result.output).toEqual(['a', 'b', 'c']);
    });

    it('should resolve nested dot path', async () => {
      const input = { data: { items: [1, 2] } };
      const result = (await handler.execute(
        input,
        { inputField: 'data.items' },
        context,
      )) as { output: unknown[] };
      expect(result.output).toEqual([1, 2]);
    });

    it('should accept inline resolved array value', async () => {
      const result = (await handler.execute(
        null,
        { inputField: [1, 2, 3] },
        context,
      )) as { output: unknown[] };
      expect(result.output).toEqual([1, 2, 3]);
    });

    it('should return empty array when resolved value is not an array', async () => {
      const result = (await handler.execute(
        { items: 'not-array' },
        { inputField: 'items' },
        context,
      )) as { output: unknown[] };
      expect(result.output).toEqual([]);
    });

    it('should return empty array when path does not exist', async () => {
      const result = (await handler.execute(
        { other: [] },
        { inputField: 'items' },
        context,
      )) as { output: unknown[] };
      expect(result.output).toEqual([]);
    });

    it('should handle empty array input', async () => {
      const result = (await handler.execute(
        { items: [] },
        { inputField: 'items' },
        context,
      )) as { output: unknown[] };
      expect(result.output).toEqual([]);
    });

    it('should return empty array when input is null', async () => {
      const result = (await handler.execute(
        null,
        { inputField: 'items' },
        context,
      )) as { output: unknown[] };
      expect(result.output).toEqual([]);
    });

    it('should echo inputField in config', async () => {
      const result = (await handler.execute(
        { items: [1] },
        { inputField: 'items' },
        context,
      )) as { config: { inputField: unknown } };
      expect(result.config.inputField).toBe('items');
    });
  });
});
