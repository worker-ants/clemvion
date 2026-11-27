import { findExecutionStatusUpdate } from './raw-update-params';

/** `execution-engine.service.ts` `updateExecutionStatus` 의 UPDATE 와 같은 꼴. */
const REAL_SQL = `UPDATE execution
            SET status = $2,
                active_running_ms = $3,
                finished_at = $4,
                duration_ms = $5,
                output_data = $6::jsonb,
                resume_call_stack = $7::jsonb,
                error = $8::jsonb
          WHERE id = $1
            AND status IN ('running')
          RETURNING id`;

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
