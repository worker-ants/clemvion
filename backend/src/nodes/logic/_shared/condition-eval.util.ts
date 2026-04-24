import { getNestedValue } from '../../core/nested-value.util.js';

export const VALID_OPERATORS = [
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

export type ConditionOperator = (typeof VALID_OPERATORS)[number];

export const VALID_OPERATORS_STR = VALID_OPERATORS.join(', ');

const VALID_TYPES = new Set([
  'string',
  'number',
  'boolean',
  'object',
  'array',
  'null',
  'undefined',
]);

export const MAX_REGEX_LENGTH = 200;

export interface Condition {
  field: string;
  operator: ConditionOperator;
  value: unknown;
}

export function compileRegexCache(
  conditions: Condition[],
): Map<number, RegExp> {
  const cache = new Map<number, RegExp>();
  for (let i = 0; i < conditions.length; i++) {
    const cond = conditions[i];
    if (cond.operator === 'regex' && typeof cond.value === 'string') {
      if (cond.value.length > MAX_REGEX_LENGTH) continue;
      try {
        cache.set(i, new RegExp(cond.value));
      } catch {
        // Invalid regex — evaluation returns false
      }
    }
  }
  return cache;
}

export function evaluateCondition(
  item: unknown,
  condition: Condition,
  strict: boolean,
  compiledRegex?: RegExp,
): boolean {
  const fieldValue = getNestedValue(item, condition.field);
  const compareValue = condition.value;

  switch (condition.operator) {
    case 'eq':
      return strict ? fieldValue === compareValue : fieldValue == compareValue;
    case 'neq':
      return strict ? fieldValue !== compareValue : fieldValue != compareValue;
    case 'gt':
      return Number(fieldValue) > Number(compareValue);
    case 'gte':
      return Number(fieldValue) >= Number(compareValue);
    case 'lt':
      return Number(fieldValue) < Number(compareValue);
    case 'lte':
      return Number(fieldValue) <= Number(compareValue);
    case 'contains':
      return typeof fieldValue === 'string' && typeof compareValue === 'string'
        ? fieldValue.includes(compareValue)
        : false;
    case 'not_contains':
      return typeof fieldValue === 'string' && typeof compareValue === 'string'
        ? !fieldValue.includes(compareValue)
        : false;
    case 'starts_with':
      return typeof fieldValue === 'string' && typeof compareValue === 'string'
        ? fieldValue.startsWith(compareValue)
        : false;
    case 'ends_with':
      return typeof fieldValue === 'string' && typeof compareValue === 'string'
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
        typeof fieldValue === 'string' ? fieldValue : String(fieldValue),
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
