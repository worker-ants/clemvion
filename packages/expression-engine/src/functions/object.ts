/**
 * Built-in object functions (7).
 */

import { TypeError } from '../errors';

function assertObject(val: unknown, fnName: string): Record<string, unknown> {
  if (val === null || val === undefined || typeof val !== 'object' || Array.isArray(val)) {
    throw new TypeError(`${fnName} expects an object argument, got ${Array.isArray(val) ? 'array' : typeof val}`);
  }
  return val as Record<string, unknown>;
}

export const objectFunctions: Record<string, (...args: unknown[]) => unknown> = {
  keys(obj: unknown): string[] {
    return Object.keys(assertObject(obj, 'keys'));
  },

  values(obj: unknown): unknown[] {
    return Object.values(assertObject(obj, 'values'));
  },

  entries(obj: unknown): [string, unknown][] {
    return Object.entries(assertObject(obj, 'entries'));
  },

  hasKey(obj: unknown, key: unknown): boolean {
    const o = assertObject(obj, 'hasKey');
    if (typeof key !== 'string') {
      throw new TypeError('hasKey expects a string as key argument');
    }
    return Object.prototype.hasOwnProperty.call(o, key);
  },

  merge(obj1: unknown, obj2: unknown): Record<string, unknown> {
    const o1 = assertObject(obj1, 'merge');
    const o2 = assertObject(obj2, 'merge');
    return { ...o1, ...o2 };
  },

  pick(obj: unknown, keys: unknown): Record<string, unknown> {
    const o = assertObject(obj, 'pick');
    if (!Array.isArray(keys)) {
      throw new TypeError('pick expects an array of keys as second argument');
    }
    const result: Record<string, unknown> = {};
    for (const k of keys) {
      if (typeof k === 'string' && Object.prototype.hasOwnProperty.call(o, k)) {
        result[k] = o[k];
      }
    }
    return result;
  },

  omit(obj: unknown, keys: unknown): Record<string, unknown> {
    const o = assertObject(obj, 'omit');
    if (!Array.isArray(keys)) {
      throw new TypeError('omit expects an array of keys as second argument');
    }
    const keySet = new Set(keys);
    const result: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(o)) {
      if (!keySet.has(k)) {
        result[k] = v;
      }
    }
    return result;
  },
};
