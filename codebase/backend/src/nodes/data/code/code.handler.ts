import vm from 'node:vm';
import { createHash, randomUUID } from 'node:crypto';
import dayjs from 'dayjs';
import {
  ExecutionContext,
  NodeHandler,
  NodeHandlerOutput,
  ValidationResult,
} from '../../core/node-handler.interface.js';
import { evaluateMetadataBlockingErrors } from '../../core/metadata-validation.js';
import { codeNodeMetadata, DEFAULT_TIMEOUT_SEC } from './code.schema.js';
const MAX_CONSOLE_LINES = 100;

// Allowlist for $helpers.crypto.hash — guards against OpenSSL internal error
// messages leaking through on unsupported algorithm strings (spec §2.2).
const ALLOWED_HASH_ALGORITHMS = new Set([
  'sha256',
  'sha384',
  'sha512',
  'sha1',
  'md5',
]);

/** Typed surface of the $helpers object injected into the sandbox (spec §2.2). */
interface HelpersApi {
  date: (value?: unknown) => ReturnType<typeof dayjs>;
  crypto: {
    hash: (algorithm: string, data: string) => string;
    uuid: () => string;
  };
  base64: {
    encode: (data: string) => string;
    /** NOTE: silent-failure on invalid Base64 / non-UTF-8 input (returns string with replacement chars). */
    decode: (data: string) => string;
  };
}

/**
 * `$helpers` — built-in utilities injected into the sandbox (spec §2.2). The
 * functions execute in the HOST realm (closures defined here), so they may use
 * `Buffer` / `node:crypto` / `dayjs` even though those globals are *not* exposed
 * inside the sandboxed vm context. Sandbox code only ever holds references to
 * these closures, never the underlying host globals.
 */
function buildHelpers(): HelpersApi {
  return {
    date: (value?: unknown) => dayjs(value as dayjs.ConfigType),
    crypto: {
      hash: (algorithm: string, data: string): string => {
        if (!ALLOWED_HASH_ALGORITHMS.has(algorithm)) {
          throw new Error(
            `Unsupported hash algorithm: "${algorithm}". Allowed: ${[...ALLOWED_HASH_ALGORITHMS].join(', ')}`,
          );
        }
        if (typeof data !== 'string') {
          throw new TypeError(
            `$helpers.crypto.hash: data must be a string, got ${typeof data}`,
          );
        }
        return createHash(algorithm).update(data).digest('hex');
      },
      uuid: (): string => randomUUID(),
    },
    base64: {
      encode: (data: string): string =>
        Buffer.from(String(data), 'utf-8').toString('base64'),
      decode: (data: string): string =>
        Buffer.from(String(data), 'base64').toString('utf-8'),
    },
  };
}

interface CodeExecutionError extends Error {
  code?: string;
}

function deepClone<T>(value: T): T {
  if (value === undefined || value === null) return value;
  return JSON.parse(JSON.stringify(value)) as T;
}

function formatLog(level: string, args: unknown[]): string {
  const parts = args.map((a) => {
    if (typeof a === 'string') return a;
    try {
      return JSON.stringify(a);
    } catch {
      return String(a);
    }
  });
  return `[${level}] ${parts.join(' ')}`;
}

function buildSandbox(
  input: unknown,
  vars: Record<string, unknown>,
  execMeta: { executionId: string; workflowId: string },
  nodeMeta: { id: string; label: string },
  logs: string[],
): Record<string, unknown> {
  const pushLog = (level: string, args: unknown[]): void => {
    if (logs.length < MAX_CONSOLE_LINES) {
      logs.push(formatLog(level, args));
    }
  };

  return {
    $input: input,
    $vars: vars,
    $execution: execMeta,
    $node: nodeMeta,
    $helpers: buildHelpers(),
    console: {
      log: (...args: unknown[]) => pushLog('log', args),
      warn: (...args: unknown[]) => pushLog('warn', args),
      error: (...args: unknown[]) => pushLog('error', args),
    },
    JSON,
    Math,
    Array,
    Object,
    String,
    Number,
    Boolean,
    Date,
    RegExp,
    Map,
    Set,
    Promise,
    Error,
    TypeError,
    RangeError,
    SyntaxError,
    parseInt,
    parseFloat,
    isNaN,
    isFinite,
    encodeURIComponent,
    decodeURIComponent,
    Reflect: undefined,
    Proxy: undefined,
    globalThis: undefined,
    Symbol: undefined,
    WeakMap: undefined,
    WeakSet: undefined,
    WeakRef: undefined,
    FinalizationRegistry: undefined,
    Atomics: undefined,
    SharedArrayBuffer: undefined,
    Intl: undefined,
    // Explicit shadowing (spec §7.3) — non-deterministic scheduling is blocked.
    // vm contexts already omit these, but shadowing makes the contract explicit
    // and keeps the Promise.race timeout flow the single source of async bounds.
    setTimeout: undefined,
    setInterval: undefined,
    setImmediate: undefined,
  };
}

