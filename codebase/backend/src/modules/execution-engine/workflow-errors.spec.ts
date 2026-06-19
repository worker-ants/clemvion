import {
  ExecutionError,
  FormValidationError,
  InvalidExecutionStateError,
  MessageTooLongError,
  RetryLastTurnError,
  WorkflowForbiddenWorkspaceError,
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

  describe('FormValidationError', () => {
    it('VALIDATION_ERROR code + field + 고정 name 을 가진다', () => {
      const err = new FormValidationError(
        'email',
        '올바른 이메일을 입력하세요.',
      );
      expect(err).toBeInstanceOf(ExecutionError);
      expect(err.code).toBe(ErrorCode.VALIDATION_ERROR);
      expect(err.field).toBe('email');
      expect(err.name).toBe('FormValidationError');
      expect(err.message).toBe('올바른 이메일을 입력하세요.');
    });

    it('toHttpDetails() 는 FIRST 오류만 담은 길이 1 배열을 반환한다 (응답 매핑 SoT)', () => {
      const err = new FormValidationError('age', '숫자를 입력하세요.');
      expect(err.toHttpDetails()).toEqual([
        { field: 'age', message: '숫자를 입력하세요.', code: 'INVALID_FIELD' },
      ]);
    });
  });
});

/**
 * W-6 workspace 격리 typed error (dev 1b). plain `Error` 계열(ExecutionError 가
 * 아님 — WorkflowNotFoundError / SubWorkflowTimeoutError 와 동일 계층). Sub-Workflow
 * 핸들러의 `mapSubWorkflowError` 가 `WORKFLOW_FORBIDDEN_WORKSPACE` 로 매핑한다
 * (매핑 검증은 workflow.handler.spec.ts). 본 블록은 클래스 계약(메시지 prefix 보존·
 * 필드 캡처·name)을 검증한다.
 */
describe('WorkflowForbiddenWorkspaceError 클래스 계약 (W-6)', () => {
  it('mismatch — targetWorkspaceId/callerWorkspaceId 캡처 + message prefix 보존', () => {
    const err = new WorkflowForbiddenWorkspaceError('ws-target', 'ws-caller');
    expect(err).toBeInstanceOf(Error);
    expect(err.name).toBe('WorkflowForbiddenWorkspaceError');
    expect(err.targetWorkspaceId).toBe('ws-target');
    expect(err.callerWorkspaceId).toBe('ws-caller');
    expect(err.message).toMatch(/^WORKFLOW_FORBIDDEN_WORKSPACE:/);
    expect(err.message).toContain('ws-target');
    expect(err.message).toContain('ws-caller');
  });

  it('missing caller context — callerWorkspaceId 미공급 시 undefined + 전용 message', () => {
    const err = new WorkflowForbiddenWorkspaceError('ws-target');
    expect(err.callerWorkspaceId).toBeUndefined();
    expect(err.message).toMatch(/^WORKFLOW_FORBIDDEN_WORKSPACE:/);
    expect(err.message).toContain('without caller workspace context');
  });
});
