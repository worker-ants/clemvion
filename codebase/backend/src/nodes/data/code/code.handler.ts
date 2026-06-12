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
import { ErrorCode, type ErrorCodeValue } from '../../core/error-codes.js';
import { codeNodeMetadata, DEFAULT_TIMEOUT_SEC } from './code.schema.js';

const MAX_CONSOLE_LINES = 100;

// Isolate memory hard limit (spec §7.2). Default 128MB, operator-tunable via the
// `CODE_NODE_MEMORY_LIMIT_MB` env var, clamped to a 512MB safety ceiling so a
// single execution cannot monopolise host memory.
const DEFAULT_MEMORY_LIMIT_MB = 128;
const MAX_MEMORY_LIMIT_MB = 512;

/**
 * Resolve the isolate memory limit (MB) from `CODE_NODE_MEMORY_LIMIT_MB`
 * (spec §7.2). Falls back to {@link DEFAULT_MEMORY_LIMIT_MB} when unset or
 * invalid (non-numeric / ≤ 0), and clamps to {@link MAX_MEMORY_LIMIT_MB}.
 * Integer values only — decimal inputs are truncated (e.g. `"256.9"` → 256).
 * A console.warn is emitted when the env var is set but invalid or clamped.
 *
 * @internal Exported only for unit testing (code.handler.spec.ts).
 */
export function resolveMemoryLimitMb(): number {
  const raw = process.env.CODE_NODE_MEMORY_LIMIT_MB;
  if (raw === undefined || raw.trim() === '') return DEFAULT_MEMORY_LIMIT_MB;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    console.warn(
      `[CodeHandler] CODE_NODE_MEMORY_LIMIT_MB="${raw}" is invalid (non-numeric or ≤ 0) — falling back to ${DEFAULT_MEMORY_LIMIT_MB} MB`,
    );
    return DEFAULT_MEMORY_LIMIT_MB;
  }
  if (parsed > MAX_MEMORY_LIMIT_MB) {
    console.warn(
      `[CodeHandler] CODE_NODE_MEMORY_LIMIT_MB=${parsed} exceeds the ${MAX_MEMORY_LIMIT_MB} MB safety ceiling — clamped to ${MAX_MEMORY_LIMIT_MB} MB`,
    );
    return MAX_MEMORY_LIMIT_MB;
  }
  return parsed;
}

// Resolved once at module load (matches isolate-lifetime semantics; env is read
// at process start). Tests exercise resolveMemoryLimitMb() directly.
const ISOLATE_MEMORY_LIMIT_MB = resolveMemoryLimitMb();

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

// Script that loads the dayjs UMD onto the isolate global. In a bare isolate
// global there is no `module`/`exports`/`define`, so the UMD falls through to
// the global branch; the trailing assignment pins it on `globalThis.dayjs`.
// Used both as the snapshot bootstrap script (input to DAYJS_SNAPSHOT below)
// and as the per-exec legacy compile fallback when createSnapshot is unavailable.
const DAYJS_LOAD_SCRIPT = `${DAYJS_SOURCE}\n;globalThis.dayjs = dayjs;`;

// Heap snapshot containing the compiled + executed dayjs UMD on the isolate
// global, built once at module load. Each per-exec isolate is then created
// *from* this snapshot (`new ivm.Isolate({ snapshot })`), so dayjs is restored
// from the serialized heap instead of being re-parsed/re-compiled every run —
// the dominant fixed cost under concurrent execution (perf follow-up).
//
// Only pure JS goes in the snapshot: `createSnapshot` runs the scripts in a
// bare isolate with NO host bindings, so the host callbacks (`__host_*`, which
// capture per-exec state such as the `logs` array) and the §7.3 dangerous-global
// hardening CANNOT live here — they stay in the per-exec BOOTSTRAP_SOURCE,
// preserving the W13 capture-then-delete ordering exactly. Each exec still gets
// a fresh isolate (memory-isolation + disposal invariant) and a fresh context
// whose global is re-initialized from the immutable snapshot, so no execution
// state is ever captured across runs.
//
// If `createSnapshot` is unavailable/fails on a platform, this stays `undefined`
// and execute() transparently falls back to compiling DAYJS_LOAD_SCRIPT per-run.
//
// COST: This IIFE runs synchronously at module import — `createSnapshot` compiles
// + executes dayjs in a throwaway isolate and serializes the heap (~4 ms one-time,
// measured locally). It is a single fixed cost paid on first import (server cold
// start / Jest suite load), traded for removing the per-exec dayjs recompile; it
// does not affect steady-state request latency.
//
// NOTE: The snapshot ArrayBuffer lives for the lifetime of the Node.js process;
// it is not GC'd between requests (process-scoped memory cost, ~few hundred KB).
const DAYJS_SNAPSHOT: ivm.ExternalCopy<ArrayBuffer> | undefined = (() => {
  try {
    return ivm.Isolate.createSnapshot([
      { code: DAYJS_LOAD_SCRIPT, filename: 'dayjs.js' },
    ]);
  } catch (err) {
    console.warn(
      '[CodeHandler] dayjs snapshot 생성 실패 — per-exec 컴파일 fallback 사용:',
      err,
    );
    return undefined;
  }
})();

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
 * Host-realm `$helpers.base64.encode`. Like {@link hostHash}, the type guard
 * throws here and the message propagates to the user code's `error` port
 * (spec §2.2 — `$helpers` 입력 타입 계약). Aligns base64 with hash: a non-string
 * argument is a `TypeError`, not a silent `String(data)` coercion that would
 * hide a type bug.
 */