function wrapUserCode(code: string): string {
  return `(async () => {\n"use strict";\n${code}\n})()`;
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
    // CONVENTIONS Principle 3.1 — vm.Script compile failure is a pre-flight
    // error: the user code never started executing, so it must surface as a
    // validate-time error (engine throws INVALID_NODE_CONFIG) rather than
    // routing to the runtime `error` port. Only run the syntax check when
    // there is non-empty user code present (other code-related errors above
    // already cover empty/missing/non-string cases).
    if (typeof config.code === 'string' && config.code.length > 0) {
      try {
        new vm.Script(wrapUserCode(config.code), { filename: 'code-node.js' });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        errors.push(`code has a syntax error: ${message}`);
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
    const sandbox = buildSandbox(
      input,
      varsClone,
      { executionId: context.executionId, workflowId: context.workflowId },
      { id: context.nodeId ?? '', label: context.nodeLabel ?? '' },
      logs,
    );

    const ctx = vm.createContext(sandbox, {
      codeGeneration: { strings: false, wasm: false },
    });

    // Compile errors are screened in validate() (pre-flight throw, Principle
    // 3.1). If they slip through (handler invoked outside the engine path),
    // re-throw rather than masquerading as a runtime error — keeps the
    // contract single-meaning.
    let script: vm.Script;
    try {
      script = new vm.Script(wrapUserCode(code), { filename: 'code-node.js' });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`code has a syntax error: ${message}`);
    }

    const rawConfigForEcho = context.rawConfig ?? config;

    let runPromise: Promise<unknown>;
    try {
      runPromise = script.runInContext(ctx, {
        timeout: timeoutMs,
        breakOnSigint: true,
      }) as Promise<unknown>;
    } catch (error) {
      const err = error as CodeExecutionError;
      if (err?.code === 'ERR_SCRIPT_EXECUTION_TIMEOUT') {
        return this.failure(
          rawConfigForEcho,
          err,
          'EXECUTION_TIMEOUT',
          logs,
          'Code execution timed out',
        );
      }
      return this.failure(rawConfigForEcho, err, 'CODE_RUNTIME_ERROR', logs);
    }

    let timeoutHandle: NodeJS.Timeout | undefined;
    try {
      const result = await Promise.race([
        runPromise,
        new Promise((_resolve, reject) => {
          timeoutHandle = setTimeout(() => {
            const e: CodeExecutionError = new Error('Code execution timed out');
            e.code = 'EXECUTION_TIMEOUT';
            reject(e);
          }, timeoutMs);
        }),
      ]);

      context.variables = varsClone;

      // CONVENTIONS Principle 7 — config echoes raw `code` source + language
      // (the `code` field is widget:'code' but its content may include
      // `{{ ... }}` templates that the engine resolved before dispatch).
      return {
        config: {
          code: rawConfigForEcho.code,
          language: rawConfigForEcho.language ?? 'javascript',
          timeout: rawConfigForEcho.timeout,
        },
        output: result,
        meta: { success: true, logs },
        port: 'success',
      };
    } catch (error) {
      const err = error as CodeExecutionError;
      const isTimeout =
        err?.code === 'EXECUTION_TIMEOUT' ||
        err?.code === 'ERR_SCRIPT_EXECUTION_TIMEOUT';
      return this.failure(
        rawConfigForEcho,
        err,
        isTimeout ? 'EXECUTION_TIMEOUT' : 'CODE_RUNTIME_ERROR',
        logs,
      );
    } finally {
      if (timeoutHandle) clearTimeout(timeoutHandle);
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
    const normalizedCode =
      errorCode === 'EXECUTION_TIMEOUT'
        ? 'CODE_TIMEOUT'
        : errorCode === 'CODE_RUNTIME_ERROR'
          ? 'CODE_EXECUTION_FAILED'
          : errorCode;
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
