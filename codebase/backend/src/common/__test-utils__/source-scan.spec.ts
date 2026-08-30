import {
  countCalls,
  countRawUpdateReturning,
  hasRawUpdateReturning,
} from './source-scan';

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

/**
 * 자매 `countCalls` 는 위에 전용 테스트 6개가 있는데 `hasRawUpdateReturning` /
 * `countRawUpdateReturning` 은 지금까지 0개였다 — 판정 축 전체가 "오늘의 실제 소스가
 * 우연히 그 형태를 담고 있는가" 에만 의존했다는 뜻이다 (`01_12_26` testing W3). 합성
 * 문자열로 각 판정 축을 직접 고정한다. 음성 케이스가 없으면 `return true` 로 뭉갠
 * 뮤턴트가 전부 살아남는다 — 그래서 양성/음성을 모두 둔다.
 */
describe('countRawUpdateReturning / hasRawUpdateReturning', () => {
  describe('양성 — raw UPDATE/DELETE … RETURNING 을 찾아낸다', () => {
    it.each([
      [
        '백틱 SQL 리터럴',
        'await db.query(`UPDATE t SET x = 1 WHERE id = $1 RETURNING x`);',
      ],
      [
        '작은따옴표 SQL 리터럴 — 과거 CRITICAL(소셜 로그인 상시 실패)의 사각지대였다',
        "await db.query('UPDATE t SET x = 1 WHERE id = $1 RETURNING x');",
      ],
      [
        '큰따옴표 SQL 리터럴',
        'await db.query("UPDATE t SET x = 1 WHERE id = $1 RETURNING x");',
      ],
      [
        'DELETE … RETURNING',
        'await db.query(`DELETE FROM t WHERE id = $1 RETURNING id`);',
      ],
      [
        '제네릭 타입 인자가 있는 호출 (`.query<Row[]>(`)',
        'await db.query<{ id: string }[]>(`UPDATE t SET x = 1 RETURNING id`);',
      ],
      [
        '중첩 제네릭 `.query<Array<{...}>>(` — W1 fix 검증, `scripts/eval-retrieval.ts:162` 실형태',
        'await db.query<Array<{ id: string }>>(`UPDATE t SET x = 1 RETURNING id`);',
      ],
    ])('%s', (_label, src) => {
      expect(hasRawUpdateReturning(src)).toBe(true);
      expect(countRawUpdateReturning(src)).toBe(1);
    });
  });

  describe('음성 — 대상이 아닌 형태는 뭉개지 않는다', () => {
    it.each([
      [
        'INSERT … RETURNING — command tag 가 INSERT 라 튜플이 아니라 행 배열',
        'await db.query(`INSERT INTO t (a) VALUES ($1) RETURNING id`);',
      ],
      [
        'INSERT … ON CONFLICT DO UPDATE … RETURNING — 본문에 UPDATE 가 있어도 태그는 INSERT',
        'await db.query(`INSERT INTO t (a) VALUES ($1) ON CONFLICT (a) DO UPDATE SET a = $1 RETURNING id`);',
      ],
      [
        'UPDATE 인데 RETURNING 이 없음',
        'await db.query(`UPDATE t SET x = 1 WHERE id = $1`);',
      ],
      [
        '주석 안에 든 UPDATE … RETURNING — stripComments 축',
        '/* await db.query(`UPDATE t SET x = 1 RETURNING x`); */',
      ],
      [
        'QueryBuilder .update().returning().execute() — UpdateResult 계약, .query() 가 아니다',
        "await qb.update(T).set({ x: 1 }).returning('*').execute();",
      ],
      [
        // `countRawUpdateReturning` 의 docstring 이 스스로 적어 둔 blind spot이다 —
        // **고쳐야 할 결함이 아니라 의도된 한계를 RED 방향으로 고정한다.** SQL 이 변수에
        // 담기면 `.query(` 뒤에 문자열 리터럴이 오지 않아 판정 축이 원리적으로 못 본다.
        // 넓히려면 데이터플로 분석이 필요해 정규식 스캐너 범위 밖 — 다음 사람이 이걸
        // 버그로 보고 스캐너를 넓히려 들지 않도록 여기 명시한다 (`13_15_58` testing W3).
        '`.query(sqlVar)` — SQL 이 변수에 담기면 못 본다. 알려진 한계, RED 로 고정(고칠 대상 아님)',
        'const sql = `UPDATE t SET x = 1 WHERE id = $1 RETURNING x`;\nawait db.query(sql, [1]);',
      ],
      [
        // 제네릭 부분 정규식이 한 단계 중첩까지만 받는다 — 2단계 이상은 여전히 못 받는다
        // (source-scan.ts 의 `countRawUpdateReturning` docstring 참조). **의도된 한계를
        // 고정**한다, 고칠 대상 아님 (`13_15_58` testing W3).
        '2단계 이상 중첩 제네릭 `.query<Array<Map<string, Row>>>(` — 알려진 한계, RED 로 고정(고칠 대상 아님)',
        'await db.query<Array<Map<string, Row>>>(`UPDATE t SET x = 1 RETURNING id`);',
      ],
      [
        // **이건 오탐 배제가 아니라 진짜 미탐지다.** PostgreSQL 은 CTE 를 얹어도 top-level 이
        // UPDATE 면 command tag 가 그대로라 반환이 `[rows, count]` 튜플이다. 그런데 판정은
        // 첫 키워드를 보므로 `WITH` 에서 어긋난다. 넓히지 않는 이유는 첫 키워드 판정이
        // `INSERT … ON CONFLICT DO UPDATE` 오탐 배제의 근거이기도 해서다 — CTE 를 받으려면
        // SQL 파서가 필요하다. 오늘 저장소에 이 형태는 없다(전수 확인).
        //
        // 1라운드 리뷰가 이미 짚었는데 SUMMARY 합성에서 누락돼 두 라운드를 지나갔다
        // (`13_46_53` W4 재발견). **한계를 아는 것과 고정하는 것은 다르다** — 여기 없었으면
        // 세 번째로 잊혔을 것이다.
        'CTE 접두 `WITH … UPDATE … RETURNING` — 진짜 미탐지. 알려진 한계, RED 로 고정(고칠 대상 아님)',
        'await db.query(`WITH x AS (SELECT 1) UPDATE t SET a = 1 RETURNING id`);',
      ],
    ])('%s', (_label, src) => {
      expect(hasRawUpdateReturning(src)).toBe(false);
      expect(countRawUpdateReturning(src)).toBe(0);
    });
  });

  it('여러 지점을 존재-only 가 아니라 개수로 센다 (W2 하드닝의 토대)', () => {
    const src = [
      'await db.query(`UPDATE a SET x = 1 WHERE id = $1 RETURNING x`);',
      'await db.query(`DELETE FROM b WHERE id = $1 RETURNING id`);',
    ].join('\n');
    expect(countRawUpdateReturning(src)).toBe(2);
    expect(hasRawUpdateReturning(src)).toBe(true);
  });
});
