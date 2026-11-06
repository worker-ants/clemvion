/**
 * `buildTriggerListOrderBy` 단위 테스트 — `GET /api/triggers` 의 `sort` · `order` 를 ORDER BY 조건으로 바꾸는 규칙.
 *
 * 허용 컬럼은 CLE-T-FKYM4N 질문의 답으로 정했다(REQ-TRIG-025 가 목록을 정하지 않았다).
 * 실제 SQL 정렬 결과는 `test/trigger-list-sort.e2e-spec.ts` 가 실 DB 로 단언한다. 여기서는 매핑 규칙만 본다.
 */
import { buildTriggerListOrderBy } from './triggers-list-sort';

describe('buildTriggerListOrderBy', () => {
  it('sort · order 가 없으면 created_at DESC 이고 id 로 순서를 고정한다', () => {
    expect(buildTriggerListOrderBy(undefined, undefined)).toEqual({
      't.created_at': 'DESC',
      't.id': 'DESC',
    });
  });

  it.each([
    ['created_at', 't.created_at'],
    ['updated_at', 't.updated_at'],
    ['name', 't.name'],
    ['type', 't.type'],
    ['is_active', 't.is_active'],
  ])('sort=%s 는 %s 컬럼으로 asc · desc 정렬한다', (sort, column) => {
    expect(buildTriggerListOrderBy(sort, 'asc')).toEqual({
      [column]: 'ASC',
      't.id': 'ASC',
    });
    expect(buildTriggerListOrderBy(sort, 'desc')).toEqual({
      [column]: 'DESC',
      't.id': 'DESC',
    });
  });

  it('last_triggered_at 은 asc · desc 모두 한 번도 실행되지 않은(null) 행을 뒤로 보낸다', () => {
    expect(buildTriggerListOrderBy('last_triggered_at', 'asc')).toEqual({
      't.last_triggered_at': { order: 'ASC', nulls: 'NULLS LAST' },
      't.id': 'ASC',
    });
    expect(buildTriggerListOrderBy('last_triggered_at', 'desc')).toEqual({
      't.last_triggered_at': { order: 'DESC', nulls: 'NULLS LAST' },
      't.id': 'DESC',
    });
  });

  /**
   * 정렬 컬럼이 먼저이고 `t.id` 는 같은 값끼리의 순서만 정한다.
   * TypeORM 은 객체의 키 순서대로 ORDER BY 를 만들기 때문에 순서가 바뀌면 사실상 id 정렬이 된다.
   */
  it('ORDER BY 순서는 정렬 컬럼 다음 t.id 다', () => {
    expect(Object.keys(buildTriggerListOrderBy('name', 'asc'))).toEqual([
      't.name',
      't.id',
    ]);
  });

  /**
   * DTO 의 `@Matches(/^[a-zA-Z][a-zA-Z0-9_]*$/)` 를 통과하는 값 가운데 Object 내장 속성 이름이 있다.
   * 평범한 객체 조회(`allowed[sort]`)는 이 값에서 내장 함수를 돌려줘 폴백을 건너뛴다.
   * 허용 목록 밖의 컬럼(비밀 · 내부 컬럼 포함)도 같은 폴백을 탄다.
   */
  it.each([
    'constructor',
    'toString',
    'hasOwnProperty',
    'valueOf',
    '__proto__',
    'workspace_id',
    'config',
    'notification_secret_v2',
    'last_run',
    'next_run_at',
    'createdAt',
    '',
  ])('허용 밖 sort=%p 는 created_at 으로 폴백하고 방향은 지킨다', (sort) => {
    expect(buildTriggerListOrderBy(sort, 'asc')).toEqual({
      't.created_at': 'ASC',
      't.id': 'ASC',
    });
    expect(buildTriggerListOrderBy(sort, 'desc')).toEqual({
      't.created_at': 'DESC',
      't.id': 'DESC',
    });
  });

  /** DTO 의 `@IsIn(['asc','desc'])` 가 먼저 막지만, 함수만 따로 불려도 'asc' 가 아니면 DESC 다. */
  it.each([undefined, 'desc', 'ASC', 'DESC', 'random'])(
    'order=%p 는 DESC 다',
    (order) => {
      expect(buildTriggerListOrderBy('name', order)).toEqual({
        't.name': 'DESC',
        't.id': 'DESC',
      });
    },
  );
});
