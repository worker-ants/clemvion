import {
  ExecutionError,
  InvalidExecutionStateError,
  MessageTooLongError,
  RetryLastTurnError,
} from './workflow-errors';
import { ErrorCode } from '../../nodes/core/error-codes';

/**
 * A-1 client-safe typed error 계약 (spec/5-system/4-execution-engine.md §7.5.2).
 *
 * 핵심 불변식: client 경계 typed 에러는 `ExecutionError` 를 상속하고,
 *   - `message` 는 **고정 client-safe 문자열** (내부 식별자·수치 미포함),
 *   - `serverDetail` 은 **서버 로그 전용** (client 미노출),
 *   - `code` 는 안정 client-safe 코드.
 */
describe('ExecutionError typed error 계약 (§7.5.2)', () => {
  describe('InvalidExecutionStateError', () => {
    it('ExecutionError 를 상속하고 고정 message + INVALID_EXECUTION_STATE code 를 가진다', () => {
      const err = new InvalidExecutionStateError('rows=2 exec=abc-123');
      expect(err).toBeInstanceOf(ExecutionError);
      expect(err).toBeInstanceOf(Error);
      expect(err.code).toBe('INVALID_EXECUTION_STATE');
      expect(err.message).toBe('Execution is not waiting for input.');
    });

    it('detail 인자는 serverDetail(서버 전용)에 담기고 client message 에는 노출되지 않는다', () => {
      const err = new InvalidExecutionStateError('rows=2 exec=abc-123');
      expect(err.serverDetail).toBe('rows=2 exec=abc-123');
      expect(err.message).not.toContain('abc-123');
      // 하위 호환 별칭
      expect(err.detail).toBe('rows=2 exec=abc-123');
    });
  });

  describe('RetryLastTurnError', () => {
    it('ExecutionError 를 상속하고 factory code/message 를 보존한다', () => {
      const err = RetryLastTurnError.notFound('state row gone');
      expect(err).toBeInstanceOf(ExecutionError);
      expect(err.code).toBe(ErrorCode.RETRY_STATE_NOT_FOUND);
      expect(err.message).toBe('Retry state not found or expired.');
      expect(err.serverDetail).toBe('state row gone');
      expect(err.detail).toBe('state row gone');
    });

    it('notRetryable factory — NODE_NOT_RETRYABLE code + 고정 client-safe message (I-10)', () => {
      const err = RetryLastTurnError.notRetryable('retryable=false on ne-abc');
      expect(err).toBeInstanceOf(ExecutionError);
      expect(err.code).toBe(ErrorCode.NODE_NOT_RETRYABLE);
      expect(err.message).toBe('This node cannot be retried.');
      // serverDetail 은 서버 로그 전용 — client message 에 미포함.
      expect(err.serverDetail).toBe('retryable=false on ne-abc');
      expect(err.message).not.toContain('ne-abc');
      // 하위 호환 별칭
      expect(err.detail).toBe('retryable=false on ne-abc');
    });

    it('tooEarly factory — RETRY_TOO_EARLY code + 고정 client-safe message (I-10)', () => {
      const err = RetryLastTurnError.tooEarly('retryAfterSec=30 elapsed=5');
      expect(err).toBeInstanceOf(ExecutionError);
      expect(err.code).toBe(ErrorCode.RETRY_TOO_EARLY);
      expect(err.message).toBe(
        'Retry requested before the retry-after window elapsed.',
      );
      expect(err.serverDetail).toBe('retryAfterSec=30 elapsed=5');
      expect(err.message).not.toContain('retryAfterSec');
      expect(err.detail).toBe('retryAfterSec=30 elapsed=5');
    });

    it('notRetryable/tooEarly factory 에 detail 미지정 시 serverDetail 은 undefined (I-10)', () => {
      expect(RetryLastTurnError.notRetryable().serverDetail).toBeUndefined();
      expect(RetryLastTurnError.tooEarly().serverDetail).toBeUndefined();
    });
  });

  describe('MessageTooLongError', () => {
    it('EXECUTION_MESSAGE_TOO_LONG code + 고정 client-safe message 를 가진다', () => {
      const err = new MessageTooLongError(10_000, 123_456);
      expect(err).toBeInstanceOf(ExecutionError);
      expect(err.code).toBe(ErrorCode.EXECUTION_MESSAGE_TOO_LONG);
      expect(err.message).toBe('Message exceeds the maximum allowed length.');
    });

    it('한도/실제 길이 수치는 serverDetail 에만 담고 client message 에는 노출하지 않는다', () => {
      const err = new MessageTooLongError(10_000, 123_456);
      expect(err.serverDetail).toBe('length=123456 max=10000');
      expect(err.message).not.toContain('123456');
      expect(err.message).not.toContain('10000');
    });

    it('actualLength 미지정 시 serverDetail 은 max 만 담는다', () => {
      const err = new MessageTooLongError(10_000);
      expect(err.serverDetail).toBe('max=10000');
    });
  });
});
