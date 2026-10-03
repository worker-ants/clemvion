import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import {
  RECORDER_FN,
  UNION_SOURCE,
  findUnwiredMembers,
  findWiredComponents,
  readUnionMembers,
  stringLiteralsOf,
} from './redis-fail-open-catalog-guard';

/**
 * `clemvion.redis.fail_open` 의 `component` 라벨 — **코드 유니온 · 실배선 정합 가드**.
 * 파일 이름의 `catalog` 는 스펙 카탈로그 행까지 대조하던 시절의 이름이다.
 *
 * NERV `CLE-OBS-LOGGING` 의 Rationale «`clemvion.redis.fail_open` 의 `component` 는 실제로 연결한
 * 값만 둔다» 가 이 가드의 근거다: 라벨 집합이 구현보다 넓으면 카운터의 `0` 이
 * **"정상(장애 없음)"** 인지 **"미계측(아무도 안 부름)"** 인지 구분되지 않는다. 그래서 두 집합이
 * 같아야 한다.
 *
 * 1. `RedisFailOpenComponent` 유니온 (`business-metrics.service.ts`)
 * 2. 프로덕션 코드가 실제로 `recordRedisFailOpen(<component>, …)` 에 넘기는 값
 *
 * **스펙 카탈로그 표는 대조하지 않는다.** 표의 정본은 NERV `CLE-OBS-LOGGING` 「비즈니스
 * 메트릭 카탈로그」 다. 사람이 고치는 문서라 저장소가 표기를 정하지 못하고, 저장소 미러는
 * 구현 PR 이 받은 스냅샷이다. 표와 유니온의 정합은 일관성 검토가 본다. 그 문서의
 * 「구현 위치」 가 `business-metrics.service.ts` 를 덮으므로 유니온을 바꾼 변경에
 * `--impl-done` 을 돌리면 그 문서가 검토 대상에 든다. 강제는 아니다. 자동 대조를 되살릴지는
 * NERV Task `CLE-T-DM3AXQ` 항목 14 가 정한다.
 *
 * **왜 이 가드가 필요한가 — 이것도 "부재 주장" 이다.** 지금 배선된 component 는
 * `idempotency` **하나뿐**이고, 그 사실은 아무 데도 고정돼 있지 않았다. 새 소비자를
 * 배선하면서 유니온 확장을 잊으면 타입이 막는다. 반대로 유니온만 넓히고 배선을 잊으면
 * **조용히 통과**한다. 그 경우가 특히 나쁘다 — 대시보드에 라벨이 있는데 값이 영원히 0이면
 * 운영자는 "그 경로는 건강하다" 고 읽는다.
 *
 * **미배선 fail-open 서비스는 이 가드의 대상이 아니다.** 2026-08-29 실측으로 Redis 를 만지며
 * fail-open 하는 파일은 21개이고 그중 배선된 것은 인터셉터 1곳뿐인데, 나머지 19개를 여기서
 * 강제하지 않는다 — 배선은 component 라벨 설계와 카탈로그 갱신을 동반하는 별건이고,
 * 그 백로그는 NERV Task `CLE-T-7ER0Y0` 이다. 이 가드가 막는 것은 **"유니온을 넓히면서
 * 배선을 빠뜨리는 것"** 이다.
 */
