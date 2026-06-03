import { CodeHandler } from './code.handler.js';
import { ExecutionContext } from '../../core/node-handler.interface.js';
import { createEmptyConversationThread } from '../../../shared/conversation-thread/conversation-thread.types';

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
      structuredOutputCache: {},
      engineResolvedConfigCache: {},
      conversationThread: createEmptyConversationThread(),
      recursionDepth: 0,
    };
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
      // Schema warningRule "Body of the code to run must be entered." fires.
      expect(result.errors.some((e) => e.includes('code'))).toBe(true);
    });

    it('should reject empty code string', () => {
      const result = handler.validate({ code: '' });
      expect(result.valid).toBe(false);
    });

    it('should reject non-string code', () => {
      const result = handler.validate({ code: 42 });
      expect(result.valid).toBe(false);
    });

    it('should accept timeout within allowed range', () => {
      expect(handler.validate({ code: 'return 1;', timeout: 1 }).valid).toBe(
        true,
      );
      expect(handler.validate({ code: 'return 1;', timeout: 120 }).valid).toBe(
        true,
      );
    });

    it('should reject timeout outside allowed range', () => {
      expect(handler.validate({ code: 'return 1;', timeout: 0 }).valid).toBe(
        false,
      );
      expect(handler.validate({ code: 'return 1;', timeout: 121 }).valid).toBe(
        false,
      );
      expect(handler.validate({ code: 'return 1;', timeout: 'x' }).valid).toBe(
        false,
      );
    });

    it('should reject syntactically invalid code (pre-flight, CONVENTIONS 3.1)', () => {
      const result = handler.validate({ code: 'this is ( not valid js' });
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('syntax error'))).toBe(true);
    });

    it('should not run syntax check when code is empty (other rule fires first)', () => {
      // Empty code triggers `code:no-code`, but the syntax check should not
      // also fire — empty string is valid as a vm.Script body.
      const result = handler.validate({ code: '' });
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('syntax error'))).toBe(false);
    });
  });

  describe('execute — basic', () => {
    it('should run simple synchronous code and return output with port `success`', async () => {
      const result = (await handler.execute(
        { value: 5 },
        { code: 'return $input.value * 2;' },
        context,
      )) as unknown as {
        output: unknown;
        meta: Record<string, unknown>;
        port?: string;
      };
      expect(result.output).toBe(10);
      expect(result.meta).toMatchObject({ success: true });
      expect(result.port).toBe('success');
    });

    it('should expose $vars from context variables', async () => {
      context.variables = { greeting: 'hello' };
      const result = (await handler.execute(
        null,
        { code: 'return $vars.greeting + " world";' },
        context,
      )) as unknown as { output: unknown };
      expect(result.output).toBe('hello world');
    });

    it('should expose $execution with executionId and workflowId', async () => {
      const result = (await handler.execute(
        null,
        {
          code: 'return { eid: $execution.executionId, wid: $execution.workflowId };',
        },
        context,
      )) as unknown as { output: Record<string, string> };
      expect(result.output).toEqual({ eid: 'exec-1', wid: 'wf-1' });
    });

    it('should await a returned promise (async code)', async () => {
      const result = (await handler.execute(
        null,
        { code: 'return Promise.resolve(42);' },
        context,
      )) as unknown as { output: unknown };
      expect(result.output).toBe(42);
    });

    it('should support top-level await inside user code', async () => {
      const result = (await handler.execute(
        null,
        { code: 'const v = await Promise.resolve(7); return v + 1;' },
        context,
      )) as unknown as { output: unknown };
      expect(result.output).toBe(8);
    });

    it('should capture runtime errors with `error` port + normalized output.error.code', async () => {
      const result = (await handler.execute(
        null,
        { code: 'throw new Error("boom");' },
        context,
      )) as unknown as {
        output: { error: { code: string; message: string } };
        meta: { success: boolean };
        port?: string;
      };
      expect(result.output.error).toBeDefined();
      expect(result.port).toBe('error');
      expect(result.meta.success).toBe(false);
      // CONVENTIONS §3.2 — `output.error.code` is the canonical surface.
      expect(result.output.error.code).toBe('CODE_EXECUTION_FAILED');
      expect(result.output.error.message).toContain('boom');
    });

    it('should NOT emit deprecated meta.error / meta.errorCode / meta.stack aliases', async () => {
      const result = (await handler.execute(
        null,
        { code: 'throw new Error("boom");' },
        context,
      )) as unknown as { meta: Record<string, unknown> };
      expect(result.meta).not.toHaveProperty('error');
      expect(result.meta).not.toHaveProperty('errorCode');
      expect(result.meta).not.toHaveProperty('stack');
    });

    it('should throw at execute() if syntax-invalid code reaches the handler (pre-flight invariant)', async () => {
      // Engine path screens this in validate(); if it slips through, execute()
      // throws rather than masquerading as a runtime error.
      await expect(
        handler.execute(null, { code: 'this is ( not valid js' }, context),
      ).rejects.toThrow(/syntax error/);
    });

    it('should return undefined output when code returns nothing', async () => {
      const result = (await handler.execute(
        null,
        { code: 'const x = 1;' },
        context,
      )) as unknown as { output: unknown; meta: { success: boolean } };
      expect(result.output).toBeUndefined();
      expect(result.meta.success).toBe(true);
    });

    it('should echo configured language and code body in config (success)', async () => {
      const result = (await handler.execute(
        null,
        { code: 'return 1;', language: 'javascript' },
        context,
      )) as unknown as { config: { language: string; code?: string } };
      expect(result.config.language).toBe('javascript');
      expect(result.config.code).toBe('return 1;');
    });

    it('should default language to javascript', async () => {
      const result = (await handler.execute(
        null,
        { code: 'return 1;' },
        context,
      )) as unknown as { config: { language: string } };
      expect(result.config.language).toBe('javascript');
    });

    it('should echo configured language AND code body on error path (CONVENTIONS Principle 7)', async () => {
      const result = (await handler.execute(
        null,
        { code: 'throw new Error("x");', language: 'javascript' },
        context,
      )) as unknown as {
        config: { language: string; code?: string };
        meta: { success: boolean };
      };
      expect(result.config.language).toBe('javascript');
      expect(result.config.code).toBe('throw new Error("x");');
      expect(result.meta.success).toBe(false);
    });
  });

  describe('execute — security restrictions', () => {
    it.each([
      ['require', 'return require("fs");'],
      ['process', 'return process.env;'],
      ['global', 'return global;'],
      ['Buffer', 'return Buffer.from("x");'],
      ['fetch', 'return fetch("http://x");'],
      ['setTimeout', 'return setTimeout(() => {}, 0);'],
      ['setInterval', 'return setInterval(() => {}, 0);'],
      ['setImmediate', 'return setImmediate(() => {});'],
      ['Reflect', 'return Reflect.get({}, "x");'],
      ['Proxy', 'return new Proxy({}, {});'],
    ])('should block access to %s', async (_name, code) => {
      const result = (await handler.execute(
        null,
        { code },
        context,
      )) as unknown as {
        meta: { success: boolean };
        output: { error?: { message: string } };
      };
      expect(result.meta.success).toBe(false);
      expect(result.output.error?.message).toBeDefined();
    });

    it('should shadow globalThis so it exposes no dangerous globals', async () => {
      const result = (await handler.execute(
        null,
        { code: 'return typeof globalThis;' },
        context,
      )) as unknown as { output: string };
      expect(result.output).toBe('undefined');
    });

    it('should block dynamic import()', async () => {
      const result = (await handler.execute(
        null,
        { code: 'return import("fs");' },
        context,
      )) as unknown as { meta: { success: boolean } };
      expect(result.meta.success).toBe(false);
    });

    it('should block eval()', async () => {
      const result = (await handler.execute(
        null,
        { code: 'return eval("1+1");' },
        context,
      )) as unknown as { meta: { success: boolean } };
      expect(result.meta.success).toBe(false);
    });

    it('should block new Function() constructor', async () => {
      const result = (await handler.execute(
        null,
        { code: 'return new Function("return 1")();' },
        context,
      )) as unknown as { meta: { success: boolean } };
      expect(result.meta.success).toBe(false);
    });

    it('should allow JSON, Math, Date, and other approved globals', async () => {
      const result = (await handler.execute(
        null,
        {
          code: `
            const o = JSON.parse('{"a":1}');
            const pi = Math.PI;
            const d = new Date(0).getFullYear();
            return { a: o.a, pi, d };
          `,
        },
        context,
      )) as unknown as { output: { a: number; pi: number; d: number } };
      expect(result.output.a).toBe(1);
      expect(result.output.pi).toBeCloseTo(Math.PI);
      expect(result.output.d).toBe(1970);
    });

    it('should capture console.log into meta.logs', async () => {
      const result = (await handler.execute(
        null,
        { code: 'console.log("hello", 1); return 1;' },
        context,
      )) as unknown as { meta: { logs: string[] } };
      expect(result.meta.logs).toEqual(['[log] hello 1']);
    });

    it('should cap console logs at 100 lines', async () => {
      const result = (await handler.execute(
        null,
        {
          code: 'for (let i = 0; i < 250; i++) console.log(i); return 1;',
        },
        context,
      )) as unknown as { meta: { logs: string[] } };
      expect(result.meta.logs).toHaveLength(100);
    });
  });

  describe('execute — timeouts', () => {
    it('should timeout synchronous infinite loops via vm timeout option', async () => {
      const result = (await handler.execute(
        null,
        { code: 'while (true) {}', timeout: 1 },
        context,
      )) as unknown as {
        output: { error: { code: string } };
        meta: { success: boolean };
        port?: string;
      };
      expect(result.output.error).toBeDefined();
      expect(result.port).toBe('error');
      expect(result.meta.success).toBe(false);
      expect(result.output.error.code).toBe('CODE_TIMEOUT');
    }, 10_000);

    it('should timeout async code that never resolves', async () => {
      const result = (await handler.execute(
        null,
        {
          code: 'await new Promise(() => {}); return 1;',
          timeout: 1,
        },
        context,
      )) as unknown as {
        output: { error: { code: string; message: string } };
        meta: { success: boolean };
        port?: string;
      };
      expect(result.output.error).toBeDefined();
      expect(result.port).toBe('error');
      expect(result.meta.success).toBe(false);
      expect(result.output.error.message).toContain('timed out');
      expect(result.output.error.code).toBe('CODE_TIMEOUT');
    }, 10_000);
  });

  describe('execute — $vars atomic replace', () => {
    it('should apply $vars mutations after successful execution', async () => {
      context.variables = { counter: 1 };
      const result = (await handler.execute(
        null,
        { code: '$vars.counter = 42; $vars.added = "new"; return $vars;' },
        context,
      )) as unknown as { meta: { success: boolean } };
      expect(result.meta.success).toBe(true);
      expect(context.variables).toEqual({ counter: 42, added: 'new' });
    });

    it('should preserve original $vars when execution throws', async () => {
      context.variables = { counter: 1 };
      await handler.execute(
        null,
        { code: '$vars.counter = 999; throw new Error("fail");' },
        context,
      );
      expect(context.variables).toEqual({ counter: 1 });
    });
  });

  describe('execute — $node (spec §2.1)', () => {
    it('should expose $node.id and $node.label from context', async () => {
      context.nodeId = 'node-42';
      context.nodeLabel = 'My Code Step';
      const result = (await handler.execute(
        null,
        { code: 'return { id: $node.id, label: $node.label };' },
        context,
      )) as unknown as { output: Record<string, string> };
      expect(result.output).toEqual({ id: 'node-42', label: 'My Code Step' });
    });

    it('should expose $node with empty-string fallbacks when context omits id/label', async () => {
      // Direct-invoke fixtures may omit nodeId/nodeLabel (interface allows it).
      const result = (await handler.execute(
        null,
        { code: 'return { id: $node.id, label: $node.label };' },
        context,
      )) as unknown as { output: Record<string, string> };
      expect(result.output).toEqual({ id: '', label: '' });
    });
  });

  describe('execute — $helpers (spec §2.2)', () => {
    it('should expose $helpers.crypto.uuid() returning a v4-shaped string', async () => {
      const result = (await handler.execute(
        null,
        { code: 'return $helpers.crypto.uuid();' },
        context,
      )) as unknown as { output: string };
      expect(result.output).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
      );
    });

    it('should expose $helpers.crypto.hash(algorithm, data) returning a hex digest', async () => {
      const result = (await handler.execute(
        null,
        { code: 'return $helpers.crypto.hash("sha256", "abc");' },
        context,
      )) as unknown as { output: string };
      // Known sha256("abc")
      expect(result.output).toBe(
        'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
      );
    });

    it('should expose $helpers.base64.encode / decode (round-trip)', async () => {
      const result = (await handler.execute(
        null,
        {
          code: 'const e = $helpers.base64.encode("hello"); return { e, d: $helpers.base64.decode(e) };',
        },
        context,
      )) as unknown as { output: { e: string; d: string } };
      expect(result.output.e).toBe('aGVsbG8=');
      expect(result.output.d).toBe('hello');
    });

    it('should expose $helpers.date(value) as a dayjs-compatible object', async () => {
      const result = (await handler.execute(
        null,
        {
          code: 'const d = $helpers.date("2020-01-15"); return { y: d.year(), f: d.format("YYYY-MM-DD") };',
        },
        context,
      )) as unknown as { output: { y: number; f: string } };
      expect(result.output.y).toBe(2020);
      expect(result.output.f).toBe('2020-01-15');
    });
  });
});
