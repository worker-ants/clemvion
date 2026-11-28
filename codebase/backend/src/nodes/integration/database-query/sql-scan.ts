/**
 * Database Query 노드의 SQL 스캐너. 입출력이 없는 순수 함수만 둔다(CLE-T-KSMRAY).
 *
 * - dry-run 부수효과 판정: {@link isWriteOperation}
 * - MySQL 실행용 `$N` → `?` 변환: {@link convertMysqlPlaceholders}
 * - 활동 로그 `api_method` 용 첫 동사: {@link extractSqlVerb}
 *
 * 파서가 아니라 문자 단위 스캔이다. 리터럴 · 주석을 읽는 규칙은 두 용도가 함께 쓴다.
 */
import { IntegrationError } from '../_base/integration-handler-base.js';

/**
 * INT-US-05 — `IntegrationUsageLog.api_method` 용. 쿼리 첫 비공백 토큰을
 * upper-case 로 추출 (e.g., `SELECT`, `INSERT`, `UPDATE`, `DELETE`).
 * 첫 토큰이 영문 단어가 아니거나 query 가 비어있으면 NULL fallback.
 */
export function extractSqlVerb(query: string | undefined): string | null {
  if (!query) return null;
  const match = query.trim().match(/^([A-Za-z]+)/);
  if (!match) return null;
  return match[1].toUpperCase();
}

/**
 * dry-run 부수효과 판정에서 읽기로 보는 SQL 첫 동사. 이 목록에 있으면 dry-run 에서도 실제로 실행한다.
 * `EXPLAIN` 은 넣지 않는다. PostgreSQL `EXPLAIN ANALYZE` 는 대상 문장을 실제로 실행한다.
 */
const SQL_READ_VERBS = new Set([
  'SELECT',
  'SHOW',
  'DESCRIBE',
  'DESC',
  'VALUES',
  'TABLE',
]);

/**
 * dry-run 판정 스캐너가 SQL 을 읽는 방언. 판정은 통합을 얻기 전이라 드라이버를 모른다. 그래서 같은 SQL 을
 * 두 방언으로 한 번씩 읽고 둘 다 «읽기 한 문장» 일 때만 실행한다({@link isWriteOperation}).
 */
type SqlDialect = 'postgres' | 'mysql';

const SQL_DIALECTS: readonly SqlDialect[] = ['postgres', 'mysql'];

/**
 * {@link skipSqlQuoted} 가 리터럴을 읽는 방식. 방언과 백슬래시 처리를 한 값으로 묶는다.
 * - `postgres` · `mysql`: dry-run 판정용이다. 같은 SQL 을 두 방언으로 함께 읽으므로 엔진마다 다르게 읽을 수
 *   있는 백슬래시는 `ambiguous` 다.
 * - `mysql-escape`: 방언을 아는 MySQL 실행 경로다({@link convertMysqlPlaceholders}). 백슬래시를 이스케이프로 읽는다.
 *
 * PostgreSQL 실행 경로는 `$N` 을 그대로 보내 리터럴을 읽을 일이 없다. 그래서 PostgreSQL 에 이스케이프 모드는 없다.
 */
type SqlQuoteMode = SqlDialect | 'mysql-escape';

/**
 * 스캐너 한 걸음의 결과.
 * - `none`: 그 위치에 해당 구문(주석 · 인용 등)이 없다.
 * - `skip`: 그 구문을 건너뛴 다음 위치가 `next` 다.
 * - `ambiguous`: 두 엔진이 다르게 읽을 수 있거나 닫히지 않아 판정할 수 없다. 호출한 쪽은 mock 으로 본다.
 */
type SqlSkip =
  { kind: 'none' } | { kind: 'skip'; next: number } | { kind: 'ambiguous' };

const SQL_NONE: SqlSkip = { kind: 'none' };
const SQL_AMBIGUOUS: SqlSkip = { kind: 'ambiguous' };

