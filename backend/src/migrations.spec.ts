import { readdirSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Flyway 마이그레이션 파일명 컨벤션 가드.
 *
 * 본 프로젝트는 `backend/migrations/V<정수>__<설명>.sql` 단조 정수 prefix
 * 만 사용한다 (`backend/migrations/README.md` 참조). Flyway 10 의 기본
 * version regex 는 `V[0-9.]+__...` 형태라 alphanumeric suffix (V035a 등)
 * 는 매치되지 않아 **silent skip** 되며 schema_history 에 등록되지 않는다 —
 * PR-B Part A 에서 V035a/V035b 두 파일이 그대로 누락되어 prod 에서 회귀
 * 발생한 사례가 있다.
 *
 * 본 spec 은 매 빌드/CI 마다 마이그레이션 파일명을 검증해 동일 회귀를
 * 차단한다. 컨벤션 위반 (alphanumeric suffix / 잘못된 separator / 짝지어진
 * .conf 의 prefix mismatch / version 중복) 시 즉시 fail.
 */

const MIGRATIONS_DIR = join(__dirname, '..', 'migrations');
// 단조 정수 prefix + 더블 언더스코어 + 영소문자/숫자/언더스코어/하이픈만 허용.
// Flyway 가 invalid 로 간주하지 않을 안전한 부분집합.
const SQL_NAME_RE = /^V([0-9]+)__[a-z0-9_-]+\.sql$/;
const CONF_NAME_RE = /^V([0-9]+)__[a-z0-9_-]+\.conf$/;

describe('Flyway migration naming convention', () => {
  let entries: string[];

  beforeAll(() => {
    entries = readdirSync(MIGRATIONS_DIR);
  });

  it('모든 V*.sql 파일이 정수 prefix 컨벤션을 만족한다', () => {
    const sqlFiles = entries.filter(
      (f) => f.startsWith('V') && f.endsWith('.sql'),
    );
    expect(sqlFiles.length).toBeGreaterThan(0);
    const violators = sqlFiles.filter((f) => !SQL_NAME_RE.test(f));
    expect(violators).toEqual([]);
  });

  it('모든 V*.conf 파일이 같은 prefix 컨벤션을 만족하고 짝지어진 .sql 이 존재한다', () => {
    const confFiles = entries.filter(
      (f) => f.startsWith('V') && f.endsWith('.conf'),
    );
    const sqlSet = new Set(
      entries.filter((f) => f.startsWith('V') && f.endsWith('.sql')),
    );
    const violators: string[] = [];
    for (const conf of confFiles) {
      if (!CONF_NAME_RE.test(conf)) {
        violators.push(`${conf} (잘못된 prefix)`);
        continue;
      }
      const expectedSql = conf.replace(/\.conf$/, '.sql');
      if (!sqlSet.has(expectedSql)) {
        violators.push(`${conf} (짝지어진 .sql 없음: ${expectedSql})`);
      }
    }
    expect(violators).toEqual([]);
  });

  it('version 번호가 중복되지 않는다 (gap 은 허용, drift 차단)', () => {
    const sqlFiles = entries.filter(
      (f) => f.startsWith('V') && f.endsWith('.sql'),
    );
    const versions = sqlFiles
      .map((f) => SQL_NAME_RE.exec(f)?.[1])
      .filter((v): v is string => Boolean(v))
      .map((v) => parseInt(v, 10));
    const seen = new Set<number>();
    const duplicates: number[] = [];
    for (const v of versions) {
      if (seen.has(v)) duplicates.push(v);
      else seen.add(v);
    }
    expect(duplicates).toEqual([]);
  });

  it('alphanumeric suffix (e.g. V035a) 가 등장하지 않는다 (silent skip 회귀 가드)', () => {
    const offenders = entries.filter(
      (f) =>
        (f.endsWith('.sql') || f.endsWith('.conf')) && /^V[0-9]+[a-z]/.test(f),
    );
    expect(offenders).toEqual([]);
  });
});
