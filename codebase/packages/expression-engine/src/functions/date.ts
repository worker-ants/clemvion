/**
 * Built-in date/time functions (7).
 */

import dayjs from 'dayjs';
import { TypeError, FunctionError } from '../errors';

type ManipulateUnit = 'year' | 'month' | 'day' | 'hour' | 'minute' | 'second'
  | 'years' | 'months' | 'days' | 'hours' | 'minutes' | 'seconds';

function assertString(val: unknown, fnName: string): string {
  if (typeof val !== 'string') {
    throw new TypeError(`${fnName} expects a string argument, got ${typeof val}`);
  }
  return val;
}

function assertNumber(val: unknown, fnName: string): number {
  if (typeof val !== 'number') {
    throw new TypeError(`${fnName} expects a number argument, got ${typeof val}`);
  }
  return val;
}

function parseDayjs(dateStr: string, fnName: string): dayjs.Dayjs {
  const d = dayjs(dateStr);
  if (!d.isValid()) {
    throw new FunctionError(`${fnName}: invalid date string "${dateStr}"`);
  }
  return d;
}

function normalizeUnit(unit: string): dayjs.ManipulateType {
  const map: Record<string, dayjs.ManipulateType> = {
    years: 'year',
    year: 'year',
    months: 'month',
    month: 'month',
    days: 'day',
    day: 'day',
    hours: 'hour',
    hour: 'hour',
    minutes: 'minute',
    minute: 'minute',
    seconds: 'second',
    second: 'second',
  };
  const normalized = map[unit];
  if (!normalized) {
    throw new FunctionError(`Invalid time unit: "${unit}"`);
  }
  return normalized;
}

export const dateFunctions: Record<string, (...args: unknown[]) => unknown> = {
  formatDate(dateStr: unknown, pattern: unknown): string {
    const s = assertString(dateStr, 'formatDate');
    const p = assertString(pattern, 'formatDate');
    return parseDayjs(s, 'formatDate').format(p);
  },

  parseDate(str: unknown, _pattern?: unknown): string {
    const s = assertString(str, 'parseDate');
    return parseDayjs(s, 'parseDate').toISOString();
  },

  addTime(dateStr: unknown, amount: unknown, unit: unknown): string {
    const s = assertString(dateStr, 'addTime');
    const n = assertNumber(amount, 'addTime');
    const u = assertString(unit, 'addTime');
    return parseDayjs(s, 'addTime').add(n, normalizeUnit(u)).toISOString();
  },

  subtractTime(dateStr: unknown, amount: unknown, unit: unknown): string {
    const s = assertString(dateStr, 'subtractTime');
    const n = assertNumber(amount, 'subtractTime');
    const u = assertString(unit, 'subtractTime');
    return parseDayjs(s, 'subtractTime').subtract(n, normalizeUnit(u)).toISOString();
  },

  diffTime(date1: unknown, date2: unknown, unit: unknown): number {
    const s1 = assertString(date1, 'diffTime');
    const s2 = assertString(date2, 'diffTime');
    const u = assertString(unit, 'diffTime');
    return parseDayjs(s1, 'diffTime').diff(parseDayjs(s2, 'diffTime'), normalizeUnit(u));
  },

  now(): string {
    return dayjs().toISOString();
  },

  today(): string {
    return dayjs().format('YYYY-MM-DD');
  },
};
