import {
  NodeHandler,
  ValidationResult,
  ExecutionContext,
} from '../../core/node-handler.interface.js';
import { evaluateMetadataBlockingErrors } from '../../core/metadata-validation.js';
import {
  Condition,
  evaluateCondition,
} from '../../core/condition-evaluator.util.js';
import { ifElseMetadata } from './if-else.schema.js';

interface IfElseConfig {
  conditions: Condition[];
  combineMode: 'and' | 'or';
  strictComparison?: boolean;
}

export class IfElseHandler implements NodeHandler {
  metadata = ifElseMetadata;

  validate(config: Record<string, unknown>): ValidationResult {
    // Schema SSOT (warningRules + validateConfig) covers conditions empty,
    // first-condition.field, per-condition field+operator.
    const errors = [...evaluateMetadataBlockingErrors(this.metadata, config)];
    const { combineMode, strictComparison } = config as unknown as IfElseConfig;
    if (combineMode && combineMode !== 'and' && combineMode !== 'or') {
      errors.push('combineMode must be "and" or "or"');
    }
    if (
      strictComparison !== undefined &&
      typeof strictComparison !== 'boolean'
    ) {
      errors.push('strictComparison must be a boolean');
    }
    return { valid: errors.length === 0, errors };
  }

  execute(
    input: unknown,
    config: Record<string, unknown>,
    _context: ExecutionContext,
  ): Promise<unknown> {
    const {
      conditions,
      combineMode = 'and',
      strictComparison,
    } = config as unknown as IfElseConfig;

    const options = { strict: strictComparison === true };
    const results = conditions.map((cond) =>
      evaluateCondition(input, cond, options),
    );

    const passed =
      combineMode === 'and' ? results.every(Boolean) : results.some(Boolean);

    return Promise.resolve({
      config: { conditions, combineMode },
      output: input,
      port: passed ? 'true' : 'false',
    });
  }
}
