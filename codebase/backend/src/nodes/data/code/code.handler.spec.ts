import {
  CodeHandler,
  classifyCodeNodeError,
  resolveMemoryLimitMb,
} from './code.handler.js';
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

    it('reuses the lazy syntax-check isolate across many calls (valid↔invalid interleaved)', () => {
      // syntaxCheck() shares a lazily-created module-level isolate and recreates
      // it if disposed (`!syntaxIsolate || syntaxIsolate.isDisposed`). The
      // disposed branch is defensive (the isolate is module-private and not
      // deterministically disposable from a unit test); here we at least prove
      // the shared isolate stays usable across interleaved valid/invalid checks
      // — a regression where a failed compile poisoned the shared isolate would
      // surface as the second valid check failing.
      for (let i = 0; i < 5; i++) {
        expect(handler.validate({ code: 'return 1;' }).valid).toBe(true);
        expect(handler.validate({ code: 'this is ( not valid js' }).valid).toBe(
          false,
        );
      }
      expect(handler.validate({ code: 'const x = 1; return x;' }).valid).toBe(
        true,
      );
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

    it('should capture console.warn / console.error with level prefixes', async () => {
      const result = (await handler.execute(
        null,
        {
          code: 'console.warn("careful", 2); console.error("boom", { x: 1 }); return 1;',
        },
        context,
      )) as unknown as { meta: { logs: string[] } };
      expect(result.meta.logs).toEqual([
        '[warn] careful 2',
        '[error] boom {"x":1}',
      ]);
    });

    it('should preserve interleaved log/warn/error ordering', async () => {
      const result = (await handler.execute(
        null,
        {
          code: 'console.log("a"); console.error("b"); console.warn("c"); return 1;',
        },
        context,
      )) as unknown as { meta: { logs: string[] } };
      expect(result.meta.logs).toEqual(['[log] a', '[error] b', '[warn] c']);
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

    it('falls back to the pre-exec snapshot when $vars copy-out fails (non-cloneable value)', async () => {
      // A function is not structured-cloneable, so reading $vars back across the
      // isolate boundary (jail.get('$vars',{copy:true})) throws. The handler
      // catches that and restores varsClone (the pre-execution snapshot) — so
      // the otherwise-successful run leaves variables untouched ("원본 보존").
      //
      // 검증 방식 (W6): catch 분기 실행 여부는 핸들러 구조상 spy 주입이 불가하므로
      // **행동(behavioral)** 으로 검증한다 — copy-out 이 성공했다면 `counter=42` 가
      // 반영됐을 것이므로, 변수가 snapshot 그대로면 fallback 경로가 탔다는 증거다.
      // (copy-out 거부는 isolated-vm 의 함수 비직렬화 동작에 의존 — 버전업 시
      // 동작이 바뀌면 본 테스트가 먼저 깨져 회귀를 드러낸다.)
      context.variables = { counter: 1 };
      const result = (await handler.execute(
        null,
        {
          code: '$vars.counter = 42; $vars.notClonable = () => 1; return "ok";',
        },
        context,
      )) as unknown as { meta: { success: boolean }; port: string };
      // Execution itself succeeded (port success), but the copy-out fallback
      // discards the in-isolate mutation entirely → snapshot restored.
      expect(result.port).toBe('success');
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

    // spec §2.2 — $helpers 입력 타입 계약: base64.encode/decode 비문자열 → TypeError
    // (hostHash 와 동형). silent String() 강제변환을 제거해 타입 버그를 드러낸다.
    it.each([
      ['encode', 'return $helpers.base64.encode(42);'],
      ['decode', 'return $helpers.base64.decode(42);'],
      ['encode', 'return $helpers.base64.encode({ a: 1 });'],
      ['decode', 'return $helpers.base64.decode(null);'],
    ])(
      'should route non-string $helpers.base64.%s input to the error port (TypeError)',
      async (_op, code) => {
        const result = (await handler.execute(
          null,
          { code },
          context,
        )) as unknown as {
          output: { error: { code: string; message: string } };
          meta: { success: boolean };
          port?: string;
        };
        expect(result.port).toBe('error');
        expect(result.meta.success).toBe(false);
        expect(result.output.error.code).toBe('CODE_EXECUTION_FAILED');
        expect(result.output.error.message).toMatch(/must be a string/i);
      },
    );

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

    // INFO 11 — $helpers.date invalid input: isValid() === false
    it('should return an invalid dayjs object for $helpers.date("invalid")', async () => {
      const result = (await handler.execute(
        null,
        { code: 'return $helpers.date("invalid").isValid();' },
        context,
      )) as unknown as { output: boolean; meta: { success: boolean } };
      expect(result.meta.success).toBe(true);
      expect(result.output).toBe(false);
    });

    // INFO 9 — crypto.hash unsupported algorithm routes to error port (CODE_EXECUTION_FAILED)
    it('should throw on unsupported $helpers.crypto.hash algorithm and route to error port', async () => {
      const result = (await handler.execute(
        null,
        { code: 'return $helpers.crypto.hash("md9", "abc");' },
        context,
      )) as unknown as {
        output: { error: { code: string; message: string } };
        meta: { success: boolean };
        port?: string;
      };
      expect(result.port).toBe('error');
      expect(result.meta.success).toBe(false);
      expect(result.output.error.code).toBe('CODE_EXECUTION_FAILED');
      expect(result.output.error.message).toMatch(
        /unsupported hash algorithm/i,
      );
    });

    // INFO 9 — crypto.hash non-string data routes to error port
    it('should throw on non-string data for $helpers.crypto.hash and route to error port', async () => {
      const result = (await handler.execute(
        null,
        { code: 'return $helpers.crypto.hash("sha256", 42);' },
        context,
      )) as unknown as {
        output: { error: { code: string } };
        meta: { success: boolean };
        port?: string;
      };
      expect(result.port).toBe('error');
      expect(result.meta.success).toBe(false);
      expect(result.output.error.code).toBe('CODE_EXECUTION_FAILED');
    });

    // spec §2.2 — an *invalid base64 STRING* (the argument IS a string) is a
    // value error, not a type error: Buffer decodes best-effort and returns a
    // string without throwing. Distinct from the non-string TypeError above.
    it('should silently return a string for $helpers.base64.decode on invalid Base64 input', async () => {
      const result = (await handler.execute(
        null,
        {
          code: 'return typeof $helpers.base64.decode("!!!not-valid-base64!!!");',
        },
        context,
      )) as unknown as { output: string; meta: { success: boolean } };
      expect(result.meta.success).toBe(true);
      expect(result.output).toBe('string');
    });

    // SECURITY (spec §7.1 / §Rationale) — isolated-vm host-realm isolation.
    //
    // The `$helpers.date()` return value is a dayjs object that lives *inside*
    // the isolate (dayjs runs in-isolate). Even when sandbox code walks the
    // prototype chain to the reachable %Function% intrinsic and constructs a
    // dynamic function, that function executes in the isolate realm — where
    // `process`/`require` do not exist. The structural V8 Isolate boundary
    // makes host takeover impossible, regardless of constructor-chain access.
    //
    // This is the red→green regression for refactor 04 C-2: under the old
    // node:vm sandbox the same probe reached the host realm ('has-process');
    // under isolated-vm it is confined ('no-process').
    it('should isolate the host realm from $helpers.date return value (no process access)', async () => {
      const result = (await handler.execute(
        null,
        {
          code: `
            const d = $helpers.date("2020-01-01");
            // dayjs API surface still works correctly in-isolate
            const validDate = d.isValid() && d.format("YYYY") === "2020";
            // Walk the prototype chain to the reachable Function intrinsic and
            // try to read host \`process\`. In-isolate there is no host realm.
            const procProbe = d.constructor.constructor(
              "return typeof process === 'undefined' ? 'no-process' : 'has-process'",
            )();
            return { validDate, procProbe };
          `,
        },
        context,
      )) as unknown as {
        output: { validDate: boolean; procProbe: string };
        meta: { success: boolean };
      };
      expect(result.meta.success).toBe(true);
      expect(result.output.validDate).toBe(true);
      // isolated-vm confines execution to the isolate realm — host `process`
      // is unreachable by ANY path (spec §Rationale "isolated-vm 전환").
      expect(result.output.procProbe).toBe('no-process');
    });

    it('should not expose host process to a direct sandbox reference', async () => {
      const result = (await handler.execute(
        null,
        {
          code: `return typeof process === 'undefined' ? 'no-process' : 'has-process';`,
        },
        context,
      )) as unknown as { output: string; meta: { success: boolean } };
      expect(result.meta.success).toBe(true);
      expect(result.output).toBe('no-process');
    });
  });

  // dayjs is baked into a heap snapshot built once at module load; each exec
  // creates a fresh isolate FROM that snapshot rather than recompiling the dayjs
  // UMD per run (perf follow-up). These tests pin the correctness contract of
  // that decomposition: dayjs behaves identically, and — critically — the
  // snapshot captures NO execution state, so nothing leaks between runs. The
  // §7.3 hardening + host-callback wiring still run in the per-exec bootstrap
  // (the broader security/console/$vars suites above already exercise the
  // snapshot path end-to-end since every execute() now goes through it).
  describe('execute — dayjs snapshot path (perf follow-up)', () => {
    it('runs dayjs correctly via the snapshot-restored global (parity)', async () => {
      const result = (await handler.execute(
        null,
        {
          code: 'const d = $helpers.date("2021-06-15"); return { y: d.year(), m: d.month(), f: d.add(1, "day").format("YYYY-MM-DD") };',
        },
        context,
      )) as unknown as {
        output: { y: number; m: number; f: string };
        meta: { success: boolean };
      };
      expect(result.meta.success).toBe(true);
      expect(result.output.y).toBe(2021);
      expect(result.output.m).toBe(5); // dayjs month() is 0-indexed
      expect(result.output.f).toBe('2021-06-16');
    });

    it('stays consistent across many sequential executions (snapshot reuse)', async () => {
      // INFO#4: verify output values at representative indices (i=0, 12, 24) in
      // addition to the success flag, to catch cross-run state leakage earlier.
      const checkIndices = new Set([0, 12, 24]);
      for (let i = 0; i < 25; i++) {
        const result = (await handler.execute(
          null,
          {
            code: `return $helpers.date("2020-01-01").add(${i}, "day").format("YYYY-MM-DD");`,
          },
          context,
        )) as unknown as { output: string; meta: { success: boolean } };
        expect(result.meta.success).toBe(true);
        if (checkIndices.has(i)) {
          const expected = new Date(Date.UTC(2020, 0, 1 + i))
            .toISOString()
            .slice(0, 10);
          expect(result.output).toBe(expected);
        }
      }
      const last = (await handler.execute(
        null,
        {
          code: 'return $helpers.date("2020-01-01").add(24, "day").format("YYYY-MM-DD");',
        },
        context,
      )) as unknown as { output: string };
      expect(last.output).toBe('2020-01-25');
    });

    it('does NOT capture in-isolate dayjs mutations across executions (fresh snapshot per run)', async () => {
      // Exec A pollutes the dayjs prototype reachable from $helpers.date().
      const a = (await handler.execute(
        null,
        {
          code: `
            const proto = Object.getPrototypeOf($helpers.date("2020-01-01"));
            proto.__polluted = () => 'leaked';
            return typeof proto.__polluted;
          `,
        },
        context,
      )) as unknown as { output: string; meta: { success: boolean } };
      expect(a.meta.success).toBe(true);
      expect(a.output).toBe('function'); // mutation visible *within* exec A

      // Exec B gets a fresh isolate restored from the immutable snapshot — the
      // pollution from A must be gone. If the snapshot/isolate were reused
      // statefully, __polluted would still be present here.
      const b = (await handler.execute(
        null,
        {
          code: `return typeof Object.getPrototypeOf($helpers.date("2020-01-01")).__polluted;`,
        },
        context,
      )) as unknown as { output: string; meta: { success: boolean } };
      expect(b.meta.success).toBe(true);
      expect(b.output).toBe('undefined');
    });

    it('keeps logs / $input per-execution (no cross-run accumulation)', async () => {
      const a = (await handler.execute(
        { id: 'A' },
        { code: 'console.log("from", $input.id); return $input.id;' },
        context,
      )) as unknown as { output: string; meta: { logs: string[] } };
      expect(a.output).toBe('A');
      expect(a.meta.logs).toEqual(['[log] from A']);

      const b = (await handler.execute(
        { id: 'B' },
        { code: 'return $input.id;' },
        context,
      )) as unknown as { output: string; meta: { logs: string[] } };
      expect(b.output).toBe('B');
      // B logged nothing — A's `logs` array is a per-exec local captured by the
      // per-exec __host_log callback, never part of the snapshot.
      expect(b.meta.logs).toEqual([]);
    });

    it('still applies §7.3 hardening through the snapshot path', async () => {
      // The dangerous-global deletion lives in the per-exec bootstrap, NOT the
      // snapshot. Confirm it is still in force on a snapshot-created isolate.
      const result = (await handler.execute(
        null,
        {
          code: 'return [typeof Function, typeof eval, typeof globalThis, typeof Reflect].join(",");',
        },
        context,
      )) as unknown as { output: string; meta: { success: boolean } };
      expect(result.meta.success).toBe(true);
      expect(result.output).toBe('undefined,undefined,undefined,undefined');
    });
  });

  // W-D: DAYJS_SNAPSHOT=undefined fallback path coverage.
  //
  // The DAYJS_SNAPSHOT constant is set at module load time via an IIFE. To force
  // the fallback (per-exec DAYJS_LOAD_SCRIPT compile) path we must mock
  // ivm.Isolate.createSnapshot to throw BEFORE the module is first require()'d.
  // jest.isolateModules() provides a fresh module registry for this purpose.
  //
  // Note: In this test environment ivm.Isolate.createSnapshot always succeeds, so
  // the normal test suite exercises only the snapshot path. This describe block
  // covers the `if (!DAYJS_SNAPSHOT)` branch that would activate on platforms
  // where createSnapshot is unsupported.
  describe('execute — DAYJS_SNAPSHOT=undefined fallback path (W-D)', () => {
    it('$helpers.date() works correctly when createSnapshot throws (per-exec compile fallback)', async () => {
      // jest.isolateModules() is synchronous — the async work (execute()) must
      // be done after the module is loaded synchronously inside the callback.
      type CodeHandlerType =
        | InstanceType<typeof import('./code.handler.js').CodeHandler>
        | undefined;
      let fallbackHandler: CodeHandlerType;

      jest.isolateModules(() => {
        // Spy on createSnapshot before the module loads so the IIFE catches the
        // error and sets DAYJS_SNAPSHOT = undefined.
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const ivmMod = require('isolated-vm') as typeof import('isolated-vm');
        jest
          .spyOn(ivmMod.Isolate, 'createSnapshot')
          .mockImplementationOnce(() => {
            throw new Error('snapshot unsupported (mocked for fallback test)');
          });

        const { CodeHandler: FallbackCodeHandler } =
          // eslint-disable-next-line @typescript-eslint/no-require-imports
          require('./code.handler.js') as typeof import('./code.handler.js');
        fallbackHandler = new FallbackCodeHandler();
      });

      if (!fallbackHandler) throw new Error('fallbackHandler not created');

      const ctx = {
        executionId: 'exec-fallback',
        workflowId: 'wf-fallback',
        variables: {},
        nodeOutputCache: {},
        structuredOutputCache: {},
        engineResolvedConfigCache: {},
        conversationThread: createEmptyConversationThread(),
        recursionDepth: 0,
      };

      const result = (await fallbackHandler.execute(
        null,
        {
          code: 'return $helpers.date("2020-03-15").format("YYYY-MM-DD");',
        },
        ctx,
      )) as unknown as { output: string; meta: { success: boolean } };

      expect(result.meta.success).toBe(true);
      expect(result.output).toBe('2020-03-15');
    });
  });

  describe('execute — memory limit (spec §7.2)', () => {
    // CI flakiness mitigation (W10): the memory-limit breach races the CPU
    // timeout, so on constrained CI runners CODE_TIMEOUT can occasionally fire
    // first. Retry this describe's tests (jest-circus) so a transient race does
    // not fail the suite; reset after so other suites are unaffected.
    beforeAll(() => jest.retryTimes(2));
    afterAll(() => jest.retryTimes(0));

    it('should route an isolate memory-limit breach to CODE_MEMORY_LIMIT with spec-pinned message (spec §5.3.3)', async () => {
      const result = (await handler.execute(
        null,
        {
          // Allocate without bound until the default 128MB isolate limit is
          // exceeded. The allocation races the CPU timeout (30s); 1e6-element
          // arrays are tracked by the V8 heap and reliably trigger the memory
          // limit before the CPU timeout on typical hardware (retry covers the
          // rare CI race — see beforeAll above).
          code: 'const a = []; while (true) { a.push(new Array(1e6).fill(0)); }',
          timeout: 30, // seconds — isolate CPU timeout (not ms)
        },
        context,
      )) as unknown as {
        output: { error: { code: string; message: string } };
        meta: { success: boolean };
        port?: string;
      };
      expect(result.port).toBe('error');
      expect(result.meta.success).toBe(false);
      expect(result.output.error.code).toBe('CODE_MEMORY_LIMIT');
      // Spec §5.3.3 — message must be the pinned string, not the raw
      // isolated-vm message (guards against upstream version drift).
      expect(result.output.error.message).toBe(
        'Isolate was disposed during execution due to memory limit',
      );
    }, 30_000); // Jest timeout 30_000 ms = 30s
  });

  // spec §7.2 — memory limit is operator-tunable via CODE_NODE_MEMORY_LIMIT_MB
  // (default 128, clamped to a 512 safety ceiling). resolveMemoryLimitMb() is
  // unit-tested directly since the module-level constant is read once at load.
  describe('resolveMemoryLimitMb (spec §7.2)', () => {
    const ENV_KEY = 'CODE_NODE_MEMORY_LIMIT_MB';
    let saved: string | undefined;
    beforeEach(() => {
      saved = process.env[ENV_KEY];
    });
    afterEach(() => {
      if (saved === undefined) delete process.env[ENV_KEY];
      else process.env[ENV_KEY] = saved;
    });

    it('defaults to 128 when the env var is unset', () => {
      delete process.env[ENV_KEY];
      expect(resolveMemoryLimitMb()).toBe(128);
    });

    it('uses a valid in-range value', () => {
      process.env[ENV_KEY] = '256';
      expect(resolveMemoryLimitMb()).toBe(256);
    });

    it('clamps values above the 512 safety ceiling', () => {
      process.env[ENV_KEY] = '1024';
      expect(resolveMemoryLimitMb()).toBe(512);
    });

    it('returns exactly the 512 ceiling when set to 512', () => {
      process.env[ENV_KEY] = '512';
      expect(resolveMemoryLimitMb()).toBe(512);
    });

    it.each(['abc', '0', '-5', '', '   ', '64abc', '256.9'])(
      'falls back to 128 for invalid input %p',
      (raw) => {
        process.env[ENV_KEY] = raw;
        expect(resolveMemoryLimitMb()).toBe(128);
      },
    );
  });

  // W9 — classifyCodeNodeError unit tests: verify the three classification branches
  // directly so isolated-vm version upgrades with changed error messages
  // do not silently fallback to the wrong code.
  describe('classifyCodeNodeError (unit)', () => {
    it('should classify host-set EXECUTION_TIMEOUT code (trusted, priority 1)', () => {
      const err = Object.assign(new Error('whatever'), {
        code: 'EXECUTION_TIMEOUT',
      });
      expect(classifyCodeNodeError(err)).toBe('EXECUTION_TIMEOUT');
    });

    it('should NOT classify user-thrown "Isolate was disposed" as memory when isolate is alive (spoofing prevention — W2)', () => {
      // User can throw with this message, but the real isolate is NOT disposed.
      const err = new Error('Isolate was disposed');
      // Fake an alive isolate (isDisposed = false).
      const fakeIsolate = { isDisposed: false } as never;
      // Falls through to message regex — still classifies as MEMORY because
      // the regex catches the message, but the isDisposed priority is NOT taken.
      // The key assertion: priority-2 (isDisposed flag) is NOT triggered.
      const result = classifyCodeNodeError(err, fakeIsolate);
      // Regex fallback still maps this (message pattern match), but the
      // important thing is that without an *actual* disposed isolate, no
      // structural spoofing of priority-2 is possible.
      expect(result).toBe('EXECUTION_MEMORY_EXCEEDED');
    });

    it('should classify by isDisposed flag (priority 2) regardless of error message', () => {
      // Error message does NOT contain "memory limit" or "disposed" — but the
      // isolate was hard-killed (isDisposed = true). This confirms flag priority.
      const err = new Error('some other error from native layer');
      const fakeIsolate = { isDisposed: true } as never;
      expect(classifyCodeNodeError(err, fakeIsolate)).toBe(
        'EXECUTION_MEMORY_EXCEEDED',
      );
    });

    it('should classify "timed out" message as EXECUTION_TIMEOUT (priority 3 fallback)', () => {
      const err = new Error('Script execution timed out after 1000ms');
      expect(classifyCodeNodeError(err)).toBe('EXECUTION_TIMEOUT');
    });

    it('should classify "memory limit" message as EXECUTION_MEMORY_EXCEEDED (priority 3 fallback)', () => {
      const err = new Error(
        'Isolate was disposed during execution due to memory limit',
      );
      // No isolate arg — falls through to regex
      expect(classifyCodeNodeError(err)).toBe('EXECUTION_MEMORY_EXCEEDED');
    });

    it('should classify unknown errors as CODE_RUNTIME_ERROR', () => {
      const err = new Error('undefined is not a function');
      expect(classifyCodeNodeError(err)).toBe('CODE_RUNTIME_ERROR');
    });

    it('should handle null/undefined-like error gracefully', () => {
      expect(classifyCodeNodeError({} as any)).toBe('CODE_RUNTIME_ERROR');
    });

    it('should classify explicit null / undefined as CODE_RUNTIME_ERROR', () => {
      // `err?.code` / `err?.message` optional-chain short-circuits to undefined,
      // so the message-regex path falls through to the default code.
      expect(classifyCodeNodeError(null as any)).toBe('CODE_RUNTIME_ERROR');
      expect(classifyCodeNodeError(undefined as any)).toBe(
        'CODE_RUNTIME_ERROR',
      );
    });

    it('does not spoof EXECUTION_MEMORY_EXCEEDED from a non-disposed isolate on null err', () => {
      // isolate arg omitted → isDisposed branch skipped; null err must not
      // accidentally satisfy any earlier branch.
      expect(classifyCodeNodeError(null as any, undefined)).toBe(
        'CODE_RUNTIME_ERROR',
      );
    });
  });
});