/** `pos` 부터 줄 끝(다음 `\n` 뒤)까지 건너뛴다. */
function skipToLineEnd(sql: string, pos: number): SqlSkip {
  const nl = sql.indexOf('\n', pos);
  return { kind: 'skip', next: nl < 0 ? sql.length : nl + 1 };
}

/**
 * `pos` 에서 시작하는 주석 하나를 건너뛴다.
 *
 * - `--` 뒤에 공백이 아닌 문자가 붙어 있으면 `ambiguous` 다. MySQL 은 `--` 뒤에 ASCII 공백 · 제어 문자가 있어야
 *   주석으로 읽고(NBSP · U+2028 · U+3000 같은 유니코드 공백은 공백이 아니다) PostgreSQL 은 늘 주석으로 읽는다.
 * - `#` 는 MySQL 에서만 줄 주석이다. PostgreSQL 에서는 연산자(`#>` 등)라 주석이 아니다.
 * - 블록 주석이 닫히지 않았거나 안에 `/*` 가 또 있으면(PostgreSQL 만 중첩을 허용) `ambiguous` 다.
 * - MySQL 실행 주석 `/*!` 는 안쪽을 SQL 로 실행하므로 MySQL 에서 `ambiguous` 다.
 * - `leading` 이면(동사 앞) 힌트 `/*+` 블록도 `ambiguous` 다. 힌트는 동사 뒤에만 둔다.
 */
function skipSqlComment(
  sql: string,
  pos: number,
  dialect: SqlDialect,
  leading: boolean,
): SqlSkip {
  if (sql.startsWith('--', pos)) {
    const next = sql[pos + 2];
    // ASCII 공백 · 제어 문자(0x00-0x20, 0x7f)만 공백으로 본다.
    if (
      next !== undefined &&
      next.charCodeAt(0) > 0x20 &&
      next.charCodeAt(0) !== 0x7f
    )
      return SQL_AMBIGUOUS;
    return skipToLineEnd(sql, pos);
  }
  if (dialect === 'mysql' && sql[pos] === '#') return skipToLineEnd(sql, pos);
  if (sql.startsWith('/*', pos)) {
    if (dialect === 'mysql' && sql[pos + 2] === '!') return SQL_AMBIGUOUS;
    if (leading && sql[pos + 2] === '+') return SQL_AMBIGUOUS;
    const close = sql.indexOf('*/', pos + 2);
    if (close < 0) return SQL_AMBIGUOUS;
    if (sql.slice(pos + 2, close).includes('/*')) return SQL_AMBIGUOUS;
    return { kind: 'skip', next: close + 2 };
  }
  return SQL_NONE;
}

/**
 * `from` 부터 공백과 주석을 모두 건너뛴 위치를 `skip` 으로 돌려준다(건너뛸 것이 없으면 `next === from`).
 * 판정할 수 없는 주석을 만나면 `ambiguous` 다.
 */
function skipSqlBlank(
  sql: string,
  from: number,
  dialect: SqlDialect,
  leading: boolean,
): SqlSkip {
  let pos = from;
  for (;;) {
    while (pos < sql.length && /\s/.test(sql[pos])) pos += 1;
    const comment = skipSqlComment(sql, pos, dialect, leading);
    if (comment.kind === 'ambiguous') return comment;
    if (comment.kind === 'none') return { kind: 'skip', next: pos };
    pos = comment.next;
  }
}

