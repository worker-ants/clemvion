import {
  NodeHandler,
  ValidationResult,
  ExecutionContext,
} from '../node-handler.interface.js';
import { resolveFieldValue } from './nested-value.util.js';
import {
  Condition,
  VALID_OPERATORS,
  VALID_OPERATORS_STR,
  compileRegexCache,
  evaluateCondition,
} from './condition-eval.util.js';

interface FilterConfig {
  // Either a dot-path string applied to `$input` (e.g. `"items"`) OR the
  // resolved value itself when an inline expression like `{{ $var.a }}` is used.
  inputField: unknown;
  conditions: Condition[];
  combineMode: 'and' | 'or';
  strictComparison?: boolean;
}

export class FilterHandler implements NodeHandler {
  validate(config: Record<string, unknown>): ValidationResult {
    const errors: string[] = [];
    const { inputField, conditions, combineMode } =
      config as unknown as FilterConfig;

    if (inputField === undefined || inputField === null || inputField === '') {
      errors.push('inputField is required');
    }

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
        if (
          !cond.operator ||
          !(VALID_OPERATORS as readonly string[]).includes(cond.operator)
        ) {
          errors.push(
            `conditions[${i}].operator must be one of: ${VALID_OPERATORS_STR}`,
          );
        }
      }
    }

    if (combineMode && combineMode !== 'and' && combineMode !== 'or') {
      errors.push('combineMode must be "and" or "or"');
    }

    return { valid: errors.length === 0, errors };
  }

  execute(
    input: unknown,
    config: Record<string, unknown>,
    _context: ExecutionContext,
  ): Promise<unknown> {
    const {
      inputField,
      conditions,
      combineMode = 'and',
      strictComparison = false,
    } = config as unknown as FilterConfig;

    const array = resolveFieldValue(input, inputField);

    if (!Array.isArray(array)) {
      throw new Error('Filter inputField does not resolve to an array');
    }

    const compiledRegexes = compileRegexCache(conditions);

    const match: unknown[] = [];
    const unmatched: unknown[] = [];

    for (const item of array) {
      const passed =
        combineMode === 'or'
          ? conditions.some((cond, i) =>
              evaluateCondition(
                item,
                cond,
                strictComparison,
                compiledRegexes.get(i),
              ),
            )
          : conditions.every((cond, i) =>
              evaluateCondition(
                item,
                cond,
                strictComparison,
                compiledRegexes.get(i),
              ),
            );

      if (passed) {
        match.push(item);
      } else {
        unmatched.push(item);
      }
    }

    return Promise.resolve({
      config: { inputField, conditions, combineMode, strictComparison },
      output: { match, unmatched },
    });
  }
}
