/**
 * `ExecutionEngineService.updateExecutionStatus` else 분기의 guarded UPDATE SQL 을 만든다.
 *
 * 바인딩 자리는 `$1` id · `$2` status · `$3` active_running_ms · `$4` finished_at ·
 * `$5` duration_ms · `$6` output_data · `$7` resume_call_stack · `$8` error 다.
 * 테스트 유틸 `findExecutionStatusUpdate` 의 spec 이 이 함수가 만든 SQL 로 단언한다.
 * 그래서 SQL 을 바꾸면 그 spec 도 함께 깨진다(CLE-T-G1JP5S). 제품 동작은 옛 인라인
 * SQL 과 같다.
 *
 * **쓰기 범위 계약(CLE-T-84YZDS)**: SET 절은 상태와 관계없이 일곱 컬럼을 모두 쓴다. 특히
 * `error` 는 모든 전이에서 in-memory `execution.error` 로 덮인다(없으면 `NULL`). 그래서
 * 호출부는 전이 전에 `error` 를 "이 전이 뒤 DB 에 남아야 할 값" 으로 맞춰 둬야 한다.
 * - FAILED 로 가는 호출부(`finalizeFailedExecution` · `failFirstSegmentSetup` ·
 *   `executeSync` timeout)는 이번 실패의 `error` 를 먼저 채운다.
 * - 재시도는 턴 시작 때 엔티티의 `error` 를 비우고 턴 끝 전이가 이 SET 으로 옛 값을
 *   지우는 데 기댄다. SET 을 전이별로 좁히면 그 정리가 사라진다. CLE-EXEC-STATE-RETRY
 *   「재시도 전에 실행 `failed` 를 두 번 확인한다」가 이 공유 SET 을 재시도 전용으로 바꾸지
 *   않기로 정했고 이 계약은 그 결정을 따른다(사용자 결정 질문 18 A).
 * - `error` 를 건드리지 않아야 하는 전이는 이 함수를 지나지 않는다. 예: retry-turn
 *   `finalizeGuarded` 의 취소 멱등 분기는 직접 UPDATE 로 `error` 를 SET 에서 뺀다.
 *
 * @param guardStatusesSql `status IN (…)` 안에 넣을 목록. `guardStatusesSql()` 가 만든
 *   따옴표 친 상태 목록(`'running', 'pending'`)만 넘긴다. 사용자 입력을 넣지 않는다.
 */
export function buildExecutionStatusUpdateSql(
  guardStatusesSql: string,
): string {
  return `UPDATE execution
            SET status = $2,
                active_running_ms = $3,
                finished_at = $4,
                duration_ms = $5,
                output_data = $6::jsonb,
                resume_call_stack = $7::jsonb,
                error = $8::jsonb
          WHERE id = $1
            AND status IN (${guardStatusesSql})
          RETURNING id`;
}
