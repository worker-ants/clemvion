import { omitUndefined } from './omit-undefined';

describe('omitUndefined', () => {
  it('undefined 인 키만 빼고 falsy 값(null · 0 · 빈 문자열 · false)은 남긴다', () => {
    expect(
      omitUndefined({
        a: undefined,
        b: null,
        c: 0,
        d: '',
        e: false,
        f: 'x',
      }),
    ).toStrictEqual({ b: null, c: 0, d: '', e: false, f: 'x' });
  });

  it('입력을 바꾸지 않는다 — 사본을 돌려준다', () => {
    const input = { a: undefined, b: 1 };
    const out = omitUndefined(input);
    expect(out).not.toBe(input);
    expect(Object.keys(input)).toEqual(['a', 'b']);
  });

  it('얕게만 본다 — 중첩 객체 안의 undefined 는 그대로다', () => {
    const nested = { inner: undefined };
    expect(omitUndefined({ n: nested }).n).toBe(nested);
  });

  // 이 헬퍼가 막는 결함의 형태 — 클래스 필드는 값이 없어도 own property 로 정의된다(`useDefineForClassFields`).
  it('값을 안 준 클래스 필드(undefined own property)를 뺀다', () => {
    class PartialBody {
      name?: string;
      sortOrder?: number;
    }
    const body = Object.assign(new PartialBody(), { name: 'Renamed' });
    expect(Object.keys(body)).toEqual(['name', 'sortOrder']);
    expect(omitUndefined(body)).toStrictEqual({ name: 'Renamed' });
  });
});
