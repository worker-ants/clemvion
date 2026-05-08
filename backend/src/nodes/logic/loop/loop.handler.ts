import {
  NodeHandler,
  ValidationResult,
  ExecutionContext,
} from '../../core/node-handler.interface.js';
import { evaluateMetadataBlockingErrors } from '../../core/metadata-validation.js';
import { loopNodeMetadata } from './loop.schema.js';

interface LoopConfig {
  count: number | string;
  maxIterations?: number | string;
}

const DEFAULT_MAX_ITERATIONS = 1000;

/**
 * Parse a numeric config value that may arrive as a raw number, a plain
 * numeric string (the UI commonly stores number inputs as strings), or an
 * unresolved expression like `{{ $input.count }}`. Returns null when the
 * value is a literal that clearly isn't a number, so validate can surface
 * the mismatch; unresolved expressions return null at validate time but are
 * resolved at execute time by the expression resolver.
 */
function parseNumeric(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed === '') return null;
    // Expression placeholders are resolved upstream — accept them without
    // validating the numeric shape.
    if (/\{\{.*\}\}/.test(trimmed)) return null;
    const n = Number(trimmed);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

export class LoopHandler implements NodeHandler {
  metadata = loopNodeMetadata;

  validate(config: Record<string, unknown>): ValidationResult {
    // Schema SSOT (warningRules + validateConfig) covers count-required +
    // numeric parse + count-vs-maxIterations cross-field rule.
    const errors = evaluateMetadataBlockingErrors(this.metadata, config);
    return { valid: errors.length === 0, errors };
  }

  execute(
    _input: unknown,
    config: Record<string, unknown>,
    context: ExecutionContext,
  ): Promise<unknown> {
    // parseNumeric is still invoked for its side-effect of validating the
    // resolved values — engine's iteration bounds come from its own read of
    // `node.config` (verified: `outputData.config` is never read back).
    const { count, maxIterations } = config as unknown as LoopConfig;
    void parseNumeric(count);
    void (maxIterations !== undefined ? parseNumeric(maxIterations) : null);

    // CONVENTIONS Principle 7 — config echoes raw count / maxIterations
    // (`{{ ... }}` templates preserved). `output: null` stays so the engine
    // overrides with iteration results (Principle 9 — container contract).
    const rawConfig = (context.rawConfig ?? config) as unknown as LoopConfig;
    return Promise.resolve({
      config: {
        count: rawConfig.count,
        maxIterations: rawConfig.maxIterations ?? DEFAULT_MAX_ITERATIONS,
      },
      output: null,
    });
  }
}
