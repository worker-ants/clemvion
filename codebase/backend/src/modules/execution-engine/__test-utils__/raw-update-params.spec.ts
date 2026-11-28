import { buildExecutionStatusUpdateSql } from '../execution-engine.service';
import { findExecutionStatusUpdate } from './raw-update-params';

/**
 * 제품 `updateExecutionStatus` 가 쓰는 SQL 그대로다. 손으로 옮긴 사본을 두지 않는다.
 * 제품 SQL 의 컬럼이나 자리가 바뀌면 아래 단언이 함께 깨진다(CLE-T-G1JP5S).
 */
const REAL_SQL = buildExecutionStatusUpdateSql("'running'");

describe('findExecutionStatusUpdate', () => {
  it('SET 절의 `컬럼 = $n` 을 컬럼 이름으로 묶고 `::jsonb` 캐스트도 읽는다', () => {
    const params = ['e1', 'failed', 10, null, 5, { o: 1 }, [], { code: 'X' }];
    const r = findExecutionStatusUpdate([[REAL_SQL, params]], 'failed');
    expect(r).toMatchObject({
      status: 'failed',
      active_running_ms: 10,
      output_data: { o: 1 },
      error: { code: 'X' },
    });
  });

  it('WHERE 절의 `id = $1` 은 잡지 않는다', () => {
    const r = findExecutionStatusUpdate(
      [[REAL_SQL, ['e1', 'failed', 0, null, 0, null, null, null]]],
      'failed',
    );
    expect(r).not.toHaveProperty('id');
  });

  it('WHERE 의 `status = $n` 이 SET 의 status 를 덮어쓰지 않는다', () => {
    const sql = 'UPDATE execution SET status = $1 WHERE status = $2';
    expect(
      findExecutionStatusUpdate([[sql, ['failed', 'running']]], 'failed'),
    ).toEqual({ status: 'failed' });
  });

  it('공백이 달라도(`col=$n`, 줄바꿈) 읽는다', () => {
    const sql = 'UPDATE execution SET status=$1,\n error\n=\n$2 WHERE id = $3';
    expect(
      findExecutionStatusUpdate([[sql, ['failed', 'boom', 'e1']]], 'failed'),
    ).toEqual({ status: 'failed', error: 'boom' });
  });

  it("리터럴 대입(`status = 'running'`)은 건너뛴다", () => {
    const sql = "UPDATE execution SET status = 'running', error = $1";
    expect(
      findExecutionStatusUpdate([[sql, ['x']]], 'running'),
    ).toBeUndefined();
  });

  it('일치하는 status 가 없으면 undefined 를 돌려준다', () => {
    expect(
      findExecutionStatusUpdate(
        [[REAL_SQL, ['e1', 'completed', 0, null, 0, null, null, null]]],
        'failed',
      ),
    ).toBeUndefined();
  });

  it('제품 SQL 의 바인딩 자리 여덟 개를 모두 컬럼 이름으로 읽는다', () => {
    const params = ['e1', 'failed', 10, 't', 5, { o: 1 }, [], { code: 'X' }];
    expect(findExecutionStatusUpdate([[REAL_SQL, params]], 'failed')).toEqual({
      status: 'failed',
      active_running_ms: 10,
      finished_at: 't',
      duration_ms: 5,
      output_data: { o: 1 },
      resume_call_stack: [],
      error: { code: 'X' },
    });
  });

  it('맞는 호출이 여럿이면 가장 먼저 부른 것을 돌려준다', () => {
    const first = ['e1', 'failed', 1, null, 0, null, null, { code: 'FIRST' }];
    const second = ['e1', 'failed', 2, null, 0, null, null, { code: 'SECOND' }];
    expect(
      findExecutionStatusUpdate(
        [
          [REAL_SQL, first],
          [REAL_SQL, second],
        ],
        'failed',
      ),
    ).toMatchObject({ error: { code: 'FIRST' } });
  });

  it.each([
    ['execution_foo', 'UPDATE execution_foo SET status = $1'],
    ['node_execution', 'UPDATE node_execution SET status = $1'],
  ])('다른 테이블(%s)의 UPDATE 는 건너뛴다', (_label, sql) => {
    expect(findExecutionStatusUpdate([[sql, ['failed']]], 'failed')).toBe(
      undefined,
    );
  });

  it('한계: `COALESCE($n, 컬럼)` 대입은 읽지 못하고 범위를 넘는 `$n` 은 undefined 다', () => {
    const sql =
      'UPDATE execution SET status = $1, error = COALESCE($2, error), output_data = $9';
    const r = findExecutionStatusUpdate([[sql, ['failed', 'boom']]], 'failed');
    expect(r).toEqual({ status: 'failed', output_data: undefined });
    expect(r).not.toHaveProperty('error');
  });

  it('params 가 배열이 아니거나 UPDATE execution 이 아닌 호출은 건너뛴다', () => {
    const calls: unknown[][] = [
      [REAL_SQL, undefined],
      ['SELECT 1', ['failed']],
      [42, ['failed']],
      ['UPDATE execution SET status = $1 WHERE id = $2', ['failed', 'e1']],
    ];
    expect(findExecutionStatusUpdate(calls, 'failed')).toEqual({
      status: 'failed',
    });
  });
});
