import { countCalls } from './source-scan';

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

  /**
   * **부풀리는 방향**이 가드를 조용히 무력화한다 — 호출을 빠뜨린 파일이 줄 끝
   * 주석에서 헬퍼를 언급하기만 해도 개수가 맞아 통과한다 (`01_12_26` testing W5).
   */
  it('줄 끝 주석 속 언급도 세지 않는다 — 카운트를 부풀리는 방향', () => {
    const src = 'const rows = foo(x); // foo(y) 는 옛 방식이다\nfoo(z);';
    expect(countCalls(src, 'foo')).toBe(2); // 주석의 foo(y) 는 제외
  });

  /**
   * 문자열 안의 `//` 도 주석으로 보고 자른다. **의도된 선택**이다 — 틀리는 방향이
   * "개수가 줄어 RED" 라 조용히 통과하지 않는다. 실측상 대상 파일 4개에서 이 형태는
   * 카운트를 바꾸지 않았다(URL 8줄 중 헬퍼 호출과 같은 줄에 있는 것 없음).
   *
   * 이 테스트는 "버그" 가 아니라 **현재 동작을 명시 고정**한다. 언젠가 이 형태가 실제로
   * 나오면 여기가 먼저 설명해 준다.
   */
  it('문자열 안 URL 뒤의 호출은 잘려 나간다 — 알려진 한계, 방향은 RED', () => {
    const src = "const u = 'https://x.test'; foo(u);";
    expect(countCalls(src, 'foo')).toBe(0);
  });

  it('URL 이 호출과 다른 줄이면 영향 없다 (실제 대상 파일들의 형태)', () => {
    const src = "const u = 'https://x.test';\nfoo(u);";
    expect(countCalls(src, 'foo')).toBe(1);
  });
});
