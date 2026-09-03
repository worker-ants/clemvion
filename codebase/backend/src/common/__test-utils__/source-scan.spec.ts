import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import {
  collectTsFiles,
  countCalls,
  countRawUpdateReturning,
  hasRawUpdateReturning,
  stripLiterals,
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
      [
        // 프로덕션 지점은 대부분 여러 줄짜리 템플릿 리터럴이다 — 이 diff 가 함께 고친
        // `kb-stats.helper.ts` 의 UPDATE 부터가 8줄에 걸쳐 있다. 그런데 이 축은 여태
        // **오늘의 실제 소스가 우연히 멀티라인 형태를 담고 있는가** 로만 간접 검증됐다
        // (`14_11_02` testing INFO). 직전 커밋 `#1235` 가 자매 가드에서 정확히 이
        // 멀티라인 축으로 무너졌으므로 실제 소스와 무관하게 여기 고정한다.
        '멀티라인 백틱 리터럴 — `UPDATE` 와 `RETURNING` 이 다른 줄 (실제 지점의 지배적 형태)',
        'await db.query(`\n  UPDATE t\n     SET x = 1\n   WHERE id = $1\n  RETURNING x\n`);',
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

/**
 * `collectTsFiles` 는 `repo-guards/__tests__/` 의 walker **사본 5개**를 대체한다. 여기가
 * 틀리면 다섯 가드가 **동시에** 다른 파일을 본다 — 그래서 각 필터를 직접 단언한다.
 *
 * 픽스처는 `os.tmpdir()` 에 만든다. 실제 소스 트리를 대상으로 삼으면 저장소가 바뀔 때마다
 * 기대값이 흔들리고, 무엇보다 **가드 테스트가 실파일을 건드리는 사고**가 이 저장소에서
 * 이미 한 번 있었다.
 */
describe('collectTsFiles', () => {
  let root: string;

  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'collect-ts-'));
    const mk = (rel: string): void => {
      const full = path.join(root, rel);
      fs.mkdirSync(path.dirname(full), { recursive: true });
      fs.writeFileSync(full, '// fixture\n');
    };
    mk('a.ts');
    mk('nested/b.ts');
    mk('nested/deep/c.ts');
    mk('a.spec.ts');
    mk('nested/b.spec.ts');
    mk('types.d.ts');
    mk('README.md');
    // `-`(0x2D) 는 `/`(0x2F) 보다 앞선다 → 정렬은 이 파일을 `nested/*` **앞**에 두는데,
    // DFS 는 `nested`(디렉터리)를 먼저 들어가므로 **뒤**에 온다. 이 한 줄이 정렬 분기를
    // 관측 가능하게 만든다.
    mk('nested-sibling.ts');
    mk('node_modules/pkg/index.ts');
    mk('dist/bundle.ts');
  });

  afterEach(() => {
    fs.rmSync(root, { recursive: true, force: true });
  });

  const rel = (files: string[]): string[] =>
    files.map((f) => path.relative(root, f).split(path.sep).join('/'));

  it('기본값은 `.spec.ts` 를 제외한다 — 대부분의 가드가 프로덕션 소스만 본다', () => {
    expect(rel(collectTsFiles(root))).toEqual([
      'a.ts',
      'nested-sibling.ts',
      'nested/b.ts',
      'nested/deep/c.ts',
    ]);
  });

  /**
   * ## 정렬은 `nested-sibling.ts` 한 줄이 관측 가능하게 만든다
   *
   * 위·아래 `toEqual` 의 기대 배열은 **정렬된 순서**다. 구현이 `sort()` 를 잃으면 결과는
   * DFS 순회 순서가 되고, 픽스처의 `nested-sibling.ts` 덕분에 그 둘이 갈린다:
   *
   * | | 순서 |
   * |---|---|
   * | DFS | `… nested/b.ts, nested/deep/c.ts, nested-sibling.ts` |
   * | 정렬 | `… nested-sibling.ts, nested/b.ts, nested/deep/c.ts` |
   *
   * `-`(0x2D) 가 `/`(0x2F) 보다 앞서기 때문이다.
   *
   * > **초판은 여기에 "이 환경에서는 원리적으로 못 잡는다" 고 적었다 — 틀렸다** (리뷰 W1).
   * > 근거로 "정렬은 서브트리를 연속으로 유지하고 DFS 도 그러므로 둘이 같다" 를 댔는데,
   * > 연속성은 유지되지만 **형제 파일과 그 서브트리의 상대 위치가 뒤집힌다.** 실측으로
   * > 반증됐다 — 그 문장을 믿었으면 닫을 수 있는 커버리지를 영구히 열어 뒀을 것이다.
   * >
   * > (`fs.readdirSync` 를 spy 로 뒤집는 방법도 시도했으나 `node:fs` property 가
   * > non-configurable 이라 실패했다. 픽스처 쪽이 어차피 더 단순하다.)
   */
  it('`includeSpec` 은 `.spec.ts` 를 되살린다 — masked-reject 가드가 쓰는 유일한 축', () => {
    expect(rel(collectTsFiles(root, { includeSpec: true }))).toEqual([
      'a.spec.ts',
      'a.ts',
      'nested-sibling.ts',
      'nested/b.spec.ts',
      'nested/b.ts',
      'nested/deep/c.ts',
    ]);
  });

  it('`.d.ts` 는 옵션과 무관하게 항상 제외한다', () => {
    for (const opts of [{}, { includeSpec: true }]) {
      expect(rel(collectTsFiles(root, opts))).not.toContain('types.d.ts');
    }
  });

  it('`node_modules`·`dist` 는 옵션과 무관하게 항상 건너뛴다', () => {
    for (const opts of [{}, { includeSpec: true }]) {
      const files = rel(collectTsFiles(root, opts));
      expect(files).not.toContain('node_modules/pkg/index.ts');
      expect(files).not.toContain('dist/bundle.ts');
    }
  });

  it('`.ts` 가 아닌 파일은 담지 않는다', () => {
    expect(rel(collectTsFiles(root)).some((f) => f.endsWith('.md'))).toBe(
      false,
    );
  });
});

