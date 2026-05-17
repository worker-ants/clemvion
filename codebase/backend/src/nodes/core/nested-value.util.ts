const BLOCKED_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

export function resolveFieldValue(
  input: unknown,
  fieldValue: unknown,
): unknown {
  if (typeof fieldValue === 'string') {
    return getNestedValue(input, fieldValue);
  }
  return fieldValue;
}

function parsePath(path: string): string[] {
  // Normalize bracket notation (e.g. items[0].name → items.0.name).
  const normalized = path.replace(/\[(\w+)\]/g, '.$1');
  return normalized.split('.').filter((k) => k.length > 0);
}

export function getNestedValue(obj: unknown, path: string): unknown {
  if (obj === null || obj === undefined) {
    return undefined;
  }

  const keys = parsePath(path);
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

export function hasNestedValue(obj: unknown, path: string): boolean {
  if (obj === null || obj === undefined) return false;

  const keys = parsePath(path);
  if (keys.length === 0) return false;

  let current: unknown = obj;
  for (let i = 0; i < keys.length - 1; i++) {
    const key = keys[i];
    if (BLOCKED_KEYS.has(key)) return false;
    if (current === null || current === undefined) return false;
    if (typeof current !== 'object') return false;
    current = (current as Record<string, unknown>)[key];
  }

  const lastKey = keys[keys.length - 1];
  if (BLOCKED_KEYS.has(lastKey)) return false;
  if (current === null || current === undefined) return false;
  if (typeof current !== 'object') return false;

  if (Array.isArray(current)) {
    const idx = Number(lastKey);
    return Number.isInteger(idx) && idx >= 0 && idx < current.length;
  }
  return lastKey in (current as Record<string, unknown>);
}

export function setNestedValue(
  obj: Record<string, unknown>,
  path: string,
  value: unknown,
): void {
  const keys = parsePath(path);
  if (keys.length === 0) return;

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

export function delNestedValue(obj: unknown, path: string): void {
  if (obj === null || obj === undefined || typeof obj !== 'object') return;
  const keys = parsePath(path);
  if (keys.length === 0) return;

  let current: unknown = obj;
  for (let i = 0; i < keys.length - 1; i++) {
    const key = keys[i];
    if (BLOCKED_KEYS.has(key)) return;
    if (current === null || current === undefined) return;
    if (typeof current !== 'object') return;
    current = (current as Record<string, unknown>)[key];
  }

  if (current === null || current === undefined) return;
  if (typeof current !== 'object') return;

  const lastKey = keys[keys.length - 1];
  if (BLOCKED_KEYS.has(lastKey)) return;

  if (Array.isArray(current)) {
    const idx = Number(lastKey);
    if (Number.isInteger(idx) && idx >= 0 && idx < current.length) {
      current.splice(idx, 1);
    }
    return;
  }
  delete (current as Record<string, unknown>)[lastKey];
}
