import { ErrorPolicyHandler } from './error-policy.handler';
import { ErrorCode } from '../../../nodes/core/error-codes';
import { Cafe24RateLimitedError } from '../../../nodes/integration/cafe24/cafe24-api.client';
import { IntegrationError } from '../../../nodes/integration/_base/integration-handler-base';

// CLE-T-KXARNK — 핸들러가 throw 한 실패에 `route_to_error_port` 가 걸리면 `output.error.code` 를
// ForEach · Map · Parallel 의 실패 회차와 같은 규칙(`resolveIterationErrorCode`)으로 고른다.
// 카탈로그 코드는 그대로, 그 밖은 `UNKNOWN_ERROR` 다(NERV CLE-NODE-ERROR 「2. 에러 포트로 라우팅」).
describe('ErrorPolicyHandler — route_to_error_port 의 output.error', () => {
  const handler = new ErrorPolicyHandler();
  const route = (error: Error) =>
    handler.handleError(error, { policy: 'route_to_error_port' }, 0);

  it('code 가 없는 평범한 Error 는 UNKNOWN_ERROR 와 그 message 를 낸다', () => {
    expect(route(new Error('routed failure'))).toEqual({
      action: 'route_error',
      output: {
        error: { code: ErrorCode.UNKNOWN_ERROR, message: 'routed failure' },
      },
    });
  });

  it('TypeError 처럼 클래스 이름만 다른 에러도 UNKNOWN_ERROR 다', () => {
    const result = route(new TypeError('x is not a function'));
    expect(result.output).toEqual({
      error: { code: ErrorCode.UNKNOWN_ERROR, message: 'x is not a function' },
    });
  });

  it('엔진이 Error 가 아닌 throw 를 감싼 Error 도 UNKNOWN_ERROR 다', () => {
    // execution-engine.service.ts 의 executeNode 는 `new Error(String(err))` 로 감싸 넘긴다.
    const result = route(new Error(String('plain string thrown')));
    expect(result.output).toEqual({
      error: {
        code: ErrorCode.UNKNOWN_ERROR,
        message: 'plain string thrown',
      },
    });
  });

  it('IntegrationError 의 카탈로그 code 는 그대로 낸다', () => {
    const result = route(
      new IntegrationError('INTEGRATION_NOT_CONNECTED', 'not connected'),
    );
    expect(result.output).toEqual({
      error: { code: 'INTEGRATION_NOT_CONNECTED', message: 'not connected' },
    });
  });

  it('클래스 필드로 싣는 카탈로그 code(CAFE24_RATE_LIMITED)는 그대로 낸다', () => {
    const err = new Cafe24RateLimitedError(3, 1, 'mall-1');
    const result = route(err);
    expect(result.output).toEqual({
      error: { code: 'CAFE24_RATE_LIMITED', message: err.message },
    });
  });

  it('ErrorCode 값을 code 로 실은 에러는 그 값을 낸다', () => {
    const err = Object.assign(new Error('llm failed'), {
      code: ErrorCode.LLM_CALL_FAILED,
    });
    expect(route(err).output).toEqual({
      error: { code: ErrorCode.LLM_CALL_FAILED, message: 'llm failed' },
    });
  });

  it('Node 런타임이 싣는 카탈로그 밖 code(ECONNREFUSED)는 UNKNOWN_ERROR 다', () => {
    const err = Object.assign(new Error('connect ECONNREFUSED'), {
      code: 'ECONNREFUSED',
    });
    expect(route(err).output).toEqual({
      error: {
        code: ErrorCode.UNKNOWN_ERROR,
        message: 'connect ECONNREFUSED',
      },
    });
  });
});
