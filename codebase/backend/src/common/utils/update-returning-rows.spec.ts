import { readFileSync } from 'fs';
import { join } from 'path';
import { updateReturningRows } from './update-returning-rows';

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
  ])('%s 면 던진다', (_l, v) => {
    expect(() => updateReturningRows(v, 'computeChainDepth 재귀 CTE')).toThrow(
      /배열이 아님/,
    );
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
  const SRC = join(__dirname, '..', '..');

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
      const helper = (src.match(/updateReturningRows[<(]/g) ?? []).length;
      expect(helper).toBe(count);
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
