import { readFileSync, readdirSync } from 'fs';
import { join, relative, sep } from 'path';
import {
  countCalls,
  countRawUpdateReturning,
} from '../__test-utils__/source-scan';
import { updateReturningRows } from './update-returning-rows';

// 아래 두 `describe` 가 각자 재선언하던 것을 파일 상단으로 hoist 했다
// (`13_15_58` maintainability INFO 2, 세 번째 describe 가 생기기 전이지만 둘도 이미
// 중복이었다).
const SRC = join(__dirname, '..', '..');

describe('updateReturningRows', () => {
  it('UPDATE/DELETE 튜플에서 RETURNING 행만 꺼낸다', () => {
    expect(updateReturningRows([[{ id: 'a' }], 1], 'ctx')).toEqual([
      { id: 'a' },
    ]);
  });

  it('0행 튜플은 빈 배열 — "없음" 이 보존돼야 CAS 락이 거절한다', () => {
    expect(updateReturningRows([[], 0], 'ctx')).toEqual([]);
  });

  it('행 배열 직접(SELECT/INSERT 형태)도 그대로 받는다', () => {
    expect(updateReturningRows([{ id: 'b' }], 'ctx')).toEqual([{ id: 'b' }]);
    expect(updateReturningRows([], 'ctx')).toEqual([]);
  });

  it.each([
    ['undefined', undefined],
    ['null', null],
    ['객체', { rowCount: 1 }],
  ])('%s 면 던지고 호출부 문맥을 메시지에 싣는다', (_label, value) => {
    // `detail` 이 실제 메시지에 실리는지까지 본다 — 그게 이 인자를 필수로 만든 이유다.
    // 자매 헬퍼 `assertRowArray` 의 같은 테스트는 이미 이렇게 하고 있었다
    // (ai-review `23_46_00` WARNING 4). placeholder 이름도 자매와 맞췄다.
    expect(() =>
      updateReturningRows(value, 'computeChainDepth 재귀 CTE'),
    ).toThrow(/배열이 아님.*computeChainDepth 재귀 CTE/s);
  });
});

/**
 * **이 결함이 4개월 살아남은 이유는 mock 이 틀린 현실을 인코딩했기 때문이다.**
 * 단위 테스트가 `UPDATE … RETURNING` 에 `[{id}]`(INSERT 형태)를 돌려주도록 mock 해서
 * `rows.length === 1` 이 GREEN 이었고, e2e 는 최종 상태(`completed`)만 봐서 경로가
 * 틀린 것을 못 봤다.
 *
 * 그래서 헬퍼를 만드는 것만으로는 부족하다 — **UPDATE/DELETE 결과를 헬퍼 없이 직접
 * 소비하는 지점이 다시 생기는 것**을 여기서 막는다. 새 지점을 추가하면서 헬퍼를
 * 빠뜨리면 RED 가 된다.
 *
 * 정적 grep 이라 정밀하지 않다(사각지대는 `assert-row-array.spec.ts` 와 동일 — `let`·
 * 체이닝 형태). 개수만 본다. 대조군으로 **이미 올바른** 두 방식도 함께 고정한다:
 * `stuck-document-recovery` 의 구조분해와 `agent-memory-admin` 의 `deletedRowCount`.
 */
