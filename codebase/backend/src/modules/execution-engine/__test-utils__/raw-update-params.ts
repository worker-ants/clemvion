/**
 * raw `UPDATE execution` 호출에서 바인딩 값을 컬럼 이름으로 꺼낸다.
 *
 * `updateExecutionStatus` 는 `manager.query(sql, params)` 로 lifecycle 컬럼을 쓴다.
 * 테스트가 `(call[1] as unknown[])[7]` 처럼 자리 번호로 `error` 를 읽으면 SQL 의 자리가
 * 바뀔 때 엉뚱한 컬럼을 단언한다(CLE-T-WKESFB). 그래서 SQL 본문의 `컬럼 = $n` 짝을 읽어
 * `$n` 자리의 값을 그 컬럼 이름에 붙인다. `$6::jsonb` 같은 캐스트가 붙어도 읽는다.
 *
 * 읽지 못하는 꼴(CLE-T-G1JP5S):
 * - `컬럼 = COALESCE($n, 컬럼)` 처럼 `$n` 이 함수 인자인 대입은 `컬럼 = $n` 꼴이 아니라 빠진다.
 * - `$n` 이 `params` 길이를 넘으면 그 컬럼 값은 `undefined` 다. 오류를 내지 않는다.
 * - 테이블 이름은 낱말 경계로 본다. `UPDATE execution_foo` 나 `UPDATE node_execution` 은
 *   대상이 아니다.
 */

/** SQL 의 `컬럼 = $n` 짝. 리터럴 대입(`status = 'running'`)은 바인딩이 없어 빠진다. */
const BOUND_COLUMN = /(\w+)\s*=\s*\$(\d+)/g;

/** `UPDATE execution` 문. `execution_foo` 같은 다른 테이블은 걸리지 않는다. */
const UPDATE_EXECUTION = /\bUPDATE\s+execution\b/i;

/**
 * `query` mock 의 호출 가운데 `status` 바인딩 값이 `status` 인 `UPDATE execution` 을 찾아
 * 컬럼 이름 → 바인딩 값 객체로 돌려준다. 맞는 호출이 여럿이면 가장 먼저 부른 것을
 * 돌려준다. 없으면 `undefined`.
 */
export function findExecutionStatusUpdate(
  calls: readonly unknown[][],
  status: string,
): Record<string, unknown> | undefined {
  for (const [sql, params] of calls) {
    if (typeof sql !== 'string' || !UPDATE_EXECUTION.test(sql)) continue;
    if (!Array.isArray(params)) continue;
    const columns: Record<string, unknown> = {};
    // SET 절만 읽는다. `WHERE status = $n` 이 SET 의 `status` 를 덮어쓰지 못하게 한다.
    const setClause = sql.split(/\bWHERE\b/i)[0];
    for (const [, column, position] of setClause.matchAll(BOUND_COLUMN)) {
      columns[column] = params[Number(position) - 1];
    }
    if (columns.status === status) return columns;
  }
  return undefined;
}
