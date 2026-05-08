import vm from 'node:vm';
import {
  ExecutionContext,
  NodeHandler,
  ValidationResult,
} from '../../core/node-handler.interface.js';
import { evaluateMetadataBlockingErrors } from '../../core/metadata-validation.js';
import { codeNodeMetadata } from './code.schema.js';

const DEFAULT_TIMEOUT_SEC = 30;
const MAX_CONSOLE_LINES = 100;

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
  };
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
    return { valid: errors.length === 0, errors };
  }

  async execute(
    input: unknown,
    config: Record<string, unknown>,
    context: ExecutionContext,
  ): Promise<unknown> {
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
      logs,
    );

    const ctx = vm.createContext(sandbox, {
      codeGeneration: { strings: false, wasm: false },
    });

    const wrapped = `(async () => {\n"use strict";\n${code}\n})()`;

    let script: vm.Script;
    try {
      script = new vm.Script(wrapped, { filename: 'code-node.js' });
    } catch (error) {
      return this.failure(config, error, 'CODE_SYNTAX_ERROR', logs);
    }

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
          config,
          err,
          'EXECUTION_TIMEOUT',
          logs,
          'Code execution timed out',
        );
      }
      return this.failure(config, err, 'CODE_RUNTIME_ERROR', logs);
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
      const rawConfig = context.rawConfig ?? config;
      return {
        config: {
          code: rawConfig.code,
          language: rawConfig.language ?? 'javascript',
          timeout: rawConfig.timeout,
        },
        output: result,
        meta: { success: true, logs },
      };
    } catch (error) {
      const err = error as CodeExecutionError;
      const isTimeout =
        err?.code === 'EXECUTION_TIMEOUT' ||
        err?.code === 'ERR_SCRIPT_EXECUTION_TIMEOUT';
      return this.failure(
        config,
        err,
        isTimeout ? 'EXECUTION_TIMEOUT' : 'CODE_RUNTIME_ERROR',
        logs,
      );
    } finally {
      if (timeoutHandle) clearTimeout(timeoutHandle);
    }
  }

  private failure(
    config: Record<string, unknown>,
    error: unknown,
    errorCode: string,
    logs: string[],
    overrideMessage?: string,
  ): unknown {
    const message =
      overrideMessage ??
      (error instanceof Error ? error.message : String(error));
    const stack = error instanceof Error ? error.stack : undefined;
    // Stack traces expose internal file paths, library versions and the
    // sandboxed VM line numbers. Strip them from client-observable output
    // in production; keep them on `meta` for server-side debugging only
    // (log ingestion pipeline, not rendered by the run-results UI).
    const exposeStack = process.env.NODE_ENV !== 'production';
    // CONVENTIONS §3.2 — runtime failure routes to the `error` port with a
    // standardized envelope. `meta.success` / `meta.error` / `meta.errorCode`
    // are retained for the run-results "Logs" tab (pre-Stage-7 convention);
    // downstream consumers should prefer `output.error.code` going forward.
    // The two coexist intentionally for one release so observability
    // dashboards keying on `meta.errorCode` keep working.
    const normalizedCode =
      errorCode === 'EXECUTION_TIMEOUT'
        ? 'CODE_TIMEOUT'
        : errorCode === 'CODE_RUNTIME_ERROR' ||
            errorCode === 'CODE_SYNTAX_ERROR'
          ? 'CODE_EXECUTION_FAILED'
          : errorCode;
    const outputDetails: Record<string, unknown> = { legacyCode: errorCode };
    if (exposeStack && stack) outputDetails.stack = stack;
    return {
      config: { language: config.language ?? 'javascript' },
      output: {
        error: {
          code: normalizedCode,
          message,
          details: outputDetails,
        },
      },
      meta: {
        success: false,
        error: message,
        errorCode,
        ...(stack ? { stack } : {}),
        logs,
      },
      port: 'error',
    };
  }
}
