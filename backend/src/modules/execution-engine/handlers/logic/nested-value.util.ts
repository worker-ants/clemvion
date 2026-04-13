const BLOCKED_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

/**
 * Resolve a config value that can be either:
 *   - a dot-path string applied to `input` (e.g. `"items"`, `"order.items"`), or
 *   - the value itself, already produced by an inline expression like
 *     `{{ $var.a }}` whose evaluator returns the underlying type (array,
 *     object, primitive) instead of stringifying it.
 *
 * Returns the resolved value. Useful for handlers that accept "Expression |
 * Path" config fields (Map, ForEach, Split).
 */
export function resolveFieldValue(input: unknown, fieldValue: unknown): unknown {
  if (typeof fieldValue === 'string') {
    return getNestedValue(input, fieldValue);
  }
  return fieldValue;
}

export function getNestedValue(obj: unknown, path: string): unknown {
  if (obj === null || obj === undefined) {
    return undefined;
  }

  const keys = path.split('.');
  let current: unknown = obj;

  for (const key of keys) {
    if (current === null || current === undefined) {
      return undefined;
    }
    if (typeof current !== 'object') {
      return undefined;
    }
    if (BLOCKED_KEYS.has(key)) {
      return undefined;
    }
    current = (current as Record<string, unknown>)[key];
  }

  return current;
}

export function setNestedValue(
  obj: Record<string, unknown>,
  path: string,
  value: unknown,
): void {
  const keys = path.split('.');
  let current: Record<string, unknown> = obj;

  for (let i = 0; i < keys.length - 1; i++) {
    const key = keys[i];
    if (BLOCKED_KEYS.has(key)) {
      return;
    }
    if (
      current[key] === undefined ||
      current[key] === null ||
      typeof current[key] !== 'object'
    ) {
      current[key] = {};
    }
    current = current[key] as Record<string, unknown>;
  }

  const lastKey = keys[keys.length - 1];
  if (BLOCKED_KEYS.has(lastKey)) {
    return;
  }
  current[lastKey] = value;
}
