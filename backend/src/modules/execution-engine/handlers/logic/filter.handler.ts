import {
  NodeHandler,
  ValidationResult,
  ExecutionContext,
} from '../node-handler.interface.js';
import { getNestedValue } from './nested-value.util.js';

interface FilterCondition {
  field: string;
  operator: (typeof VALID_OPERATORS)[number];
  value: unknown;
}

interface FilterConfig {
  inputField: string;
  conditions: FilterCondition[];
  combineMode: 'and' | 'or';
  strictComparison?: boolean;
}

const VALID_OPERATORS = [
  'eq',
  'neq',
  'gt',
  'gte',
  'lt',
  'lte',
  'contains',
  'not_contains',
  'starts_with',
  'ends_with',
  'is_empty',
  'is_not_empty',
  'regex',
  'is_null',
  'is_type',
] as const;

const VALID_OPERATORS_STR = VALID_OPERATORS.join(', ');

const VALID_TYPES = new Set([
  'string',
  'number',
  'boolean',
  'object',
  'array',
  'null',
  'undefined',
]);

const MAX_REGEX_LENGTH = 200;

export class FilterHandler implements NodeHandler {
  validate(config: Record<string, unknown>): ValidationResult {
    const errors: string[] = [];
    const { inputField, conditions, combineMode } =
      config as unknown as FilterConfig;

    if (!inputField || typeof inputField !== 'string') {
      errors.push('inputField is required and must be a string');
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

  async execute(
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

    const array = getNestedValue(input, inputField);

    if (!Array.isArray(array)) {
      throw new Error('Filter inputField does not resolve to an array');
    }

    // Pre-compile regex patterns to avoid repeated construction per item
    const compiledRegexes = new Map<number, RegExp>();
    for (let i = 0; i < conditions.length; i++) {
      const cond = conditions[i];
      if (cond.operator === 'regex' && typeof cond.value === 'string') {
        const pattern = cond.value;
        if (pattern.length > MAX_REGEX_LENGTH) continue;
        try {
          compiledRegexes.set(i, new RegExp(pattern));
        } catch {
          // Invalid regex — will return false during evaluation
        }
      }
    }

    const match: unknown[] = [];
    const unmatched: unknown[] = [];

    for (const item of array) {
      const passed =
        combineMode === 'or'
          ? conditions.some((cond, i) =>
              this.evaluateCondition(
                item,
                cond,
                strictComparison,
                compiledRegexes.get(i),
              ),
            )
          : conditions.every((cond, i) =>
              this.evaluateCondition(
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

    return {
      config: { inputField, conditions, combineMode, strictComparison },
      output: { match, unmatched },
    };
  }

  private evaluateCondition(
    item: unknown,
    condition: FilterCondition,
    strict: boolean,
    compiledRegex?: RegExp,
  ): boolean {
    const fieldValue = getNestedValue(item, condition.field);
    const compareValue = condition.value;

    switch (condition.operator) {
      case 'eq':
        return strict
          ? fieldValue === compareValue
          : fieldValue == compareValue;
      case 'neq':
        return strict
          ? fieldValue !== compareValue
          : fieldValue != compareValue;
      case 'gt':
        return Number(fieldValue) > Number(compareValue);
      case 'gte':
        return Number(fieldValue) >= Number(compareValue);
      case 'lt':
        return Number(fieldValue) < Number(compareValue);
      case 'lte':
        return Number(fieldValue) <= Number(compareValue);
      case 'contains':
        return typeof fieldValue === 'string' &&
          typeof compareValue === 'string'
          ? fieldValue.includes(compareValue)
          : false;
      case 'not_contains':
        // Non-string values cannot contain a string, so return false (symmetric with contains)
        return typeof fieldValue === 'string' &&
          typeof compareValue === 'string'
          ? !fieldValue.includes(compareValue)
          : false;
      case 'starts_with':
        return typeof fieldValue === 'string' &&
          typeof compareValue === 'string'
          ? fieldValue.startsWith(compareValue)
          : false;
      case 'ends_with':
        return typeof fieldValue === 'string' &&
          typeof compareValue === 'string'
          ? fieldValue.endsWith(compareValue)
          : false;
      case 'is_empty':
        return (
          fieldValue === '' ||
          fieldValue === null ||
          fieldValue === undefined ||
          (Array.isArray(fieldValue) && fieldValue.length === 0)
        );
      case 'is_not_empty':
        return (
          fieldValue !== '' &&
          fieldValue !== null &&
          fieldValue !== undefined &&
          !(Array.isArray(fieldValue) && fieldValue.length === 0)
        );
      case 'regex':
        if (!compiledRegex) return false;
        return compiledRegex.test(
          typeof fieldValue === 'string'
            ? fieldValue
            : String(fieldValue as string | number | boolean),
        );
      case 'is_null':
        return fieldValue === null || fieldValue === undefined;
      case 'is_type': {
        if (typeof compareValue !== 'string' || !VALID_TYPES.has(compareValue))
          return false;
        if (compareValue === 'array') return Array.isArray(fieldValue);
        if (compareValue === 'null')
          return fieldValue === null || fieldValue === undefined;
        return typeof fieldValue === compareValue;
      }
      default:
        return false;
    }
  }
}
