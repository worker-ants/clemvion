import {
  DEFAULT_MAX_ACTIVE_RUNNING_MS,
  resolveMaxActiveRunningMs,
  resolveConcurrencyCap,
  resolveQueueWaitTimeoutMs,
  DEFAULT_QUEUE_WAIT_TIMEOUT_MS,
  DEFAULT_WORKSPACE_MAX_CONCURRENT_EXECUTIONS,
  DEFAULT_WORKFLOW_MAX_CONCURRENT_EXECUTIONS,
  resolveExecutionRunWorkerConcurrency,
  DEFAULT_EXECUTION_RUN_WORKER_CONCURRENCY,
} from './execution-limits';
import { ExecutionTimeLimitError } from './workflow-errors';
import { ErrorCode } from '../../nodes/core/error-codes';

describe('resolveMaxActiveRunningMs', () => {
  it('기본값은 30분', () => {
    expect(DEFAULT_MAX_ACTIVE_RUNNING_MS).toBe(30 * 60 * 1000);
    expect(resolveMaxActiveRunningMs({})).toBe(DEFAULT_MAX_ACTIVE_RUNNING_MS);
  });

  it('양의 정수 채택', () => {
    expect(
      resolveMaxActiveRunningMs({ EXECUTION_MAX_ACTIVE_RUNNING_MS: '600000' }),
    ).toBe(600000);
  });

  it('0 = 무제한(그대로 0 반환)', () => {
    expect(
      resolveMaxActiveRunningMs({ EXECUTION_MAX_ACTIVE_RUNNING_MS: '0' }),
    ).toBe(0);
  });

  it('음수·소수·공학표기·비숫자·공백은 기본값 fallback', () => {
    for (const bad of ['-1', '2.5', '1e6', 'abc', '', '  ']) {
      expect(
        resolveMaxActiveRunningMs({ EXECUTION_MAX_ACTIVE_RUNNING_MS: bad }),
      ).toBe(DEFAULT_MAX_ACTIVE_RUNNING_MS);
    }
  });
});

describe('resolveConcurrencyCap (PR2b §8)', () => {
  it('기본값 상수 — workspace 10 / workflow 3', () => {
    expect(DEFAULT_WORKSPACE_MAX_CONCURRENT_EXECUTIONS).toBe(10);
    expect(DEFAULT_WORKFLOW_MAX_CONCURRENT_EXECUTIONS).toBe(3);
  });

  it('settings.maxConcurrentExecutions 양의 정수 채택', () => {
    expect(resolveConcurrencyCap({ maxConcurrentExecutions: 5 }, 10)).toBe(5);
    expect(resolveConcurrencyCap({ maxConcurrentExecutions: 1 }, 3)).toBe(1);
  });

  it('미설정·null·undefined 는 defaultCap', () => {
    expect(resolveConcurrencyCap(undefined, 10)).toBe(10);
    expect(resolveConcurrencyCap(null, 3)).toBe(3);
    expect(resolveConcurrencyCap({}, 10)).toBe(10);
    expect(resolveConcurrencyCap({ other: 5 }, 7)).toBe(7);
  });

  it('0·음수·비정수·문자열·비숫자 타입은 defaultCap (무제한 옵션 없음)', () => {
    for (const bad of [0, -1, 2.5, '5', '10', true, null, NaN, Infinity]) {
      expect(
        resolveConcurrencyCap(
          { maxConcurrentExecutions: bad as unknown as number },
          10,
        ),
      ).toBe(10);
    }
  });
});

describe('resolveQueueWaitTimeoutMs (PR2b §8)', () => {
  it('기본값 5분(300000)', () => {
    expect(DEFAULT_QUEUE_WAIT_TIMEOUT_MS).toBe(5 * 60 * 1000);
    expect(resolveQueueWaitTimeoutMs({})).toBe(DEFAULT_QUEUE_WAIT_TIMEOUT_MS);
  });

  it('양의 정수 채택', () => {
    expect(
      resolveQueueWaitTimeoutMs({ EXECUTION_QUEUE_WAIT_TIMEOUT_MS: '60000' }),
    ).toBe(60000);
  });

  it('0·음수·소수·공학표기·비숫자·공백은 기본값 fallback (0=무제한 없음)', () => {
    for (const bad of ['0', '-1', '2.5', '1e6', 'abc', '', '  ']) {
      expect(
        resolveQueueWaitTimeoutMs({ EXECUTION_QUEUE_WAIT_TIMEOUT_MS: bad }),
      ).toBe(DEFAULT_QUEUE_WAIT_TIMEOUT_MS);
    }
  });
});

describe('ExecutionTimeLimitError', () => {
  it('.code 는 EXECUTION_TIME_LIMIT_EXCEEDED', () => {
    const err = new ExecutionTimeLimitError(1800000, 1800000);
    expect(err.code).toBe(ErrorCode.EXECUTION_TIME_LIMIT_EXCEEDED);
  });

  it('message 는 고정 문자열 — 수치 미포함 (W3 ai-review SECURITY fix)', () => {
    // W3: message 에 ms 수치를 포함하면 REST/WS 응답으로 노출됨.
    // 수치는 activeRunningMs / limitMs 프로퍼티로 분리해 서버 로그 전용.
    const err = new ExecutionTimeLimitError(1800000, 1800000);
    expect(err.message).toBe('Execution active-running time limit exceeded.');
    expect(err.message).not.toContain('1800000');
    expect(err.name).toBe('ExecutionTimeLimitError');
    expect(err.activeRunningMs).toBe(1800000);
    expect(err.limitMs).toBe(1800000);
  });

  it('instanceof Error', () => {
    const err = new ExecutionTimeLimitError(0, 1000);
    expect(err).toBeInstanceOf(Error);
  });
});

// ARCH#4 — execution-run.queue.ts 에서 이관(동시성 한도 파서 응집).
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
