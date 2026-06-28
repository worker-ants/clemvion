import {
  ArgumentsHost,
  BadRequestException,
  HttpException,
  HttpStatus,
  Logger,
  PayloadTooLargeException,
} from '@nestjs/common';
import { QueryFailedError } from 'typeorm';
import { GlobalExceptionFilter } from './http-exception.filter';

function mockHost(): {
  host: ArgumentsHost;
  status: jest.Mock;
  json: jest.Mock;
} {
  const json = jest.fn();
  const status = jest.fn(() => ({ json }));
  const host = {
    switchToHttp: () => ({
      getResponse: () => ({ status }),
      getRequest: () => ({}),
    }),
  } as unknown as ArgumentsHost;
  return { host, status, json };
}

function bodyOf(json: jest.Mock): {
  error: {
    code: string;
    message: string;
    requestId: string;
    details?: unknown;
  };
} {
  return json.mock.calls[0][0];
}

describe('GlobalExceptionFilter', () => {
  // Logger spy 복원을 afterEach 로 통일(B-5) — 예외로 테스트가 중단돼도 spy 가 누설되지 않는다.
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('maps 413 PayloadTooLargeException to PAYLOAD_TOO_LARGE envelope', () => {
    const { host, status, json } = mockHost();
    new GlobalExceptionFilter().catch(new PayloadTooLargeException(), host);

    expect(status).toHaveBeenCalledWith(413);
    const body = bodyOf(json);
    expect(body.error.code).toBe('PAYLOAD_TOO_LARGE');
    expect(body.error.requestId).toBeDefined();
  });

  it('maps a plain http-error (status, non-HttpException) 4xx to its envelope', () => {
    // body-parser 의 PayloadTooLargeError 처럼 NestJS HttpException 이 아니지만
    // 숫자 status 를 가진 오류 → mapHttpErrorLike 경로.
    const { host, status, json } = mockHost();
    const err = Object.assign(new Error('request entity too large'), {
      status: 413,
      statusCode: 413,
    });
    new GlobalExceptionFilter().catch(err, host);

    expect(status).toHaveBeenCalledWith(413);
    const body = bodyOf(json);
    expect(body.error.code).toBe('PAYLOAD_TOO_LARGE');
    // 내부 message 를 echo 하지 않고 일반 문구만 반환한다(CWE-209).
    expect(body.error.message).not.toBe('request entity too large');
    expect(body.error.message).toBe('Request payload too large.');
  });

  it('maps a non-413 4xx http-error to a generic message + logs the original', () => {
    const warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation();
    const { host, status, json } = mockHost();
    const err = Object.assign(new Error('some internal 400 detail'), {
      status: 400,
    });
    new GlobalExceptionFilter().catch(err, host);

    expect(status).toHaveBeenCalledWith(400);
    const body = bodyOf(json);
    expect(body.error.code).toBe('VALIDATION_ERROR'); // getCodeFromStatus(400)
    expect(body.error.requestId).toBeDefined(); // 413 케이스와 대칭(B-6)
    // CWE-209: 내부 원문 미노출, 일반 문구만. 원문은 logger.warn 로만 남는다.
    expect(body.error.message).toBe('The request could not be processed.');
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('some internal 400 detail'),
    );
    // spy 복원은 afterEach(jest.restoreAllMocks) 가 담당.
  });

  it('masks a plain 5xx-ish error (no/≥500 status) as 500 INTERNAL_ERROR', () => {
    const { host, status, json } = mockHost();
    const err = Object.assign(new Error('internal detail leak'), {
      status: 502,
    });
    new GlobalExceptionFilter().catch(err, host);

    expect(status).toHaveBeenCalledWith(500);
    const body = bodyOf(json);
    expect(body.error.code).toBe('INTERNAL_ERROR');
    expect(body.error.message).not.toContain('internal detail leak');
    expect(body.error.requestId).toBeDefined(); // 5xx 도 requestId 항상 발급
  });

  it('maps a unique-violation QueryFailedError (23505) to 409 RESOURCE_CONFLICT', () => {
    // typeorm race-window unique 위반 → 클라이언트엔 409 가 옳다(isUniqueViolation 분기).
    const { host, status, json } = mockHost();
    const driverError = Object.assign(new Error('duplicate key value'), {
      code: '23505',
    });
    const err = new QueryFailedError('INSERT ...', [], driverError);
    new GlobalExceptionFilter().catch(err, host);

    expect(status).toHaveBeenCalledWith(409);
    const body = bodyOf(json);
    expect(body.error.code).toBe('RESOURCE_CONFLICT');
    expect(body.error.requestId).toBeDefined();
    // 드라이버 원문(컬럼·제약명)을 echo 하지 않는다.
    expect(body.error.message).not.toContain('duplicate key value');
  });

  it('recognizes nested { error: { code, message, details } } envelope (API §5.3 shape)', () => {
    // interaction 모듈처럼 nested error shape 으로 throw 하는 코드도 정상 직렬화한다.
    const { host, status, json } = mockHost();
    new GlobalExceptionFilter().catch(
      new HttpException(
        {
          error: {
            code: 'STATE_MISMATCH',
            message: 'state conflict',
            details: [{ field: 'x' }],
          },
        },
        HttpStatus.CONFLICT,
      ),
      host,
    );

    expect(status).toHaveBeenCalledWith(409);
    const body = bodyOf(json);
    expect(body.error.code).toBe('STATE_MISMATCH');
    expect(body.error.message).toBe('state conflict');
    expect(body.error.details).toEqual([{ field: 'x' }]);
    expect(body.error.requestId).toBeDefined();
  });

  it('passes through an explicit code + details', () => {
    const { host, status, json } = mockHost();
    new GlobalExceptionFilter().catch(
      new BadRequestException({
        code: 'INVALID_WEBHOOK_PAYLOAD',
        message: 'Invalid webhook payload',
        details: [{ field: 'orderId', code: 'MISSING_REQUIRED_FIELD' }],
      }),
      host,
    );

    expect(status).toHaveBeenCalledWith(400);
    const body = bodyOf(json);
    expect(body.error.code).toBe('INVALID_WEBHOOK_PAYLOAD');
    expect(body.error.details).toEqual([
      { field: 'orderId', code: 'MISSING_REQUIRED_FIELD' },
    ]);
  });

  it('defaults unknown errors to 500 INTERNAL_ERROR', () => {
    const { host, status, json } = mockHost();
    new GlobalExceptionFilter().catch(new Error('boom'), host);

    expect(status).toHaveBeenCalledWith(500);
    expect(bodyOf(json).error.code).toBe('INTERNAL_ERROR');
  });

  it('비-Error 값 throw(문자열 등)은 UNKNOWN_ERROR_MESSAGE 로 500 처리', () => {
    // Error 인스턴스가 아닌 값(문자열·객체)이 throw 되면 어떤 분기에도 안 걸려
    // UNKNOWN_ERROR_MESSAGE fallthrough 가 그대로 응답된다(UNHANDLED 경로와 구분).
    const { host, status, json } = mockHost();
    new GlobalExceptionFilter().catch('a raw string thrown', host);

    expect(status).toHaveBeenCalledWith(500);
    const body = bodyOf(json);
    expect(body.error.code).toBe('INTERNAL_ERROR');
    expect(body.error.message).toBe('An unexpected error occurred');
  });
});
