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

const UNRESOLVED_EXPRESSION_PATTERN = /\{\{.*\}\}/;

function unresolvedExpressionError(
  nodeType: string,
  fieldName: string,
  value: unknown,
): Error {
  return new Error(
    `INVALID_CONTAINER_PARAM: ${nodeType}.${fieldName} carries an unresolved expression ` +
      `${JSON.stringify(value)}. The engine expected an evaluated value but received the raw ` +
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
        `INVALID_CONTAINER_PARAM: ${nodeType}.${fieldName} is an empty string.`,
      );
    }
    const n = Number(trimmed);
    if (Number.isFinite(n)) return n;
  }
  throw new Error(
    `INVALID_CONTAINER_PARAM: ${nodeType}.${fieldName} = ${JSON.stringify(value)} is not a finite number.`,
  );
}

/** Same as {@link coerceContainerNumber} but returns `undefined` when the value is missing. */
export function coerceContainerNumberOptional(
  value: unknown,
  fieldName: string,
  nodeType: string,
): number | undefined {
  if (value === undefined || value === null) return undefined;
  return coerceContainerNumber(value, fieldName, nodeType);
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
    `INVALID_CONTAINER_PARAM: ${nodeType}.${fieldName} = ${JSON.stringify(value)} is not a boolean.`,
  );
}
