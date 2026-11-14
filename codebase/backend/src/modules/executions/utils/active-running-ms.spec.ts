import { ExecutionStatus } from '../entities/execution.entity';
import { PG_INT4_MAX } from '../../../shared/utils/terminal-duration';
import {
  ADD_STOPPED_SEGMENT_SQL,
  addRunningSegmentMs,
  toActiveRunningMsForResponse,
} from './active-running-ms';

describe('toActiveRunningMsForResponse', () => {
  it('입력 대기가 길었던 취소 실행은 전체 경과가 커도 실행 시간은 저장 값 그대로다', () => {
    // 폼 입력을 1시간 기다리다 취소된 실행. 엔진이 park 직전까지의 구간만 더했다.
    expect(
      toActiveRunningMsForResponse({
        status: ExecutionStatus.CANCELLED,
        activeRunningMs: 1_200,
        durationMs: 3_600_000,
      }),
    ).toBe(1_200);
  });

  it('실행 중 REST 중지로 끝나 구간이 기록되지 않은 실행은 null(측정되지 않음)이다', () => {
    // `stop()` 이 running → cancelled 로 바꾸고 엔진의 뒤 UPDATE 는 terminal 가드에 막힌다.
    expect(
      toActiveRunningMsForResponse({
        status: ExecutionStatus.CANCELLED,
        activeRunningMs: 0,
        durationMs: 5_000,
      }),
    ).toBeNull();
  });

  it('V083 이전 완료 실행(저장 값 0, 전체 경과 > 0)은 null 이다', () => {
    expect(
      toActiveRunningMsForResponse({
        status: ExecutionStatus.COMPLETED,
        activeRunningMs: 0,
        durationMs: 820,
      }),
    ).toBeNull();
  });

  it('실제로 0ms 에 끝난 실행은 0 이다(전체 경과도 0)', () => {
    expect(
      toActiveRunningMsForResponse({
        status: ExecutionStatus.COMPLETED,
        activeRunningMs: 0,
        durationMs: 0,
      }),
    ).toBe(0);
  });

  it('전체 경과가 없는 끝난 실행은 저장 값을 그대로 쓴다', () => {
    expect(
      toActiveRunningMsForResponse({
        status: ExecutionStatus.FAILED,
        activeRunningMs: 0,
        durationMs: null,
      }),
    ).toBe(0);
    expect(
      toActiveRunningMsForResponse({
        status: ExecutionStatus.FAILED,
        activeRunningMs: 300,
        durationMs: null,
      }),
    ).toBe(300);
  });

  it.each([
    ExecutionStatus.PENDING,
    ExecutionStatus.RUNNING,
    ExecutionStatus.WAITING_FOR_INPUT,
  ])('끝나지 않은 실행(%s)은 저장 값이 있어도 null 이다', (status) => {
    expect(
      toActiveRunningMsForResponse({
        status,
        activeRunningMs: 900,
        durationMs: null,
      }),
    ).toBeNull();
  });

  it('완료 실행은 저장 값을 그대로 돌려준다', () => {
    expect(
      toActiveRunningMsForResponse({
        status: ExecutionStatus.COMPLETED,
        activeRunningMs: 3_100,
        durationMs: 3_200,
      }),
    ).toBe(3_100);
  });
});

describe('addRunningSegmentMs', () => {
  it('닫은 구간 길이를 앞선 실행 시간에 더한다', () => {
    expect(addRunningSegmentMs(1_200, 500)).toBe(1_700);
  });

  it('구간 길이가 음수면(시계 어긋남) 0 으로 보고 앞선 값을 그대로 둔다', () => {
    expect(addRunningSegmentMs(1_200, -50)).toBe(1_200);
  });

  it('합이 int4 상한을 넘으면 상한에서 멈춘다 (컬럼이 int4 라 넘으면 UPDATE 가 실패한다)', () => {
    expect(addRunningSegmentMs(PG_INT4_MAX - 100, 500)).toBe(PG_INT4_MAX);
  });
});

describe('ADD_STOPPED_SEGMENT_SQL', () => {
  // SQL 의 계산 결과는 Postgres 에서만 실행된다(engine-cancel-duration e2e). 여기서는 규칙의 뼈대가
  // 한쪽만 고쳐져 어긋나지 않도록 구조를 고정한다.
  it('int4 상한은 duration_ms 와 같은 상수에서 온다', () => {
    expect(ADD_STOPPED_SEGMENT_SQL).toContain(`${PG_INT4_MAX}`);
  });

  it('구간 끝은 구간 길이와 중지 시각 기준 길이 중 작은 쪽이고 음수는 0 으로 자른다', () => {
    const squashed = ADD_STOPPED_SEGMENT_SQL.replace(/\s+/g, ' ');
    expect(squashed).toContain(
      'GREATEST( 0, LEAST( $2::bigint, (EXTRACT(EPOCH FROM finished_at) * 1000)::bigint - $3::bigint ) )',
    );
  });

  it('쓰는 컬럼은 active_running_ms 하나이고 cancelled 행에만 더한다', () => {
    const setClause = ADD_STOPPED_SEGMENT_SQL.slice(
      ADD_STOPPED_SEGMENT_SQL.indexOf('SET'),
      ADD_STOPPED_SEGMENT_SQL.indexOf('WHERE'),
    );
    expect(setClause.match(/\b\w+\s*=/g)).toEqual(['active_running_ms =']);
    expect(ADD_STOPPED_SEGMENT_SQL).toMatch(
      /WHERE id = \$1\s+AND status = \$4/,
    );
  });
});
