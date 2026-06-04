import {
  EXECUTION_RUN_QUEUE,
  EXECUTION_RUN_QUEUE_DEFAULT_OPTS,
  EXECUTION_RUN_MAX_STALLED_COUNT,
  DEFAULT_EXECUTION_RUN_WORKER_CONCURRENCY,
  buildExecutionRunJobId,
  resolveExecutionRunPriority,
  resolveExecutionRunWorkerConcurrency,
  EXECUTION_RUN_PRIORITY,
} from './execution-run.queue';

describe('execution-run.queue', () => {
  it('큐 이름은 execution-run', () => {
    expect(EXECUTION_RUN_QUEUE).toBe('execution-run');
  });

  describe('buildExecutionRunJobId', () => {
    it('PR1 은 executionId 자체를 jobId 로 사용 (1:1 enqueue dedup)', () => {
      expect(buildExecutionRunJobId('exec-123')).toBe('exec-123');
    });
  });

  describe('resolveExecutionRunPriority', () => {
    it('manual < webhook < schedule (낮을수록 우선)', () => {
      expect(resolveExecutionRunPriority('manual')).toBe(
        EXECUTION_RUN_PRIORITY.manual,
      );
      expect(resolveExecutionRunPriority('webhook')).toBe(
        EXECUTION_RUN_PRIORITY.webhook,
      );
      expect(resolveExecutionRunPriority('schedule')).toBe(
        EXECUTION_RUN_PRIORITY.schedule,
      );
      expect(resolveExecutionRunPriority('manual')).toBeLessThan(
        resolveExecutionRunPriority('webhook'),
      );
      expect(resolveExecutionRunPriority('webhook')).toBeLessThan(
        resolveExecutionRunPriority('schedule'),
      );
    });

    it('미상/누락은 가장 낮은 우선순위(schedule)로 보수 처리', () => {
      expect(resolveExecutionRunPriority(undefined)).toBe(
        EXECUTION_RUN_PRIORITY.schedule,
      );
    });
  });

  describe('EXECUTION_RUN_QUEUE_DEFAULT_OPTS', () => {
    it('PR1 은 crash-retry 없음 — attempts:1, stalled 재배달 차단', () => {
      expect(EXECUTION_RUN_QUEUE_DEFAULT_OPTS.attempts).toBe(1);
      expect(EXECUTION_RUN_QUEUE_DEFAULT_OPTS.removeOnComplete).toBe(true);
      expect(EXECUTION_RUN_QUEUE_DEFAULT_OPTS.removeOnFail).toBe(false);
      expect(EXECUTION_RUN_MAX_STALLED_COUNT).toBe(0);
    });
  });

  describe('resolveExecutionRunWorkerConcurrency', () => {
    it('미설정 시 기본값 1', () => {
      expect(resolveExecutionRunWorkerConcurrency({})).toBe(
        DEFAULT_EXECUTION_RUN_WORKER_CONCURRENCY,
      );
    });

    it('양의 정수 채택', () => {
      expect(
        resolveExecutionRunWorkerConcurrency({
          EXECUTION_RUN_WORKER_CONCURRENCY: '4',
        }),
      ).toBe(4);
    });

    it('0·음수·소수·공학표기·비숫자는 기본값 fallback', () => {
      for (const bad of ['0', '-1', '2.5', '1e10', 'abc', '']) {
        expect(
          resolveExecutionRunWorkerConcurrency({
            EXECUTION_RUN_WORKER_CONCURRENCY: bad,
          }),
        ).toBe(DEFAULT_EXECUTION_RUN_WORKER_CONCURRENCY);
      }
    });

    // SUMMARY#12 — 공백 전용 문자열 + 극단값 동작 명시
    it('공백 전용 문자열은 기본값 fallback (trim 후 빈 문자열 → \\d+ 불일치)', () => {
      expect(
        resolveExecutionRunWorkerConcurrency({
          EXECUTION_RUN_WORKER_CONCURRENCY: '   ',
        }),
      ).toBe(DEFAULT_EXECUTION_RUN_WORKER_CONCURRENCY);
    });

    it('Number.MAX_SAFE_INTEGER 는 양의 정수로 채택 (극단값 동작 문서화)', () => {
      expect(
        resolveExecutionRunWorkerConcurrency({
          EXECUTION_RUN_WORKER_CONCURRENCY: String(Number.MAX_SAFE_INTEGER),
        }),
      ).toBe(Number.MAX_SAFE_INTEGER);
    });
  });
});