function hostB64Encode(data: unknown): string {
  if (typeof data !== 'string') {
    throw new TypeError(
      `$helpers.base64.encode: data must be a string, got ${typeof data}`,
    );
  }
  return Buffer.from(data, 'utf-8').toString('base64');
}

/**
 * Host-realm `$helpers.base64.decode`. Non-string input throws a `TypeError`
 * (spec §2.2). Note: an *invalid base64 string* (the argument IS a string) is
 * NOT a type error — `Buffer.from` decodes best-effort and returns a string
 * without throwing, per spec §2.2.
 */
function hostB64Decode(data: unknown): string {
  if (typeof data !== 'string') {
    throw new TypeError(
      `$helpers.base64.decode: data must be a string, got ${typeof data}`,
    );
  }
  return Buffer.from(data, 'base64').toString('utf-8');
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
 * W14: The wrapper prepends a 3-line header (async IIFE open + "use strict" +
 * inner async arrow open) before the user code, which starts on line 4. Runtime
 * error line numbers are therefore offset by +3 relative to the user's source.
 * Error messages from isolated-vm include the raw line; callers/UIs should
 * subtract 3 to show the user their actual line number. (Matches
 * spec/4-nodes/5-data/2-code.md §4 step2 "런타임 에러 라인 오프셋 +3".)
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

// Module-level compiled regexes (W8/INFO#9 — avoid per-call GC pressure).
const RE_TIMED_OUT = /timed out/i;
const RE_MEMORY_LIMIT = /memory limit/i;
const RE_ISOLATE_DISPOSED = /Isolate was disposed/i;

// Internal (legacy) error codes produced by classifyCodeNodeError. Kept as a
// narrow union so LEGACY_TO_NORMALIZED below is an *exhaustive* Record over it —
// adding a new internal code without a public mapping becomes a compile error.
type CodeNodeInternalErrorCode =
  | 'EXECUTION_TIMEOUT'
  | 'EXECUTION_MEMORY_EXCEEDED'
  | 'CODE_RUNTIME_ERROR';

// Normalised mapping table for internal (legacy) → public error codes (W8 —
// single place to add new codes; eliminates the triple-ternary chain in
// failure()). Frozen at module load so a stray mutation can't reroute public
// codes; the exhaustive `Record<CodeNodeInternalErrorCode, ErrorCodeValue>`
// forces every internal code to map to a real `ErrorCode` member at compile time.
const LEGACY_TO_NORMALIZED: Readonly<
  Record<CodeNodeInternalErrorCode, ErrorCodeValue>
> = Object.freeze({
  EXECUTION_TIMEOUT: ErrorCode.CODE_TIMEOUT,
  EXECUTION_MEMORY_EXCEEDED: ErrorCode.CODE_MEMORY_LIMIT,
  CODE_RUNTIME_ERROR: ErrorCode.CODE_EXECUTION_FAILED,
});

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
 *
 * @internal Exported only for unit testing (code.handler.spec.ts). The name is
 * intentionally Code-node-specific to avoid grep collisions with the unrelated
 * private `classifyError` methods on the cafe24/makeshop MCP tool providers.
 */
export function classifyCodeNodeError(
  err: CodeExecutionError,
  isolate?: ivm.Isolate,
): CodeNodeInternalErrorCode {
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

    // Create from the prebuilt dayjs snapshot when available (skips the per-exec
    // dayjs compile inside _buildIsolateContext); otherwise a bare isolate.
    const isolateOptions: ConstructorParameters<typeof ivm.Isolate>[0] = {
      memoryLimit: ISOLATE_MEMORY_LIMIT_MB,
    };
    if (DAYJS_SNAPSHOT) isolateOptions.snapshot = DAYJS_SNAPSHOT;
    const isolate = new ivm.Isolate(isolateOptions);
    try {
      // Build the isolate context: inject execution-context data + host
      // callbacks, restore/compile dayjs, then run the §7.3 hardening bootstrap.
      const ctx = await this._buildIsolateContext(
        isolate,
        input,
        varsClone,
        context,
        logs,
      );

      // --- compile user code (syntax error here = pre-flight invariant) ------
      let script: ivm.Script;
      try {
        script = await isolate.compileScript(wrapUserCode(code));
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        throw new Error(`code has a syntax error: ${message}`);
      }

      // --- run with dual timeout: isolate CPU timeout + host wall-clock race -
      const result = await this._runWithTimeout(script, ctx, timeoutMs);

      // --- success: sync $vars back (atomic full replace, spec §4.5) ---------
      try {
        context.variables =
          ((await ctx.global.get('$vars', { copy: true })) as Record<
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
      const errorCode = classifyCodeNodeError(err, isolate);
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
      if (!isolate.isDisposed) isolate.dispose();
    }
  }

  /**
   * Build a fresh isolate context for one execution: inject the execution-context
   * data ($input/$vars/$execution/$node, copied into the isolate heap) + the
   * host-realm callbacks ($helpers internals + console), restore dayjs (from the
   * snapshot, or compile per-run on the fallback path), then run BOOTSTRAP_SOURCE
   * which assembles $helpers/console and applies the §7.3 global hardening.
   *
   * W13 (IMPORTANT — execution order): host callbacks MUST be injected here BEFORE
   * BOOTSTRAP_SOURCE runs — the IIFE lexically captures them and then deletes the
   * globals. Reordering breaks the closures and may re-expose dangerous globals.
   */
  private async _buildIsolateContext(
    isolate: ivm.Isolate,
    input: unknown,
    varsClone: Record<string, unknown>,
    context: ExecutionContext,
    logs: string[],
  ): Promise<ivm.Context> {
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
      new ivm.Callback((data: unknown) => hostB64Encode(data)),
    );
    await jail.set(
      '__host_b64decode',
      new ivm.Callback((data: unknown) => hostB64Decode(data)),
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
    // With a snapshot, dayjs is already on the global (restored from the
    // serialized heap) — only the legacy/fallback path compiles it per-run.
    if (!DAYJS_SNAPSHOT) {
      await (await isolate.compileScript(DAYJS_LOAD_SCRIPT)).run(ctx);
    }
    // BOOTSTRAP_SOURCE is re-compiled per exec — ivm.Script is bound to the
    // isolate it was compiled in and cannot be shared cross-isolate; since each
    // exec uses a fresh isolate (memory-isolation invariant), module-level
    // pre-compilation is not possible. BOOTSTRAP_SOURCE is ~70 LoC; re-compile
    // cost is negligible compared to the dayjs UMD (now eliminated via snapshot).
    await (await isolate.compileScript(BOOTSTRAP_SOURCE)).run(ctx);

    return ctx;
  }

  /**
   * Run the compiled user script with the dual timeout (spec §7.2): the isolate
   * CPU timeout option + a host wall-clock `Promise.race` guarding async hangs.
   * The wall-clock timer is always cleared before returning/throwing.
   */
  private async _runWithTimeout(
    script: ivm.Script,
    ctx: ivm.Context,
    timeoutMs: number,
  ): Promise<unknown> {
    const runPromise = script.run(ctx, {
      promise: true,
      timeout: timeoutMs,
      copy: true,
    }) as Promise<unknown>;
    // Swallow a late rejection if the host race wins and the isolate is disposed
    // while the run is still pending (avoids an unhandled rejection).
    runPromise.catch(() => undefined);

    let timeoutHandle: NodeJS.Timeout | undefined;
    try {
      return await Promise.race([
        runPromise,
        new Promise((_resolve, reject) => {
          timeoutHandle = setTimeout(() => {
            const e: CodeExecutionError = new Error('Code execution timed out');
            e.code = 'EXECUTION_TIMEOUT';
            reject(e);
          }, timeoutMs + 1000);
        }),
      ]);
    } finally {
      if (timeoutHandle) clearTimeout(timeoutHandle);
    }
  }

  private failure(
    config: Readonly<Record<string, unknown>>,
    error: unknown,
    errorCode: CodeNodeInternalErrorCode,
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
    // The exhaustive Record makes this lookup total at compile time; the
    // `?? CODE_EXECUTION_FAILED` is runtime belt-and-suspenders so an unmapped
    // internal code can never leak through to the public `output.error.code`
    // even if the union is bypassed (e.g. an `as any` cast upstream).
    const normalizedCode =
      LEGACY_TO_NORMALIZED[errorCode] ?? ErrorCode.CODE_EXECUTION_FAILED;
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
