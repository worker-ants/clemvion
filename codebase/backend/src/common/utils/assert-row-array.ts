/**
 * `EntityManager.query()` / `Repository.query()` 의 선언 타입은 `Promise<any>` 다.
 * 호출부가 `const rows: Array<{ id: string }> = await repo.query(...)` 처럼 적는 제네릭·
 * 타입 단언은 **주장이지 검증이 아니다** — 드라이버가 배열 아닌 것을 돌려주면 그대로 통과하고,
 * 뒤따르는 `rows.length` / `rows[0]` 가 조용히 엉뚱한 값을 만든다.
 *
 * 이 저장소에서 그 결과는 매번 달랐다 (ai-review `17_15_21` 실측):
 * `.length > 0` 자리는 `false` 로 접히고(fail-closed), `rows[0]?.x ?? 기본값` 자리는
 * **기본값으로 접혀 제한 검사를 통과**했다(fail-open). 그래서 이 헬퍼는 `.length`/`[0]` 를
 * 읽기 **전에** 배열임을 확정하는 한 가지 일만 한다.
 *
 * **메시지는 호출부가 준다.** 왜 이 자리가 위험한지는 지점마다 다르고(롤백이 걸리는지,
 * 종결 이벤트가 유실되는지, 어떤 제한이 우회되는지) 그 설명이 진짜 값어치다 — 헬퍼가
 * 일반 문구로 뭉개면 다음 사람이 그 차이를 못 본다.
 *
 * ## ⚠️ `UPDATE`/`DELETE … RETURNING` 에는 이걸 쓰지 마라 — {@link updateReturningRows}
 *
 * 이 헬퍼는 **SELECT 전용**이다. TypeORM 0.3.31 + pg 는 `UPDATE`/`DELETE` 에
 * `[rows, rowCount]` **튜플**을 돌려주는데, **튜플도 배열이라 이 가드를 그대로 통과한다.**
 * 통과한 뒤 `.length` 는 항상 2, `[0]` 은 행이 아니라 행 배열이다.
 *
 * 그래서 8곳이 이 함정에 빠져 4개월간 소셜 로그인 상시 실패·admission cap 미집행·
 * KB CAS 락 미작동을 냈다. 분담은 이렇다:
 *
 * | 쿼리 | 헬퍼 |
 * |---|---|
 * | `SELECT` | `assertRowArray` (이 파일) |
 * | `UPDATE`/`DELETE … RETURNING` | `updateReturningRows` (`./update-returning-rows`) |
 */
export function assertRowArray(
  rows: unknown,
  detail: string,
): asserts rows is unknown[] {
  if (!Array.isArray(rows)) {
    throw new Error(
      `raw SQL 결과가 배열이 아님 (typeof=${typeof rows}) — ${detail}`,
    );
  }
}
