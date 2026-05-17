import { getNestedValue } from './nested-value.util.js';

/**
 * Supported comparison operators.
 *
 * Single source of truth: the runtime list and the TypeScript union are
 * derived from the same `as const` array so adding a new operator only
 * requires editing this array (+ the `switch` branch in
 * {@link evaluateResolvedCondition}).
 *
 * Used by: if_else, switch (expression mode), filter, transform.array_filter.
 * `logic/_shared/condition-eval.util.ts` re-exports these symbols to keep
 * Filter / Transform on the legacy positional signature without duplicating
 * operator semantics.
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
  'regex',
  'is_type',
] as const;

export type ConditionOperator = (typeof CONDITION_OPERATORS)[number];

/**
 * Cap on user-authored regex pattern length to mitigate ReDoS exposure.
 * Mirrored by {@link compileRegexCache}.
 */
export const MAX_REGEX_LENGTH = 200;

/**
 * Detector for inline `{{ ... }}` expressions in authored strings. Filter
 * relies on this to decide whether a value is a dot-path or an expression
 * to resolve per-item.
 */
export const EXPRESSION_PATTERN = /\{\{/;

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
 * A single condition evaluated by {@link evaluateCondition}.
 *
 * Matches the `ConditionGroup` schema defined in
 * `nodes/logic/if-else/if-else.schema.ts` — reused by Switch (expression
 * mode), Filter, and Transform's array_filter.
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
  /**
   * Pre-compiled regex for the `regex` operator. Filter passes a per-item
   * cached compile here; If/Else and Switch leave this unset (the schema
   * accepts only string-literal patterns, and recompiling per call is
   * acceptable cost). When undefined, `regex` returns `false`.
   */
  regex?: RegExp;
}

const DEFAULT_OPTIONS: EvaluateOptions = Object.freeze({});

/**
 * Evaluate a single operator against an already-resolved fieldValue.
 *
 * Filter calls this directly after its per-item expression resolution; the
 * path-driven helper {@link evaluateCondition} wraps it for callers that
 * still treat `condition.field` as a dot-path on `input`.
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
    case 'regex':
      if (!compiledRegex) return false;
      return compiledRegex.test(
        typeof fieldValue === 'string' ? fieldValue : String(fieldValue),
      );
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
 * Evaluate a single {@link Condition} against `input` and return whether it
 * is satisfied.
 *
 * Looks up `condition.field` on `input` via {@link getNestedValue} (which
 * blocks `__proto__` / `constructor` / `prototype` paths) and applies the
 * configured operator via {@link evaluateResolvedCondition}.
 */
export function evaluateCondition(
  input: unknown,
  condition: Condition,
  options: EvaluateOptions = DEFAULT_OPTIONS,
): boolean {
  const fieldValue = getNestedValue(input, condition.field);
  return evaluateResolvedCondition(
    fieldValue,
    condition.operator,
    condition.value,
    options.strict === true,
    options.regex,
  );
}

/**
 * Compile per-condition regex patterns into a position-indexed cache.
 *
 * Filter / Transform use this to avoid re-compiling the same pattern per
 * array item. Invalid patterns and patterns exceeding
 * {@link MAX_REGEX_LENGTH} are silently skipped — callers may detect them
 * by the missing cache entry (Filter surfaces them via
 * `meta.invalidRegexPatterns`).
 */
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
        // Invalid regex — evaluation returns false.
      }
    }
  }
  return cache;
}
