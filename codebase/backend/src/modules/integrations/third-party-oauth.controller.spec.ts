import { BadRequestException } from '@nestjs/common';
import type { Response } from 'express';
import {
  ThirdPartyOAuthController,
  isValidPostMessageOrigin,
} from './third-party-oauth.controller';
import { IntegrationOAuthService } from './integration-oauth.service';

function makeRes() {
  const res = {
    statusCode: 200,
    headers: {} as Record<string, string>,
    body: undefined as unknown,
    status: jest.fn().mockImplementation(function (
      this: typeof res,
      c: number,
    ) {
      this.statusCode = c;
      return this;
    }),
    setHeader: jest.fn().mockImplementation(function (
      this: typeof res,
      k: string,
      v: string,
    ) {
      this.headers[k] = v;
      return this;
    }),
    send: jest.fn().mockImplementation(function (
      this: typeof res,
      body: unknown,
    ) {
      this.body = body;
      return this;
    }),
    json: jest.fn().mockImplementation(function (
      this: typeof res,
      body: unknown,
    ) {
      this.body = body;
      return this;
    }),
    redirect: jest.fn(),
  };
  return res as unknown as Response & typeof res;
}

function makeRateLimit() {
  return {
    isLockedOut: jest.fn().mockResolvedValue(false),
    recordFailure: jest.fn().mockResolvedValue(undefined),
  };
}

describe('ThirdPartyOAuthController — oauthCallback error paths', () => {
  let controller: ThirdPartyOAuthController;
  let oauthService: jest.Mocked<
    Pick<
      IntegrationOAuthService,
      | 'handleCallback'
      | 'handleCallbackWithErrorCapture'
      | 'markIntegrationCallbackError'
      | 'handleInstall'
    >
  >;

  beforeEach(() => {
    process.env.FRONTEND_URL = 'https://frontend.test';
    oauthService = {
      handleCallback: jest.fn(),
      handleCallbackWithErrorCapture: jest.fn(),
      markIntegrationCallbackError: jest.fn().mockResolvedValue(undefined),
      handleInstall: jest.fn(),
    } as unknown as typeof oauthService;
    controller = new ThirdPartyOAuthController(
      oauthService as never,
      makeRateLimit() as never,
    );
  });

  afterEach(() => {
    delete process.env.FRONTEND_URL;
    delete process.env.APP_URL;
  });

  it('delegates to handleCallbackWithErrorCapture and renders success HTML', async () => {
    oauthService.handleCallbackWithErrorCapture.mockResolvedValue({
      mode: 'reauthorize',
      provider: 'cafe24',
      integrationId: 'int-1',
    });
    const res = makeRes();
    await controller.oauthCallback('cafe24', 'c', 's', undefined, res as never);
    expect(oauthService.handleCallbackWithErrorCapture).toHaveBeenCalledWith(
      'cafe24',
      {
        code: 'c',
        state: 's',
        error: undefined,
      },
    );
    expect(res.headers['Content-Type']).toMatch(/text\/html/);
    expect(res.body as string).toContain('Connected');
  });

  it('renders error HTML when the service rejects (recording happens inside service)', async () => {
    oauthService.handleCallbackWithErrorCapture.mockRejectedValue(
      new BadRequestException({
        code: 'OAUTH_STATE_MISMATCH',
        message: 'Invalid or already consumed OAuth state',
      }),
    );
    const res = makeRes();
    await controller.oauthCallback('cafe24', 'c', 's', undefined, res as never);
    expect(res.body as string).toContain('OAuth failed');
    // The controller no longer reaches into the error for context — recording
    // is the service's responsibility (handleCallbackWithErrorCapture).
    expect(oauthService.markIntegrationCallbackError).not.toHaveBeenCalled();
  });

  it('falls back gracefully when the error lacks a `message`', async () => {
    oauthService.handleCallbackWithErrorCapture.mockRejectedValue({});
    const res = makeRes();
    await controller.oauthCallback('cafe24', 'c', 's', undefined, res as never);
    expect(res.body as string).toContain('OAuth failed');
  });

  it('fails closed when FRONTEND_URL and APP_URL are both missing', async () => {
    delete process.env.FRONTEND_URL;
    delete process.env.APP_URL;
    const res = makeRes();
    await controller.oauthCallback('cafe24', 'c', 's', undefined, res as never);
    expect(res.statusCode).toBe(500);
    // No HTML callback template renders → no postMessage payload leaks.
    expect(oauthService.handleCallbackWithErrorCapture).not.toHaveBeenCalled();
  });

  it('falls back to APP_URL when FRONTEND_URL is unset', async () => {
    delete process.env.FRONTEND_URL;
    process.env.APP_URL = 'https://app.test';
    oauthService.handleCallbackWithErrorCapture.mockResolvedValue({
      mode: 'reauthorize',
      provider: 'cafe24',
      integrationId: 'int-1',
    });
    const res = makeRes();
    await controller.oauthCallback('cafe24', 'c', 's', undefined, res as never);
    expect(res.statusCode).toBe(200);
    expect(res.body as string).toContain('Connected');
  });

  it('returns 400 with error HTML for unsupported providers', async () => {
    const res = makeRes();
    await controller.oauthCallback(
      'unsupportedprovider',
      undefined,
      undefined,
      undefined,
      res as never,
    );
    expect(res.statusCode).toBe(400);
    expect(res.body as string).toContain('Unsupported OAuth provider');
    expect(oauthService.handleCallbackWithErrorCapture).not.toHaveBeenCalled();
  });
});

