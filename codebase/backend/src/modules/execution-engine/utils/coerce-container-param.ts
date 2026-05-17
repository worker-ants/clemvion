/**
 * Container action-parameter coercion helpers.
 *
 * Container engine paths (runContainerInner / runParallel) read iteration
 * parameters from `engineResolvedConfigCache` — values that have already
 * been through the expression resolver. These helpers act as a strict
 * validation gate so that any unresolved `{{ ... }}` template (engine bug)
 * surfaces as a clear error instead of being silently coerced to `NaN`
 * (Loop) or fallback-to-default (Parallel typeof guard).
 */

/**
 * Greedy `{{...}}` detector — any string containing the template marker
 * pair anywhere is treated as an unresolved expression. This is intentional:
 * a partially evaluated mixed string (e.g. `"prefix {{x}} suffix"`) cannot
 * legally drive a typed action parameter and must surface an error rather
 * than be silently coerced.
 */
const UNRESOLVED_EXPRESSION_PATTERN = /\{\{.*\}\}/;

const INVALID_PARAM_PREFIX = 'INVALID_CONTAINER_PARAM';
/** Truncate raw values in error messages to avoid leaking large secrets. */
const ERROR_VALUE_PREVIEW_LIMIT = 100;

function previewValue(value: unknown): string {
  return JSON.stringify(value).slice(0, ERROR_VALUE_PREVIEW_LIMIT);
}

function unresolvedExpressionError(
  nodeType: string,
  fieldName: string,
  value: unknown,
): Error {
  return new Error(
    `${INVALID_PARAM_PREFIX}: ${nodeType}.${fieldName} carries an unresolved expression ` +
      `${previewValue(value)}. The engine expected an evaluated value but received the raw ` +
      `template — engineResolvedConfigCache miss or expression-resolver bypass.`,
  );
}

/**
 * Coerce an evaluated container config field to a finite number.
 *
 * - number (finite) → pass through
 * - numeric string ("3", "  10  ") → parsed
 * - unresolved expression string ("{{3}}") → throw
 * - everything else → throw
 */
export function coerceContainerNumber(
  value: unknown,
  fieldName: string,
  nodeType: string,
): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (UNRESOLVED_EXPRESSION_PATTERN.test(trimmed)) {
      throw unresolvedExpressionError(nodeType, fieldName, value);
    }
    if (trimmed === '') {
      throw new Error(
        `${INVALID_PARAM_PREFIX}: ${nodeType}.${fieldName} is an empty string.`,
      );
    }
    const n = Number(trimmed);
    if (Number.isFinite(n)) return n;
  }
  throw new Error(
    `${INVALID_PARAM_PREFIX}: ${nodeType}.${fieldName} = ${previewValue(value)} is not a finite number.`,
  );
}

/**
 * Same as {@link coerceContainerNumber} but returns `undefined` when the
 * value is `undefined` or `null`. Note: the literal `0` is a valid finite
 * number and DOES round-trip through the helper unchanged (not treated as
 * "missing").
 */
export function coerceContainerNumberOptional(
  value: unknown,
  fieldName: string,
  nodeType: string,
): number | undefined {
  if (value === undefined || value === null) return undefined;
  return coerceContainerNumber(value, fieldName, nodeType);
}

export type ContainerErrorPolicy = 'stop' | 'skip' | 'continue';

const ERROR_POLICY_VALUES: readonly ContainerErrorPolicy[] = [
  'stop',
  'skip',
  'continue',
];

/**
 * Coerce an evaluated container config field to a {@link ContainerErrorPolicy}
 * enum value, falling back to `defaultValue` when the field is absent.
 *
 * - 'stop' / 'skip' / 'continue' → pass through
 * - undefined / null → defaultValue
 * - unresolved expression string → throw
 * - everything else → throw
 *
 * Stricter than the previous `as` cast: an out-of-range value used to
 * fall through the executor's switch silently (treated as a no-op around
 * caught errors).
 */
export function coerceErrorPolicy(
  value: unknown,
  fieldName: string,
  nodeType: string,
  defaultValue: ContainerErrorPolicy,
): ContainerErrorPolicy {
  if (value === undefined || value === null) return defaultValue;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (UNRESOLVED_EXPRESSION_PATTERN.test(trimmed)) {
      throw unresolvedExpressionError(nodeType, fieldName, value);
    }
    if (ERROR_POLICY_VALUES.includes(trimmed as ContainerErrorPolicy)) {
      return trimmed as ContainerErrorPolicy;
    }
  }
  throw new Error(
    `${INVALID_PARAM_PREFIX}: ${nodeType}.${fieldName} = ${previewValue(value)} ` +
      `is not a valid error policy (expected one of: ${ERROR_POLICY_VALUES.join(', ')}).`,
  );
}

/**
 * Coerce an evaluated container config field to a boolean, falling back to
 * `defaultValue` when the field is absent.
 *
 * - boolean → pass through
 * - undefined / null → defaultValue
 * - "true" / "false" (trimmed, case-sensitive) → parsed
 * - unresolved expression string → throw
 * - everything else → throw
 */
export function coerceContainerBoolean(
  value: unknown,
  fieldName: string,
  nodeType: string,
  defaultValue: boolean,
): boolean {
  if (typeof value === 'boolean') return value;
  if (value === undefined || value === null) return defaultValue;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (UNRESOLVED_EXPRESSION_PATTERN.test(trimmed)) {
      throw unresolvedExpressionError(nodeType, fieldName, value);
    }
    if (trimmed === 'true') return true;
    if (trimmed === 'false') return false;
  }
  throw new Error(
    `${INVALID_PARAM_PREFIX}: ${nodeType}.${fieldName} = ${previewValue(value)} is not a boolean.`,
  );
}
