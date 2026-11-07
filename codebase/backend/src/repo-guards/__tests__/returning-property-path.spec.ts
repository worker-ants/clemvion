import { describe, it, expect } from '@jest/globals';
import * as fs from 'node:fs';
import * as path from 'node:path';

import {
  collectTsFiles,
  toPosixRelative,
} from '../../common/__test-utils__/source-scan';
import { scanReturningPropertyPaths } from './returning-property-path-guard';

/**
 * QueryBuilder `.returning([...])` 배열에는 **엔티티 속성 경로**만 넣는다.
 *
 * ## 왜 이 가드인가
 *
 * TypeORM 1.1.2 `QueryBuilder.getReturningColumns()` 는 배열 원소마다 `metadata.findColumnsWithPropertyPath(name)` 로
 * 컬럼을 찾는다. 컬럼 이름(`'duration_ms'`)을 넘기면 맞는 속성이 없어 그 원소가 **조용히 빠진다**. 배열 전체가 안 맞으면
 * RETURNING 절이 통째로 사라진다. 컴파일도 단위 테스트도 통과한다. 단위 스펙의 mock 은 `.returning()` 인자와 상관없이
 * 정해 둔 `raw` 를 돌려주기 때문이다.
 *
 * 이 저장소는 같은 실수를 두 번 했다. CLE-T-2PTH0W 가 `retry-turn.service.ts` 에서 찾아 고쳤고, 엔진의 마감 경로
 * 다섯 곳에 같은 형태가 남아 취소 · 실패 이벤트의 `durationMs` 가 늘 `null` 이었다(CLE-T-0WDZ5G). 실 Postgres 회귀는
 * `test/engine-cancel-duration.e2e-spec.ts` 와 `test/retry-turn-guard-sql.e2e-spec.ts` 가 본다. 이 가드는 새 호출부가
 * 같은 형태로 들어오는 것을 미리 막는다.
 *
 * ## 무엇을 세는가
 *
 * `src/**` 의 비-spec `.ts` 에서 `.returning(<배열 리터럴>)` 호출의 원소. camelCase 속성 경로(임베디드는 `.` 연결)가
 * 아니면 위반이다. 문자열 인자 형태(`.returning('id, dismissed_at')`)는 TypeORM 이 raw SQL 로 쓰므로 보지 않는다.
 * 돌아오는 `raw` 행의 키는 반대로 **컬럼 이름**이다. 읽는 쪽은 `raw[0].duration_ms` 그대로 둔다.
 */
describe('`.returning([...])` 은 엔티티 속성 경로만 받는다', () => {
  const SRC_ROOT = path.resolve(__dirname, '..', '..');
  const files = collectTsFiles(SRC_ROOT);
  const scans = files.map((f) =>
    scanReturningPropertyPaths(
      toPosixRelative(SRC_ROOT, f),
      fs.readFileSync(f, 'utf8'),
    ),
  );

  it('스캔이 알려진 호출부를 실제로 본다 (vacuous 방지)', () => {
    // 2026-11-07 실측: 엔진 마감 경로 5곳 + `retry-turn.service.ts` 1곳. 경로가 어긋나 0건을 훑으면
    // 아래 단언이 아무것도 검사하지 않고 통과한다.
    const scanned = scans.reduce((n, s) => n + s.scanned, 0);
    expect(scanned).toBeGreaterThanOrEqual(6);
  });

  it('배열 원소가 모두 엔티티 속성 경로다', () => {
    const violations = scans.flatMap((s) =>
      s.violations.map(
        (v) =>
          `${v.file}:${v.line} '${v.element}' (${v.reason}) — 컬럼 이름이 아니라 엔티티 속성 경로를 넘긴다`,
      ),
    );
    expect(violations).toEqual([]);
  });

  describe('판정 로직 (합성 입력)', () => {
    const scan = (text: string) => scanReturningPropertyPaths('t.ts', text);

    it('[대조군] 컬럼 이름(snake_case)을 잡는다 — CLE-T-0WDZ5G 의 원형', () => {
      const r = scan(
        `qb.update(E).set({}).returning(['id', 'duration_ms']).execute();`,
      );
      expect(r.scanned).toBe(1);
      expect(r.violations).toEqual([
        {
          file: 't.ts',
          line: 1,
          element: 'duration_ms',
          reason: 'not-property-path',
        },
      ]);
    });

    it('속성 경로와 임베디드 경로는 통과한다', () => {
      const r = scan(`qb.returning(['id', 'durationMs', 'meta.finishedAt']);`);
      expect(r).toEqual({ violations: [], scanned: 1 });
    });

    it('문자열 인자(raw SQL)는 보지 않는다', () => {
      const r = scan(`qb.returning('id, dismissed_at');`);
      expect(r).toEqual({ violations: [], scanned: 0 });
    });

    it('문자열 리터럴이 아닌 원소는 정적으로 확인할 수 없어 위반으로 센다', () => {
      const r = scan(`const c = 'durationMs';\nqb.returning(['id', c]);`);
      expect(r.violations).toEqual([
        { file: 't.ts', line: 2, element: 'c', reason: 'not-string-literal' },
      ]);
    });

    it('주석 · 문자열 속 `.returning([` 는 세지 않는다', () => {
      const r = scan(
        `// qb.returning(['duration_ms'])\nconst s = "x.returning(['duration_ms'])";`,
      );
      expect(r).toEqual({ violations: [], scanned: 0 });
    });
  });
});
