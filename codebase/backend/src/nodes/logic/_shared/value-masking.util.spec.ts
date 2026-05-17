import { isSecretName, maskValueForLog } from './value-masking.util.js';

describe('value-masking.util', () => {
  describe('isSecretName', () => {
    it.each([
      ['password', true],
      ['userPassword', true],
      ['apiKey', true],
      ['api_key', true],
      ['authToken', true],
      ['auth_token', true],
      ['refreshToken', true],
      ['client_secret', true],
      ['privateKey', true],
      ['authorization', true],
      ['bearerToken', true],
      ['credential', true],
      // Pass-through for non-secret names
      ['counter', false],
      ['userId', false],
      ['items', false],
      ['lastSeen', false],
    ])('classifies "%s" as secret = %s', (name, expected) => {
      expect(isSecretName(name)).toBe(expected);
    });
  });

  describe('maskValueForLog', () => {
    it('collapses secret-named values to *** regardless of type', () => {
      expect(maskValueForLog('password', 'super-secret')).toBe('***');
      expect(maskValueForLog('apiKey', 12345)).toBe('***');
      expect(maskValueForLog('refresh_token', null)).toBe('***');
      expect(maskValueForLog('credential', { nested: 'object' })).toBe('***');
    });

    it('passes primitives through verbatim for non-secret names', () => {
      expect(maskValueForLog('counter', 5)).toBe(5);
      expect(maskValueForLog('name', 'Alice')).toBe('Alice');
      expect(maskValueForLog('flag', true)).toBe(true);
      expect(maskValueForLog('missing', null)).toBe(null);
      expect(maskValueForLog('absent', undefined)).toBe(undefined);
    });

    it('deep-clones small objects so later mutations are not reflected', () => {
      const original = { a: 1, list: [1, 2] };
      const cloned = maskValueForLog('payload', original) as {
        a: number;
        list: number[];
      };
      // Mutate the live value — recorded snapshot must NOT change.
      original.a = 99;
      original.list.push(99);
      expect(cloned).toEqual({ a: 1, list: [1, 2] });
    });

    it('returns a placeholder for unsupported types (function / symbol)', () => {
      expect(maskValueForLog('cb', () => 'x')).toBe('[unsupported:function]');
      expect(maskValueForLog('sym', Symbol('s'))).toBe('[unsupported:symbol]');
    });

    it('truncates oversized objects to a byte-count placeholder', () => {
      const big = {
        items: Array.from({ length: 1000 }, (_, i) => `padding-${i}`),
      };
      const result = maskValueForLog('big', big);
      expect(typeof result).toBe('string');
      expect(result as string).toMatch(/^\[truncated:\d+ bytes\]$/);
    });

    it('handles unserialisable objects gracefully', () => {
      const cycle: { self?: unknown } = {};
      cycle.self = cycle;
      expect(maskValueForLog('cycle', cycle)).toBe('[unserialisable]');
    });
  });
});
