import { CodeHandler } from './code.handler.js';
import { ExecutionContext } from '../node-handler.interface.js';

describe('CodeHandler', () => {
  let handler: CodeHandler;
  let context: ExecutionContext;

  beforeEach(() => {
    handler = new CodeHandler();
    context = {
      executionId: 'exec-1',
      workflowId: 'wf-1',
      variables: {},
      nodeOutputCache: {},
    };
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  describe('validate', () => {
    it('should return valid when code is a non-empty string', () => {
      const result = handler.validate({ code: 'return 1;' });
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject missing code', () => {
      const result = handler.validate({});
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('code is required and must be a string');
    });

    it('should reject empty code string', () => {
      const result = handler.validate({ code: '' });
      expect(result.valid).toBe(false);
    });

    it('should reject non-string code', () => {
      const result = handler.validate({ code: 42 });
      expect(result.valid).toBe(false);
    });
  });

  describe('execute', () => {
    it('should run simple synchronous code and return output', async () => {
      const result = (await handler.execute(
        { value: 5 },
        { code: 'return $input.value * 2;' },
        context,
      )) as { output: unknown; meta: Record<string, unknown> };
      expect(result.output).toBe(10);
      expect(result.meta).toMatchObject({ success: true });
    });

    it('should expose $vars from context variables', async () => {
      context.variables = { greeting: 'hello' };
      const result = (await handler.execute(
        null,
        { code: 'return $vars.greeting + " world";' },
        context,
      )) as { output: unknown };
      expect(result.output).toBe('hello world');
    });

    it('should expose $execution with executionId and workflowId', async () => {
      const result = (await handler.execute(
        null,
        {
          code: 'return { eid: $execution.executionId, wid: $execution.workflowId };',
        },
        context,
      )) as { output: Record<string, string> };
      expect(result.output).toEqual({ eid: 'exec-1', wid: 'wf-1' });
    });

    it('should await a returned promise (async code)', async () => {
      const result = (await handler.execute(
        null,
        {
          code: 'return Promise.resolve(42);',
        },
        context,
      )) as { output: unknown };
      expect(result.output).toBe(42);
    });

    it('should capture runtime errors into meta.error and return null output', async () => {
      const result = (await handler.execute(
        null,
        { code: 'throw new Error("boom");' },
        context,
      )) as {
        output: unknown;
        meta: { success: boolean; error?: string; stack?: string };
      };
      expect(result.output).toBeNull();
      expect(result.meta.success).toBe(false);
      expect(result.meta.error).toContain('boom');
    });

    it('should capture syntax errors (new Function construction) into meta', async () => {
      const result = (await handler.execute(
        null,
        { code: 'this is ( not valid js' },
        context,
      )) as { output: unknown; meta: { success: boolean; error?: string } };
      expect(result.output).toBeNull();
      expect(result.meta.success).toBe(false);
      expect(result.meta.error).toBeDefined();
    });

    it('should return undefined output when code returns nothing', async () => {
      const result = (await handler.execute(
        null,
        { code: 'const x = 1;' },
        context,
      )) as { output: unknown; meta: { success: boolean } };
      expect(result.output).toBeUndefined();
      expect(result.meta.success).toBe(true);
    });

    it('should echo configured language in config', async () => {
      const result = (await handler.execute(
        null,
        { code: 'return 1;', language: 'javascript' },
        context,
      )) as { config: { language: string } };
      expect(result.config.language).toBe('javascript');
    });

    it('should default language to javascript', async () => {
      const result = (await handler.execute(
        null,
        { code: 'return 1;' },
        context,
      )) as { config: { language: string } };
      expect(result.config.language).toBe('javascript');
    });

    it('should echo configured language on error path too', async () => {
      const result = (await handler.execute(
        null,
        { code: 'throw new Error("x");', language: 'javascript' },
        context,
      )) as { config: { language: string }; meta: { success: boolean } };
      expect(result.config.language).toBe('javascript');
      expect(result.meta.success).toBe(false);
    });

    it('should timeout code that exceeds CODE_TIMEOUT_MS', async () => {
      jest.useFakeTimers();
      const executePromise = handler.execute(
        null,
        {
          code: 'return new Promise((resolve) => setTimeout(resolve, 60000));',
        },
        context,
      );
      await jest.advanceTimersByTimeAsync(30_001);
      const result = (await executePromise) as {
        output: unknown;
        meta: { success: boolean; error?: string };
      };
      expect(result.output).toBeNull();
      expect(result.meta.success).toBe(false);
      expect(result.meta.error).toContain('timed out');
    }, 10_000);
  });
});
