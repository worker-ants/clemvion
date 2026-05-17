/**
 * Built-in string functions (14).
 */

import { FunctionError, TypeError } from '../errors';

function assertString(val: unknown, fnName: string): string {
  if (typeof val !== 'string') {
    throw new TypeError(`${fnName} expects a string argument, got ${typeof val}`);
  }
  return val;
}

export const stringFunctions: Record<string, (...args: unknown[]) => unknown> = {
  length(val: unknown): number {
    if (typeof val === 'string') return val.length;
    if (Array.isArray(val)) return val.length;
    throw new TypeError('length expects a string or array argument');
  },

  uppercase(val: unknown): string {
    return assertString(val, 'uppercase').toUpperCase();
  },

  lowercase(val: unknown): string {
    return assertString(val, 'lowercase').toLowerCase();
  },

  trim(val: unknown): string {
    return assertString(val, 'trim').trim();
  },

  contains(str: unknown, sub: unknown): boolean {
    return assertString(str, 'contains').includes(assertString(sub, 'contains'));
  },

  startsWith(str: unknown, prefix: unknown): boolean {
    return assertString(str, 'startsWith').startsWith(assertString(prefix, 'startsWith'));
  },

  endsWith(str: unknown, suffix: unknown): boolean {
    return assertString(str, 'endsWith').endsWith(assertString(suffix, 'endsWith'));
  },

  replace(str: unknown, search: unknown, replacement: unknown): string {
    return assertString(str, 'replace').replace(
      assertString(search, 'replace'),
      assertString(replacement, 'replace'),
    );
  },

  replaceAll(str: unknown, search: unknown, replacement: unknown): string {
    const s = assertString(str, 'replaceAll');
    const searchStr = assertString(search, 'replaceAll');
    const rep = assertString(replacement, 'replaceAll');
    return s.split(searchStr).join(rep);
  },

  split(str: unknown, separator: unknown): string[] {
    return assertString(str, 'split').split(assertString(separator, 'split'));
  },

  join(arr: unknown, separator: unknown): string {
    if (!Array.isArray(arr)) {
      throw new TypeError('join expects an array as first argument');
    }
    return arr.join(assertString(separator, 'join'));
  },

  substring(str: unknown, start: unknown, end?: unknown): string {
    const s = assertString(str, 'substring');
    if (typeof start !== 'number') {
      throw new TypeError('substring expects a number as start index');
    }
    if (end !== undefined && end !== null && typeof end !== 'number') {
      throw new TypeError('substring expects a number as end index');
    }
    return s.substring(start, end as number | undefined);
  },

  padStart(str: unknown, length: unknown, char?: unknown): string {
    const s = assertString(str, 'padStart');
    if (typeof length !== 'number') {
      throw new TypeError('padStart expects a number as length');
    }
    const fillChar = char !== undefined && char !== null ? assertString(char, 'padStart') : ' ';
    return s.padStart(length, fillChar);
  },

  padEnd(str: unknown, length: unknown, char?: unknown): string {
    const s = assertString(str, 'padEnd');
    if (typeof length !== 'number') {
      throw new TypeError('padEnd expects a number as length');
    }
    const fillChar = char !== undefined && char !== null ? assertString(char, 'padEnd') : ' ';
    return s.padEnd(length, fillChar);
  },
};
