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
