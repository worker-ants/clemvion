import {
  BadGatewayException,
  BadRequestException,
  HttpException,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import {
  INSTALL_UNEXPECTED_ERROR_MESSAGE,
  installErrorBody,
  newInstallRequestId,
  resolveInstallFailure,
} from './install-failure-response';

describe('resolveInstallFailure', () => {
  it('keeps the status, code and message of a coded HttpException', () => {
    const failure = resolveInstallFailure(
      new NotFoundException({
        code: 'CAFE24_INSTALL_INVALID_TOKEN',
        message: 'install_token not found',
      }),
      'CAFE24_INSTALL_FAILED',
    );
    expect(failure).toEqual({
      status: 404,
      code: 'CAFE24_INSTALL_INVALID_TOKEN',
      message: 'install_token not found',
      unexpected: false,
    });
  });

  it('falls back to the provider code when the HttpException has a string response', () => {
    const failure = resolveInstallFailure(
      new HttpException('Teapot refused', 418),
      'MAKESHOP_INSTALL_FAILED',
    );
    expect(failure).toEqual({
      status: 418,
      code: 'MAKESHOP_INSTALL_FAILED',
      message: 'Teapot refused',
      unexpected: false,
    });
  });

  it('uses the exception message when the response message is not a string', () => {
    // class-validator 형 응답은 message 가 배열이다.
    const err = new BadRequestException({ message: ['a must be a string'] });
    const failure = resolveInstallFailure(err, 'CAFE24_INSTALL_FAILED');
    expect(failure.status).toBe(400);
    expect(failure.code).toBe('CAFE24_INSTALL_FAILED');
    expect(failure.message).toBe(err.message);
    expect(failure.unexpected).toBe(false);
  });

  it('ignores an empty code in the response', () => {
    const failure = resolveInstallFailure(
      new BadRequestException({ code: '', message: 'bad' }),
      'CAFE24_INSTALL_FAILED',
    );
    expect(failure.code).toBe('CAFE24_INSTALL_FAILED');
  });

  it('masks the message of a coded 5xx HttpException but keeps its status and code (CLE-T-KKJ2A0)', () => {
    // OAUTH_CONFIG_MISSING 의 원문에는 환경 변수 이름이 들어 있다. 원문은 호출부가 requestId 와 로그에 남긴다.
    const failure = resolveInstallFailure(
      new InternalServerErrorException({
        code: 'OAUTH_CONFIG_MISSING',
        message: 'CAFE24_CLIENT_ID / CAFE24_CLIENT_SECRET env not configured',
      }),
      'CAFE24_INSTALL_FAILED',
    );
    expect(failure).toEqual({
      status: 500,
      code: 'OAUTH_CONFIG_MISSING',
      message: INSTALL_UNEXPECTED_ERROR_MESSAGE,
      unexpected: true,
    });
  });

  it('masks an uncoded 5xx HttpException with the provider code and keeps its status', () => {
    const failure = resolveInstallFailure(
      new BadGatewayException('upstream 10.0.0.5 refused'),
      'MAKESHOP_INSTALL_FAILED',
    );
    expect(failure).toEqual({
      status: 502,
      code: 'MAKESHOP_INSTALL_FAILED',
      message: INSTALL_UNEXPECTED_ERROR_MESSAGE,
      unexpected: true,
    });
  });

  it.each([
    ['Error', new Error('connect ECONNREFUSED 10.0.0.5:5432')],
    [
      'duck-typed status object',
      Object.assign(new Error('x'), { status: 403 }),
    ],
    ['string', 'boom'],
    ['undefined', undefined],
  ])(
    'masks a non-HttpException (%s) as 500 with the fixed message',
    (_l, err) => {
      expect(resolveInstallFailure(err, 'CAFE24_INSTALL_FAILED')).toEqual({
        status: 500,
        code: 'CAFE24_INSTALL_FAILED',
        message: INSTALL_UNEXPECTED_ERROR_MESSAGE,
        unexpected: true,
      });
    },
  );
});

describe('installErrorBody · newInstallRequestId', () => {
  it('builds the error envelope with a uuid v4 requestId', () => {
    const requestId = newInstallRequestId();
    expect(requestId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
    expect(installErrorBody('C', 'm', requestId)).toEqual({
      error: { code: 'C', message: 'm', requestId },
    });
  });
});
