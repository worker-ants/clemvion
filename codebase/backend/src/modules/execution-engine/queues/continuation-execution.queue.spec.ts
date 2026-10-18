import { Backoffs } from 'bullmq';
import {
  CONTINUATION_BACKOFF_TYPE,
  CONTINUATION_QUEUE_DEFAULT_OPTS,
  DEFAULT_CONTINUATION_WORKER_CONCURRENCY,
  continuationBackoffDelayMs,
  continuationBackoffStrategy,
  resolveContinuationWorkerConcurrency,
} from './continuation-execution.queue';

/**
 * resolveContinuationWorkerConcurrency 단위 테스트.
 *
 * SoT: spec/5-system/4-execution-engine.md §7.4 / §11
 * (`CONTINUATION_WORKER_CONCURRENCY`).
 *
 * 검증 범위:
 *   1. 유효한 양의 정수는 그대로 반환.
 *   2. 미설정 / 빈 문자열 / 공백 → 기본값(1).
 *   3. 비숫자 / 0 / 음수 / 소수 / 공학표기(`1e10`) → 기본값 fallback
 *      (continuation-dlq-monitor.config.ts 와 동일한 정규식 선검증 규약).
 *   4. 앞뒤 공백은 trim 후 파싱.
 */
describe('resolveContinuationWorkerConcurrency', () => {
  it('유효한 양의 정수를 그대로 반환한다', () => {
    expect(
      resolveContinuationWorkerConcurrency({
        CONTINUATION_WORKER_CONCURRENCY: '4',
      }),
    ).toBe(4);
  });

  it('미설정 시 기본값을 반환한다', () => {
    expect(resolveContinuationWorkerConcurrency({})).toBe(
      DEFAULT_CONTINUATION_WORKER_CONCURRENCY,
    );
    expect(DEFAULT_CONTINUATION_WORKER_CONCURRENCY).toBe(1);
  });

  it('빈 문자열 / 공백만 있는 값은 기본값으로 fallback 한다', () => {
    expect(
      resolveContinuationWorkerConcurrency({
        CONTINUATION_WORKER_CONCURRENCY: '',
      }),
    ).toBe(1);
    expect(
      resolveContinuationWorkerConcurrency({
        CONTINUATION_WORKER_CONCURRENCY: '   ',
      }),
    ).toBe(1);
  });

  it.each([
    ['abc', '비숫자'],
    ['0', '0'],
    ['-2', '음수'],
    ['2.5', '소수'],
    ['1e10', '공학표기'],
    ['0x10', '16진수 표기'],
  ])('잘못된 입력 %s (%s) 은 기본값으로 fallback 한다', (raw) => {
    expect(
      resolveContinuationWorkerConcurrency({
        CONTINUATION_WORKER_CONCURRENCY: raw,
      }),
    ).toBe(1);
  });

  it('앞뒤 공백은 trim 후 파싱한다', () => {
    expect(
      resolveContinuationWorkerConcurrency({
        CONTINUATION_WORKER_CONCURRENCY: '  8  ',
      }),
    ).toBe(8);
  });
});

// 근거: [큐 워커와 동시 실행 제한 「재개 큐」](CLE-EXEC-WORKER#재개-큐), NERV Task `CLE-T-EQDYC1`.
// 재시도 간격은 1초에서 4배씩 늘어난다. BullMQ 내장 `exponential` 은 2배라 사용자 정의 전략을 쓴다.
describe('재개 큐 backoff', () => {
  it('재시도 간격은 1초에서 4배씩 늘어난다', () => {
    expect([1, 2, 3, 4].map(continuationBackoffDelayMs)).toEqual([
      1000, 4000, 16000, 64000,
    ]);
  });

  it('job 옵션은 BullMQ 내장 전략이 아닌 사용자 정의 전략 이름을 쓴다', () => {
    expect(CONTINUATION_QUEUE_DEFAULT_OPTS.backoff).toEqual({
      type: 'continuation-exp4',
    });
    expect(CONTINUATION_BACKOFF_TYPE).toBe('continuation-exp4');
    expect(Object.keys(Backoffs.builtinStrategies)).not.toContain(
      CONTINUATION_BACKOFF_TYPE,
    );
  });

  it('기본 3회 시도면 BullMQ 가 계산하는 재시도 간격은 1초 · 4초다', () => {
    expect(CONTINUATION_QUEUE_DEFAULT_OPTS.attempts).toBe(3);
    // BullMQ 는 실패한 시도 수에 1 을 더해 전략을 부른다(첫 실패 = 1). 마지막 시도가 실패하면
    // 재시도하지 않으므로 3회 시도의 재시도는 두 번이다.
    const delays = [1, 2].map((attemptsMade) =>
      Backoffs.calculate(
        CONTINUATION_QUEUE_DEFAULT_OPTS.backoff,
        attemptsMade,
        new Error('boom'),
        {} as never,
        continuationBackoffStrategy,
      ),
    );
    expect(delays).toEqual([1000, 4000]);
  });
});
