import {
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { IntegrationOAuthService } from './integration-oauth.service';

type Mock = jest.Mock;

function makeRepo(): Record<string, Mock> {
  return {
    create: jest.fn().mockImplementation((data: unknown) => data),
    save: jest
      .fn()
      .mockImplementation((entity: unknown) => Promise.resolve(entity)),
    findOne: jest.fn().mockResolvedValue(null),
    delete: jest.fn().mockResolvedValue(undefined),
  };
}

describe('IntegrationOAuthService', () => {
  let service: IntegrationOAuthService;
  let integrationRepo: Record<string, Mock>;
  let stateRepo: Record<string, Mock>;
  let previewRepo: Record<string, Mock>;
  let dataSource: {
    query: Mock;
    transaction: Mock;
  };

  beforeEach(() => {
    integrationRepo = makeRepo();
    stateRepo = makeRepo();
    previewRepo = makeRepo();
    dataSource = {
      query: jest.fn().mockResolvedValue([]),
      transaction: jest
        .fn()
        .mockImplementation(
          async (cb: (manager: { getRepository: Mock }) => Promise<void>) => {
            await cb({
              getRepository: jest.fn().mockReturnValue(integrationRepo),
            });
          },
        ),
    };

    process.env.OAUTH_STUB_MODE = 'true';

    service = new IntegrationOAuthService(
      integrationRepo as never,
      stateRepo as never,
      previewRepo as never,
      dataSource as never,
    );
  });

  afterEach(() => {
    delete process.env.OAUTH_STUB_MODE;
  });

  describe('begin', () => {
    it('throws when service is not OAuth-capable', async () => {
      await expect(
        service.begin({
          workspaceId: 'ws-1',
          userId: 'u-1',
          service: 'http',
          scopes: [],
          mode: 'new',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws InternalServerError when CLIENT_ID env var is missing', async () => {
      delete process.env.GOOGLE_CLIENT_ID;
      await expect(
        service.begin({
          workspaceId: 'ws-1',
          userId: 'u-1',
          service: 'google',
          scopes: ['https://www.googleapis.com/auth/drive'],
          mode: 'new',
        }),
      ).rejects.toThrow(InternalServerErrorException);
    });

    it('returns authUrl and persists state for new mode', async () => {
      process.env.GOOGLE_CLIENT_ID = 'cid-123';
      const result = await service.begin({
        workspaceId: 'ws-1',
        userId: 'u-1',
        service: 'google',
        scopes: [
          'https://www.googleapis.com/auth/drive',
          'https://www.googleapis.com/auth/calendar',
        ],
        mode: 'new',
      });
      expect(result.authUrl).toContain('client_id=cid-123');
      expect(result.authUrl).toContain('https');
      expect(result.state).toHaveLength(48);
      expect(stateRepo.save).toHaveBeenCalled();
      delete process.env.GOOGLE_CLIENT_ID;
    });
  });

  describe('handleCallback', () => {
    it('rejects unknown provider', async () => {
      await expect(
        service.handleCallback('evil', { code: 'x', state: 'y' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects on error param', async () => {
      await expect(
        service.handleCallback('google', { error: 'access_denied' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects on missing state', async () => {
      await expect(
        service.handleCallback('google', { code: 'x' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects on missing code', async () => {
      await expect(
        service.handleCallback('google', { state: 'y' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects already-consumed state', async () => {
      dataSource.query.mockResolvedValue([]);
      await expect(
        service.handleCallback('google', { code: 'x', state: 'y' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects expired state', async () => {
      dataSource.query.mockResolvedValue([
        {
          provider: 'google',
          serviceType: 'google',
          mode: 'new',
          workspaceId: 'ws-1',
          userId: 'u-1',
          requestedScopes: ['https://www.googleapis.com/auth/drive'],
          integrationId: null,
          expiresAt: new Date(Date.now() - 60_000),
        },
      ]);
      await expect(
        service.handleCallback('google', { code: 'x', state: 'y' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('returns previewToken for new mode', async () => {
      dataSource.query.mockResolvedValue([
        {
          provider: 'google',
          serviceType: 'google',
          mode: 'new',
          workspaceId: 'ws-1',
          userId: 'u-1',
          requestedScopes: ['https://www.googleapis.com/auth/drive'],
          integrationId: null,
          expiresAt: new Date(Date.now() + 60_000),
        },
      ]);
      const result = await service.handleCallback('google', {
        code: 'code-xyz',
        state: 'abc',
      });
      expect(result.mode).toBe('new');
      expect(result.previewToken).toMatch(/^tmp_/);
      expect(previewRepo.save).toHaveBeenCalled();
    });

    it('updates integration for reauthorize mode', async () => {
      dataSource.query.mockResolvedValue([
        {
          provider: 'google',
          serviceType: 'google',
          mode: 'reauthorize',
          workspaceId: 'ws-1',
          userId: 'u-1',
          requestedScopes: ['https://www.googleapis.com/auth/drive'],
          integrationId: 'int-1',
          expiresAt: new Date(Date.now() + 60_000),
        },
      ]);
      integrationRepo.findOne.mockResolvedValue({
        id: 'int-1',
        workspaceId: 'ws-1',
        credentials: { access_token: 'old' },
        status: 'error',
      });
      const result = await service.handleCallback('google', {
        code: 'code',
        state: 'abc',
      });
      expect(result.mode).toBe('reauthorize');
      expect(result.integrationId).toBe('int-1');
      expect(integrationRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'connected', statusReason: null }),
      );
    });

    it('merges scopes for request_scopes mode', async () => {
      dataSource.query.mockResolvedValue([
        {
          provider: 'google',
          serviceType: 'google',
          mode: 'request_scopes',
          workspaceId: 'ws-1',
          userId: 'u-1',
          requestedScopes: [
            'https://www.googleapis.com/auth/drive',
            'https://www.googleapis.com/auth/gmail.send',
          ],
          integrationId: 'int-1',
          expiresAt: new Date(Date.now() + 60_000),
        },
      ]);
      integrationRepo.findOne.mockResolvedValue({
        id: 'int-1',
        workspaceId: 'ws-1',
        credentials: {
          access_token: 'old',
          scopes: ['https://www.googleapis.com/auth/drive'],
        },
        status: 'error',
      });
      const result = await service.handleCallback('google', {
        code: 'code',
        state: 'abc',
      });
      expect(result.mode).toBe('request_scopes');
      const saved = integrationRepo.save.mock.calls[0][0] as {
        credentials: { scopes: string[] };
      };
      expect(saved.credentials.scopes).toEqual(
        expect.arrayContaining([
          'https://www.googleapis.com/auth/drive',
          'https://www.googleapis.com/auth/gmail.send',
        ]),
      );
    });
  });

  describe('handleCallback — failure observability (변경 0)', () => {
    // After OAuth state is consumed, any thrown exception must carry
    // { integrationId, workspaceId, mode } context so the controller can
    // surface the diagnostic on the integration row.

    it('attaches callback context when state expired', async () => {
      dataSource.query.mockResolvedValue([
        {
          provider: 'google',
          serviceType: 'google',
          mode: 'reauthorize',
          workspaceId: 'ws-1',
          userId: 'u-1',
          requestedScopes: ['scope-1'],
          integrationId: 'int-42',
          expiresAt: new Date(Date.now() - 60_000),
        },
      ]);
      const error = await service
        .handleCallback('google', { code: 'code', state: 'abc' })
        .catch((e: Error) => e);
      expect(error).toBeInstanceOf(BadRequestException);
      const ctx = (error as { context?: unknown }).context as
        | { integrationId?: string; workspaceId?: string; mode?: string }
        | undefined;
      expect(ctx).toEqual({
        integrationId: 'int-42',
        workspaceId: 'ws-1',
        mode: 'reauthorize',
      });
    });

    it('attaches callback context when row is missing (resource_not_found)', async () => {
      dataSource.query.mockResolvedValue([
        {
          provider: 'google',
          serviceType: 'google',
          mode: 'reauthorize',
          workspaceId: 'ws-1',
          userId: 'u-1',
          requestedScopes: ['scope-1'],
          integrationId: 'int-vanished',
          expiresAt: new Date(Date.now() + 60_000),
        },
      ]);
      integrationRepo.findOne.mockResolvedValue(null);
      const error = await service
        .handleCallback('google', { code: 'code', state: 'abc' })
        .catch((e: Error) => e);
      // findOne -> null inside transaction throws NotFoundException
      const ctx = (error as { context?: unknown }).context as
        | { integrationId?: string }
        | undefined;
      expect(ctx?.integrationId).toBe('int-vanished');
    });

    it('does NOT attach context for state-mismatch (pre-consumption — no integrationId known)', async () => {
      dataSource.query.mockResolvedValue([]); // DELETE…RETURNING returned 0 rows
      const error = await service
        .handleCallback('google', { code: 'code', state: 'abc' })
        .catch((e: Error) => e);
      expect(error).toBeInstanceOf(BadRequestException);
      const ctx = (error as { context?: unknown }).context;
      expect(ctx).toBeUndefined();
    });

    it('attaches callback context on token exchange failure', async () => {
      // Run without OAUTH_STUB_MODE so exchangeCodeForToken does a real fetch
      // which we intercept globally to force a 401.
      delete process.env.OAUTH_STUB_MODE;
      process.env.GOOGLE_CLIENT_ID = 'cid';
      process.env.GOOGLE_CLIENT_SECRET = 'csec';
      const originalFetch = global.fetch;
      (global as { fetch: jest.Mock }).fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 401,
        text: async () => 'unauthorized',
      });
      try {
        dataSource.query.mockResolvedValue([
          {
            provider: 'google',
            serviceType: 'google',
            mode: 'reauthorize',
            workspaceId: 'ws-1',
            userId: 'u-1',
            requestedScopes: ['scope-1'],
            integrationId: 'int-token-fail',
            expiresAt: new Date(Date.now() + 60_000),
          },
        ]);
        const error = await service
          .handleCallback('google', { code: 'bad-code', state: 'abc' })
          .catch((e: Error) => e);
        expect(error).toBeInstanceOf(BadRequestException);
        const ctx = (error as { context?: unknown }).context as
          | { integrationId?: string; workspaceId?: string; mode?: string }
          | undefined;
        expect(ctx).toEqual({
          integrationId: 'int-token-fail',
          workspaceId: 'ws-1',
          mode: 'reauthorize',
        });
        // Sanity: the underlying code was OAUTH_TOKEN_EXCHANGE_FAILED so the
        // controller can transition `connected` rows to error(auth_failed).
        const code = (error as { response?: { code?: string } }).response?.code;
        expect(code).toBe('OAUTH_TOKEN_EXCHANGE_FAILED');
      } finally {
        global.fetch = originalFetch;
        delete process.env.GOOGLE_CLIENT_ID;
        delete process.env.GOOGLE_CLIENT_SECRET;
        process.env.OAUTH_STUB_MODE = 'true';
      }
    });
  });

  describe('markIntegrationCallbackError (변경 0)', () => {
    it('records last_error/status_reason on pending_install row while preserving status', async () => {
      const row = {
        id: 'int-1',
        workspaceId: 'ws-1',
        status: 'pending_install',
        statusReason: null,
        lastError: null,
      };
      integrationRepo.findOne.mockResolvedValue(row);
      await service.markIntegrationCallbackError(
        'int-1',
        'ws-1',
        'OAUTH_TOKEN_EXCHANGE_FAILED',
        'Failed to exchange authorization code for access token',
      );
      expect(integrationRepo.save).toHaveBeenCalledTimes(1);
      const saved = integrationRepo.save.mock.calls[0][0] as Record<
        string,
        unknown
      >;
      expect(saved.status).toBe('pending_install'); // preserved
      expect(saved.statusReason).toBe('oauth_token_exchange_failed'); // snake_case
      const lastError = saved.lastError as {
        code: string;
        message: string;
        at: string;
      };
      expect(lastError.code).toBe('OAUTH_TOKEN_EXCHANGE_FAILED'); // UPPER_SNAKE_CASE in last_error
      expect(lastError.message).toContain('exchange');
      expect(typeof lastError.at).toBe('string');
    });

    it('transitions connected → error(auth_failed) on OAUTH_TOKEN_EXCHANGE_FAILED', async () => {
      integrationRepo.findOne.mockResolvedValue({
        id: 'int-2',
        workspaceId: 'ws-1',
        status: 'connected',
        statusReason: null,
        lastError: null,
      });
      await service.markIntegrationCallbackError(
        'int-2',
        'ws-1',
        'OAUTH_TOKEN_EXCHANGE_FAILED',
        'denied',
      );
      const saved = integrationRepo.save.mock.calls[0][0] as Record<
        string,
        unknown
      >;
      expect(saved.status).toBe('error');
      expect(saved.statusReason).toBe('auth_failed');
    });

    it('preserves connected status on non-token-exchange errors (state expired)', async () => {
      integrationRepo.findOne.mockResolvedValue({
        id: 'int-3',
        workspaceId: 'ws-1',
        status: 'connected',
        statusReason: null,
        lastError: null,
      });
      await service.markIntegrationCallbackError(
        'int-3',
        'ws-1',
        'OAUTH_STATE_EXPIRED',
        'OAuth state has expired',
      );
      const saved = integrationRepo.save.mock.calls[0][0] as Record<
        string,
        unknown
      >;
      expect(saved.status).toBe('connected'); // preserved
      expect(saved.statusReason).toBeNull(); // not overwritten for connected non-auth errors
      expect((saved.lastError as { code: string }).code).toBe(
        'OAUTH_STATE_EXPIRED',
      );
    });

    it('silently swallows when integration row is missing', async () => {
      integrationRepo.findOne.mockResolvedValue(null);
      await expect(
        service.markIntegrationCallbackError(
          'gone',
          'ws-1',
          'OAUTH_TOKEN_EXCHANGE_FAILED',
          'nope',
        ),
      ).resolves.toBeUndefined();
      expect(integrationRepo.save).not.toHaveBeenCalled();
    });

    it('does not propagate DB errors from save', async () => {
      integrationRepo.findOne.mockResolvedValue({
        id: 'int-x',
        workspaceId: 'ws-1',
        status: 'pending_install',
        statusReason: null,
        lastError: null,
      });
      integrationRepo.save.mockRejectedValue(new Error('db down'));
      await expect(
        service.markIntegrationCallbackError(
          'int-x',
          'ws-1',
          'OAUTH_TOKEN_EXCHANGE_FAILED',
          'msg',
        ),
      ).resolves.toBeUndefined();
    });
  });

  describe('consumePreviewToken', () => {
    it('rejects unknown token', async () => {
      dataSource.query.mockResolvedValue([]);
      await expect(
        service.consumePreviewToken('tmp_x', 'ws-1', 'u-1'),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects mismatched owner', async () => {
      dataSource.query.mockResolvedValue([
        {
          previewToken: 'tmp_x',
          workspaceId: 'other',
          userId: 'u-1',
          serviceType: 'google',
          credentials: { access_token: 't' },
          tokenExpiresAt: null,
          expiresAt: new Date(Date.now() + 60_000),
        },
      ]);
      await expect(
        service.consumePreviewToken('tmp_x', 'ws-1', 'u-1'),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects expired preview', async () => {
      dataSource.query.mockResolvedValue([
        {
          previewToken: 'tmp_x',
          workspaceId: 'ws-1',
          userId: 'u-1',
          serviceType: 'google',
          credentials: { access_token: 't' },
          tokenExpiresAt: null,
          expiresAt: new Date(Date.now() - 60_000),
        },
      ]);
      await expect(
        service.consumePreviewToken('tmp_x', 'ws-1', 'u-1'),
      ).rejects.toThrow(BadRequestException);
    });

    it('returns credentials on success', async () => {
      dataSource.query.mockResolvedValue([
        {
          previewToken: 'tmp_x',
          workspaceId: 'ws-1',
          userId: 'u-1',
          serviceType: 'google',
          credentials: { access_token: 't' },
          tokenExpiresAt: null,
          expiresAt: new Date(Date.now() + 60_000),
        },
      ]);
      const result = await service.consumePreviewToken('tmp_x', 'ws-1', 'u-1');
      expect(result.serviceType).toBe('google');
      expect(result.credentials.access_token).toBe('t');
    });

    it('parses credentials when stored as a JSON string (normalized path)', async () => {
      dataSource.query.mockResolvedValue([
        {
          previewToken: 'tmp_x',
          workspaceId: 'ws-1',
          userId: 'u-1',
          serviceType: 'google',
          credentials: JSON.stringify({ access_token: 't-str' }),
          tokenExpiresAt: null,
          expiresAt: new Date(Date.now() + 60_000),
        },
      ]);
      const result = await service.consumePreviewToken('tmp_x', 'ws-1', 'u-1');
      expect(result.credentials.access_token).toBe('t-str');
    });

    it('rejects with BadRequest when credentials string is corrupt (not unhandled 500)', async () => {
      dataSource.query.mockResolvedValue([
        {
          previewToken: 'tmp_x',
          workspaceId: 'ws-1',
          userId: 'u-1',
          serviceType: 'google',
          credentials: '{ not-valid-json',
          tokenExpiresAt: null,
          expiresAt: new Date(Date.now() + 60_000),
        },
      ]);
      await expect(
        service.consumePreviewToken('tmp_x', 'ws-1', 'u-1'),
      ).rejects.toMatchObject({
        response: expect.objectContaining({
          code: 'INTEGRATION_CREDENTIALS_INVALID',
        }),
      });
    });
  });
});
