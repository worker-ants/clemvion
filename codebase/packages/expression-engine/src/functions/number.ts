/**
 * Built-in number functions (10).
 */

import { TypeError } from '../errors';

function assertNumber(val: unknown, fnName: string): number {
  if (typeof val !== 'number' || isNaN(val)) {
    throw new TypeError(`${fnName} expects a number argument, got ${typeof val}`);
  }
  return val;
}

export const numberFunctions: Record<string, (...args: unknown[]) => unknown> = {
  round(num: unknown, decimals?: unknown): number {
    const n = assertNumber(num, 'round');
    if (decimals !== undefined && decimals !== null) {
      const d = assertNumber(decimals, 'round');
      const factor = Math.pow(10, d);
      return Math.round(n * factor) / factor;
    }
    return Math.round(n);
  },

  ceil(num: unknown): number {
    return Math.ceil(assertNumber(num, 'ceil'));
  },

  floor(num: unknown): number {
    return Math.floor(assertNumber(num, 'floor'));
  },

  abs(num: unknown): number {
    return Math.abs(assertNumber(num, 'abs'));
  },

  min(...args: unknown[]): number {
    if (args.length === 0) {
      throw new TypeError('min expects at least one argument');
    }
    const nums = args.map((a) => assertNumber(a, 'min'));
    return Math.min(...nums);
  },

  max(...args: unknown[]): number {
    if (args.length === 0) {
      throw new TypeError('max expects at least one argument');
    }
    const nums = args.map((a) => assertNumber(a, 'max'));
    return Math.max(...nums);
  },

  parseInt(str: unknown): number {
    if (typeof str === 'number') return Math.trunc(str);
    if (typeof str !== 'string') {
      throw new TypeError('parseInt expects a string or number argument');
    }
    const result = globalThis.parseInt(str, 10);
    if (isNaN(result)) {
      throw new TypeError(`Cannot parse "${str}" as integer`);
    }
    return result;
  },

  parseFloat(str: unknown): number {
    if (typeof str === 'number') return str;
    if (typeof str !== 'string') {
      throw new TypeError('parseFloat expects a string or number argument');
    }
    const result = globalThis.parseFloat(str);
    if (isNaN(result)) {
      throw new TypeError(`Cannot parse "${str}" as float`);
    }
    return result;
  },

  toFixed(num: unknown, digits: unknown): string {
    const n = assertNumber(num, 'toFixed');
    const d = assertNumber(digits, 'toFixed');
    return n.toFixed(d);
  },

  random(): number {
    return Math.random();
  },
};