/**
 * `pos` 에서 시작하는 문자열 리터럴 · 따옴표 식별자 · 달러 인용 하나를 건너뛴다.
 *
 * - 작은따옴표 리터럴 안에 백슬래시가 있으면 `ambiguous` 다. MySQL 은 이스케이프로 읽고 PostgreSQL 은
 *   (`E'…'` 가 아니면) 글자로 읽는다.
 * - 큰따옴표는 PostgreSQL 에서 식별자(백슬래시 이스케이프 없음)다. MySQL 기본 모드에서는 백슬래시
 *   이스케이프가 있는 문자열이고 `ANSI_QUOTES` 모드에서는 식별자다. 그래서 MySQL 에서 큰따옴표 안에
 *   백슬래시가 있으면 `ambiguous` 다.
 * - 백틱은 두 방언 모두 따옴표로 본다. MySQL 식별자이고, PostgreSQL 은 백틱을 구문 오류로 거절해 문자열
 *   전체가 실행되지 않는다.
 * - 달러 인용(`$$…$$` · `$tag$…$tag$`)은 PostgreSQL 에서만 인용이다. MySQL 에서 `$` 는 식별자 글자다.
 * - 같은 따옴표를 두 번 쓰면 따옴표 글자 하나다. 닫히지 않았으면 `ambiguous` 다.
 *
 * `mode` 가 `mysql-escape` 면 작은따옴표 · 큰따옴표 리터럴은 {@link skipMysqlEscapedLiteral} 이 읽는다. 백틱은
 * `mysql` 과 같이 읽는다.
 */
function skipSqlQuoted(sql: string, pos: number, mode: SqlQuoteMode): SqlSkip {
  const ch = sql[pos];
  if (mode === 'mysql-escape' && (ch === "'" || ch === '"')) {
    return skipMysqlEscapedLiteral(sql, pos);
  }
  const dialect: SqlDialect = mode === 'postgres' ? 'postgres' : 'mysql';
  if (ch === "'" || ch === '"' || ch === '`') {
    const backslashAmbiguous =
      ch === "'" || (ch === '"' && dialect === 'mysql');
    let i = pos + 1;
    for (;;) {
      const close = sql.indexOf(ch, i);
      if (close < 0) return SQL_AMBIGUOUS;
      if (backslashAmbiguous && sql.slice(pos + 1, close).includes('\\')) {
        return SQL_AMBIGUOUS;
      }
      if (sql[close + 1] === ch) {
        i = close + 2;
        continue;
      }
      return { kind: 'skip', next: close + 1 };
    }
  }
  if (ch === '$' && dialect === 'postgres') {
    const prev = pos > 0 ? sql[pos - 1] : '';
    if (/[A-Za-z0-9_$]/.test(prev)) return SQL_NONE;
    const tag = /^\$([A-Za-z_][A-Za-z0-9_]*)?\$/.exec(sql.slice(pos));
    if (!tag) return SQL_NONE;
    const close = sql.indexOf(tag[0], pos + tag[0].length);
    return close < 0
      ? SQL_AMBIGUOUS
      : { kind: 'skip', next: close + tag[0].length };
  }
  return SQL_NONE;
}

/**
 * `pos` 의 작은따옴표 · 큰따옴표 리터럴 하나를 MySQL 실행 규칙으로 건너뛴다. 백슬래시는 다음 글자 하나를
 * 이스케이프하고 `ambiguous` 가 되지 않는다. 같은 따옴표를 두 번 쓰면 따옴표 글자 하나다. 닫히지 않았으면
 * `ambiguous` 다.
 *
 * mysql2 가 `?` 를 채울 때 리터럴을 읽는 법(기본 SQL 모드)과 같다. 단 mysql2 는 큰따옴표 리터럴 안의 `?` 도
 * 치환한다({@link convertMysqlPlaceholders}).
 */
function skipMysqlEscapedLiteral(sql: string, pos: number): SqlSkip {
  const quote = sql[pos];
  for (let i = pos + 1; i < sql.length; i += 1) {
    if (sql[i] === '\\') {
      i += 1;
      continue;
    }
    if (sql[i] !== quote) continue;
    if (sql[i + 1] === quote) {
      i += 1;
      continue;
    }
    return { kind: 'skip', next: i + 1 };
  }
  return SQL_AMBIGUOUS;
}

