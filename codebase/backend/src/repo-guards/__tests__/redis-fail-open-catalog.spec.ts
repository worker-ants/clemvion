import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import {
  CATALOG_SPEC,
  RECORDER_FN,
  UNION_SOURCE,
  findWiredComponents,
  readCatalogComponents,
  readUnionMembers,
} from './redis-fail-open-catalog-guard';

/**
 * `clemvion.redis.fail_open` 의 `component` 라벨 — **코드 · spec · 실배선 3자 정합 가드**.
 *
 * `spec/data-flow/9-observability.md` 의 "`component` 를 실제 배선된 값만 열거하는 이유" 가
 * 이 가드의 근거다: 문서가 구현보다 넓으면 카운터의 `0` 이 **"정상(장애 없음)"** 인지
 * **"미계측(아무도 안 부름)"** 인지 구분되지 않는다. 그래서 세 집합이 같아야 한다.
 *
 * 1. `RedisFailOpenComponent` 유니온 (`business-metrics.service.ts`)
 * 2. spec 카탈로그 행의 `component (…)` 목록 (`_product-overview.md` §NF-OB-07)
 * 3. 프로덕션 코드가 실제로 `recordRedisFailOpen(<component>, …)` 에 넘기는 값
 *
 * **왜 이 가드가 필요한가 — 이것도 "부재 주장" 이다.** 지금 배선된 component 는
 * `idempotency` **하나뿐**이고, 그 사실은 아무 데도 고정돼 있지 않았다. 새 fail-open 소비자를
 * 배선하며 유니온만 넓히고 spec 표를 잊거나(문서가 좁아짐), 반대로 spec 표만 넓히고 배선을
 * 잊으면(문서가 넓어짐) **둘 다 조용히 통과**한다. 후자가 특히 나쁘다 — 대시보드에 라벨이
 * 있는데 값이 영원히 0이면 운영자는 "그 경로는 건강하다" 고 읽는다.
 *
 * **미배선 fail-open 서비스는 이 가드의 대상이 아니다.** 2026-08-29 실측으로 Redis 를 만지며
 * fail-open 하는 파일은 21개이고 그중 배선된 것은 인터셉터 1곳뿐인데, 나머지 19개를 여기서
 * 강제하지 않는다 — 배선은 component 라벨 설계와 spec 카탈로그 갱신을 동반하는 별건이고,
 * 그 백로그는 `plan/in-progress/backend-lint-gate-broken-on-main.md` 에 있다. 이 가드가 막는
 * 것은 **"배선하면서 셋 중 하나를 빠뜨리는 것"** 이다.
 */
describe('clemvion.redis.fail_open component 카탈로그 정합', () => {
  const repoRoot = path.resolve(__dirname, '../../../../..');
  const srcDir = path.resolve(__dirname, '../..');

  it('유니온 ↔ spec 카탈로그 목록이 정확히 같다', () => {
    expect(readCatalogComponents(repoRoot)).toEqual(readUnionMembers(repoRoot));
  });

  it('유니온의 모든 값이 프로덕션 호출부를 가진다 (문서가 구현보다 넓지 않다)', () => {
    const wired = new Set(
      findWiredComponents(srcDir)
        .map((w) => w.component)
        .filter((c): c is string => c !== null),
    );
    // 유니온에만 있고 아무도 안 부르는 값이 있으면, 그 라벨의 0 은 "정상" 이 아니라 "미계측" 이다.
    expect(readUnionMembers(repoRoot).filter((m) => !wired.has(m))).toEqual([]);
  });

  it('모든 호출부의 component 인자가 정적으로 해석된다', () => {
    // 해석 실패(`null`)를 허용하면 위 두 단언이 조용히 좁아진다 — 못 읽은 호출부는
    // "배선 안 된 것" 과 구분되지 않기 때문이다. 동적 값이 필요해지면 가드를 먼저 고쳐라.
    expect(
      findWiredComponents(srcDir).filter((w) => w.component === null),
    ).toEqual([]);
  });

  it('현재 배선된 component 는 `idempotency` 하나다 (넓어지면 여기서 알린다)', () => {
    // 이 단언은 "고정" 이 아니라 **알림**이다. 새 소비자를 배선하면 여기가 RED 가 되고,
    // 그때 유니온·spec 카탈로그를 함께 갱신했는지 위 세 단언이 확인한다.
    // 값을 늘릴 때 이 줄을 같이 늘리는 것이 곧 체크리스트다.
    expect(readUnionMembers(repoRoot)).toEqual(['idempotency']);
  });

  describe('가드 자체의 판별력', () => {
    /** spec 을 임시로 복제해 카탈로그 행만 바꾼 뒤 읽는다 — 저장소 원본은 건드리지 않는다. */
    function withPatchedSpec<T>(
      patch: (row: string) => string,
      fn: (root: string) => T,
    ): T {
      const tmp = fs.mkdtempSync(
        path.join(os.tmpdir(), 'redis-failopen-guard-'),
      );
      const dest = path.join(tmp, CATALOG_SPEC);
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      const text = fs.readFileSync(path.join(repoRoot, CATALOG_SPEC), 'utf8');
      fs.writeFileSync(
        dest,
        text
          .split('\n')
          .map((l) => (l.includes('`clemvion.redis.fail_open`') ? patch(l) : l))
          .join('\n'),
      );
      try {
        return fn(tmp);
      } finally {
        fs.rmSync(tmp, { recursive: true, force: true });
      }
    }

    it('spec 목록이 넓어지면 유니온과 달라진다', () => {
      const widened = withPatchedSpec(
        (row) =>
          row.replace(
            '`component` (idempotency)',
            '`component` (idempotency/blacklist)',
          ),
        (root) => readCatalogComponents(root),
      );
      expect(widened).toEqual(['blacklist', 'idempotency']);
      expect(widened).not.toEqual(readUnionMembers(repoRoot));
    });

    it('카탈로그 행이 사라지면 빈 배열이 아니라 throw 한다', () => {
      expect(() =>
        withPatchedSpec(
          () => '',
          (root) => readCatalogComponents(root),
        ),
      ).toThrow(/카탈로그 행을 찾지 못했다/);
    });

    it(`상수를 거쳐 넘기는 ${RECORDER_FN} 호출부도 값을 해석한다`, () => {
      // 정본 호출부(`idempotency.interceptor.ts`)가 문자열 리터럴이 아니라 `METRICS_COMPONENT`
      // 상수를 넘긴다. 상수 추적이 없으면 그 호출부가 통째로 안 보이고, 그 상태에서도 위
      // "모든 값이 호출부를 가진다" 가 **거짓 RED** 가 아니라 조용한 오판이 된다.
      const wired = findWiredComponents(srcDir);
      expect(wired.length).toBeGreaterThan(0);
      expect(
        wired.some((w) => w.file.includes('idempotency.interceptor.ts')),
      ).toBe(true);
      expect(wired.every((w) => w.component === 'idempotency')).toBe(true);
    });

    it(`유니온 소스 경로(${UNION_SOURCE}) 가 실재한다`, () => {
      // 파일이 옮겨지면 `readUnionMembers` 가 ENOENT 로 죽어야 한다 — 빈 배열로 조용히
      // 통과하면 위 정합 단언이 `[] === []` 로 공허해진다.
      expect(fs.existsSync(path.join(repoRoot, UNION_SOURCE))).toBe(true);
    });
  });
});