describe('UPDATE/DELETE 결과를 직접 소비하는 지점이 다시 생기지 않는다', () => {
  /** 반환값을 변수로 받는 raw 쿼리 호출. */
  const CONSUMING = /const\s+\w+[^=\n]*=\s*\n?\s*await\s+[\w.]*\.query[<(]/g;

  // (파일, 그 파일의 `updateReturningRows` 호출 수) — 2-tuple 이다.
  // 종전 주석은 3항목을 예고했는데 타입은 2항목이었다(`23_27_48` WARNING 2).
  const EXPECTED: Array<[string, number]> = [
    ['modules/execution-engine/execution-engine.service.ts', 2],
    ['modules/knowledge-base/knowledge-base.service.ts', 5],
    // 1차 감사가 놓쳤던 지점 — 정규식이 백틱 SQL 만 봐서 작은따옴표 쿼리를 통째로
    // 건너뛰었고, 그 사각지대에 소셜 로그인 상시 실패가 있었다 (`20_36_35` CRITICAL 1).
    ['modules/auth/auth-oauth.service.ts', 1],
  ];

  it.each(EXPECTED)(
    '%s 의 UPDATE/DELETE 소비 지점 %i 개가 모두 updateReturningRows 를 거친다',
    (rel, count) => {
      const src = readFileSync(join(SRC, rel), 'utf8');
      expect(countCalls(src, 'updateReturningRows')).toBe(count);
    },
  );

  it('이미 올바른 두 선례는 그대로 유지된다 (구조분해 · deletedRowCount)', () => {
    const recovery = readFileSync(
      join(
        SRC,
        'modules/knowledge-base/queues/stuck-document-recovery.service.ts',
      ),
      'utf8',
    );
    // `const [rows] = await …query` 구조분해 2곳.
    expect((recovery.match(/const \[rows\] = await/g) ?? []).length).toBe(2);

    const admin = readFileSync(
      join(SRC, 'modules/agent-memory/agent-memory-admin.service.ts'),
      'utf8',
    );
    // 튜플·비튜플 양쪽을 받는 로컬 헬퍼가 살아 있어야 한다.
    expect(admin).toContain('function deletedRowCount(');
    expect((admin.match(/deletedRowCount\(result\)/g) ?? []).length).toBe(2);
  });

  it('소비 지점 자체의 수가 늘면 알려준다 — 새 지점은 판단이 필요하다', () => {
    const counts = EXPECTED.map(([rel]) => {
      const src = readFileSync(join(SRC, rel), 'utf8');
      return (src.match(CONSUMING) ?? []).length;
    });
    // execution-engine 3곳(admission·lock·update) / knowledge-base 10곳 / auth-oauth **0곳**.
    // auth-oauth 이 0 인 이유: 수정하면서 `await …query(…)` 를 헬퍼 호출의 인자로 넣어
    // `const x = await …query(` 패턴이 사라졌다. 정규식의 한계지 결함이 아니다 —
    // 그 파일의 헬퍼 호출 수는 위 `it.each` 가 1 로 고정한다. 여기 0 을 두면
    // **헬퍼를 안 거치는 새 지점이 생길 때** 1 이 되어 잡힌다(원하는 동작).
    // SELECT 지점도 포함한 수다 — 늘면 UPDATE 인지 SELECT 인지 사람이 본다.
    //
    // **이 수가 바뀌었다고 곧바로 회귀는 아니다.** 파일 분할·무관한 raw query 추가로도
    // 달라진다. 늘었으면 (1) 새 지점이 UPDATE/DELETE 인지 보고 (2) 맞으면 헬퍼를 태우고
    // (3) 아니면 이 기대값을 갱신한다 (`20_36_35` WARNING 7).
    expect(counts).toEqual([3, 10, 0]);
  });
});

/**
 * **목록 밖에 새 지점이 생겼는지** 를 본다 — 위 `describe` 가 원리적으로 못 보던 축이다.
 *
 * 위 가드는 손으로 고른 3파일의 헬퍼 호출 수만 센다. 그래서 *"아는 지점이 후퇴하지
 * 않는지"* 는 지키지만 **목록 밖 파일에 새 raw UPDATE 가 생기면 아무것도 RED 를 내지
 * 않는다** (`01_12_26` architecture W1).
 *
 * 여기서는 입력 집합을 **손으로 고르지 않고 `src/**` 전수에서 발견**한다
 * ({@link countRawUpdateReturning}). 그러면 "목록을 줄이는 편집" 이라는 조용한 통과 표면이
 * 사라진다 — 이 저장소가 반복 기록한 *"입력 집합 자체가 커버리지"* 다.
 *
 * ## 판정은 존재가 아니라 **개수**로 한다
 *
 * 처음엔 파일 단위 존재만 봤다 — 헬퍼 호출이 파일에 하나라도 있으면 통과였다. 그러면
 * 한 파일에 raw 지점이 2곳이고 헬퍼는 1곳만 거치는 경우를 "가드됨" 으로 오판한다. 자매
 * 큐레이션 가드(`EXPECTED`)는 정확한 개수 튜플로 이걸 피하는데 존재-only 판정은 그
 * 정밀도를 잃는다 (`01_12_26` requirement/testing W2). 그래서 `discover()` 는 파일마다
 * **raw 지점 수**까지 함께 돌려주고, 판정은 `countCalls(...) >= rawCount` 로 개수를
 * 직접 비교한다.
 *
 * ## 왜 래퍼(타입 경계)로 가지 않았나
 *
 * plan 은 `DataSource`/`EntityManager` 확장 래퍼로 "호출 즉시 언랩" 을 강제하는 안을
 * 함께 적어 두면서 **"착수 전 비용을 볼 것"** 을 달아 뒀다. 재보니 그 안은 기존 raw 호출부
 * **전수 이관**을 요구한다. 반면 발견형 가드는 호출부를 하나도 안 건드리고 같은 축을 —
 * *"헬퍼를 안 거치는 지점이 존재하는가"* — 지킨다. 래퍼가 더 강한 보장(컴파일 타임)을
 * 주는 것은 맞으므로, 이관 비용을 치를 이유가 생기면 그때 승격한다.
 */

/**
 * `discovered` 중 헬퍼(또는 유효한 허용목록)가 못 덮는 지점을 가른다.
 *
 * **순수 함수다** — 파일시스템을 만지지 않는다. 그래서 합성 입력으로 판정 로직 자체를
 * 검증할 수 있다(아래 `describe('findUnguarded — …')`). 이전엔 이 판정이 `it` 본문에
 * 인라인이라 스텁을 먹일 수 없었고, 유일한 검증은 리뷰 라운드 중 만들었다 지운 수동
 * 프로브 파일 1회뿐이었다 — 하드닝을 지키는 영속 테스트가 없었다 (`13_15_58` testing W2).
 *
 * 두 축을 가른다:
 *
 * 1. **허용목록(`allowed`) 안의 파일** — 그 사유가 검토한 raw 지점 수(`allowedCount`)를
 *    넘지 않는 한 통과한다. `rawCount`가 그 수를 넘으면, 사유가 커버하지 못하는 **새
 *    지점**이 그 파일에 생겼다는 뜻 — unguarded 로 분류한다. 파일 단위 전면 면제였던
 *    이전 판정은 이 축이 없어 `kb-stats.helper.ts` 류 파일에 두 번째 raw 지점이 생겨도
 *    GREEN 이었다 (`13_15_58` requirement W1).
 * 2. **그 외 파일** — `guardCountOf(rel)`(헬퍼 호출 수)가 `rawCount` 보다 **작으면**
 *    unguarded. 존재(`> 0`)가 아니라 **개수**로 판정해야, 한 파일에 raw 지점이 2곳이고
 *    헬퍼는 1곳만 거치는 **부분 커버리지**를 잡는다.
 */
function findUnguarded(
  discovered: ReadonlyArray<readonly [string, number]>,
  allowed: ReadonlyMap<string, number>,
  guardCountOf: (rel: string) => number,
): string[] {
  const unguarded: string[] = [];
  for (const [rel, rawCount] of discovered) {
    const allowedCount = allowed.get(rel);
    if (allowedCount !== undefined) {
      if (rawCount > allowedCount) unguarded.push(rel);
      continue;
    }
    if (guardCountOf(rel) < rawCount) unguarded.push(rel);
  }
  return unguarded;
}

describe('헬퍼를 거치지 않는 raw UPDATE/DELETE 지점이 새로 생기지 않는다', () => {
  /** 허용목록 사유의 최소 길이 — 빈 사유나 "ok" 류를 막는다. */
  const MIN_REASON_LENGTH = 20;

  /**
   * 발견되지만 헬퍼가 **필요 없는** 지점 — (경로, 사유, 그 사유가 검토한 raw 지점 수).
   *
   * 목록에 넣는 것 자체가 판단이므로, "왜 안전한가" 를 여기 적지 않으면 다음 사람이
   * 그 판단을 다시 해야 한다.
   *
   * **세 번째 항목(개수)이 있는 이유**: 면제는 파일 단위가 아니라 **그 사유가 실제로
   * 검토한 지점 수**까지만 걸린다. 이 수는 실측값이다 — 각 파일의
   * `countRawUpdateReturning` 을 직접 돌려 확인했다(스캐너 프로브,
   * `13_15_58` requirement W1). 여기 적은 수보다 그 파일의 `rawCount` 가 늘면
   * `findUnguarded` 가 unguarded 로 분류한다 — 사유가 검토하지 않은 새 지점이라는 뜻.
   */
  const ALLOWED: ReadonlyArray<readonly [string, string, number]> = [
    [
      'modules/knowledge-base/queues/stuck-document-recovery.service.ts',
      '`const [rows] = await …` 구조분해로 이미 언랩한다 (위 대조군 테스트가 2곳을 고정).',
      2,
    ],
    [
      'modules/agent-memory/agent-memory-admin.service.ts',
      '로컬 `deletedRowCount()` 가 튜플·비튜플 양쪽을 받는다 (위 대조군 테스트가 고정).',
      2,
    ],
    [
      'modules/integrations/integration-oauth.service.ts',
      '`.query<[Row[], number]>` 로 **튜플 타입을 명시**해 구조분해한다 — 타입이 곧 언랩 계약.',
      2,
    ],
    [
      'modules/knowledge-base/graph/kb-stats.helper.ts',
      '반환값을 **소비하지 않는다**(`await …query(…)`, 대입 없음). 타입 인자도 튜플로 정정해 ' +
        '다음 사람이 행 배열로 오해하지 않게 했다.',
      1,
    ],
  ];

  /** `src/**` 의 `.ts` 전수 (spec·d.ts·node_modules·dist 제외). */
  function listSources(dir: string): string[] {
    const out: string[] = [];
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === 'node_modules' || entry.name === 'dist') continue;
        out.push(...listSources(full));
      } else if (
        entry.name.endsWith('.ts') &&
        !entry.name.endsWith('.spec.ts') &&
        !entry.name.endsWith('.d.ts')
      ) {
        out.push(full);
      }
    }
    return out;
  }

  /**
   * 발견된 raw UPDATE/DELETE … RETURNING 지점 — (저장소 상대 경로, 그 파일의 raw 지점 수).
   * 존재-only 가 아니라 **개수**를 돌려주는 이유는 위 docstring 참조.
   */
  function discover(): Array<[string, number]> {
    return listSources(SRC)
      .map((f): [string, number] => [
        relative(SRC, f).split(sep).join('/'),
        countRawUpdateReturning(readFileSync(f, 'utf8')),
      ])
      .filter(([, count]) => count > 0)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  }

  // `discover()` 는 src/** 전수(약 800여 파일)를 재귀 스캔한다 — `it` 마다 새로 돌리면
  // 스위트가 파일 수에 선형으로 느려진다. 한 번만 계산해 아래 4개 `it` 이 공유한다
  // (`01_12_26` maintainability W5). 스캔은 순수 함수라 공유해도 테스트 간 격리가
  // 깨지지 않는다 — 어떤 `it` 도 소스를 변형하지 않는다.
  let discovered: Array<[string, number]>;
  beforeAll(() => {
    discovered = discover();
  });

  it('발견된 지점은 모두 raw 지점 수만큼 헬퍼를 거치거나 사유와 함께 허용목록에 있다', () => {
    const allowed = new Map(ALLOWED.map(([rel, , count]) => [rel, count]));
    const unguarded = findUnguarded(discovered, allowed, (rel) =>
      countCalls(readFileSync(join(SRC, rel), 'utf8'), 'updateReturningRows'),
    );
    expect(unguarded).toEqual([]);
  });

  it('허용목록이 죽은 항목을 갖지 않는다 — 사라진 파일은 면제를 공짜로 만든다', () => {
    // 대상이 아니게 된 항목을 남겨 두면, 나중에 같은 경로에 진짜 지점이 생겼을 때
    // 이미 면제돼 있다. 양방향으로 조인다.
    const found = new Set(discovered.map(([rel]) => rel));
    expect(
      ALLOWED.map(([rel]) => rel).filter((rel) => !found.has(rel)),
    ).toEqual([]);
  });

  it('허용목록의 모든 항목에 사유가 적혀 있다', () => {
    expect(
      ALLOWED.filter(([, why]) => why.trim().length < MIN_REASON_LENGTH),
    ).toEqual([]);
  });

  it('발견 자체가 공허하지 않다 — 알려진 지점을 실제로 찾는다', () => {
    // 스캐너가 0건을 돌려주면 위 단언들이 전부 조용히 통과한다(vacuity).
    const found = new Set(discovered.map(([rel]) => rel));
    expect(found.has('modules/auth/auth-oauth.service.ts')).toBe(true);
    expect(
      found.has('modules/execution-engine/execution-engine.service.ts'),
    ).toBe(true);
    expect(discovered.length).toBeGreaterThanOrEqual(ALLOWED.length + 1);
  });
});

