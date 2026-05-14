import { BadRequestException } from '@nestjs/common';
import type { Response } from 'express';
import { IntegrationsController } from './integrations.controller';
import {
  attachCallbackContext,
  IntegrationOAuthService,
} from './integration-oauth.service';
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

describe('IntegrationsController — oauthCallback error paths (변경 0)', () => {
  let controller: IntegrationsController;
  let oauthService: jest.Mocked<
    Pick<
      IntegrationOAuthService,
      'handleCallback' | 'markIntegrationCallbackError' | 'handleInstall'
    >
  >;
  let integrationsService: jest.Mocked<Pick<IntegrationsService, never>>;

  beforeEach(() => {
    process.env.FRONTEND_URL = 'https://frontend.test';
    oauthService = {
      handleCallback: jest.fn(),
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

  it('records callback error on the integration row when context is present', async () => {
    const err = attachCallbackContext(
      new BadRequestException({
        code: 'OAUTH_TOKEN_EXCHANGE_FAILED',
        message: 'Failed to exchange authorization code for access token',
      }),
      {
        integrationId: 'int-1',
        workspaceId: 'ws-1',
        mode: 'reauthorize',
      },
    );
    oauthService.handleCallback.mockRejectedValue(err);
    const res = makeRes();
    await controller.oauthCallback(
      'cafe24',
      'code',
      'state',
      undefined,
      res as never,
    );
    expect(oauthService.markIntegrationCallbackError).toHaveBeenCalledWith(
      'int-1',
      'ws-1',
      'OAUTH_TOKEN_EXCHANGE_FAILED',
      'Failed to exchange authorization code for access token',
    );
    // HTML error response still rendered.
    expect(res.headers['Content-Type']).toMatch(/text\/html/);
    expect(typeof res.body).toBe('string');
    expect(res.body as string).toContain('OAuth failed');
  });

  it('skips recording when no callback context (e.g. pre-state-consumption mismatch)', async () => {
    oauthService.handleCallback.mockRejectedValue(
      new BadRequestException({
        code: 'OAUTH_STATE_MISMATCH',
        message: 'Invalid or already consumed OAuth state',
      }),
    );
    const res = makeRes();
    await controller.oauthCallback('cafe24', 'c', 's', undefined, res as never);
    expect(oauthService.markIntegrationCallbackError).not.toHaveBeenCalled();
    expect(res.body as string).toContain('OAuth failed');
  });

  it('still renders HTML response even if recording throws unexpectedly', async () => {
    const err = attachCallbackContext(
      new BadRequestException({
        code: 'OAUTH_TOKEN_EXCHANGE_FAILED',
        message: 'failure',
      }),
      {
        integrationId: 'int-2',
        workspaceId: 'ws-1',
        mode: 'reauthorize',
      },
    );
    oauthService.handleCallback.mockRejectedValue(err);
    oauthService.markIntegrationCallbackError.mockRejectedValueOnce(
      new Error('DB unreachable'),
    );
    const res = makeRes();
    await expect(
      controller.oauthCallback('cafe24', 'c', 's', undefined, res as never),
    ).resolves.toBeUndefined();
    expect(res.body as string).toContain('OAuth failed');
  });

  it('falls back to a generic errorCode when service throws an exception without `code`', async () => {
    const err = attachCallbackContext(new Error('boom'), {
      integrationId: 'int-3',
      workspaceId: 'ws-1',
      mode: 'reauthorize',
    });
    oauthService.handleCallback.mockRejectedValue(err);
    const res = makeRes();
    await controller.oauthCallback('cafe24', 'c', 's', undefined, res as never);
    expect(oauthService.markIntegrationCallbackError).toHaveBeenCalledWith(
      'int-3',
      'ws-1',
      'OAUTH_CALLBACK_FAILED',
      'boom',
    );
  });

  it('fails closed when FRONTEND_URL and APP_URL are both missing', async () => {
    delete process.env.FRONTEND_URL;
    delete process.env.APP_URL;
    const res = makeRes();
    await controller.oauthCallback('cafe24', 'c', 's', undefined, res as never);
    expect(res.statusCode).toBe(500);
    // No HTML callback template renders → no postMessage payload leaks.
    expect(oauthService.handleCallback).not.toHaveBeenCalled();
  });
});

describe('IntegrationsController — cafe24 install routes (변경 2)', () => {
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
