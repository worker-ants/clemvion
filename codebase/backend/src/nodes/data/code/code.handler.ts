import { createHash, randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import ivm from 'isolated-vm';
import {
  ExecutionContext,
  NodeHandler,
  NodeHandlerOutput,
  ValidationResult,
} from '../../core/node-handler.interface.js';
import { evaluateMetadataBlockingErrors } from '../../core/metadata-validation.js';
import { codeNodeMetadata, DEFAULT_TIMEOUT_SEC } from './code.schema.js';

const MAX_CONSOLE_LINES = 100;
/**
 * Isolate memory hard limit (spec §7.2) — exceeded triggers CODE_MEMORY_LIMIT.
 * W15: Currently hardcoded. Can be extracted to `CODE_NODE_MEMORY_LIMIT_MB`
 * env var if runtime tuning is needed.
 */
const ISOLATE_MEMORY_LIMIT_MB = 128;

// Allowlist for $helpers.crypto.hash — guards against OpenSSL internal error
// messages leaking through on unsupported algorithm strings (spec §2.2).
const ALLOWED_HASH_ALGORITHMS = new Set([
  'sha256',
  'sha384',
  'sha512',
  'sha1',
  'md5',
]);

// dayjs UMD source, read once at module load. It runs *inside* the isolate so
// `$helpers.date(...)` returns a fully chainable dayjs object living in the
// isolate realm (spec §2.2) — never a host-realm object crossing the boundary.
// The backend compiles to CommonJS (no `"type": "module"`), so `require.resolve`
// locates the package asset in both the runtime and ts-jest.
const DAYJS_SOURCE = readFileSync(
  require.resolve('dayjs/dayjs.min.js'),
  'utf-8',
);

interface CodeExecutionError extends Error {
  code?: string;
}

function deepClone<T>(value: T): T {
  if (value === undefined || value === null) return value;
  return JSON.parse(JSON.stringify(value)) as T;
}

/**
 * Host-realm `$helpers.crypto.hash`. Runs outside the isolate via `ivm.Callback`
 * (string in / string out — both transferable). The algorithm allowlist + type
 * guard throw here; the thrown message is copied back into the isolate and
 * propagates to the user code's `error` port (spec §2.2, §5.3).
 */
function hostHash(algorithm: unknown, data: unknown): string {
  if (
    typeof algorithm !== 'string' ||
    !ALLOWED_HASH_ALGORITHMS.has(algorithm)
  ) {
    throw new Error(
      `Unsupported hash algorithm: "${String(algorithm)}". Allowed: ${[...ALLOWED_HASH_ALGORITHMS].join(', ')}`,
    );
  }
  if (typeof data !== 'string') {
    throw new TypeError(
      `$helpers.crypto.hash: data must be a string, got ${typeof data}`,
    );
  }
  return createHash(algorithm).update(data).digest('hex');
}

/**
 * Bootstrap script run once per context, *after* host callbacks (`__host_*`) and
 * the dayjs UMD are injected. It (1) assembles the `$helpers` / `console`
 * surface — capturing dayjs + the host callbacks **lexically** inside an IIFE so
 * the globals can be deleted while the closures keep working — and (2) hardens
 * the global object by removing dynamic-eval / metaprogramming / non-deterministic
 * intrinsics (spec §7.3). The isolate has no host realm, so this is
 * defense-in-depth on top of the structural V8 Isolate boundary.
 *
 * W13 (IMPORTANT — execution order): The `$helpers`/`console` closures MUST
 * capture their references (step 1) BEFORE the `delete globalThis.*` block
 * (step 2) runs. Reordering these two steps will break the closures and
 * may re-expose dangerous globals. Do not change the order without careful review.
 */
const BOOTSTRAP_SOURCE = `(() => {
  "use strict";
  const __dayjs = globalThis.dayjs;
  const __hash = globalThis.__host_hash;
  const __uuid = globalThis.__host_uuid;
  const __b64encode = globalThis.__host_b64encode;
  const __b64decode = globalThis.__host_b64decode;
  const __log = globalThis.__host_log;

  const fmt = (args) =>
    args
      .map((a) => {
        if (typeof a === 'string') return a;
        try {
          return JSON.stringify(a);
        } catch {
          return String(a);
        }
      })
      .join(' ');

  globalThis.$helpers = {
    date: (value) => __dayjs(value),
    crypto: {
      hash: (algorithm, data) => __hash(algorithm, data),
      uuid: () => __uuid(),
    },
    base64: {
      encode: (data) => __b64encode(data),
      decode: (data) => __b64decode(data),
    },
  };
  globalThis.console = {
    log: (...args) => __log('log', fmt(args)),
    warn: (...args) => __log('warn', fmt(args)),
    error: (...args) => __log('error', fmt(args)),
  };

  // Remove the injection scaffolding + dayjs from the global surface (the
  // closures above retain them lexically).
  delete globalThis.dayjs;
  delete globalThis.__host_hash;
  delete globalThis.__host_uuid;
  delete globalThis.__host_b64encode;
  delete globalThis.__host_b64decode;
  delete globalThis.__host_log;

  // Block dynamic code execution + metaprogramming + non-deterministic globals
  // (spec §7.3). Naive global access is removed; the reachable %Function%
  // intrinsic stays isolate-confined (no host realm to escape to).
  for (const key of [
    'eval',
    'Function',
    'Reflect',
    'Proxy',
    'Symbol',
    'WeakMap',
    'WeakSet',
    'WeakRef',
    'FinalizationRegistry',
    'Atomics',
    'SharedArrayBuffer',
    'Intl',
    'setTimeout',
    'setInterval',
    'setImmediate',
    'queueMicrotask',
    'globalThis',
  ]) {
    delete globalThis[key];
  }
})();`;

/**
 * Wrap user code so the IIFE resolves to a JSON string (or `undefined`). The
 * result is serialized *inside* the isolate via `JSON.stringify`, so:
 *   - only JSON-safe data crosses the boundary (`copy: true` never sees a live
 *     object such as a returned dayjs instance — it gets `toJSON`'d to a string);
 *   - `undefined` (no `return`) stays `undefined` (spec §5.1).
 *
 * W14: The wrapper prepends a 4-line header (async IIFE open + "use strict" +
 * inner async arrow open + the user code). Runtime error line numbers are
 * therefore offset by +4 relative to the user's source. Error messages from
 * isolated-vm include the raw line; callers/UIs should subtract 4 to show the
 * user their actual line number.
 */
function wrapUserCode(code: string): string {
  return `(async () => {
"use strict";
const __user = async () => {
${code}
};
const __result = await __user();
return __result === undefined ? undefined : JSON.stringify(__result);
})()`;
}

// Lazily-created isolate used ONLY for compile-time syntax checking in
// validate(). Compilation never executes user code, so a shared long-lived
// isolate is safe; JS is single-threaded so concurrent compiles serialize.
let syntaxIsolate: ivm.Isolate | undefined;
/**
 * Check user code for syntax errors by compiling it in a disposable
 * syntax-check isolate.
 *
 * @returns `undefined` when there are no errors; an error message string
 *   when the code has a syntax error.
 */
function syntaxCheck(wrappedCode: string): string | undefined {
  // W4/INFO#3 — re-create if disposed (e.g. after an OOM in a prior check).
  if (!syntaxIsolate || syntaxIsolate.isDisposed) {
    syntaxIsolate = new ivm.Isolate({ memoryLimit: 8 });
  }
  try {
    const script = syntaxIsolate.compileScriptSync(wrappedCode);
    script.release();
    return undefined;
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
}

export class CodeHandler implements NodeHandler {
  metadata = codeNodeMetadata;

  validate(config: Record<string, unknown>): ValidationResult {
    // Schema SSOT (warningRules + validateConfig) covers code-required +
    // timeout numeric range. The handler keeps a residual non-string code
    // guard for raw fixtures bypassing zod's `.default('')` narrowing.
    const errors = [...evaluateMetadataBlockingErrors(this.metadata, config)];
    if (config.code !== undefined && typeof config.code !== 'string') {
      errors.push('code is required and must be a string');
    }
    // CONVENTIONS Principle 3.1 — compile failure is a pre-flight error: the
    // user code never started executing, so it must surface as a validate-time
    // error (engine throws INVALID_NODE_CONFIG) rather than routing to the
    // runtime `error` port. Only run the syntax check when there is non-empty
    // user code present (other code-related errors above already cover
    // empty/missing/non-string cases).
    if (typeof config.code === 'string' && config.code.length > 0) {
      const syntaxError = syntaxCheck(wrapUserCode(config.code));
      if (syntaxError) {
        errors.push(`code has a syntax error: ${syntaxError}`);
      }
    }
    return { valid: errors.length === 0, errors };
  }

  async execute(
    input: unknown,
    config: Record<string, unknown>,
    context: ExecutionContext,
  ): Promise<NodeHandlerOutput> {
    const code = config.code as string;
    const timeoutSec =
      typeof config.timeout === 'number' ? config.timeout : DEFAULT_TIMEOUT_SEC;
    const timeoutMs = timeoutSec * 1000;

    const logs: string[] = [];
    const varsClone = deepClone(context.variables) ?? {};
    const rawConfigForEcho = context.rawConfig ?? config;

    const isolate = new ivm.Isolate({ memoryLimit: ISOLATE_MEMORY_LIMIT_MB });
    let runPromise: Promise<unknown> | undefined;
    let timeoutHandle: NodeJS.Timeout | undefined;
    try {
      const ctx = await isolate.createContext();
      const jail = ctx.global;

      // --- inject execution-context data (copied into the isolate heap) ------
      await jail.set('$input', new ivm.ExternalCopy(input).copyInto());
      await jail.set('$vars', new ivm.ExternalCopy(varsClone).copyInto());
      await jail.set(
        '$execution',
        new ivm.ExternalCopy({
          executionId: context.executionId,
          workflowId: context.workflowId,
        }).copyInto(),
      );
      await jail.set(
        '$node',
        new ivm.ExternalCopy({
          id: context.nodeId ?? '',
          label: context.nodeLabel ?? '',
        }).copyInto(),
      );

      // --- inject host-realm callbacks ($helpers internals + console) --------
      await jail.set(
        '__host_hash',
        new ivm.Callback((algorithm: unknown, data: unknown) =>
          hostHash(algorithm, data),
        ),
      );
      await jail.set('__host_uuid', new ivm.Callback(() => randomUUID()));
      await jail.set(
        '__host_b64encode',
        new ivm.Callback((data: unknown) =>
          Buffer.from(String(data), 'utf-8').toString('base64'),
        ),
      );
      await jail.set(
        '__host_b64decode',
        new ivm.Callback((data: unknown) =>
          Buffer.from(String(data), 'base64').toString('utf-8'),
        ),
      );
      await jail.set(
        '__host_log',
        new ivm.Callback((level: unknown, payload: unknown) => {
          if (logs.length < MAX_CONSOLE_LINES) {
            logs.push(`[${String(level)}] ${String(payload)}`);
          }
        }),
      );

      // --- load dayjs into the isolate, then assemble + harden the surface ---
      await (
        await isolate.compileScript(
          `${DAYJS_SOURCE}\n;globalThis.dayjs = dayjs;`,
        )
      ).run(ctx);
      await (await isolate.compileScript(BOOTSTRAP_SOURCE)).run(ctx);

      // --- compile user code (syntax error here = pre-flight invariant) ------
      let script: ivm.Script;
      try {
        script = await isolate.compileScript(wrapUserCode(code));
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        throw new Error(`code has a syntax error: ${message}`);
      }

      // --- run with dual timeout: isolate CPU timeout + host wall-clock race -
      runPromise = script.run(ctx, {
        promise: true,
        timeout: timeoutMs,
        copy: true,
      }) as Promise<unknown>;
      // Swallow a late rejection if the host race wins and we dispose the
      // isolate while the run is still pending (avoids unhandled rejection).
      runPromise.catch(() => undefined);

      const result = await Promise.race([
        runPromise,
        new Promise((_resolve, reject) => {
          timeoutHandle = setTimeout(() => {
            const e: CodeExecutionError = new Error('Code execution timed out');
            e.code = 'EXECUTION_TIMEOUT';
            reject(e);
          }, timeoutMs + 1000);
        }),
      ]);

      // --- success: sync $vars back (atomic full replace, spec §4.5) ---------
      try {
        context.variables =
          ((await jail.get('$vars', { copy: true })) as Record<
            string,
            unknown
          >) ?? {};
      } catch {
        // $vars copy-out failed (e.g. user assigned a non-serialisable value).
        // INFO#14/INFO#15: Restore the pre-execution snapshot (varsClone). This
        // is NOT a "mutated clone" — it is the original variables from before
        // execution started. Per spec §4.5 "원본 보존": keeping varsClone here
        // is equivalent to original preservation (read-back failed; variables
        // not updated).
        context.variables = varsClone;
      }

      // CONVENTIONS Principle 7 — config echoes raw `code` source + language
      // (the `code` field is widget:'code' but its content may include
      // `{{ ... }}` templates that the engine resolved before dispatch).
      return {
        config: {
          code: rawConfigForEcho.code,
          language: rawConfigForEcho.language ?? 'javascript',
          timeout: rawConfigForEcho.timeout,
        },
        output: result === undefined ? undefined : JSON.parse(result as string),
        meta: { success: true, logs },
        port: 'success',
      };
    } catch (error) {
      const err = error as CodeExecutionError;
      // Compile failures are screened in validate() (Principle 3.1). If one
      // slips through here, re-throw rather than masquerading as a runtime
      // error — keeps the contract single-meaning.
      if (
        typeof err?.message === 'string' &&
        err.message.startsWith('code has a syntax error:')
      ) {
        throw err;
      }
      const errorCode = classifyError(err, isolate);
      return this.failure(
        rawConfigForEcho,
        err,
        errorCode,
        logs,
        errorCode === 'EXECUTION_TIMEOUT'
          ? 'Code execution timed out'
          : undefined,
      );
    } finally {
      if (timeoutHandle) clearTimeout(timeoutHandle);
      if (!isolate.isDisposed) isolate.dispose();
    }
  }

  private failure(
    config: Readonly<Record<string, unknown>>,
    error: unknown,
    errorCode: string,
    logs: string[],
    overrideMessage?: string,
  ): NodeHandlerOutput {
    const message =
      overrideMessage ??
      (error instanceof Error ? error.message : String(error));
    const stack = error instanceof Error ? error.stack : undefined;
    // Stack traces expose internal file paths, library versions and the
    // sandboxed VM line numbers. Strip them from client-observable output
    // in production; keep them on `meta` for server-side debugging only
    // (log ingestion pipeline, not rendered by the run-results UI).
    const exposeStack = process.env.NODE_ENV !== 'production';
    // CONVENTIONS §3.2 — runtime failure routes to the `error` port with the
    // standardized envelope. Legacy `meta.error` / `meta.errorCode` /
    // `meta.stack` aliases were removed in Phase 1 (D); downstream consumers
    // read `output.error.{code, message, details.stack}` exclusively now.
    // W8: LEGACY_TO_NORMALIZED table replaces the triple-ternary chain —
    // one place to add new code mappings.
    const normalizedCode = LEGACY_TO_NORMALIZED[errorCode] ?? errorCode;
    const outputDetails: Record<string, unknown> = { legacyCode: errorCode };
    if (exposeStack && stack) outputDetails.stack = stack;
    // CONVENTIONS Principle 7 — error path echoes raw config (including
    // `code` body) just like the success path. No memory cap is applied
    // because `code` is bounded upstream by editor/UI.
    return {
      config: {
        code: config.code,
        language: config.language ?? 'javascript',
        timeout: config.timeout,
      },
      output: {
        error: {
          code: normalizedCode,
          message,
          details: outputDetails,
        },
      },
      meta: {
        success: false,
        logs,
      },
      port: 'error',
    };
  }
}

// Module-level compiled regexes (W8/INFO#9 — avoid per-call GC pressure).
const RE_TIMED_OUT = /timed out/i;
const RE_MEMORY_LIMIT = /memory limit/i;
const RE_ISOLATE_DISPOSED = /Isolate was disposed/i;

// Normalised mapping table for internal → public error codes (W8 — single place
// to add new codes; eliminates the triple-ternary chain in failure()).
const LEGACY_TO_NORMALIZED: Record<string, string> = {
  EXECUTION_TIMEOUT: 'CODE_TIMEOUT',
  EXECUTION_MEMORY_EXCEEDED: 'CODE_MEMORY_LIMIT',
  CODE_RUNTIME_ERROR: 'CODE_EXECUTION_FAILED',
};

/**
 * Map a thrown error from the isolate run onto an internal (legacy) error code.
 *
 * Classification priority (W2 — spoofing defence):
 *  1. `err.code === 'EXECUTION_TIMEOUT'` — host-side wall-clock timeout (trusted,
 *     set by the handler itself, never by user code).
 *  2. `isolate.isDisposed === true` — the V8 Isolate was hard-killed by
 *     isolated-vm (memory OOM or equivalent). User code cannot set this flag
 *     without actually disposing the isolate, so `throw new Error("Isolate was
 *     disposed")` does NOT trigger this branch — the isolate stays alive.
 *  3. Message regex patterns — fallback only, lower trust.
 */
export function classifyError(
  err: CodeExecutionError,
  isolate?: ivm.Isolate,
): string {
  // Priority 1: trusted host-set code (wall-clock timeout).
  if (err?.code === 'EXECUTION_TIMEOUT') return 'EXECUTION_TIMEOUT';
  // Priority 2: isolate was hard-disposed by isolated-vm (memory limit breach).
  // isDisposed is a native flag; user code cannot spoof it.
  if (isolate?.isDisposed) return 'EXECUTION_MEMORY_EXCEEDED';
  // Priority 3: message pattern — fallback.
  const message = typeof err?.message === 'string' ? err.message : '';
  if (RE_TIMED_OUT.test(message)) return 'EXECUTION_TIMEOUT';
  if (RE_MEMORY_LIMIT.test(message) || RE_ISOLATE_DISPOSED.test(message)) {
    return 'EXECUTION_MEMORY_EXCEEDED';
  }
  return 'CODE_RUNTIME_ERROR';
}