/**
 * 위 describe 는 **저장소의 실제 파일**로만 `findUnguarded` 를 돌린다 — 오늘의 저장소가
 * 우연히 부분 커버리지 형태를 담고 있지 않으면, 판정 로직이 옛 존재-only(`=== 0`)로
 * 후퇴해도 아무 테스트도 RED 가 되지 않는다. 여기서는 **합성 입력**으로 판정 로직
 * 자체를 파일시스템 없이 고정한다 (`13_15_58` testing W2).
 */
describe('findUnguarded — 합성 입력으로 판정 로직 자체를 고정한다', () => {
  it('부분 커버리지(raw 2곳 중 헬퍼 1곳) → unguarded — 이 PR 핵심 하드닝의 판별 입력', () => {
    // 구 판정(`guardCount === 0`)이었다면 guardCount=1 은 "존재하니 통과" 로 오판했다.
    // 새 판정(`guardCount < rawCount`)은 1 < 2 라 unguarded 로 잡는다.
    const unguarded = findUnguarded(
      [['fake/partial.ts', 2]],
      new Map(),
      () => 1,
    );
    expect(unguarded).toEqual(['fake/partial.ts']);
  });

  it('완전 커버리지(raw 2곳, 헬퍼 2곳) → 통과', () => {
    const unguarded = findUnguarded([['fake/full.ts', 2]], new Map(), () => 2);
    expect(unguarded).toEqual([]);
  });

  it('초과 커버리지(raw 1곳, 헬퍼 3곳) → 통과', () => {
    const unguarded = findUnguarded([['fake/over.ts', 1]], new Map(), () => 3);
    expect(unguarded).toEqual([]);
  });

  // rawCount=0 인 파일은 애초에 `discover()` 가 걸러 `discovered` 에 들어오지 않는다
  // (본 파일의 `discover()` 정의 참조, `count > 0` 필터). 그래서 `findUnguarded` 입력에
  // rawCount=0 케이스는 해당 없음 — 여기서 별도로 고정하지 않는다.

  it('허용목록 파일의 raw 지점이 허용 수를 넘으면 unguarded — 파일 단위 전면 면제를 좁힌다', () => {
    // guardCountOf 가 무엇을 반환하든(여기선 0) 결과가 바뀌면 안 된다 — 허용목록 항목은
    // 헬퍼 호출 수가 아니라 "사유가 검토한 수" 로만 판정한다.
    const unguarded = findUnguarded(
      [['fake/allowlisted-grown.ts', 2]],
      new Map([['fake/allowlisted-grown.ts', 1]]),
      () => 0,
    );
    expect(unguarded).toEqual(['fake/allowlisted-grown.ts']);
  });

  it('허용목록 파일의 raw 지점이 허용 수 이내면 통과 — guardCountOf 는 호출되지 않아도 된다', () => {
    const unguarded = findUnguarded(
      [['fake/allowlisted-stable.ts', 1]],
      new Map([['fake/allowlisted-stable.ts', 1]]),
      () => 0,
    );
    expect(unguarded).toEqual([]);
  });
});
