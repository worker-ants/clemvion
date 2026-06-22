import { asString } from './coerce';

describe('asString', () => {
  it('passes string values through unchanged', () => {
    expect(asString('hello', 'fb')).toBe('hello');
    expect(asString('', 'fb')).toBe(''); // empty string is still a string
  });

  it('returns the fallback for non-string values', () => {
    expect(asString(undefined, 'fb')).toBe('fb');
    expect(asString(null, 'fb')).toBe('fb');
    expect(asString(42, 'fb')).toBe('fb');
    expect(asString({}, 'fb')).toBe('fb');
    expect(asString(['a'], 'fb')).toBe('fb');
    expect(asString(true, 'fb')).toBe('fb');
  });
});
