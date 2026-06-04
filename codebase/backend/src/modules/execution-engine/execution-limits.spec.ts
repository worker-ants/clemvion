import {
  DEFAULT_MAX_ACTIVE_RUNNING_MS,
  resolveMaxActiveRunningMs,
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

describe('ExecutionTimeLimitError', () => {
  it('.code 는 EXECUTION_TIME_LIMIT_EXCEEDED', () => {
    const err = new ExecutionTimeLimitError(1800000, 1800000);
    expect(err.code).toBe(ErrorCode.EXECUTION_TIME_LIMIT_EXCEEDED);
  });

  it('message 에 activeRunningMs 와 limitMs 가 포함됨', () => {
    const err = new ExecutionTimeLimitError(1800000, 1800000);
    expect(err.message).toContain('1800000');
    expect(err.name).toBe('ExecutionTimeLimitError');
  });

  it('instanceof Error', () => {
    const err = new ExecutionTimeLimitError(0, 1000);
    expect(err).toBeInstanceOf(Error);
  });
});
