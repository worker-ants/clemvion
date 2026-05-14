import { BadRequestException } from '@nestjs/common';
import type { Response } from 'express';
import { IntegrationsController } from './integrations.controller';
import { IntegrationOAuthService } from './integration-oauth.service';
import type { IntegrationsService } from './integrations.service';

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

describe('IntegrationsController — oauthCallback error paths', () => {
  let controller: IntegrationsController;
  let oauthService: jest.Mocked<
    Pick<
      IntegrationOAuthService,
      | 'handleCallback'
      | 'handleCallbackWithErrorCapture'
      | 'markIntegrationCallbackError'
      | 'handleInstall'
    >
  >;
  let integrationsService: jest.Mocked<Pick<IntegrationsService, never>>;

  beforeEach(() => {
    process.env.FRONTEND_URL = 'https://frontend.test';
    oauthService = {
      handleCallback: jest.fn(),
      handleCallbackWithErrorCapture: jest.fn(),
      markIntegrationCallbackError: jest.fn().mockResolvedValue(undefined),
      handleInstall: jest.fn(),
    } as unknown as typeof oauthService;
    integrationsService = {} as typeof integrationsService;
    controller = new IntegrationsController(
      integrationsService as never,
      oauthService as never,
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
});

describe('IntegrationsController — cafe24 install routes', () => {
  let controller: IntegrationsController;
  let oauthService: {
    handleInstall: jest.Mock;
    handleCallback: jest.Mock;
    markIntegrationCallbackError: jest.Mock;
  };
  const validToken = 'a'.repeat(64);

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
    controller = new IntegrationsController({} as never, oauthService as never);
  });

  it('rejects non-hex install_token with 404 CAFE24_INSTALL_INVALID_TOKEN before calling service', async () => {
    const res = makeRes();
    await controller.cafe24Install(
      'not-a-hex-token',
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
    expect((res.body as { code: string }).code).toBe(
      'CAFE24_INSTALL_INVALID_TOKEN',
    );
    expect(oauthService.handleInstall).not.toHaveBeenCalled();
  });

  it('rejects short/long hex with 404 (length must be 64)', async () => {
    const res = makeRes();
    await controller.cafe24Install(
      'a'.repeat(63),
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
    expect((res.body as { code: string }).code).toBe(
      'CAFE24_INSTALL_MISSING_PARAMS',
    );
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
      { url: '/api/integrations/oauth/install/cafe24/X?mall_id=shop' } as never,
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

  it('legacy /oauth/install/cafe24 returns 410 CAFE24_INSTALL_LEGACY_PATH', () => {
    const res = makeRes();
    controller.cafe24InstallLegacy(res as never);
    expect(res.statusCode).toBe(410);
    expect((res.body as { code: string }).code).toBe(
      'CAFE24_INSTALL_LEGACY_PATH',
    );
  });
});
