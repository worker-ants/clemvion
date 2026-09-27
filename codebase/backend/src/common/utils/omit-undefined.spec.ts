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

  // 경계 — 빈 본문(`{}`)과 아무 필드도 안 보낸 DTO 인스턴스는 병합해도 아무것도 바꾸지 않아야 한다(워크플로 `settings: {}`).
  it('빈 객체 · 전 필드가 undefined 인 입력은 빈 객체가 된다', () => {
    class Settings {
      maxConcurrentExecutions?: number;
    }
    expect(omitUndefined({})).toStrictEqual({});
    expect(omitUndefined(new Settings())).toStrictEqual({});
  });

  /**
   * 배열은 인덱스 키 객체(`{ 0: … }`)로 무너지므로 타입이 막는다. jest 는 타입을 지우므로 이 단언은 build 단계의 타입체크
   * ratchet(`tsconfig.json` 이 spec 을 포함한다)이 본다 — 제약이 풀리면 아래 `@ts-expect-error` 가 «쓰이지 않는 지시어»(TS2578)가
   * 되어 ratchet 이 늘어난다.
   */
  it('배열은 받지 않는다 (타입 — build 의 타입체크 ratchet 이 본다)', () => {
    // @ts-expect-error — 배열은 받지 않는다
    const out = omitUndefined([1, undefined]);
    expect(out).toStrictEqual({ 0: 1 });
  });
});