describe('clemvion.redis.fail_open component 유니온 · 실배선 정합', () => {
  const repoRoot = path.resolve(__dirname, '../../../../..');
  const srcDir = path.resolve(__dirname, '../..');
  // 프로덕션 소스 전수를 한 번만 읽는다.
  const wired = findWiredComponents(srcDir);
  const unionMembers = readUnionMembers(repoRoot);

  it('유니온의 모든 값이 프로덕션 호출부를 가진다 (라벨이 구현보다 넓지 않다)', () => {
    // 유니온에만 있고 아무도 안 부르는 값이 있으면, 그 라벨의 0 은 "정상" 이 아니라 "미계측" 이다.
    expect(findUnwiredMembers(unionMembers, wired)).toEqual([]);
  });

  it('모든 호출부의 component 인자가 정적으로 해석된다', () => {
    // 해석 실패(`null`)를 허용하면 위 단언이 조용히 좁아진다 — 못 읽은 호출부는
    // "배선 안 된 것" 과 구분되지 않기 때문이다. 동적 값이 필요해지면 가드를 먼저 고쳐라.
    expect(wired.filter((w) => w.component === null)).toEqual([]);
  });

  it('현재 배선된 component 는 `idempotency` 하나다 (넓어지면 여기서 알린다)', () => {
    // 이 단언은 "고정" 이 아니라 **알림**이다. 새 소비자를 배선하면 여기가 RED 가 되고,
    // 그때 유니온을 함께 넓혔는지 위 두 단언이 확인한다. `CLE-OBS-LOGGING` 카탈로그 표도
    // 함께 넓힌다(NERV 스펙 초안). 값을 늘릴 때 이 줄을 같이 늘리는 것이 곧 체크리스트다.
    expect(unionMembers).toEqual(['idempotency']);
  });

  describe('가드 자체의 판별력', () => {
    it('유니온에만 있는 값을 미배선으로 낸다 (합성 입력)', () => {
      const wiredOne = [{ file: 'a.ts', component: 'idempotency' }];
      expect(
        findUnwiredMembers(['blacklist', 'idempotency'], wiredOne),
      ).toEqual(['blacklist']);
      expect(findUnwiredMembers(['idempotency'], wiredOne)).toEqual([]);
      // 해석하지 못한 호출부(`null`)는 어떤 값도 배선한 것으로 치지 않는다.
      expect(
        findUnwiredMembers(['idempotency'], [{ component: null }]),
      ).toEqual(['idempotency']);
    });

    it(`상수를 거쳐 넘기는 ${RECORDER_FN} 호출부도 값을 해석한다`, () => {
      // 정본 호출부(`idempotency.interceptor.ts`)가 문자열 리터럴이 아니라 `METRICS_COMPONENT`
      // 상수를 넘긴다. 상수 추적이 없으면 그 호출부가 통째로 안 보이고, 그 상태에서도 위
      // "모든 값이 호출부를 가진다" 가 **거짓 RED** 가 아니라 조용한 오판이 된다.
      expect(wired.length).toBeGreaterThan(0);
      expect(
        wired.some((w) => w.file.includes('idempotency.interceptor.ts')),
      ).toBe(true);
      expect(wired.every((w) => w.component === 'idempotency')).toBe(true);
    });

    it(`유니온 소스 경로(${UNION_SOURCE}) 가 실재한다`, () => {
      // 현재 저장소 상태에서 경로가 실재함만 본다 — 옮겨졌을 때의 실패 모드 자체는
      // 아래 별도 케이스가 scratch 경로로 직접 검증한다.
      expect(fs.existsSync(path.join(repoRoot, UNION_SOURCE))).toBe(true);
    });

    it('유니온 소스 파일이 없으면 빈 배열이 아니라 throw 한다 (ENOENT)', () => {
      // 파일이 옮겨진 상태를 scratch 빈 디렉터리로 직접 재현한다 — 빈 배열로 조용히
      // 통과하면 위 정합 단언이 `[] === []` 로 공허해진다.
      const tmp = fs.mkdtempSync(
        path.join(os.tmpdir(), 'redis-failopen-guard-union-'),
      );
      try {
        expect(() => readUnionMembers(tmp)).toThrow();
      } finally {
        fs.rmSync(tmp, { recursive: true, force: true });
      }
    });

    it('가드 두 파일의 문자열 리터럴에 스펙 트리 경로가 없다', () => {
      // 옛 트리는 전환 단계 5 에서 지운다. 가드가 다시 그 아래 파일을 읽으면 그날 깨진다.
      // 경로는 문자열로만 만들 수 있으므로 두 파일의 문자열 리터럴 전수를 본다. 주석은
      // 리터럴이 아니라서 옛 경로를 이력으로 적어도 걸리지 않는다. 판정은 정규식 리터럴로
      // 한다. 이 파일도 검사 대상이라 비교용 문자열을 두면 자기 자신이 걸린다.
      const files = [
        path.join(__dirname, 'redis-fail-open-catalog-guard.ts'),
        __filename,
      ];
      const literals = files.flatMap((f) =>
        stringLiteralsOf(f, fs.readFileSync(f, 'utf8')),
      );
      expect(literals.length).toBeGreaterThan(10); // 리터럴을 실제로 걷었다
      expect(literals.filter((s) => /^spec$|(^|\/)spec\//.test(s))).toEqual([]);
    });
  });
});
