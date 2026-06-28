import {
  HOOKS_MAX_BODY_BYTES,
  GLOBAL_MAX_BODY_BYTES,
  resolveHooksMaxBodyBytes,
  createHooksBodyParsers,
  createGlobalBodyParsers,
} from './hooks-body-parser';

describe('resolveHooksMaxBodyBytes', () => {
  it('defaults to 1 MiB when env is unset', () => {
    expect(HOOKS_MAX_BODY_BYTES).toBe(1024 * 1024);
    expect(resolveHooksMaxBodyBytes({})).toBe(1024 * 1024);
  });

  it('accepts a positive integer override', () => {
    expect(resolveHooksMaxBodyBytes({ HOOKS_MAX_BODY_BYTES: '524288' })).toBe(
      524288,
    );
  });

  it('floors fractional values', () => {
    expect(resolveHooksMaxBodyBytes({ HOOKS_MAX_BODY_BYTES: '1000.9' })).toBe(
      1000,
    );
  });

  it.each(['0', '-1', 'abc', '', 'NaN', 'Infinity'])(
    'falls back to default for invalid override %p',
    (val) => {
      expect(resolveHooksMaxBodyBytes({ HOOKS_MAX_BODY_BYTES: val })).toBe(
        HOOKS_MAX_BODY_BYTES,
      );
    },
  );
});

describe('createHooksBodyParsers', () => {
  it('returns json + urlencoded middlewares', () => {
    const parsers = createHooksBodyParsers();
    expect(parsers).toHaveLength(2);
    expect(parsers.every((p) => typeof p === 'function')).toBe(true);
  });
});

describe('createGlobalBodyParsers', () => {
  it('returns json + urlencoded middlewares', () => {
    const parsers = createGlobalBodyParsers();
    expect(parsers).toHaveLength(2);
    expect(parsers.every((p) => typeof p === 'function')).toBe(true);
  });

  it('global default (100KB) is smaller than the hooks limit (1MB)', () => {
    expect(GLOBAL_MAX_BODY_BYTES).toBe(100 * 1024);
    expect(GLOBAL_MAX_BODY_BYTES).toBeLessThan(HOOKS_MAX_BODY_BYTES);
  });
});
