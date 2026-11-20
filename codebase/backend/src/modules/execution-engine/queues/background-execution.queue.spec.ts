import { BACKGROUND_EXECUTION_QUEUE_DEFAULT_OPTS } from './background-execution.queue';

describe('background-execution.queue', () => {
  // 끝난 작업은 건수가 아니라 나이로 지운다(NERV Task CLE-T-9XMCS6). 작업 데이터에 노드 출력
  // 스냅샷이 실려 건수 기준이면 큰 작업이 Redis 에 오래 남는다. 실패 작업은 조사할 시간을 남긴다.
  it('완료 작업은 24시간, 실패 작업은 7일 뒤 지운다', () => {
    expect(BACKGROUND_EXECUTION_QUEUE_DEFAULT_OPTS).toEqual({
      removeOnComplete: { age: 24 * 60 * 60 },
      removeOnFail: { age: 7 * 24 * 60 * 60 },
    });
  });
});
