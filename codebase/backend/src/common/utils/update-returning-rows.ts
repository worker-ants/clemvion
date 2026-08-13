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
 * `rows.map(r => r.id)` 는 `[undefined, undefined]`.
 *
 * 비-튜플(행 배열 직접) 형태도 받아들인다 — 드라이버/버전에 따라 달라질 수 있고,
 * 무엇보다 **호출부가 형태를 몰라도 되게** 하는 것이 이 함수의 목적이기 때문이다.
 *
 * ## 신규 지점은 이 헬퍼를 쓴다
 *
 * 저장소에 같은 문제를 **각자** 푼 관용구가 셋 더 있다. 전부 정확하지만 **과거 호환으로
 * 유지할 뿐 새로 따라 하지 않는다** — 처방이 지점마다 흩어져 있던 것이 이 결함이 계속
 * 재발한 이유다 (ai-review `20_36_35` WARNING 6):
 *
 * | 위치 | 관용구 | 계기 |
 * |---|---|---|
 * | `agent-memory-admin` | 로컬 `deletedRowCount()` | NotFound 로 변환 안 되던 버그 |
 * | `stuck-document-recovery` | 구조분해 `const [rows] = …` | 매 부팅 가짜 job 2개 큐잉 |
 * | `integration-oauth` | 명시 튜플 타입 + `queryResult[0]` | (선제 대응) |
 *
 * **세 곳이 이미 알고 있었는데 네 번째(`auth-oauth` 의 소셜 로그인 콜백)는 그걸 몰라서
 * 상시 실패하고 있었다.** 지식이 지점에 갇히면 그 옆에서 같은 실수가 난다.
 *
 * `SELECT` 결과에는 이걸 쓰지 않는다 — 그쪽은 튜플이 아니므로 `assertRowArray`
 * (`./assert-row-array`) 가 맡는다.
 *
 * ## ⚠️ 제네릭 `T` 는 검증이 아니라 **단언**이다 — 컬럼명은 snake_case 다
 *
 * 이 함수는 **바깥 shape**(튜플이냐 행 배열이냐)만 구조적으로 판별한다. 개별 행의 필드는
 * `as T[]` 로 넘길 뿐 아무것도 확인하지 않는다.
 *
 * 그리고 raw `.query()` 는 ORM 매핑을 타지 않으므로 **행의 키가 DB 그대로 snake_case** 다.
 * entity 타입을 제네릭으로 넘기면 `@Column({ name: 'remember_me' }) rememberMe` 같은 매핑이
 * 적용된 것처럼 보이지만 실제로는 안 된다 — **컴파일은 통과하고 런타임에 조용히 `undefined`** 다.
 *
 * 이 PR 안에서 실제로 그렇게 됐다: `updateReturningRows<AuthOAuthState>` 로 단언한 뒤
 * `record.rememberMe` 를 읽어 소셜 로그인의 "로그인 유지" 가 침묵으로 무시됐다. 나머지 7개
 * 호출부는 `id` 처럼 **대소문자 차이가 없는 필드만 써서 우연히 피했을 뿐**이다.
 *
 * → raw 행 전용 타입(snake_case 필드)을 따로 선언해 넘길 것.
 *   예: `auth-oauth.service.ts` 의 `AuthOAuthStateRow`.
 */
export function updateReturningRows<T = unknown>(
  result: unknown,
  /**
   * 호출부 문맥(어느 execution·어느 KB 인지 등). **필수다** — 자매 헬퍼 `assertRowArray` 와
   * 같은 계약이고, 선택으로 두었더니 8곳 중 한 곳(`auth-oauth`, 이 PR 전체를 촉발한 바로 그
   * 지점)이 비워 뒀다 (ai-review `23_07_11` WARNING 4). 극단 상황에서 로그만으로 지점을
   * 특정할 수 있어야 하고, 그건 "권장" 으로는 지켜지지 않는다.
   */
  detail: string,
): T[] {
  if (!Array.isArray(result)) {
    throw new Error(
      `UPDATE/DELETE RETURNING 결과가 배열이 아님 (typeof=${typeof result}) — ${detail}`,
    );
  }
  // `[rows, rowCount]` 튜플 — 첫 원소가 배열이면 그것이 RETURNING 행이다.
  if (Array.isArray(result[0])) {
    return result[0] as T[];
  }
  // 빈 튜플은 없다(`[[], 0]` 이므로 위에서 걸린다). 여기 오는 건 행 배열 직접.
  return result as T[];
}
