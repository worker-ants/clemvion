import { isRecord, toRecord } from './to-record';

describe('isRecord', () => {
  it('plain object 에 true', () => {
    expect(isRecord({})).toBe(true);
    expect(isRecord({ a: 1 })).toBe(true);
  });

  it('null / undefined / 원시값 / 배열 에 false', () => {
    expect(isRecord(null)).toBe(false);
    expect(isRecord(undefined)).toBe(false);
    expect(isRecord(0)).toBe(false);
    expect(isRecord('')).toBe(false);
    expect(isRecord('x')).toBe(false);
    expect(isRecord(false)).toBe(false);
    expect(isRecord([])).toBe(false);
    expect(isRecord([1, 2])).toBe(false);
  });

  it('가드 통과 시 Record 로 좁혀진다 (컴파일 타임 narrowing)', () => {
    const value: unknown = { foo: 'bar' };
    if (isRecord(value)) {
      // 타입이 Record<string, unknown> 로 좁혀져 인덱싱 가능
      expect(value.foo).toBe('bar');
    } else {
      throw new Error('unreachable');
    }
  });
});

describe('toRecord', () => {
  it('객체는 동일 참조로 반환', () => {
    const obj = { a: 1 };
    expect(toRecord(obj)).toBe(obj);
  });

  it('null / undefined 는 빈 객체 (기존 `?? {}` 보존)', () => {
    expect(toRecord(null)).toEqual({});
    expect(toRecord(undefined)).toEqual({});
  });

  it('배열 / 원시값도 빈 객체로 수렴', () => {
    expect(toRecord([1, 2])).toEqual({});
    expect(toRecord(42)).toEqual({});
    expect(toRecord('str')).toEqual({});
    expect(toRecord(true)).toEqual({});
  });

  it('property 접근 관점에서 malformed 값이 undefined 로 동일하게 수렴', () => {
    // 기존 `(x as Record) ?? {}` 후 property 접근과 동일한 결과
    expect(toRecord(null)['missing']).toBeUndefined();
    expect(toRecord(42)['missing']).toBeUndefined();
  });
});
