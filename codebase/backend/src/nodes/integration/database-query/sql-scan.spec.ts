import { IntegrationError } from '../_base/integration-handler-base.js';
import {
  convertMysqlPlaceholders,
  extractSqlVerb,
  isWriteOperation,
} from './sql-scan.js';

// SQL 스캐너 단위 테스트. database-query.handler.spec.ts 에서 옮겼다(CLE-T-KSMRAY).

// W2 + W4 — extractSqlVerb unit tests (INT-US-05)
describe('extractSqlVerb', () => {
  it('returns null for undefined input', () => {
    expect(extractSqlVerb(undefined)).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(extractSqlVerb('')).toBeNull();
  });

  it('extracts SELECT from a standard query', () => {
    expect(extractSqlVerb('SELECT id FROM users WHERE age > $1')).toBe(
      'SELECT',
    );
  });

  it('handles leading whitespace', () => {
    expect(extractSqlVerb('  SELECT 1')).toBe('SELECT');
  });

  it('uppercases mixed-case SQL verb', () => {
    expect(extractSqlVerb('SeLeCt 1')).toBe('SELECT');
  });

  it('returns null when first token starts with a digit', () => {
    expect(extractSqlVerb('123invalid')).toBeNull();
  });

  it('extracts WITH for CTE queries', () => {
    expect(extractSqlVerb('WITH cte AS (SELECT 1) SELECT * FROM cte')).toBe(
      'WITH',
    );
  });

  it('extracts INSERT', () => {
    expect(extractSqlVerb('INSERT INTO t VALUES ($1)')).toBe('INSERT');
  });

  it('extracts UPDATE', () => {
    expect(extractSqlVerb('UPDATE t SET col = $1 WHERE id = $2')).toBe(
      'UPDATE',
    );
  });

  it('extracts DELETE', () => {
    expect(extractSqlVerb('DELETE FROM t WHERE id = $1')).toBe('DELETE');
  });

  // W4 — over-length SQL verb (9-char SAVEPOINT gets clamped by clampApiField downstream)
  it('returns full SAVEPOINT (9 chars) — clampApiField upstream of DB write handles truncation', () => {
    // extractSqlVerb itself returns the full verb; callers apply clampApiField.
    expect(extractSqlVerb('SAVEPOINT sp1')).toBe('SAVEPOINT');
  });

  it('returns ROLLBACK (8 chars — exactly at api_method limit)', () => {
    expect(extractSqlVerb('ROLLBACK')).toBe('ROLLBACK');
  });

  it('returns TRUNCATE (8 chars — exactly at api_method limit)', () => {
    expect(extractSqlVerb('TRUNCATE t')).toBe('TRUNCATE');
  });
});

