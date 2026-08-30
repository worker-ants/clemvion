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

/**
 * 한 소스가 **raw `UPDATE`/`DELETE … RETURNING`** 을 실행하는가.
 *
 * ## 왜 필요한가 — 큐레이션 목록은 "새 지점" 을 못 본다
 *
 * 자매 가드들은 **손으로 고른 파일 목록**(`EXPECTED`)의 헬퍼 호출 수만 셌다. 그 방식은
 * *"아는 지점이 후퇴하지 않는지"* 는 지키지만 *"모르는 지점이 생겼는지"* 는 원리적으로
 * 못 본다 — 목록 밖 파일에 새 raw UPDATE 가 생기면 **아무 가드도 RED 를 내지 않는다**
 * (`01_12_26` architecture W1). 실측으로도 목록(3파일) 밖에 이미 대상이 있었다.
 *
 * 그래서 입력 집합을 **손으로 고르지 않고 발견**한다. 목록을 줄이는 편집이 조용히
 * 통과하던 표면이 사라진다.
 *
 * ## 판정 축 — SQL 리터럴의 **첫 키워드**
 *
 * `.query(` 뒤의 SQL 리터럴을 꺼내 **선두가 `UPDATE`/`DELETE` 인지**를 본다. 호출 주변을
 * 훑는 방식(윈도우)으로 하면 안 된다 — 실측에서 두 종류가 오탐으로 잡혔다:
 *
 * | 형태 | 왜 대상이 아닌가 |
 * |---|---|
 * | `INSERT … RETURNING` | command tag 가 INSERT — 튜플이 아니라 행 배열이다 |
 * | `INSERT … ON CONFLICT DO UPDATE … RETURNING` | 본문에 `UPDATE` 가 있지만 여전히 INSERT 태그다 |
 *
 * 선두 키워드로 가르면 둘 다 자연히 빠진다.
 *
 * ## 이 축이 **안** 보는 것 (의도 + 미문서 blind spot 정정)
 *
 * - QueryBuilder `.update().execute()` 는 대상이 아니다 — 그쪽 반환은 `[rows, count]` 튜플이
 *   아니라 `UpdateResult { raw, affected }` 라 애초에 다른 계약이다. 엔진 §7.4·§7.5 의
 *   **의도된 조건부 UPDATE**(경합 판정용 `affected` 기반)가 전부 그 형태이므로, 이 가드는
 *   그것들을 **구조적으로** 건드리지 않는다(allowlist 로 빼 줄 필요가 없다).
 * - **`.query(sqlVar)` — SQL 이 변수에 담겨 전달되면 원리적으로 못 본다.** 이 판정 축은
 *   `.query(` 뒤에 오는 **문자열 리터럴**만 읽는다. SQL 을 상수/템플릿으로 조립해 변수에
 *   담고 `.query(sql, params)` 처럼 넘기면 `m[1]` 이 리터럴이 아니라서 애초에 매치되지
 *   않는다(scratch 프로브로 실측, `false` 반환 — `01_12_26` W1). 넓히지 않는다 — 변수를
 *   추적하려면 데이터플로 분석이 필요해 정규식 스캐너의 범위를 벗어난다. 이 저장소의
 *   raw UPDATE/DELETE 지점은 지금까지 전부 리터럴이라 실피해는 없지만, 다음 사람이 변수로
 *   리팩터하면 **조용히** 이 가드의 사각지대로 들어간다는 뜻이다.
 * - **CTE 접두 — `WITH … UPDATE/DELETE … RETURNING` 을 못 본다.** 판정이 SQL 의 **첫
 *   키워드**를 보는데 CTE 는 `WITH` 로 시작하므로 `^\s*(UPDATE|DELETE)` 가 어긋난다.
 *   PostgreSQL 은 CTE 를 얹어도 top-level 이 UPDATE/DELETE 면 **command tag 가 그대로**라
 *   반환은 `[rows, count]` 튜플이다 — 즉 이건 오탐 배제가 아니라 **진짜 미탐지**다.
 *   오늘 저장소에 그 형태의 사용처는 없다(전수 확인). 넓히지 않는 이유는 첫 키워드 판정이
 *   `INSERT … ON CONFLICT DO UPDATE` 오탐을 배제하는 근거이기도 해서다 — CTE 를 받으려면
 *   본문을 파싱해 top-level 커맨드를 찾아야 하고, 그건 정규식 스캐너를 SQL 파서로 바꾸는
 *   일이다(이 저장소가 기록한 "유한한 문제를 무한한 문제와 바꾸지 말라").
 *
 *   > **이 항목은 1라운드 리뷰(`12_41_15` requirement)가 이미 짚었는데 SUMMARY 합성에서
 *   > 누락돼 두 라운드를 그냥 지나갔다** (`13_46_53` W4 가 재발견). 개별 리포트에 있던
 *   > 발견이 요약을 거치며 사라질 수 있다 — 요약만 읽고 처분하면 이렇게 샌다.
 */
export function countRawUpdateReturning(src: string): number {
  const clean = stripComments(src);
  // `.query(` / `.query<…>(` 뒤에 오는 첫 문자열 리터럴(백틱·작은따옴표·큰따옴표).
  // 작은따옴표를 빠뜨렸던 것이 과거 CRITICAL(소셜 로그인 상시 실패)의 사각지대였다.
  //
  // 제네릭 부분은 **한 단계 중첩**까지 받는다 — `.query<Array<{ id: string }>>(` 형태가
  // 저장소에 실존한다(`scripts/eval-retrieval.ts:162`). 옛 `<[^>]*>` 는 안쪽 `<...>` 를
  // 만나면 첫 `>` 에서 멈춰 버려 바깥 `.query<Array<...>>(` 전체가 매치 실패했다 — 오늘은
  // 전부 SELECT 라 무해하지만 이 자리에 UPDATE...RETURNING 이 오면 통째로 못 봤을 것이다
  // (`01_12_26` testing/requirement W1). 2단계 이상 중첩은 여전히 못 받는다 — 저장소
  // 실측상 1단계를 넘는 사례가 없어 그 이상은 넓히지 않는다.
  const CALL =
    /\.query\s*(?:<(?:[^<>]|<[^<>]*>)*>)?\s*\(\s*(`[^`]*`|'[^']*'|"[^"]*")/g;
  let count = 0;
  for (const m of clean.matchAll(CALL)) {
    const sql = m[1].slice(1, -1);
    if (/^\s*(UPDATE|DELETE)\b/i.test(sql) && /\bRETURNING\b/i.test(sql)) {
      count++;
    }
  }
  return count;
}

/** {@link countRawUpdateReturning} 의 "지점이 존재하는가" 만 필요할 때 쓰는 얇은 래퍼. */
export function hasRawUpdateReturning(src: string): boolean {
  return countRawUpdateReturning(src) > 0;
}
