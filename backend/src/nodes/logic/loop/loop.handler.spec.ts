import { LoopHandler } from './loop.handler';
import { ExecutionContext } from '../../core/node-handler.interface';

describe('LoopHandler', () => {
  let handler: LoopHandler;

  beforeEach(() => {
    handler = new LoopHandler();
  });

  const context: ExecutionContext = {
    executionId: 'exec-1',
    workflowId: 'wf-1',
    variables: {},
    nodeOutputCache: {},
  };

  describe('validate', () => {
    it('accepts numeric count', () => {
      expect(handler.validate({ count: 10 })).toEqual({
        valid: true,
        errors: [],
      });
    });

    it('accepts numeric string count (UI form input)', () => {
      expect(handler.validate({ count: '10' })).toEqual({
        valid: true,
        errors: [],
      });
    });

    it('accepts unresolved expression as count', () => {
      expect(handler.validate({ count: '{{ $input.count }}' })).toEqual({
        valid: true,
        errors: [],
      });
    });

    it('rejects missing count', () => {
      const result = handler.validate({});
      expect(result.valid).toBe(false);
      // Schema warningRule "Count 를 입력해야 합니다." fires.
      expect(result.errors.some((e) => e.includes('Count'))).toBe(true);
    });

    it('rejects non-numeric string', () => {
      const result = handler.validate({ count: 'abc' });
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('count must be a number or expression');
    });

    it('rejects zero or negative count', () => {
      expect(handler.validate({ count: 0 }).valid).toBe(false);
      expect(handler.validate({ count: -1 }).valid).toBe(false);
    });

    it('rejects numeric count > maxIterations', () => {
      const result = handler.validate({ count: 2000, maxIterations: 100 });
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toMatch(/must be less than or equal/);
    });

    it('accepts numeric string maxIterations', () => {
      expect(handler.validate({ count: '5', maxIterations: '100' }).valid).toBe(
        true,
      );
    });
  });

  describe('execute', () => {
    it('coerces string count into the resolved config', async () => {
      const result = (await handler.execute(
        {},
        { count: '10' },
        context,
      )) as Record<string, unknown>;
      expect(result.config).toEqual({ count: 10, maxIterations: 1000 });
      expect(result.output).toBeNull();
    });

    it('falls back to default maxIterations when omitted', async () => {
      const result = (await handler.execute(
        {},
        { count: 3 },
        context,
      )) as Record<string, unknown>;
      const config = result.config as Record<string, unknown>;
      expect(config.maxIterations).toBe(1000);
    });
  });
});
