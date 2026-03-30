/**
 * Built-in type conversion functions (8).
 */

import { TypeError, FunctionError } from '../errors';

export const typeFunctions: Record<string, (...args: unknown[]) => unknown> = {
  toString(value: unknown): string {
    if (value === null || value === undefined) return '';
    if (typeof value === 'object') return JSON.stringify(value);
    return String(value);
  },

  toNumber(value: unknown): number {
    if (typeof value === 'number') return value;
    if (typeof value === 'boolean') return value ? 1 : 0;
    if (typeof value === 'string') {
      const n = Number(value);
      if (isNaN(n)) {
        throw new TypeError(`Cannot convert "${value}" to number`);
      }
      return n;
    }
    if (value === null) return 0;
    throw new TypeError(`Cannot convert ${typeof value} to number`);
  },

  toBoolean(value: unknown): boolean {
    if (value === null || value === undefined) return false;
    if (typeof value === 'boolean') return value;
    if (typeof value === 'number') return value !== 0;
    if (typeof value === 'string') return value.length > 0;
    if (Array.isArray(value)) return value.length > 0;
    if (typeof value === 'object') return Object.keys(value as object).length > 0;
    return Boolean(value);
  },

  toJSON(value: unknown): string {
    try {
      return JSON.stringify(value);
    } catch {
      throw new FunctionError('Failed to convert value to JSON');
    }
  },

  fromJSON(str: unknown): unknown {
    if (typeof str !== 'string') {
      throw new TypeError('fromJSON expects a string argument');
    }
    try {
      return JSON.parse(str);
    } catch {
      throw new FunctionError(`Failed to parse JSON: "${str}"`);
    }
  },

  typeOf(value: unknown): string {
    if (value === null) return 'null';
    if (Array.isArray(value)) return 'array';
    return typeof value;
  },

  isEmpty(value: unknown): boolean {
    if (value === null || value === undefined) return true;
    if (typeof value === 'string') return value.length === 0;
    if (Array.isArray(value)) return value.length === 0;
    if (typeof value === 'object') return Object.keys(value as object).length === 0;
    return false;
  },

  isNull(value: unknown): boolean {
    return value === null || value === undefined;
  },
};
