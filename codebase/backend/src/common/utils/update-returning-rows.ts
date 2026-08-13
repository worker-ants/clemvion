/**
 * `UPDATE`/`DELETE` raw 쿼리의 `RETURNING` 행을 꺼낸다.
 *
 * **TypeORM 0.3.31 + pg 는 `UPDATE`/`DELETE` 에만 `[rows, rowCount]` 튜플을 돌려준다**
 * (`PostgresQueryRunner.query` 의 `switch (raw.command)` — `SELECT`/`INSERT` 는 행 배열
 * 그대로). RETURNING 유무·파라미터 유무·트랜잭션 안팎과 **무관**하며, 실측으로 확인했다:
 *
 * ```
 * UPDATE … RETURNING (1행)  → [[{id:1}], 1]      length 2
 * UPDATE … RETURNING (0행)  → [[], 0]            length 2
 * INSERT … RETURNING (1행)  → [{id:4}]           length 1
 * ```
 *
 * 그래서 UPDATE/DELETE 결과에 `.length` / `[0]` / `.map` 을 **바로 쓰면 항상 같은 값**이
 * 나온다 — `rows.length === 1` 은 영원히 거짓, `rows.length > 0` 은 영원히 참,
 * `rows.map(r => r.id)` 는 `[undefined, undefined]`. 이 저장소는 이미 두 번 이 결함을
 * 겪었고(`agent-memory-admin` 의 NotFound 미변환, `stuck-document-recovery` 의 가짜 job
 * 2개 큐잉) 그때마다 **그 자리만** 고쳤다. 이 헬퍼는 그 처방을 한 자리로 모은다.
 *
 * 비-튜플(행 배열 직접) 형태도 받아들인다 — 드라이버/버전에 따라 달라질 수 있고,
 * 무엇보다 **호출부가 형태를 몰라도 되게** 하는 것이 이 함수의 목적이기 때문이다.
 */
export function updateReturningRows<T = unknown>(result: unknown): T[] {
  if (!Array.isArray(result)) {
    throw new Error(
      `UPDATE/DELETE RETURNING 결과가 배열이 아님 (typeof=${typeof result})`,
    );
  }
  // `[rows, rowCount]` 튜플 — 첫 원소가 배열이면 그것이 RETURNING 행이다.
  if (Array.isArray(result[0])) {
    return result[0] as T[];
  }
  // 빈 튜플은 없다(`[[], 0]` 이므로 위에서 걸린다). 여기 오는 건 행 배열 직접.
  return result as T[];
}
