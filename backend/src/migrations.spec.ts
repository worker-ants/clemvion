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
 *
 * 빌드 시점에는 `backend/migrations/check-duplicate-versions.sh` 가 동일한
 * 정규화 규칙으로 한 번 더 차단한다 — 정책: `spec/conventions/migrations.md` §6.
 */

const MIGRATIONS_DIR = join(__dirname, '..', 'migrations');
// 단조 정수 prefix + 더블 언더스코어 + 영소문자/숫자/언더스코어/하이픈만 허용.
// Flyway 가 invalid 로 간주하지 않을 안전한 부분집합.
const SQL_NAME_RE = /^V([0-9]+)__[a-z0-9_-]+\.sql$/;
const CONF_NAME_RE = /^V([0-9]+)__[a-z0-9_-]+\.conf$/;
// 빌드 시점 가드 스크립트의 V번호 추출 정규식과 동일한 정규화 규칙
// (`s/^V0*([0-9]+)__.*/\1/`). 두 가드가 같은 정수로 정규화하므로
// V01__a.sql 과 V001__b.sql 도 동일 버전 1 로 중복 검출된다.
const VERSION_FROM_SQL_RE = /^V0*([0-9]+)__/;

/**
 * 파일 목록에서 동일 V번호(정수 정규화 후) 가 둘 이상인 케이스를 찾아 반환한다.
 * 빌드 시점 가드 (`check-duplicate-versions.sh`) 와 동일 규칙.
 */
export function findDuplicateVersions(filenames: readonly string[]): number[] {
  const seen = new Set<number>();
  const dup = new Set<number>();
  for (const name of filenames) {
    if (!name.endsWith('.sql')) continue;
    const m = VERSION_FROM_SQL_RE.exec(name);
    if (!m) continue;
    const v = parseInt(m[1], 10);
    if (seen.has(v)) dup.add(v);
    else seen.add(v);
  }
  return [...dup].sort((a, b) => a - b);
}

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

  it('현재 마이그레이션 디렉토리에 동일 V번호 .sql 이 중복되지 않는다', () => {
    expect(findDuplicateVersions(entries)).toEqual([]);
  });

  it('alphanumeric suffix (e.g. V035a) 가 등장하지 않는다 (silent skip 회귀 가드)', () => {
    const offenders = entries.filter(
      (f) =>
        (f.endsWith('.sql') || f.endsWith('.conf')) && /^V[0-9]+[a-z]/.test(f),
    );
    expect(offenders).toEqual([]);
  });
});

describe('findDuplicateVersions (가드 로직 음성 케이스)', () => {
  it('단순 중복: 같은 V<N>__*.sql 두 개 → 해당 정수 반환', () => {
    expect(
      findDuplicateVersions([
        'V040__a.sql',
        'V041__one.sql',
        'V041__two.sql',
        'V042__c.sql',
      ]),
    ).toEqual([41]);
  });

  it('zero-padding drift: V01 vs V001 도 같은 정수 1 로 정규화되어 중복', () => {
    expect(
      findDuplicateVersions(['V01__pad.sql', 'V001__unpad.sql']),
    ).toEqual([1]);
  });

  it('같은 V번호 3개 이상이어도 정수 한 번만 보고된다', () => {
    expect(
      findDuplicateVersions([
        'V050__a.sql',
        'V050__b.sql',
        'V050__c.sql',
      ]),
    ).toEqual([50]);
  });

  it('서로 다른 두 V번호가 각각 중복이면 둘 다 보고된다 (정렬됨)', () => {
    expect(
      findDuplicateVersions([
        'V010__a.sql',
        'V010__b.sql',
        'V020__c.sql',
        'V020__d.sql',
      ]),
    ).toEqual([10, 20]);
  });

  it('짝지어진 .conf 는 정수로 카운트되지 않는다 (.sql 만 검사 대상)', () => {
    expect(
      findDuplicateVersions([
        'V030__only.sql',
        'V030__only.conf',
      ]),
    ).toEqual([]);
  });

  it('빈 입력 / .sql 가 없는 경우 빈 배열', () => {
    expect(findDuplicateVersions([])).toEqual([]);
    expect(findDuplicateVersions(['README.md', 'V030__only.conf'])).toEqual([]);
  });
});