describe('ThirdPartyOAuthController — cafe24 install routes', () => {
  let controller: ThirdPartyOAuthController;
  let oauthService: {
    handleInstall: jest.Mock;
    handleCallback: jest.Mock;
    markIntegrationCallbackError: jest.Mock;
  };
  let rateLimit: ReturnType<typeof makeRateLimit>;
  // 16-byte base64url = 22 chars. spec/2-navigation/4-integration.md §9.2.
  const validToken = 'AbCdEfGhIjKlMnOpQrStUv';

  beforeEach(() => {
    oauthService = {
      handleCallback: jest.fn(),
      markIntegrationCallbackError: jest.fn(),
      handleInstall: jest
        .fn()
        .mockResolvedValue(
          'https://myshop.cafe24api.com/api/v2/oauth/authorize',
        ),
    };
    rateLimit = makeRateLimit();
    controller = new ThirdPartyOAuthController(
      oauthService as never,
      rateLimit as never,
    );
  });

  it('rejects non-base64url install_token with 404 CAFE24_INSTALL_INVALID_TOKEN before calling service', async () => {
    const res = makeRes();
    // 22자이지만 base64url 알파벳 밖 (`!` 포함)
    await controller.cafe24Install(
      '!nvalid!chars!22charlen!',
      'shop',
      '1700000000',
      'sig',
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      { url: '/cafe24?mall_id=shop' } as never,
      res as never,
    );
    expect(res.statusCode).toBe(404);
    expect((res.body as { error: { code: string } }).error.code).toBe(
      'CAFE24_INSTALL_INVALID_TOKEN',
    );
    expect(oauthService.handleInstall).not.toHaveBeenCalled();
  });

  it('rejects too-short base64url with 404 (length must be exactly 22)', async () => {
    const res = makeRes();
    await controller.cafe24Install(
      'A'.repeat(21),
      'shop',
      '1700000000',
      'sig',
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      { url: '/cafe24?mall_id=shop' } as never,
      res as never,
    );
    expect(res.statusCode).toBe(404);
  });

  it('rejects too-long base64url with 404 (length must be exactly 22)', async () => {
    const res = makeRes();
    await controller.cafe24Install(
      'A'.repeat(23),
      'shop',
      '1700000000',
      'sig',
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      { url: '/cafe24?mall_id=shop' } as never,
      res as never,
    );
    expect(res.statusCode).toBe(404);
  });

  it('rejects old 64-hex tokens with 404 (legacy format must not be accepted)', async () => {
    const res = makeRes();
    await controller.cafe24Install(
      'a'.repeat(64),
      'shop',
      '1700000000',
      'sig',
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      { url: '/cafe24?mall_id=shop' } as never,
      res as never,
    );
    expect(res.statusCode).toBe(404);
  });

  it('returns 400 CAFE24_INSTALL_MISSING_PARAMS when mall_id missing', async () => {
    const res = makeRes();
    await controller.cafe24Install(
      validToken,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      { url: '/cafe24/x' } as never,
      res as never,
    );
    expect(res.statusCode).toBe(400);
    expect((res.body as { error: { code: string } }).error.code).toBe(
      'CAFE24_INSTALL_MISSING_PARAMS',
    );
  });

  it('returns 400 CAFE24_INSTALL_MISSING_PARAMS when timestamp missing', async () => {
    const res = makeRes();
    await controller.cafe24Install(
      validToken,
      'shop',
      undefined,
      'sig',
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      { url: '/cafe24/x' } as never,
      res as never,
    );
    expect(res.statusCode).toBe(400);
    expect((res.body as { error: { code: string } }).error.code).toBe(
      'CAFE24_INSTALL_MISSING_PARAMS',
    );
  });

  it('returns 400 CAFE24_INSTALL_MISSING_PARAMS when hmac missing', async () => {
    const res = makeRes();
    await controller.cafe24Install(
      validToken,
      'shop',
      '1700000000',
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      { url: '/cafe24/x' } as never,
      res as never,
    );
    expect(res.statusCode).toBe(400);
    expect((res.body as { error: { code: string } }).error.code).toBe(
      'CAFE24_INSTALL_MISSING_PARAMS',
    );
  });

  it('propagates service ForbiddenException status (403) to response', async () => {
    const err = Object.assign(new Error('hmac fail'), {
      status: 403,
      response: { code: 'CAFE24_INSTALL_INVALID_HMAC', message: 'hmac fail' },
    });
    oauthService.handleInstall.mockRejectedValue(err);
    const res = makeRes();
    await controller.cafe24Install(
      validToken,
      'shop',
      '1700000000',
      'sig',
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      { url: '/cafe24?mall_id=shop' } as never,
      res as never,
    );
    expect(res.statusCode).toBe(403);
    expect((res.body as { error: { code: string } }).error.code).toBe(
      'CAFE24_INSTALL_INVALID_HMAC',
    );
  });

  it('propagates service NotFoundException status (404) to response', async () => {
    const err = Object.assign(new Error('token gone'), {
      status: 404,
      response: { code: 'CAFE24_INSTALL_INVALID_TOKEN', message: 'token gone' },
    });
    oauthService.handleInstall.mockRejectedValue(err);
    const res = makeRes();
    await controller.cafe24Install(
      validToken,
      'shop',
      '1700000000',
      'sig',
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      { url: '/cafe24?mall_id=shop' } as never,
      res as never,
    );
    expect(res.statusCode).toBe(404);
    expect((res.body as { error: { code: string } }).error.code).toBe(
      'CAFE24_INSTALL_INVALID_TOKEN',
    );
  });

  /**
   * 회귀 보호 (2026-05-15) — Cafe24 의 "테스트 실행" / "앱으로 가기" 가 직접
   * 브라우저 탭으로 우리 URL 을 여는 경로에서 사용자가 JSON 응답을 보지 않도록
   * Accept: text/html 인 경우 HTML 페이지를 렌더링한다.
   */
  it('renders HTML error page when request Accept header includes text/html', async () => {
    const err = Object.assign(new Error('token gone'), {
      status: 404,
      response: { code: 'CAFE24_INSTALL_INVALID_TOKEN', message: 'token gone' },
    });
    oauthService.handleInstall.mockRejectedValue(err);
    const res = makeRes();
    await controller.cafe24Install(
      validToken,
      'shop',
      '1700000000',
      'sig',
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      {
        url: '/cafe24?mall_id=shop',
        headers: { accept: 'text/html,application/xhtml+xml' },
      } as never,
      res as never,
    );
    expect(res.statusCode).toBe(404);
    const contentType = (res as { headers?: Record<string, string> }).headers?.[
      'Content-Type'
    ];
    expect(contentType ?? '').toContain('text/html');
    const bodyStr = String(res.body);
    expect(bodyStr).toContain('CAFE24_INSTALL_INVALID_TOKEN');
    expect(bodyStr).toContain('token gone');
  });

  it('delegates valid input to handleInstall and 302-redirects to authorize URL', async () => {
    const res = makeRes();
    await controller.cafe24Install(
      validToken,
      'shop',
      '1700000000',
      'sig',
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      { url: '/api/3rd-party/cafe24/install/X?mall_id=shop' } as never,
      res as never,
    );
    expect(oauthService.handleInstall).toHaveBeenCalledWith(
      validToken,
      expect.objectContaining({ mall_id: 'shop', hmac: 'sig' }),
    );
    expect(res.redirect).toHaveBeenCalledWith(
      302,
      'https://myshop.cafe24api.com/api/v2/oauth/authorize',
    );
  });

  // A-3 Layer 2: token oracle enumeration 방어 — 실패 페널티 lockout.
  // spec/4-nodes/4-integration/4-cafe24.md §9.8 Rate limiting note.
  describe('rate limiting (A-3 Layer 2 — fail penalty)', () => {
    const req = {
      url: '/api/3rd-party/cafe24/install/X?mall_id=shop',
      ip: '9.9.9.9',
      headers: {},
    };
    const call = (
      token: string,
      q: { mall_id?: string; timestamp?: string; hmac?: string } = {
        mall_id: 'shop',
        timestamp: '1700000000',
        hmac: 'sig',
      },
    ) => {
      const res = makeRes();
      return controller
        .cafe24Install(
          token,
          q.mall_id,
          q.timestamp,
          q.hmac,
          undefined,
          undefined,
          undefined,
          undefined,
          undefined,
          undefined,
          undefined,
          undefined,
          req as never,
          res as never,
        )
        .then(() => res);
    };

    it('locked-out IP → 429 CAFE24_INSTALL_RATE_LIMITED before any processing', async () => {
      rateLimit.isLockedOut.mockResolvedValue(true);
      const res = await call(validToken);
      expect(res.statusCode).toBe(429);
      expect((res.body as { error: { code: string } }).error.code).toBe(
        'CAFE24_INSTALL_RATE_LIMITED',
      );
      expect(rateLimit.isLockedOut).toHaveBeenCalledWith('9.9.9.9');
      expect(oauthService.handleInstall).not.toHaveBeenCalled();
    });

    it('records failure on invalid token format (404)', async () => {
      const res = await call('a'.repeat(64)); // legacy hex, fails pattern
      expect(res.statusCode).toBe(404);
      expect(rateLimit.recordFailure).toHaveBeenCalledWith('9.9.9.9');
    });

    it('records failure when service throws INVALID_TOKEN (404)', async () => {
      oauthService.handleInstall.mockRejectedValue(
        Object.assign(new Error('gone'), {
          status: 404,
          response: { code: 'CAFE24_INSTALL_INVALID_TOKEN', message: 'gone' },
        }),
      );
      await call(validToken);
      expect(rateLimit.recordFailure).toHaveBeenCalledWith('9.9.9.9');
    });

    it('records failure when service throws INVALID_HMAC (403)', async () => {
      oauthService.handleInstall.mockRejectedValue(
        Object.assign(new Error('hmac'), {
          status: 403,
          response: { code: 'CAFE24_INSTALL_INVALID_HMAC', message: 'hmac' },
        }),
      );
      await call(validToken);
      expect(rateLimit.recordFailure).toHaveBeenCalledWith('9.9.9.9');
    });

    it('does NOT record failure on REPLAY (400 — not an enumeration signal)', async () => {
      oauthService.handleInstall.mockRejectedValue(
        Object.assign(new Error('replay'), {
          status: 400,
          response: { code: 'CAFE24_INSTALL_REPLAY', message: 'replay' },
        }),
      );
      await call(validToken);
      expect(rateLimit.recordFailure).not.toHaveBeenCalled();
    });

    it('does NOT record failure on missing params (400)', async () => {
      const res = await call(validToken, {});
      expect(res.statusCode).toBe(400);
      expect(rateLimit.recordFailure).not.toHaveBeenCalled();
    });

    it('does NOT record failure on successful install (302) but DOES check lockout', async () => {
      const res = await call(validToken);
      expect(res.redirect).toHaveBeenCalledWith(302, expect.any(String));
      expect(rateLimit.isLockedOut).toHaveBeenCalledWith('9.9.9.9');
      expect(rateLimit.recordFailure).not.toHaveBeenCalled();
    });

    it('handles req.ip undefined gracefully (passes undefined to service)', async () => {
      const res = makeRes();
      await controller.cafe24Install(
        validToken,
        'shop',
        '1700000000',
        'sig',
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        { url: '/cafe24?mall_id=shop', ip: undefined, headers: {} } as never,
        res as never,
      );
      expect(rateLimit.isLockedOut).toHaveBeenCalledWith(undefined);
      expect(res.redirect).toHaveBeenCalledWith(302, expect.any(String));
    });
  });
});