/**
 * dry-run 판정용으로 SQL 을 한 방언으로 읽는다. 첫 문장의 동사(대문자)와 `multi` 를 돌려준다. `multi` 는
 * 첫 문장을 끝내는 `;` 뒤에 공백 · 주석이 아닌 내용이 더 있으면 true 다. 동사를 못 찾거나 판정할 수 없는
 * 모양이면 NULL 이다. 호출한 쪽은 NULL 을 쓰기로 본다.
 *
 * - 동사 앞의 공백 · 주석은 건너뛴다. 동사 앞의 `/*+` 힌트 블록은 건너뛰지 않고 NULL 이다.
 * - 첫 문장 안에서 문자열 리터럴 · 따옴표 식별자 · 주석 · (PostgreSQL) 달러 인용 속의 `;` 는 문장 끝이 아니다.
 * - 끝에 붙은 `;` 하나와 그 뒤 공백 · 주석은 `multi` 를 바꾸지 않는다.
 *
 * 활동 로그 `api_method` 는 이 함수를 쓰지 않고 {@link extractSqlVerb} 를 그대로 쓴다.
 */
function scanSql(
  query: string,
  dialect: SqlDialect,
): { verb: string; multi: boolean } | null {
  const start = skipSqlBlank(query, 0, dialect, true);
  if (start.kind !== 'skip') return null;
  const verb = extractSqlVerb(query.slice(start.next));
  if (verb === null) return null;
  let pos = start.next + verb.length;
  while (pos < query.length) {
    const quoted = skipSqlQuoted(query, pos, dialect);
    if (quoted.kind === 'ambiguous') return null;
    if (quoted.kind === 'skip') {
      pos = quoted.next;
      continue;
    }
    const comment = skipSqlComment(query, pos, dialect, false);
    if (comment.kind === 'ambiguous') return null;
    if (comment.kind === 'skip') {
      pos = comment.next;
      continue;
    }
    if (query[pos] === ';') {
      const tail = skipSqlBlank(query, pos + 1, dialect, false);
      if (tail.kind !== 'skip') return null;
      return { verb, multi: tail.next < query.length };
    }
    pos += 1;
  }
  return { verb, multi: false };
}

/** 한 방언으로 읽었을 때 읽기 동사 하나로 된 한 문장인지 본다. */
function isSingleReadStatement(query: string, dialect: SqlDialect): boolean {
  const scanned = scanSql(query, dialect);
  return scanned !== null && !scanned.multi && SQL_READ_VERBS.has(scanned.verb);
}

/**
 * dry-run 재실행의 부수효과 판정([Database Query 「dry-run」](CLE-NODE-DBQUERY#dry-run)).
 * true 면 DB 에 연결하지 않고 mock 으로 끝낸다(REQ-DBQ-025), false 면 실제로 실행한다(REQ-DBQ-026).
 *
 * - `queryType` 이 `insert` · `update` · `delete` 면 SQL 과 관계없이 쓰기다.
 * - 그 밖(`select` · `raw` · 누락)은 `queryType` 을 믿지 않고 SQL 첫 동사를 본다. 기본값 `select` 로 둔
 *   `DELETE` 가 dry-run 에서 실행되던 결함을 막는다(CLE-T-KH11HA).
 * - 첫 동사가 {@link SQL_READ_VERBS} 에 있을 때만 읽기다. 쓰기 동사와 판정이 애매한 쿼리
 *   (`WITH` · `CALL` · `DO` · `COPY` · `EXPLAIN`, 괄호로 시작 등)는 안전 쪽(mock)으로 본다.
 *   «애매하면 mock» 은 [Database Query 「dry-run」](CLE-NODE-DBQUERY#dry-run) 의 결정이다.
 * - 첫 문장 뒤에 `;` 로 이어지는 다른 내용이 있으면(`SELECT 1; DELETE …`) mock 이다. 끝에 붙은 `;` 하나와
 *   그 뒤 공백 · 주석은 읽기 판정을 바꾸지 않는다.
 * - 판정 시점에는 드라이버를 모른다. 그래서 PostgreSQL · MySQL 두 방언으로 한 번씩 읽고 둘 다 읽기 한
 *   문장일 때만 실행한다. 한 방언에서 리터럴 · 주석이고 다른 방언에서 문장 끝인 `;`(MySQL `#` 줄 주석,
 *   큰따옴표 안 백슬래시, PostgreSQL 달러 인용)는 이 규칙으로 mock 이 된다.
 * - 맨 앞이 MySQL 실행 주석 `/*!` 이거나 힌트 `/*+` 이면 mock 이다. 닫히지 않은 따옴표 · 주석, 백슬래시가
 *   든 작은따옴표 리터럴, 중첩 블록 주석, 공백 없이 붙은 `--` 처럼 엔진마다 읽는 법이 다를 수 있는 모양도
 *   mock 이다.
 *
 * 한계: `SELECT write_func()` · `SELECT … INTO new_table` 처럼 SELECT 로 시작하지만 데이터를 바꾸는
 * 쿼리는 읽기로 보고 실행한다. 파서가 아니라 문자 단위 스캔이라 위에 적은 모양 밖의 방언 문법은 모른다.
 */
