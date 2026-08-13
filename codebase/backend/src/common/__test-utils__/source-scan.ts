/**
 * 구조적 회귀 가드가 **소스를 세는** 방식의 단일 출처. 테스트 전용이다.
 *
 * jest 타입 비의존 — build tsc 가 `__test-utils__` 를 컴파일하므로 의도적으로 순수
 * 함수만 둔다 (`workspace-id-fixtures.ts`·`modules/integrations/__test-utils__` 와 같은 관례).
 *
 * > 처음엔 `common/utils/__testing__/` 라는 **새 디렉토리**에 두고 `tsconfig.build.json`
 * > 에서 제외했다. 저장소에 이미 `__test-utils__`(2곳)·`__tests__`·`__test__` 가 있어
 * > **네 번째 변종**이었고, 제외도 내 디렉토리에만 걸려 비대칭이었다
 * > (`01_44_03` maintainability W2). 여기로 합치고 제외는 되돌렸다 — 자매 두 파일이
 * > docstring 에 "build 가 컴파일한다" 를 **전제로 적어 둔 계약**이라, 제외를 넓히는 건
 * > 내 파일이 아니라 남의 계약을 바꾸는 일이다.
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
 * 블록 주석과 `//` 주석(줄 끝 포함)을 지운다.
 *
 * 주석 속 심벌 언급이 카운트에 섞이면 가드가 **약해진다** — 호출을 빠뜨린 파일이
 * 주석에서 헬퍼를 언급하기만 해도 개수가 맞아 통과해 버린다. 실제로
 * `auth-oauth.service.ts` 의 docstring 이 처방을 설명하며 심벌을 적었다가 2로 셌다.
 *
 * ## 줄 끝 주석도 지우는 이유 — 두 방향의 위험이 대칭이 아니다
 *
 * 처음엔 줄 끝 `//` 를 남겼다. 대상 파일에 `'https://…'` 가 있어 URL 을 자르게 된다는
 * 이유였는데, **재보지 않고 쓴 트레이드오프였다** (`01_12_26` architecture/testing W2·W5).
 *
 * 실측하니 줄 끝까지 지워도 4개 대상 파일의 카운트가 **하나도 바뀌지 않았다** — URL 은
 * 8줄 있지만 헬퍼 호출과 같은 줄에 있는 것이 없다. 그리고 두 방향은 대칭이 아니다:
 *
 * | 남겨두면 | 지우면 |
 * |---|---|
 * | 주석 언급이 카운트를 **부풀려** 호출 누락을 가린다 → **조용히 통과** | URL 이 잘려 카운트가 **줄어** RED → 시끄럽지만 안전 |
 *
 * 가드의 존재 이유가 "조용히 통과" 를 막는 것이므로 그쪽을 닫는다. URL 과 호출이 같은
 * 줄에 놓이는 날이 오면 RED 로 드러나고, 그때 사람이 판단하면 된다.
 */
function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
}

/**
 * 주석을 제외하고 `<name>(` 또는 `<name><` 호출 수를 센다.
 *
 * 주석 처리 규칙과 그 한계는 `stripComments` 참조 — 특히 문자열 리터럴 안의 `//`
 * (URL 등)도 주석으로 보고 잘라낸다. 의도된 선택이고, 틀리는 방향이 RED 다.
 */
export function countCalls(src: string, name: string): number {
  const pattern = new RegExp(`\\b${name}[<(]`, 'g');
  return (stripComments(src).match(pattern) ?? []).length;
}
