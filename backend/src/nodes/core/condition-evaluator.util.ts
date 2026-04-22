import { getNestedValue } from './nested-value.util.js';

/**
 * Supported comparison operators.
 *
 * Single source of truth: the runtime list and the TypeScript union are
 * derived from the same `as const` array so adding a new operator only
 * requires editing this array (+ the `switch` branch in
 * {@link evaluateCondition}).
 */
export const CONDITION_OPERATORS = [
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
  'is_null',
] as const;

export type ConditionOperator = (typeof CONDITION_OPERATORS)[number];

/**
 * A single condition evaluated by {@link evaluateCondition}.
 *
 * Matches the `ConditionGroup` schema defined in
 * `nodes/logic/if-else/if-else.schema.ts` — reused by Switch (expression
 * mode) and Filter nodes.
 */
export interface Condition {
  /** Dot-path on `input` to look up the left-hand-side value. */
  field: string;
  operator: ConditionOperator;
  /** Right-hand-side value. Optional for unary operators (is_empty, is_null, ...). */
  value?: unknown;
}

export interface EvaluateOptions {
  /**
   * Use strict equality (`===` / `!==`) for `eq` / `neq` instead of loose
   * (`==` / `!=`). Per spec §3.2.1, default is loose (`false`).
   */
  strict?: boolean;
}

const DEFAULT_OPTIONS: EvaluateOptions = Object.freeze({});

/**
 * Evaluate a single {@link Condition} against `input` and return whether it
 * is satisfied.
 *
 * Looks up `condition.field` on `input` via {@link getNestedValue} (which
 * blocks `__proto__` / `constructor` / `prototype` paths) and applies the
 * configured operator.
 */
export function evaluateCondition(
  input: unknown,
  condition: Condition,
  options: EvaluateOptions = DEFAULT_OPTIONS,
): boolean {
  const fieldValue = getNestedValue(input, condition.field);
  const compareValue = condition.value;
  const strict = options.strict === true;

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
        : true;
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
    case 'is_null':
      return fieldValue === null || fieldValue === undefined;
    default:
      return false;
  }
}