export function isWriteOperation(
  queryType: string | undefined,
  query: string | undefined,
): boolean {
  if (
    queryType === 'insert' ||
    queryType === 'update' ||
    queryType === 'delete'
  ) {
    return true;
  }
  if (!query) return true;
  return !SQL_DIALECTS.every((dialect) =>
    isSingleReadStatement(query, dialect),
  );
}

/** MySQL 비인용 식별자에 쓸 수 있는 글자(`$` 포함). `$N` 앞뒤에 붙으면 플레이스홀더가 아니라 식별자의 일부다. */
const MYSQL_IDENTIFIER_CHAR = /[\p{L}\p{N}_$]/u;

/**
 * `pos` 의 `$` 가 `$N` 플레이스홀더면 번호와 끝 위치를 돌려준다. 앞이나 뒤에 식별자 글자가 붙으면(`a$1` · `$1a`)
 * 식별자의 일부라 null 이다.
 */
function matchMysqlPlaceholder(
  sql: string,
  pos: number,
): { n: number; end: number } | null {
  const digits = /^\$(\d+)/.exec(sql.slice(pos));
  if (!digits) return null;
  const before = pos > 0 ? sql[pos - 1] : '';
  const end = pos + digits[0].length;
  const after = sql[end] ?? '';
  if (MYSQL_IDENTIFIER_CHAR.test(before) || MYSQL_IDENTIFIER_CHAR.test(after)) {
    return null;
  }
  return { n: Number(digits[1]), end };
}

