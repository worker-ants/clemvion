/**
 * 구조적 회귀 가드가 **소스를 세는** 방식의 단일 출처. 테스트 전용이다
 * (`tsconfig.build.json` 이 `__testing__` 을 제외해 dist 에 실리지 않는다).
 *
 * ## 왜 공유하나
 *
 * `assert-row-array.spec.ts` 와 `update-returning-rows.spec.ts` 는 각자
 * "헬퍼 호출 수 == 소비 지점 수" 를 세는 같은 모양의 가드를 갖고 있다. 한쪽만
 * 하드닝하면 나머지에 같은 결함 클래스가 남는다 — 실제로 `00_54_01` testing
 * WARNING 1 이 그 비대칭을 잡았다(주석 스트리핑을 한쪽에만 적용했다).
 *
 * 세 번째 가드가 생겨도 여기만 고치면 되도록 둘의 계산을 여기로 모은다.
 */

/**
 * 블록 주석과 **주석만 있는 줄**을 지운다.
 *
 * 주석 속 심벌 언급이 카운트에 섞이면 가드가 **약해진다** — 호출을 빠뜨린 파일이
 * 주석에서 헬퍼를 언급하기만 해도 개수가 맞아 통과해 버린다. 실제로
 * `auth-oauth.service.ts` 의 docstring 이 처방을 설명하며 심벌을 적었다가 2로 셌다.
 *
 * 줄 끝 `//` 는 건드리지 않는다 — 대상 파일들엔 `https://` 가 있어 URL 을 자르게 된다.
 * 잘라도 결과는 "개수가 줄어 RED" 라 조용히 통과하는 방향은 아니지만, 굳이 오탐을
 * 만들 이유가 없다.
 */
export function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
}

/** 주석을 제외하고 `<name>(` 또는 `<name><` 호출 수를 센다. */
export function countCalls(src: string, name: string): number {
  const pattern = new RegExp(`\\b${name}[<(]`, 'g');
  return (stripComments(src).match(pattern) ?? []).length;
}
