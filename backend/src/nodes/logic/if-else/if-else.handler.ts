import {
  NodeHandler,
  ValidationResult,
  ExecutionContext,
} from '../../core/node-handler.interface.js';
import {
  CONDITION_OPERATORS,
  Condition,
  evaluateCondition,
} from '../../core/condition-evaluator.util.js';

interface IfElseConfig {
  conditions: Condition[];
  combineMode: 'and' | 'or';
  strictComparison?: boolean;
}

export class IfElseHandler implements NodeHandler {
  validate(config: Record<string, unknown>): ValidationResult {
    const errors: string[] = [];
    const { conditions, combineMode, strictComparison } =
      config as unknown as IfElseConfig;

    if (!conditions || !Array.isArray(conditions)) {
      errors.push('conditions must be a non-empty array');
    } else {
      if (conditions.length === 0) {
        errors.push('conditions must be a non-empty array');
      }
      for (let i = 0; i < conditions.length; i++) {
        const cond = conditions[i];
        if (!cond.field || typeof cond.field !== 'string') {
          errors.push(
            `conditions[${i}].field is required and must be a string`,
          );
        }
        if (!cond.operator || !CONDITION_OPERATORS.includes(cond.operator)) {
          errors.push(
            `conditions[${i}].operator must be one of: ${CONDITION_OPERATORS.join(', ')}`,
          );
        }
      }
    }

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
