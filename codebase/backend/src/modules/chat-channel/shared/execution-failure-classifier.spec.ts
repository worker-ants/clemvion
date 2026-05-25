import {
  classifyExecutionFailure,
  type ExecutionFailureClass,
} from './execution-failure-classifier';
import type { EiaFailedEvent } from '../types';

function makeEvent(code: string, details?: unknown): EiaFailedEvent {
  return {
    type: 'execution.failed',
    executionId: 'exec-1',
    triggerId: 'trig-1',
    workflowId: 'wf-1',
    seq: 1,
    timestamp: '2026-05-25T00:00:00.000Z',
    error: {
      code,
      message: 'should-not-leak',
      nodeId: 'node-1',
      details,
    },
  };
}

describe('classifyExecutionFailure (Convention §3.1)', () => {
  describe('HTTP carrier categories', () => {
    it('HTTP_4XX with valid 4xx statusCode → executionFailedThirdParty4xx + statusCode', () => {
      const result = classifyExecutionFailure(
        makeEvent('HTTP_4XX', { statusCode: 404, url: 'https://internal' }),
      );
      expect(result.key).toBe('executionFailedThirdParty4xx');
      expect(result.placeholders).toEqual({ statusCode: 404 });
    });

    it('HTTP_5XX with valid 5xx statusCode → executionFailedThirdParty5xx + statusCode', () => {
      const result = classifyExecutionFailure(
        makeEvent('HTTP_5XX', { statusCode: 502 }),
      );
      expect(result.key).toBe('executionFailedThirdParty5xx');
      expect(result.placeholders).toEqual({ statusCode: 502 });
    });

    it('HTTP_4XX without statusCode → key only, placeholders omit', () => {
      const result = classifyExecutionFailure(makeEvent('HTTP_4XX'));
      expect(result.key).toBe('executionFailedThirdParty4xx');
      expect(result.placeholders.statusCode).toBeUndefined();
    });

    it('HTTP_4XX with non-number statusCode → omit (type-guard)', () => {
      const result = classifyExecutionFailure(
        makeEvent('HTTP_4XX', { statusCode: '404' }),
      );
      expect(result.placeholders.statusCode).toBeUndefined();
    });

    it('HTTP_TIMEOUT → executionFailedTimeout', () => {
      const result = classifyExecutionFailure(makeEvent('HTTP_TIMEOUT'));
      expect(result.key).toBe('executionFailedTimeout');
      expect(result.placeholders).toEqual({});
    });

    it('HTTP_TRANSPORT_FAILED → executionFailedThirdParty', () => {
      const result = classifyExecutionFailure(
        makeEvent('HTTP_TRANSPORT_FAILED'),
      );
      expect(result.key).toBe('executionFailedThirdParty');
    });
  });

  describe('LLM categories', () => {
    it('LLM_RATE_LIMIT → executionFailedRateLimit', () => {
      const result = classifyExecutionFailure(makeEvent('LLM_RATE_LIMIT'));
      expect(result.key).toBe('executionFailedRateLimit');
    });

    it('LLM_TIMEOUT → executionFailedTimeout', () => {
      const result = classifyExecutionFailure(makeEvent('LLM_TIMEOUT'));
      expect(result.key).toBe('executionFailedTimeout');
    });

    it.each([
      'LLM_CALL_FAILED',
      'LLM_RESPONSE_INVALID',
      'MAX_COLLECTION_RETRIES_EXCEEDED',
    ])('%s → executionFailedThirdParty', (code) => {
      const result = classifyExecutionFailure(makeEvent(code));
      expect(result.key).toBe('executionFailedThirdParty');
    });
  });

  describe('Generic third-party / internal categories', () => {
    it('EMAIL_SEND_FAILED → executionFailedThirdParty', () => {
      const result = classifyExecutionFailure(makeEvent('EMAIL_SEND_FAILED'));
      expect(result.key).toBe('executionFailedThirdParty');
    });

    it.each(['EXECUTION_TIMEOUT', 'CODE_TIMEOUT'])(
      '%s → executionFailedTimeout',
      (code) => {
        const result = classifyExecutionFailure(makeEvent(code));
        expect(result.key).toBe('executionFailedTimeout');
      },
    );

    it.each([
      'CODE_EXECUTION_FAILED',
      'SUB_WORKFLOW_FAILED',
      'DB_QUERY_FAILED',
      'DB_CONNECTION_ERROR',
      'DB_CONSTRAINT_VIOLATION',
      'DB_PERMISSION_DENIED',
      'RECURSION_DEPTH_EXCEEDED',
      'MAX_ITERATIONS_EXCEEDED',
      'CYCLE_DETECTED',
      'INVALID_EXPRESSION',
      'VARIABLE_NOT_FOUND',
      'TYPE_MISMATCH',
      'ERROR_PORT_FALLBACK',
    ])('%s → executionFailedInternal', (code) => {
      const result = classifyExecutionFailure(makeEvent(code));
      expect(result.key).toBe('executionFailedInternal');
    });
  });

  describe('Unknown fallback (CCH-ERR-04)', () => {
    it('unknown code → executionFailedInternal + warn log', () => {
      const warnSpy = jest
        .spyOn(console, 'warn')
        .mockImplementation(() => undefined);
      const result = classifyExecutionFailure(makeEvent('SOMETHING_NEW'));
      expect(result.key).toBe('executionFailedInternal');
      // structured warn log (CCH-ERR-04)
      expect(warnSpy).toHaveBeenCalled();
      const call = warnSpy.mock.calls[0]?.[0];
      // 구조: { kind, code, hasDetails } 등 — 직렬화 형태는 자유.
      const repr = typeof call === 'string' ? call : JSON.stringify(call);
      expect(repr).toContain('chat_channel_unknown_failure_code');
      expect(repr).toContain('SOMETHING_NEW');
      warnSpy.mockRestore();
    });

    it('empty code → executionFailedInternal', () => {
      const warnSpy = jest
        .spyOn(console, 'warn')
        .mockImplementation(() => undefined);
      const result = classifyExecutionFailure(makeEvent(''));
      expect(result.key).toBe('executionFailedInternal');
      warnSpy.mockRestore();
    });
  });

  describe('Input whitelist (CCH-ERR-02)', () => {
    it('does not leak error.message into placeholders', () => {
      const result = classifyExecutionFailure(makeEvent('HTTP_5XX'));
      const repr = JSON.stringify(result);
      expect(repr).not.toContain('should-not-leak');
    });

    it('does not leak nodeId / executionId into placeholders', () => {
      const result = classifyExecutionFailure(makeEvent('HTTP_5XX'));
      const repr = JSON.stringify(result);
      expect(repr).not.toContain('node-1');
      expect(repr).not.toContain('exec-1');
      expect(repr).not.toContain('wf-1');
    });

    it('only statusCode placeholder is allowed (other details fields ignored)', () => {
      const result = classifyExecutionFailure(
        makeEvent('HTTP_4XX', {
          statusCode: 401,
          url: 'https://api.internal.example.com/secret',
          query: 'apiKey=AKIA12345',
          stack: 'Error at line 42',
        }),
      );
      expect(result.placeholders).toEqual({ statusCode: 401 });
      const repr = JSON.stringify(result);
      expect(repr).not.toContain('api.internal');
      expect(repr).not.toContain('AKIA');
      expect(repr).not.toContain('line 42');
    });
  });

  describe('Return type narrowness', () => {
    it('key is one of the 6 i18n keys', () => {
      const keys: Array<ExecutionFailureClass['key']> = [
        'executionFailedThirdParty4xx',
        'executionFailedThirdParty5xx',
        'executionFailedThirdParty',
        'executionFailedTimeout',
        'executionFailedRateLimit',
        'executionFailedInternal',
      ];
      const result = classifyExecutionFailure(makeEvent('LLM_RATE_LIMIT'));
      expect(keys).toContain(result.key);
    });
  });
});