// W8 — isWriteOperation unit tests (dry-run 부수효과 판정, CLE-NODE-DBQUERY 「dry-run」)
// CLE-T-KH11HA: queryType 과 관계없이 SQL 첫 동사를 본다. 읽기 동사만 실제로 실행하고 쓰기 동사와
// 판정이 애매한 쿼리(WITH · CALL · DO · COPY · EXPLAIN 등)는 mock 으로 끝낸다.
describe('convertMysqlPlaceholders (CLE-T-6BV9VP)', () => {
  const convert = (sql: string, params: unknown[]) =>
    convertMysqlPlaceholders(sql, params);

  it('rebinds $N to parameters[N-1] in order of appearance, repeating as needed', () => {
    expect(convert('SELECT $2, $1, $2', ['a', 'b'])).toEqual({
      sql: 'SELECT ?, ?, ?',
      values: ['b', 'a', 'b'],
    });
  });

  it('passes a query without $N through untouched (native ? placeholders)', () => {
    const params = [1, 2];
    const out = convert('INSERT INTO t (a, b) VALUES (?, ?)', params);
    expect(out.sql).toBe('INSERT INTO t (a, b) VALUES (?, ?)');
    expect(out.values).toBe(params);
  });

  it.each<[string, string, string]>([
    ['single-quoted literal', "SELECT '$1' , $1", "SELECT '$1' , ?"],
    [
      'doubled quote inside literal',
      "SELECT 'it''s $1', $1",
      "SELECT 'it''s $1', ?",
    ],
    [
      'backslash escape inside literal',
      "SELECT 'O\\'$1', $1",
      "SELECT 'O\\'$1', ?",
    ],
    ['double-quoted string', 'SELECT "$1 \\" $1", $1', 'SELECT "$1 \\" $1", ?'],
    [
      'backtick identifier',
      'SELECT `c$1` FROM t WHERE a = $1',
      'SELECT `c$1` FROM t WHERE a = ?',
    ],
    ['-- line comment', 'SELECT $1 -- $1\nFROM t', 'SELECT ? -- $1\nFROM t'],
    ['# line comment', 'SELECT $1 # $1\nFROM t', 'SELECT ? # $1\nFROM t'],
    ['block comment', 'SELECT /* $1 */ $1', 'SELECT /* $1 */ ?'],
    [
      'identifier with $ before the number',
      'SELECT a$1, $1 FROM t',
      'SELECT a$1, ? FROM t',
    ],
    [
      'identifier with letters after the number',
      'SELECT $1a, $1 FROM t',
      'SELECT $1a, ? FROM t',
    ],
  ])('skips $N inside a %s', (_label, sql, expected) => {
    expect(convert(sql, ['v'])).toEqual({ sql: expected, values: ['v'] });
  });

  it.each<[string, string, string]>([
    // MySQL 은 `--` 뒤에 공백이 있어야 주석으로 읽는다. `--$1` 은 두 번의 부호 반전 뒤의 값이다.
    ['-- without a following space', 'SELECT 1 --$1', 'SELECT 1 --?'],
    // 실행 주석 `/*! … */` 의 안쪽은 MySQL 이 SQL 로 실행한다.
    ['executable comment', 'SELECT /*!50000 $1 */ 1', 'SELECT /*!50000 ? */ 1'],
  ])(
    'converts $N inside a %s, which MySQL reads as SQL',
    (_label, sql, expected) => {
      expect(convert(sql, ['v'])).toEqual({ sql: expected, values: ['v'] });
    },
  );

  it.each<[string, string, unknown[]]>([
    ['beyond the parameters array', 'SELECT $1, $3', ['a', 'b']],
    ['$0', 'SELECT $0', ['a']],
    ['with an empty parameters array', 'SELECT $1', []],
    ['mixed with a native ? placeholder', 'SELECT $1, ?', ['a', 'b']],
  ])('rejects $N %s with INVALID_PARAMETERS', (_label, sql, params) => {
    let thrown: unknown;
    try {
      convert(sql, params);
    } catch (err) {
      thrown = err;
    }
    expect(thrown).toBeInstanceOf(IntegrationError);
    expect((thrown as IntegrationError).code).toBe('INVALID_PARAMETERS');
  });

  it('ignores a ? inside a literal or comment when $N is used', () => {
    expect(convert("SELECT '?', $1 /* ? */", ['v'])).toEqual({
      sql: "SELECT '?', ? /* ? */",
      values: ['v'],
    });
  });

  it.each<[string, string]>([
    ['double-quoted literal', 'SELECT "?", $1'],
    ['# comment', 'SELECT $1 # ?\n'],
  ])('rejects $N mixed with a ? that mysql2 would bind (%s)', (_label, sql) => {
    let thrown: unknown;
    try {
      convert(sql, ['v']);
    } catch (err) {
      thrown = err;
    }
    expect(thrown).toBeInstanceOf(IntegrationError);
    expect((thrown as IntegrationError).code).toBe('INVALID_PARAMETERS');
  });

  it('stops at an unclosed literal and leaves the rest as written', () => {
    expect(convert("SELECT $1, 'open $1", ['v'])).toEqual({
      sql: "SELECT ?, 'open $1",
      values: ['v'],
    });
  });
});

