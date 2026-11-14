import { ExecutionStatus } from '../entities/execution.entity';
import { toActiveRunningMsForResponse } from './active-running-ms';

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
