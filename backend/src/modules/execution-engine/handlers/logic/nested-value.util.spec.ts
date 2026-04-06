import { getNestedValue, setNestedValue } from './nested-value.util.js';

describe('getNestedValue', () => {
  it('should get top-level value', () => {
    expect(getNestedValue({ a: 1 }, 'a')).toBe(1);
  });

  it('should get nested value', () => {
    expect(getNestedValue({ a: { b: { c: 3 } } }, 'a.b.c')).toBe(3);
  });

  it('should return undefined for missing path', () => {
    expect(getNestedValue({ a: 1 }, 'b')).toBeUndefined();
  });

  it('should return undefined for null intermediate', () => {
    expect(getNestedValue({ a: null }, 'a.b')).toBeUndefined();
  });

  it('should return undefined for undefined intermediate', () => {
    expect(getNestedValue({ a: undefined }, 'a.b')).toBeUndefined();
  });

  it('should return undefined for non-object intermediate', () => {
    expect(getNestedValue({ a: 42 }, 'a.b')).toBeUndefined();
  });

  it('should return undefined for null input', () => {
    expect(getNestedValue(null, 'a')).toBeUndefined();
  });

  it('should return undefined for undefined input', () => {
    expect(getNestedValue(undefined, 'a')).toBeUndefined();
  });

  it('should block __proto__ access', () => {
    expect(getNestedValue({}, '__proto__')).toBeUndefined();
  });

  it('should block constructor access', () => {
    expect(getNestedValue({}, 'constructor')).toBeUndefined();
  });

  it('should block prototype access in nested path', () => {
    expect(getNestedValue({ a: {} }, 'a.__proto__.polluted')).toBeUndefined();
  });
});

describe('setNestedValue', () => {
  it('should set top-level value', () => {
    const obj: Record<string, unknown> = {};
    setNestedValue(obj, 'a', 1);
    expect(obj.a).toBe(1);
  });

  it('should set nested value creating intermediates', () => {
    const obj: Record<string, unknown> = {};
    setNestedValue(obj, 'a.b.c', 3);
    expect((obj.a as Record<string, unknown>).b).toEqual({ c: 3 });
  });

  it('should overwrite existing value', () => {
    const obj: Record<string, unknown> = { a: 1 };
    setNestedValue(obj, 'a', 2);
    expect(obj.a).toBe(2);
  });

  it('should not pollute prototype via __proto__', () => {
    const obj: Record<string, unknown> = {};
    setNestedValue(obj, '__proto__.polluted', true);
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });

  it('should not pollute prototype via constructor.prototype', () => {
    const obj: Record<string, unknown> = {};
    setNestedValue(obj, 'constructor.prototype.polluted', true);
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });

  it('should block prototype as last key', () => {
    const obj: Record<string, unknown> = { a: {} };
    setNestedValue(obj, 'a.prototype', 'bad');
    expect((obj.a as Record<string, unknown>).prototype).toBeUndefined();
  });
});