describe('isWriteOperation', () => {
  // queryType 이 insert · update · delete 가 아니면 SQL 로만 판정한다. 세 값 모두에서 같은 결과인지 본다.
  const SQL_JUDGED_QUERY_TYPES = ['select', 'raw', undefined] as const;
  function expectWrite(query: string | undefined, expected: boolean): void {
    for (const queryType of SQL_JUDGED_QUERY_TYPES) {
      expect({ queryType, write: isWriteOperation(queryType, query) }).toEqual({
        queryType,
        write: expected,
      });
    }
  }

  it('classifies queryType insert/update/delete as write', () => {
    expect(isWriteOperation('insert', undefined)).toBe(true);
    expect(isWriteOperation('update', undefined)).toBe(true);
    expect(isWriteOperation('delete', undefined)).toBe(true);
    // 명시한 쓰기 유형은 SQL 이 SELECT 여도 쓰기다.
    expect(isWriteOperation('insert', 'SELECT 1')).toBe(true);
  });

  it('queryType select does not bypass the SQL verb check (CLE-T-KH11HA)', () => {
    // 기본값 queryType=select 로 둔 DELETE 가 dry-run 에서 실제로 실행되던 결함.
    expect(isWriteOperation('select', 'DELETE FROM t')).toBe(true);
    expect(isWriteOperation('select', 'SELECT * FROM t')).toBe(false);
  });

  it.each([
    'INSERT INTO t VALUES (1)',
    'UPDATE t SET a = 1',
    'DELETE FROM t',
    'UPSERT INTO t VALUES (1)',
    'MERGE INTO t USING s ON (t.id = s.id)',
    'REPLACE INTO t VALUES (1)',
    'TRUNCATE TABLE t',
    'DROP TABLE t',
    'CREATE TABLE t (id int)',
    'ALTER TABLE t ADD col int',
    'GRANT SELECT ON t TO u',
    'REVOKE SELECT ON t FROM u',
  ])('write verb is write regardless of queryType: %s', (query) => {
    expectWrite(query, true);
  });

  it.each([
    'SELECT * FROM t',
    'select id from t',
    'SHOW TABLES',
    'DESCRIBE t',
    'DESC t',
    'VALUES (1), (2)',
    'TABLE t',
  ])('read verb runs for real: %s', (query) => {
    expectWrite(query, false);
  });

  it.each([
    'WITH gone AS (DELETE FROM t RETURNING id) SELECT * FROM gone',
    'WITH cte AS (SELECT 1) SELECT * FROM cte',
    'CALL refresh_stats()',
    'DO $$ BEGIN DELETE FROM t; END $$',
    "COPY t FROM '/tmp/x.csv'",
    'EXPLAIN ANALYZE DELETE FROM t',
    '(SELECT 1)',
    '123 not sql',
    '',
  ])('ambiguous query is mocked (safe side): %s', (query) => {
    expectWrite(query, true);
  });

  it('skips leading comments before reading the verb', () => {
    expectWrite('-- purge\nDELETE FROM t', true);
    expectWrite('/* a */ /* b */ DELETE FROM t', true);
    expectWrite('-- report\n  SELECT * FROM t', false);
    expectWrite('/* note */SELECT 1', false);
    // 닫히지 않은 블록 주석은 동사를 찾지 못해 애매함 → mock.
    expectWrite('/* open SELECT 1', true);
  });

  it('missing query is mocked', () => {
    expectWrite(undefined, true);
  });

  describe('multi-statement queries (CLE-T-KH11HA)', () => {
    it.each([
      'SELECT 1; DELETE FROM t',
      'SELECT 1;DELETE FROM t',
      'SELECT 1;\r\nDROP TABLE t',
      'SELECT 1; -- c\nDELETE FROM t',
      'SELECT 1; /* c */ UPDATE t SET a = 1',
      'SELECT 1; SELECT 2',
      'SELECT 1;;',
      "SELECT ';' ; DELETE FROM t",
      'SELECT "a;b" FROM t; DELETE FROM t',
      'SELECT `a;b` FROM t; DELETE FROM t',
      'SELECT $$a$$; DELETE FROM t',
    ])('statement after a semicolon makes it write: %s', (query) => {
      expectWrite(query, true);
    });

    it.each([
      'SELECT 1;',
      'SELECT 1; ',
      'SELECT 1;\r\n',
      'SELECT 1; -- trailing',
      'SELECT 1; /* trailing */',
      'SELECT 1; -- only comment\n  /* more */ ',
    ])('a single trailing semicolon stays read: %s', (query) => {
      expectWrite(query, false);
    });

    it.each([
      "SELECT ';' FROM t",
      "SELECT 'it''s; fine' FROM t",
      'SELECT "a;b" FROM t',
      'SELECT "a"";b" FROM t',
      'SELECT `a;b` FROM t',
      'SELECT 1 -- a; b',
      'SELECT 1 /* a; b */',
      'SELECT $$a$$ FROM t',
      'SELECT $1, $2 FROM t',
      "SELECT ';';",
    ])(
      'semicolon inside a literal, identifier or comment stays read: %s',
      (query) => {
        expectWrite(query, false);
      },
    );

    it.each([
      "SELECT 'open; DELETE FROM t",
      'SELECT "open; DELETE FROM t',
      'SELECT `open; DELETE FROM t',
      'SELECT $$open; DELETE FROM t',
      'SELECT $tag$a$$; DELETE FROM t',
      "SELECT 'a\\'; DELETE FROM t; SELECT ''",
      'SELECT 1 /* /* nested */ ; DELETE FROM t */',
      'SELECT 1 /*! ; DELETE FROM t */',
      'SELECT 1 --;\nDELETE FROM t',
    ])('ambiguous or unterminated text is mocked: %s', (query) => {
      expectWrite(query, true);
    });
  });

  // 판정 시점에는 드라이버를 모른다. PostgreSQL · MySQL 두 방언으로 읽어 둘 다 읽기 한 문장일 때만
  // 실행한다(CLE-T-EANRHY).
  describe('two-dialect reading (CLE-T-EANRHY)', () => {
    it.each([
      // MySQL 기본 모드에서 큰따옴표는 백슬래시 이스케이프가 있는 문자열이다. `\"` 뒤의 `;` 가 문장 끝이 된다.
      'SELECT "a\\" , "; DELETE FROM t; -- "',
      'SELECT "a\\b" FROM t',
      // MySQL `#` 줄 주석이 PostgreSQL 에서는 연산자라 작은따옴표 리터럴이 줄을 넘는다.
      "SELECT 1 # '\n; DELETE FROM t; -- '",
      'SELECT 1 # c\n; DELETE FROM t',
      // PostgreSQL 은 `#` 를 주석으로 읽지 않아 동사를 찾지 못한다.
      '# c\nSELECT 1',
      // 달러 인용은 PostgreSQL 에만 있다. MySQL 에서는 `;` 가 문장 끝이다.
      'SELECT $$a; DELETE FROM t$$',
      'SELECT $tag$a; DELETE FROM t$tag$',
    ])(
      'a semicolon that one dialect sees as a statement end is mocked: %j',
      (query) => {
        expectWrite(query, true);
      },
    );

    it.each([
      // PostgreSQL jsonb 연산자. MySQL 에서는 줄 주석이지만 뒤에 다른 문장이 없다.
      "SELECT data #>> '{a,b}' FROM t",
      "SELECT data #> '{a}' FROM t",
      'SELECT 1 # trailing note',
      'SELECT 1 # note\n',
      // PostgreSQL 큰따옴표 식별자는 백슬래시 없이 `""` 로만 따옴표를 쓴다.
      'SELECT "col" FROM "t"',
    ])('reads the same in both dialects and stays read: %j', (query) => {
      expectWrite(query, false);
    });
  });

  describe('boundaries (CLE-T-EANRHY)', () => {
    it.each([
      ['`--` at the end of the text', 'SELECT 1 --', false],
      [
        '`--` before an ASCII space then a statement',
        'SELECT 1 -- ; DELETE FROM t',
        false,
      ],
      [
        '`--` before a no-break space',
        'SELECT 1 --\u00a0; DELETE FROM t',
        true,
      ],
      [
        '`--` before an ideographic space',
        'SELECT 1 --\u3000; DELETE FROM t',
        true,
      ],
      [
        '`--` before a line separator',
        'SELECT 1 --\u2028; DELETE FROM t',
        true,
      ],
      ['`--` before a tab', 'SELECT 1 --\t; DELETE FROM t', false],
      ['`--` before a newline', 'SELECT 1 --\n; DELETE FROM t', true],
      [
        '`--` before a control character',
        'SELECT 1 --\u0001; DELETE FROM t',
        false,
      ],
      ['identifier ending in `$$`', 'SELECT a$$x FROM t', false],
      [
        'identifier ending in `$$` then a statement',
        'SELECT a$$x; DELETE FROM t',
        true,
      ],
      ['`$1$` is not a dollar tag', 'SELECT $1$ FROM t', false],
      ['`$1$` then a statement', 'SELECT $1$; DELETE FROM t', true],
      ['`/*!` after the semicolon', 'SELECT 1; /*! DELETE FROM t */', true],
      ['unterminated comment after the semicolon', 'SELECT 1; /* open', true],
      ['nested comment after the semicolon', 'SELECT 1; /* /* n */ */', true],
      ['`#` comment after the semicolon', 'SELECT 1; # note', true],
    ] as const)('%s', (_name, query, expected) => {
      expectWrite(query, expected);
    });
  });

  describe('executable and hint comments (CLE-T-KH11HA)', () => {
    it.each([
      '/*! DELETE FROM t */',
      '/*!50000 DELETE FROM t */ SELECT 1',
      '/*+ HINT */ SELECT 1',
      '/* a */ /*! SELECT 1 */',
      '/* a */ /*+ HINT */ SELECT 1',
    ])('leading /*! or /*+ block is mocked: %s', (query) => {
      expectWrite(query, true);
    });

    it('a hint after the verb stays read', () => {
      expectWrite('SELECT /*+ INDEX(t i) */ 1', false);
    });

    it('`/*+` inside a leading line comment is only a comment (CLE-T-EANRHY)', () => {
      expectWrite('-- /*+ not a hint\nSELECT 1', false);
    });
  });

  describe('comment-only boundaries (CLE-T-KH11HA)', () => {
    it.each(['-- only comment', '-- only comment\n', '/* only */', '  \r\n'])(
      'no verb is mocked: %j',
      (query) => {
        expectWrite(query, true);
      },
    );

    it('handles CRLF line comments before the verb', () => {
      expectWrite('-- c\r\nSELECT 1', false);
      expectWrite('-- c\r\nDELETE FROM t', true);
    });
  });
});
