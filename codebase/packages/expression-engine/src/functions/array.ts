/**
 * Built-in array functions (10).
 * Note: length is shared with string functions and handled in the registry.
 */

import { TypeError } from '../errors';

function assertArray(val: unknown, fnName: string): unknown[] {
  if (!Array.isArray(val)) {
    throw new TypeError(`${fnName} expects an array argument, got ${typeof val}`);
  }
  return val;
}

export const arrayFunctions: Record<string, (...args: unknown[]) => unknown> = {
  first(arr: unknown): unknown {
    const a = assertArray(arr, 'first');
    return a.length > 0 ? a[0] : null;
  },

  last(arr: unknown): unknown {
    const a = assertArray(arr, 'last');
    return a.length > 0 ? a[a.length - 1] : null;
  },

  includes(arr: unknown, value: unknown): boolean {
    const a = assertArray(arr, 'includes');
    return a.includes(value);
  },

  reverse(arr: unknown): unknown[] {
    const a = assertArray(arr, 'reverse');
    return [...a].reverse();
  },

  flatten(arr: unknown): unknown[] {
    const a = assertArray(arr, 'flatten');
    return a.flat(1);
  },

  unique(arr: unknown): unknown[] {
    const a = assertArray(arr, 'unique');
    return [...new Set(a)];
  },

  compact(arr: unknown): unknown[] {
    const a = assertArray(arr, 'compact');
    return a.filter((item) => item !== null && item !== undefined);
  },

  slice(arr: unknown, start: unknown, end?: unknown): unknown[] {
    const a = assertArray(arr, 'slice');
    if (typeof start !== 'number') {
      throw new TypeError('slice expects a number as start index');
    }
    if (end !== undefined && end !== null && typeof end !== 'number') {
      throw new TypeError('slice expects a number as end index');
    }
    return a.slice(start, end as number | undefined);
  },

  concat(arr1: unknown, arr2: unknown): unknown[] {
    const a1 = assertArray(arr1, 'concat');
    const a2 = assertArray(arr2, 'concat');
    return [...a1, ...a2];
  },
};
