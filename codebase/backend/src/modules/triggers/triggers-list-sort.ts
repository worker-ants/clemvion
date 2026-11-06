import type { OrderByCondition } from 'typeorm';

/**
 * `GET /api/triggers` 의 `sort` 값과 ORDER BY 컬럼(별칭 `t`)의 대응표.
 *
 * REQ-TRIG-025 는 "그 기준으로 정렬한다" 만 적고 허용 목록을 정하지 않았다. 이 목록은 CLE-T-FKYM4N 질문의
 * 답으로 정했다(엔티티에서 정렬할 만한 컬럼 전부). 스펙 본문에 적는 일은 planner 후속 Task 가 맡는다.
 * 값은 SQL 에 그대로 들어가므로 사용자 입력이 아니라 이 표의 값만 쓴다.
 */
const SORT_COLUMNS: Readonly<Record<string, string>> = Object.freeze({
  created_at: 't.created_at',
  updated_at: 't.updated_at',
  name: 't.name',
  type: 't.type',
  is_active: 't.is_active',
  last_triggered_at: 't.last_triggered_at',
});

const DEFAULT_SORT = 'created_at';

/** 한 번도 실행되지 않은 트리거(null)를 방향과 무관하게 뒤로 보내는 컬럼. */
const NULLS_LAST_SORTS: ReadonlySet<string> = new Set(['last_triggered_at']);

/**
 * 목록 쿼리의 `sort` · `order` 를 TypeORM `OrderByCondition` 으로 바꾼다.
 *
 * - 허용 밖 `sort` 는 `created_at` 으로 폴백한다. 400 으로 거절하지 않는 것은 `schedules` · `workflows`
 *   목록과 같다. 판정은 `Object.hasOwn` 으로 한다. `allowed[sort]` 로 조회하면 DTO 정규식을 통과하는
 *   `constructor` 같은 값이 Object 내장 함수를 돌려줘 폴백을 건너뛴다.
 * - `order` 는 `'asc'` 만 ASC 이고 나머지는 DESC 다. DTO 의 `@IsIn(['asc','desc'])` 가 먼저 거른다.
 * - 같은 값끼리는 `t.id` 로 순서를 고정해 offset 페이지가 흔들리지 않게 한다. TypeORM 은 키 순서대로
 *   ORDER BY 를 만들기 때문에 정렬 컬럼을 먼저 넣는다.
 */
export function buildTriggerListOrderBy(
  sort: string | undefined,
  order: string | undefined,
): OrderByCondition {
  const key =
    sort !== undefined && Object.hasOwn(SORT_COLUMNS, sort)
      ? sort
      : DEFAULT_SORT;
  const direction = order === 'asc' ? 'ASC' : 'DESC';
  const column = SORT_COLUMNS[key];
  return {
    [column]: NULLS_LAST_SORTS.has(key)
      ? { order: direction, nulls: 'NULLS LAST' }
      : direction,
    't.id': direction,
  };
}
