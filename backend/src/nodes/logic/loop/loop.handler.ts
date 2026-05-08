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
    // CONVENTIONS Principle 7 — config echoes raw count / maxIterations
    // (`{{ ... }}` templates preserved). `output: null` stays so the engine
    // overrides with iteration results (Principle 9 — container contract).
    // Numeric resolution + range validation lives in `validate()` and the
    // engine's iteration bound logic (which reads `node.config` directly,
    // not `outputData.config`); the handler does not need to re-parse here.
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
