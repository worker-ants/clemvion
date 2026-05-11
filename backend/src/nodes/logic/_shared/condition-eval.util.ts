import {
  CONDITION_OPERATORS,
  type Condition as CoreCondition,
  type ConditionOperator as CoreConditionOperator,
  EXPRESSION_PATTERN as CORE_EXPRESSION_PATTERN,
  MAX_REGEX_LENGTH as CORE_MAX_REGEX_LENGTH,
  compileRegexCache as coreCompileRegexCache,
} from '../../core/condition-evaluator.util.js';
import { getNestedValue } from '../../core/nested-value.util.js';

/**
 * Operator list re-exported from {@link CONDITION_OPERATORS} so the runtime
 * value matches the core SSOT. Filter / Transform consumers reference this
 * to validate authored conditions; adding a new operator only requires
 * editing `core/condition-evaluator.util.ts`.
 */
export const VALID_OPERATORS = CONDITION_OPERATORS;
export type ConditionOperator = CoreConditionOperator;

export const VALID_OPERATORS_STR = VALID_OPERATORS.join(', ');

export const MAX_REGEX_LENGTH = CORE_MAX_REGEX_LENGTH;
export const EXPRESSION_PATTERN = CORE_EXPRESSION_PATTERN;

export type Condition = CoreCondition;

export const compileRegexCache = coreCompileRegexCache;

const VALID_TYPES = new Set([
  'string',
  'number',
  'boolean',
  'object',
  'array',
  'null',
  'undefined',
]);

/**
 * Evaluate the comparison operator against an already-resolved fieldValue.
 *
 * Used by Filter (after per-item expression resolution) and Transform's
 * array_filter. Operator semantics mostly mirror the core evaluator, with
 * one deliberate divergence: `not_contains` returns `false` (instead of
 * `true`) when either operand is non-string. This preserves Filter's
 * "symmetric with contains" stance — non-comparable operands should not
 * silently slip through `not_contains` (`filter.handler.spec.ts:440-456`).
 *
 * Operator additions should land in `core/condition-evaluator.util.ts`
 * first, then this function gets a matching `case` only if the semantic
 * differs from core; otherwise the per-item Filter loop can keep calling
 * the core evaluator directly.
 */
export function evaluateResolvedCondition(
  fieldValue: unknown,
  operator: ConditionOperator,
  compareValue: unknown,
  strict: boolean,
  compiledRegex?: RegExp,
): boolean {
  switch (operator) {
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
      // Defensive divergence from core: non-string operands fail rather than
      // silently passing `not_contains`. See module docstring.
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

/**
 * Path-driven evaluator: looks up `condition.field` on `item` then defers to
 * {@link evaluateResolvedCondition}. Used by callers (transform.array_filter)
 * whose conditions are dot-paths over the item object.
 */
export function evaluateCondition(
  item: unknown,
  condition: Condition,
  strict: boolean,
  compiledRegex?: RegExp,
): boolean {
  const fieldValue = getNestedValue(item, condition.field);
  return evaluateResolvedCondition(
    fieldValue,
    condition.operator,
    condition.value,
    strict,
    compiledRegex,
  );
}