/**
 * MySQL 실행용 플레이스홀더 변환([Database Query 「실행 로직」](CLE-NODE-DBQUERY#실행-로직) 4단계, REQ-DBQ-003 · 007).
 * 쿼리의 `$N` 을 mysql2 의 `?` 로 바꾸고 바인딩 배열을 `$N` 이 나온 순서대로 `parameters[N-1]` 로 다시 만든다.
 * `$2 … $1` 처럼 번호가 등장 순서와 달라도 번호대로 바인딩하고, 같은 번호를 두 번 쓰면 값도 두 번 싣는다.
 *
 * - 문자열 리터럴 · 따옴표 식별자 · 주석 안의 `$N` 은 바꾸지 않는다. 스캔은 dry-run 판정의 MySQL 규칙
 *   ({@link skipSqlQuoted} · {@link skipSqlComment})을 그대로 쓰고, 리터럴 안 백슬래시는 이스케이프로 읽는다.
 *   MySQL 이 SQL 로 읽는 `--x`(공백 없는 `--`)와 실행 주석 `/*! … *\/` 의 안쪽은 바꾼다.
 * - 앞이나 뒤에 식별자 글자가 붙은 `$N`(`a$1` · `$1a`)은 식별자라 바꾸지 않는다.
 * - `$N` 이 하나도 없으면 쿼리와 `parameters` 를 그대로 돌려준다. MySQL 고유의 `?` 를 쓴 쿼리가 이 경로다.
 * - mysql2 는 `?` 를 채울 때 작은따옴표 · 백틱 · `-- ` 와 블록 주석 안은 건너뛰지만 큰따옴표 리터럴과 `#` 주석 안의
 *   `?` 에는 값을 묶는다(mysql2 3.24.6 실측). 이 변환기는 그 안의 `$N` 도 바꾸지 않으므로, 그 안에 `?` 가 있으면
 *   고유 `?` 로 셈해 혼용으로 거절한다.
 * - `$N` 과 고유 `?` 를 섞어 쓰거나, N 이 0 이거나 `parameters` 길이보다 크면 `INVALID_PARAMETERS` 다. 어느 값을
 *   어디에 묶을지 정할 수 없어서 쿼리를 보내지 않는다.
 * - 닫히지 않은 리터럴을 만나면 그 뒤는 손대지 않는다. 쿼리 자체가 MySQL 구문 오류다.
 *
 * 한계: 서버가 `NO_BACKSLASH_ESCAPES` 모드면 백슬래시를 글자로 읽어 리터럴 경계가 이 스캔과 다를 수 있다.
 */
export function convertMysqlPlaceholders(
  sql: string,
  parameters: unknown[],
): { sql: string; values: unknown[] } {
  let out = '';
  let copied = 0;
  const values: unknown[] = [];
  let nativePlaceholder = false;
  let pos = 0;
  while (pos < sql.length) {
    const quoted = skipSqlQuoted(sql, pos, 'mysql-escape');
    if (quoted.kind === 'ambiguous') break;
    if (quoted.kind === 'skip') {
      // mysql2 는 큰따옴표 리터럴 안의 `?` 에도 값을 묶는다(실측). 변환기는 리터럴이라 건너뛰지만 `?` 가 있으면 혼용이다.
      if (sql[pos] === '"' && sql.slice(pos, quoted.next).includes('?')) {
        nativePlaceholder = true;
      }
      pos = quoted.next;
      continue;
    }
    const comment = skipSqlComment(sql, pos, 'mysql', false);
    if (comment.kind === 'skip') {
      // `#` 주석 안의 `?` 도 mysql2 가 치환한다(실측). `-- ` · 블록 주석 안은 건너뛴다.
      if (sql[pos] === '#' && sql.slice(pos, comment.next).includes('?')) {
        nativePlaceholder = true;
      }
      pos = comment.next;
      continue;
    }
    // 판정용 스캐너가 `ambiguous` 로 돌려주는 주석 모양(`--x` · `/*!` · 닫히지 않거나 겹친 블록)은 MySQL 이 SQL 로
    // 읽는 글자로 보고 한 글자씩 넘어간다.
    const ch = sql[pos];
    if (ch === '?') {
      nativePlaceholder = true;
      pos += 1;
      continue;
    }
    const token = ch === '$' ? matchMysqlPlaceholder(sql, pos) : null;
    if (token) {
      if (token.n < 1 || token.n > parameters.length) {
        throw new IntegrationError(
          'INVALID_PARAMETERS',
          `query uses $${token.n} but parameters has ${parameters.length} value(s)`,
        );
      }
      values.push(parameters[token.n - 1]);
      out += sql.slice(copied, pos) + '?';
      copied = token.end;
      pos = token.end;
      continue;
    }
    pos += 1;
  }
  if (values.length === 0) return { sql, values: parameters };
  if (nativePlaceholder) {
    throw new IntegrationError(
      'INVALID_PARAMETERS',
      'query mixes $N placeholders with ? placeholders',
    );
  }
  return { sql: out + sql.slice(copied), values };
}
