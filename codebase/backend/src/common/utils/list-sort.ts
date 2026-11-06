/**
 * 목록 API 의 `sort` 값을 허용 목록에서 찾아 ORDER BY 에 넣을 값을 돌려준다.
 *
 * 허용 목록에 자기 속성(own property)으로 있는 키만 받고 나머지는 `fallback` 을 돌려준다. 판정은
 * `Object.hasOwn` 으로 한다. `allowed[sort] || fallback` 처럼 조회하면 `PaginationQueryDto.sort` 정규식을
 * 통과하는 `constructor` · `toString` 같은 값에서 Object 내장 함수가 나와 폴백을 건너뛰고, 그 함수의 소스
 * 문자열이 ORDER BY 에 들어간다(CLE-T-FXJ9CF).
 *
 * 돌려준 값은 SQL 식별자로 그대로 들어간다. 그래서 사용자 입력은 돌려주지 않고 허용 목록의 값이나
 * `fallback` 만 돌려준다.
 */
export function pickSortColumn<T extends string>(
  allowed: Readonly<Record<string, T>>,
  sort: string | undefined,
  // 값 타입은 허용 목록에서만 추론한다. fallback 이 리터럴이어도 `Record<string, string>` 목록을 받는다.
  fallback: NoInfer<T>,
): T {
  return sort !== undefined && Object.hasOwn(allowed, sort)
    ? allowed[sort]
    : fallback;
}
