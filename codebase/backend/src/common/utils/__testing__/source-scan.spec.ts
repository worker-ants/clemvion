import { countCalls, stripComments } from './source-scan';

/**
 * 이 헬퍼는 **가드가 무엇을 세는지**를 정하므로, 여기가 틀리면 두 구조적 가드가
 * 동시에 조용히 약해진다. 그래서 존재 이유(주석을 안 센다)를 직접 단언한다.
 */
describe('source-scan', () => {
  it('주석 속 언급은 세지 않는다 — 가드가 약해지는 방향이다', () => {
    const src = `
      /** 처방: updateReturningRows<T>(rows, detail) 를 쓴다. */
      // updateReturningRows(legacy) 는 더 이상 쓰지 않는다
      const rows = updateReturningRows<{ id: string }>(raw, 'real');
    `;
    // 주석을 안 지우면 3 이 되고, 호출을 빠뜨린 파일도 개수가 맞아 통과해 버린다.
    expect(countCalls(src, 'updateReturningRows')).toBe(1);
  });

  it('제네릭 호출과 일반 호출을 모두 센다', () => {
    expect(countCalls("a<T>(x); a('y');", 'a')).toBe(2);
  });

  it('접두가 같은 다른 심벌은 세지 않는다', () => {
    expect(
      countCalls('assertRowArrayDeep(x); assertRowArray(y);', 'assertRowArray'),
    ).toBe(1);
  });

  it('줄 끝 주석은 건드리지 않는다 — URL 이 잘리면 오탐이 난다', () => {
    const src = "const u = 'https://x.test'; foo(u);";
    expect(stripComments(src)).toBe(src);
    expect(countCalls(src, 'foo')).toBe(1);
  });
});
