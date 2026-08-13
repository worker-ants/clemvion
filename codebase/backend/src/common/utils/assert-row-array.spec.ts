import { readFileSync } from 'fs';
import { join } from 'path';
import { countCalls } from './__testing__/source-scan';
import { assertRowArray } from './assert-row-array';

describe('assertRowArray', () => {
  it('배열이면 통과하고 배열로 좁힌다', () => {
    const rows: unknown = [{ id: 'a' }];
    expect(() => assertRowArray(rows, 'ctx')).not.toThrow();
    assertRowArray(rows, 'ctx');
    // 여기서 확인하는 건 **런타임 접근**이다. `asserts rows is unknown[]` 좁히기가
    // 실제로 컴파일에 걸리는지는 jest 가 못 본다 — ts-jest 는 타입을 strip 한다.
    // 그 검증은 `scripts/check-backend-typecheck-ratchet.py`(`.github/workflows/
    // backend-checks.yml` 의 typecheck 단계) 몫이다.
    expect(rows.length).toBe(1);
  });

  it('빈 배열도 통과한다 — "0행" 은 정상 결과지 이상이 아니다', () => {
    expect(() => assertRowArray([], 'ctx')).not.toThrow();
  });

  it.each([
    ['undefined', undefined],
    ['null', null],
    ['객체', { rowCount: 1 }],
    ['숫자', 1],
    ['문자열', '[]'],
  ])('%s 면 던지고 호출부 문맥을 메시지에 싣는다', (_label, value) => {
    expect(() => assertRowArray(value, 'computeChainDepth 재귀 CTE')).toThrow(
      /배열이 아님.*computeChainDepth 재귀 CTE/s,
    );
  });
});

/**
 * 이 저장소가 반복한 결함은 "가드를 한 곳에만 적용하고 자매를 안 세는 것" 이다
 * (ai-review `17_15_21` requirement WARNING 1). helper 추출은 boilerplate 를 줄일 뿐
 * **호출을 잊는 것을 막지 못한다** — 그걸 막는 건 이 테스트다.
 *
 * 두 서비스에서 반환값을 쓰는 raw SQL 호출을 세고, 같은 수의 `assertRowArray` 가 있는지
 * 본다. 5번째 `.query()` 를 추가하면서 가드를 빠뜨리면 **여기가 RED 로 알려준다.**
 *
 * 정적 grep 이라 정밀하지 않다 — 그래서 "정확히 어느 줄" 이 아니라 **개수**만 본다.
 * 반환값을 안 쓰는 호출(예: `pg_advisory_xact_lock`)은 `await m.query(` 로 시작하는
 * statement 라 `const ... = await ...query` 패턴에 안 잡힌다.
 *
 * **사각지대를 적어 둔다** (`18_19_33` testing INFO 8·7): `let` 선언·구조분해
 * (`const [row] = await ...`)·체이닝 형태의 신규 지점은 아래 정규식에 안 잡혀 GREEN 을
 * 유지한 채 지나간다. `FILES` 도 이 PR 이 손댄 2개로 한정돼 있어 backend 전역 감사는
 * 아니다(`integration-oauth.service.ts` 등 유사 소비 지점은 별도 백로그). 이 가드는
 * **완전한 증명이 아니라 가장 흔한 형태의 재발을 막는 그물**이다 — 넓히려면 정규식이
 * 아니라 AST 가 맞다.
 */
describe('자매 지점 전수 — 가드 누락 회귀 가드', () => {
  const SRC = join(__dirname, '..', '..');
  const FILES = [
    'modules/execution-engine/execution-engine.service.ts',
    'modules/executions/executions.service.ts',
  ];

  // 반환값을 변수에 받는 raw SQL 호출: `const x: T = await <something>.query(`
  const CONSUMING_QUERY =
    /const\s+\w+[^=\n]*=\s*\n?\s*await\s+[\w.]*\.query[<(]/g;

  it('반환값을 쓰는 .query() 호출 수 == assertRowArray 호출 수', () => {
    const counts = FILES.map((rel) => {
      const src = readFileSync(join(SRC, rel), 'utf8');
      return {
        rel,
        queries: (src.match(CONSUMING_QUERY) ?? []).length,
        // import 행은 `assertRowArray }` 라 아래 패턴(여는 괄호)에 안 걸린다 —
        // 처음엔 `- 1` 로 빼뒀다가 실측하고 지웠다.
        //
        // `countCalls` 는 주석을 제외하고 센다. 자매 가드
        // (`update-returning-rows.spec.ts`)만 이 하드닝을 받고 여기는 못 받아
        // 비대칭이 남아 있었다 (`00_54_01` testing WARNING 1). 지금은 대상 파일에
        // `assertRowArray(` 를 적은 주석이 없어 결과가 같지만, 주석 하나가
        // **호출 누락을 가리는** 결함 클래스는 이 카운터에도 열려 있었다.
        guards: countCalls(src, 'assertRowArray'),
      };
    });
    // 실측 고정 — 이 수가 바뀌면 새 지점이 생겼다는 뜻이고, 가드를 폈는지 여기서 갈린다.
    // **2026-08-13 갱신**: `UPDATE … RETURNING` 이 `[rows, count]` 튜플이라는 사실이
    // 드러나면서, 그 두 지점(admission·updateExecutionStatus)은 `assertRowArray` 가 아니라
    // `updateReturningRows` 가 맡는다 — 튜플도 배열이라 `assertRowArray` 로는 못 걸렀다.
    // 남은 `assertRowArray` 는 **SELECT 결과**를 지키는 자리뿐이다
    // (engine 의 `lockNonTerminalExecutionRow`, executions 의 `computeChainDepth`).
    // 두 헬퍼의 분담: SELECT → `assertRowArray`, UPDATE/DELETE → `updateReturningRows`.
    expect(counts).toEqual([
      {
        rel: 'modules/execution-engine/execution-engine.service.ts',
        queries: 3,
        guards: 1,
      },
      {
        rel: 'modules/executions/executions.service.ts',
        queries: 1,
        guards: 1,
      },
    ]);
  });
});