describe('ThirdPartyOAuthController — makeshop install routes', () => {
  let controller: ThirdPartyOAuthController;
  let oauthService: { handleMakeshopInstall: jest.Mock };
  let rateLimit: ReturnType<typeof makeRateLimit>;
  const validToken = 'AbCdEfGhIjKlMnOpQrStUv';

  beforeEach(() => {
    oauthService = {
      handleMakeshopInstall: jest
        .fn()
        .mockResolvedValue('https://auth.makeshop.com/oauth/authorize?x=1'),
    };
    rateLimit = makeRateLimit();
    controller = new ThirdPartyOAuthController(
      oauthService as never,
      rateLimit as never,
    );
  });

  const req = {
    url: '/api/3rd-party/makeshop/install/X?shop_uid=myshop&timestamp=1700000000&hmac=sig',
    ip: '9.9.9.9',
    headers: {},
  };

  it('rejects non-base64url install_token with 404 before calling service', async () => {
    const res = makeRes();
    await controller.makeshopInstall(
      'a'.repeat(64),
      'myshop',
      '1700000000',
      'sig',
      'install',
      req as never,
      res as never,
    );
    expect(res.statusCode).toBe(404);
    expect((res.body as { error: { code: string } }).error.code).toBe(
      'MAKESHOP_INSTALL_INVALID_TOKEN',
    );
    expect(oauthService.handleMakeshopInstall).not.toHaveBeenCalled();
    expect(rateLimit.recordFailure).toHaveBeenCalledWith('9.9.9.9');
  });

  it('returns 400 MAKESHOP_INSTALL_MISSING_PARAMS when shop_uid missing', async () => {
    const res = makeRes();
    await controller.makeshopInstall(
      validToken,
      undefined,
      '1700000000',
      'sig',
      'install',
      req as never,
      res as never,
    );
    expect(res.statusCode).toBe(400);
    expect((res.body as { error: { code: string } }).error.code).toBe(
      'MAKESHOP_INSTALL_MISSING_PARAMS',
    );
  });

  it('delegates valid input to handleMakeshopInstall and 302-redirects', async () => {
    const res = makeRes();
    await controller.makeshopInstall(
      validToken,
      'myshop',
      '1700000000',
      'sig',
      'install',
      req as never,
      res as never,
    );
    expect(oauthService.handleMakeshopInstall).toHaveBeenCalledWith(
      validToken,
      expect.objectContaining({ shop_uid: 'myshop', hmac: 'sig' }),
    );
    expect(res.redirect).toHaveBeenCalledWith(
      302,
      'https://auth.makeshop.com/oauth/authorize?x=1',
    );
    // success → no failure penalty.
    expect(rateLimit.recordFailure).not.toHaveBeenCalled();
  });

  it('locked-out IP → 429 before processing', async () => {
    rateLimit.isLockedOut.mockResolvedValue(true);
    const res = makeRes();
    await controller.makeshopInstall(
      validToken,
      'myshop',
      '1700000000',
      'sig',
      'install',
      req as never,
      res as never,
    );
    expect(res.statusCode).toBe(429);
    expect((res.body as { error: { code: string } }).error.code).toBe(
      'MAKESHOP_INSTALL_RATE_LIMITED',
    );
    expect(oauthService.handleMakeshopInstall).not.toHaveBeenCalled();
  });

  it('propagates 403 INVALID_HMAC + records enumeration failure', async () => {
    oauthService.handleMakeshopInstall.mockRejectedValue(
      Object.assign(new Error('hmac'), {
        status: 403,
        response: { code: 'MAKESHOP_INSTALL_INVALID_HMAC', message: 'hmac' },
      }),
    );
    const res = makeRes();
    await controller.makeshopInstall(
      validToken,
      'myshop',
      '1700000000',
      'sig',
      'install',
      req as never,
      res as never,
    );
    expect(res.statusCode).toBe(403);
    expect(rateLimit.recordFailure).toHaveBeenCalledWith('9.9.9.9');
  });

  it('does NOT record failure on REPLAY (400 — not an enumeration signal)', async () => {
    oauthService.handleMakeshopInstall.mockRejectedValue(
      Object.assign(new Error('replay'), {
        status: 400,
        response: { code: 'MAKESHOP_INSTALL_REPLAY', message: 'replay' },
      }),
    );
    const res = makeRes();
    await controller.makeshopInstall(
      validToken,
      'myshop',
      '1700000000',
      'sig',
      'install',
      req as never,
      res as never,
    );
    expect(res.statusCode).toBe(400);
    expect(rateLimit.recordFailure).not.toHaveBeenCalled();
  });
});

// SEC H-3 — `isValidPostMessageOrigin` 회귀 보호. postMessage targetOrigin
// 으로 들어가는 FRONTEND_URL / APP_URL 의 shape 가 잘못 설정되면 OAuth
// 결과 (previewToken 등) 가 외부 origin 에 누출되므로 엄격 검증.
describe('isValidPostMessageOrigin', () => {
  it.each([
    'https://app.clemvion.com',
    'https://app.clemvion.com/',
    'https://staging.clemvion.com:8443',
    'http://localhost:3000',
    'http://localhost',
    'http://127.0.0.1:3010',
  ])('accepts %s', (origin) => {
    expect(isValidPostMessageOrigin(origin)).toBe(true);
  });

  it.each([
    '*',
    'null',
    '',
    'https://app.example.com/path', // path 포함 거부
    'https://app.example.com/?q=1', // query 포함 거부
    'http://example.com', // non-localhost http 거부
    'ftp://example.com', // 비-http(s) 프로토콜 거부
    'not-a-url',
    'javascript:alert(1)',
    '//example.com',
  ])('rejects %s', (origin) => {
    expect(isValidPostMessageOrigin(origin)).toBe(false);
  });
});
