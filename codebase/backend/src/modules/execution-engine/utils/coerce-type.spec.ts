import { coerceToType } from './coerce-type';

describe('coerceToType', () => {
  it('returns null for null/undefined', () => {
    expect(coerceToType(null, 'string')).toBeNull();
    expect(coerceToType(undefined, 'number')).toBeNull();
  });

  describe('number', () => {
    it('coerces numeric strings', () => {
      expect(coerceToType('42', 'number')).toBe(42);
      expect(coerceToType('3.14', 'number')).toBe(3.14);
    });
    it('returns null for non-numeric', () => {
      expect(coerceToType('abc', 'number')).toBeNull();
    });
    it('passes through numbers', () => {
      expect(coerceToType(7, 'number')).toBe(7);
    });
  });

  describe('boolean', () => {
    it('coerces "true"/"false" strings', () => {
      expect(coerceToType('true', 'boolean')).toBe(true);
      expect(coerceToType('false', 'boolean')).toBe(false);
    });
    it('passes through booleans', () => {
      expect(coerceToType(true, 'boolean')).toBe(true);
    });
  });

  describe('array', () => {
    it('parses JSON array strings', () => {
      expect(coerceToType('[1,2,3]', 'array')).toEqual([1, 2, 3]);
    });
    it('passes through arrays', () => {
      expect(coerceToType([1, 2], 'array')).toEqual([1, 2]);
    });
  });

  describe('object', () => {
    it('parses JSON object strings', () => {
      expect(coerceToType('{"a":1}', 'object')).toEqual({ a: 1 });
    });
    it('passes through objects', () => {
      expect(coerceToType({ x: 1 }, 'object')).toEqual({ x: 1 });
    });
  });

  describe('string (default)', () => {
    it('stringifies numbers/booleans', () => {
      expect(coerceToType(5, 'string')).toBe('5');
      expect(coerceToType(false, 'string')).toBe('false');
    });
    it('passes through strings', () => {
      expect(coerceToType('hi', 'string')).toBe('hi');
    });
    it('JSON stringifies objects', () => {
      expect(coerceToType({ a: 1 }, 'string')).toBe('{"a":1}');
    });
  });
});
