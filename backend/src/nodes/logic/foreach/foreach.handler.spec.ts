import { ForEachHandler } from './foreach.handler.js';
import { ExecutionContext } from '../../core/node-handler.interface.js';

describe('ForEachHandler', () => {
  let handler: ForEachHandler;
  let context: ExecutionContext;

  beforeEach(() => {
    handler = new ForEachHandler();
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
    it('should accept a dot-path arrayField string', () => {
      const result = handler.validate({
        arrayField: 'items',
        errorPolicy: 'stop',
        collectResults: false,
      });
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should accept inline resolved array as arrayField', () => {
      const result = handler.validate({
        arrayField: [1, 2, 3],
        errorPolicy: 'skip',
      });
      expect(result.valid).toBe(true);
    });

    it('should reject missing arrayField', () => {
      const result = handler.validate({ errorPolicy: 'stop' });
      expect(result.valid).toBe(false);
      // Schema warningRule "배열 필드를 입력해야 합니다." fires.
      expect(result.errors.some((e) => e.includes('배열'))).toBe(true);
    });

    it('should reject empty string arrayField', () => {
      const result = handler.validate({ arrayField: '' });
      expect(result.valid).toBe(false);
    });

    it('should reject null arrayField', () => {
      const result = handler.validate({ arrayField: null });
      expect(result.valid).toBe(false);
    });

    it('should reject unknown errorPolicy', () => {
      const result = handler.validate({
        arrayField: 'items',
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
          arrayField: 'items',
          errorPolicy: policy,
        });
        expect(result.valid).toBe(true);
      }
    });

    it('should allow errorPolicy to be omitted', () => {
      const result = handler.validate({ arrayField: 'items' });
      expect(result.valid).toBe(true);
    });
  });

  describe('execute', () => {
    it('should resolve arrayField as path against input', async () => {
      const input = { items: [1, 2, 3] };
      const result = (await handler.execute(
        input,
        { arrayField: 'items' },
        context,
      )) as unknown as { output: unknown[] };
      expect(result.output).toEqual([1, 2, 3]);
    });

    it('should resolve nested dot path', async () => {
      const input = { data: { list: ['a', 'b'] } };
      const result = (await handler.execute(
        input,
        { arrayField: 'data.list' },
        context,
      )) as unknown as { output: unknown[] };
      expect(result.output).toEqual(['a', 'b']);
    });

    it('should accept inline resolved array value', async () => {
      const result = (await handler.execute(
        null,
        { arrayField: [10, 20, 30] },
        context,
      )) as unknown as { output: unknown[] };
      expect(result.output).toEqual([10, 20, 30]);
    });

    it('should return empty array when resolved value is not an array', async () => {
      const result = (await handler.execute(
        { items: 'not-array' },
        { arrayField: 'items' },
        context,
      )) as unknown as { output: unknown[] };
      expect(result.output).toEqual([]);
    });

    it('should return empty array when path does not exist', async () => {
      const result = (await handler.execute(
        { other: [] },
        { arrayField: 'items' },
        context,
      )) as unknown as { output: unknown[] };
      expect(result.output).toEqual([]);
    });

    it('should handle empty array input', async () => {
      const result = (await handler.execute(
        { items: [] },
        { arrayField: 'items' },
        context,
      )) as unknown as { output: unknown[] };
      expect(result.output).toEqual([]);
    });

    it('should return empty array when input is null', async () => {
      const result = (await handler.execute(
        null,
        { arrayField: 'items' },
        context,
      )) as unknown as { output: unknown[] };
      expect(result.output).toEqual([]);
    });

    it('should echo arrayField in config', async () => {
      const result = (await handler.execute(
        { items: [1] },
        { arrayField: 'items' },
        context,
      )) as unknown as { config: { arrayField: unknown } };
      expect(result.config.arrayField).toBe('items');
    });

    // ENG-RC-* — Phase 3 raw-echo migration.
    it('preserves `{{ ... }}` arrayField template on config', async () => {
      const result = (await handler.execute(
        { items: [1, 2] },
        { arrayField: 'items' },
        {
          ...context,
          rawConfig: Object.freeze({ arrayField: '{{ $input.items }}' }),
        },
      )) as unknown as { config: { arrayField: unknown }; output: unknown };
      expect(result.config.arrayField).toBe('{{ $input.items }}');
      expect(result.output).toEqual([1, 2]);
    });
  });
});