/**
 * `stripLiterals` 는 "다음 가드도 쓴다" 를 존재 이유로 export 됐다. 자매 `stripComments`
 * 가 전용 테스트를 갖는데 이쪽만 간접 커버리지뿐이면 **같은 비대칭이 다시 생긴다** —
 * 이 모듈이 애초에 막으려던 것이 그 비대칭이다 (리뷰 W2).
 */
describe('stripLiterals', () => {
  it('작은따옴표 내용을 지우고 따옴표는 남긴다', () => {
    expect(stripLiterals(`const a = 'null as unknown as Date';`)).toBe(
      `const a = '';`,
    );
  });

  it('큰따옴표도 같다', () => {
    expect(stripLiterals(`const a = "x: null as unknown as Date";`)).toBe(
      `const a = "";`,
    );
  });

  it('템플릿 리터럴은 여러 줄이어도 통째로 지운다 — 가드 픽스처가 이 형태다', () => {
    const src = ['const ENTITY = `', '  widenedAt: Date | null;', '`;'].join(
      '\n',
    );
    expect(stripLiterals(src)).toBe('const ENTITY = ``;');
  });

  it('이스케이프된 따옴표에서 조기 종료하지 않는다', () => {
    // 종료로 오인하면 뒤쪽 `null as unknown as` 가 코드로 남아 오탐이 된다.
    expect(stripLiterals(`const a = 'it\\'s null as unknown as Date';`)).toBe(
      `const a = '';`,
    );
  });

  it('리터럴 밖의 코드는 건드리지 않는다', () => {
    const src = `const f = { widenedAt: null as unknown as Date };`;
    expect(stripLiterals(src)).toBe(src);
  });

  it('여러 리터럴을 각각 지운다', () => {
    expect(stripLiterals(`f('a', "b", \`c\`);`)).toBe(`f('', "", \`\`);`);
  });

  /**
   * docstring 이 스스로 적어 둔 한계를 **테스트로 고정**한다. 고쳐야 할 버그가 아니라
   * 알려진 경계이고, 틀리는 방향이 "덜 검출" 이라 조용히 통과한다 — 그래서 여기 남긴다.
   * 이 테스트가 깨지면 누군가 한계를 없앤 것이고, 그때 docstring 도 함께 고쳐야 한다.
   */
  it('[알려진 한계] 템플릿 `${}` 안의 중첩 백틱은 경계를 잘못 잡는다', () => {
    const src = 'const a = `x${`y`}z`;';
    // 이상적으로는 `` 하나여야 하지만, 첫 백틱 쌍이 `x${` 에서 닫힌다.
    expect(stripLiterals(src)).not.toBe('const a = ``;');
  });
});
