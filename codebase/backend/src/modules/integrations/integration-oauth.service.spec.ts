import {
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import {
  IntegrationOAuthService,
  LAST_ERROR_MESSAGE_MAX_LEN,
  attachCallbackContext,
  callbackContextOf,
  sanitizeLastErrorMessage,
} from './integration-oauth.service';

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
      dataSource.query.mockResolvedValue([[], 0]);
      await expect(
        service.handleCallback('google', { code: 'x', state: 'y' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects expired state', async () => {
      dataSource.query.mockResolvedValue([
        [
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
        ],
        1,
      ]);
      await expect(
        service.handleCallback('google', { code: 'x', state: 'y' }),
      ).rejects.toThrow(BadRequestException);
    });

    // B-5-7: provider_mismatch — state.provider 가 callback 경로의 provider 와
    // 다르면 BadRequestException. 옛 회귀에서 같은 state 가 잘못된 provider
    // 콜백을 통과해 다른 서비스로 코드 교환을 시도하는 시나리오 차단.
    it('rejects provider mismatch (state.provider !== route.provider)', async () => {
      dataSource.query.mockResolvedValue([
        [
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
        ],
        1,
      ]);
      await expect(
        service.handleCallback('github', { code: 'x', state: 'y' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('returns previewToken for new mode', async () => {
      dataSource.query.mockResolvedValue([
        [
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
        ],
        1,
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
        [
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
        ],
        1,
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
        [
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
        ],
        1,
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

  describe('handleCallback — failure observability', () => {
    // After OAuth state is consumed, any thrown exception must carry
    // { integrationId, workspaceId, mode } context so the controller can
    // surface the diagnostic on the integration row.

    it('attaches callback context when state expired', async () => {
      dataSource.query.mockResolvedValue([
        [
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
        ],
        1,
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
        [
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
        ],
        1,
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
      dataSource.query.mockResolvedValue([[], 0]); // DELETE…RETURNING returned 0 rows
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
          [
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
          ],
          1,
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

    it('surfaces token exchange timeout (AbortError) as OAUTH_TOKEN_EXCHANGE_FAILED', async () => {
      // 토큰 endpoint hang → AbortController 가 fetch 를 abort. AbortError 가
      // BadRequestException(OAUTH_TOKEN_EXCHANGE_FAILED) 로 surface 돼야 한다.
      delete process.env.OAUTH_STUB_MODE;
      process.env.GOOGLE_CLIENT_ID = 'cid';
      process.env.GOOGLE_CLIENT_SECRET = 'csec';
      const originalFetch = global.fetch;
      const abortErr = new Error('The operation was aborted');
      abortErr.name = 'AbortError';
      (global as { fetch: jest.Mock }).fetch = jest
        .fn()
        .mockRejectedValue(abortErr);
      try {
        dataSource.query.mockResolvedValue([
          [
            {
              provider: 'google',
              serviceType: 'google',
              mode: 'new',
              workspaceId: 'ws-1',
              userId: 'u-1',
              requestedScopes: ['scope-1'],
              integrationId: null,
              expiresAt: new Date(Date.now() + 60_000),
            },
          ],
          1,
        ]);
        const error = await service
          .handleCallback('google', { code: 'slow-code', state: 'abc' })
          .catch((e: Error) => e);
        expect(error).toBeInstanceOf(BadRequestException);
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

  describe('handleCallbackWithErrorCapture', () => {
    // Service-side wrapper that runs handleCallback and, on a post-state-
    // consumption failure, writes the diagnostic onto the row before
    // re-throwing the same error.

    it('returns the result transparently on success', async () => {
      dataSource.query.mockResolvedValue([
        [
          {
            provider: 'google',
            serviceType: 'google',
            mode: 'new',
            workspaceId: 'ws-1',
            userId: 'u-1',
            requestedScopes: ['scope'],
            integrationId: null,
            expiresAt: new Date(Date.now() + 60_000),
          },
        ],
        1,
      ]);
      const result = await service.handleCallbackWithErrorCapture('google', {
        code: 'c',
        state: 's',
      });
      expect(result.mode).toBe('new');
    });

    it('records callback error via markIntegrationCallbackError on post-state failure', async () => {
      dataSource.query.mockResolvedValue([
        [
          {
            provider: 'google',
            serviceType: 'google',
            mode: 'reauthorize',
            workspaceId: 'ws-1',
            userId: 'u-1',
            requestedScopes: ['scope'],
            integrationId: 'int-1',
            expiresAt: new Date(Date.now() - 60_000),
          },
        ],
        1,
      ]);
      const spy = jest.spyOn(service, 'markIntegrationCallbackError');
      const err = await service
        .handleCallbackWithErrorCapture('google', { code: 'c', state: 's' })
        .catch((e: Error) => e);
      expect(err).toBeInstanceOf(BadRequestException);
      expect(spy).toHaveBeenCalledWith(
        'int-1',
        'ws-1',
        'OAUTH_STATE_EXPIRED',
        expect.stringContaining('expired'),
        // §2: 5번째 extra 인자 — invalid_scope 외에는 undefined (context 에
        // requiresCafe24Approval 없음).
        undefined,
      );
      spy.mockRestore();
    });

    it('does NOT record when no callback context (pre-state-consumption mismatch)', async () => {
      dataSource.query.mockResolvedValue([[], 0]); // DELETE…RETURNING 0 rows
      const spy = jest.spyOn(service, 'markIntegrationCallbackError');
      await service
        .handleCallbackWithErrorCapture('google', { code: 'c', state: 's' })
        .catch(() => undefined);
      expect(spy).not.toHaveBeenCalled();
      spy.mockRestore();
    });

    it('falls back to OAUTH_CALLBACK_FAILED when the error has no response.code', async () => {
      const spy = jest.spyOn(service, 'markIntegrationCallbackError');
      jest.spyOn(service, 'handleCallback').mockImplementation(async () => {
        const raw = new Error('boom') as Error & {
          context?: {
            integrationId: string;
            workspaceId: string;
            mode: string;
          };
        };
        raw.context = {
          integrationId: 'int-2',
          workspaceId: 'ws-1',
          mode: 'reauthorize',
        };
        throw raw;
      });
      await service
        .handleCallbackWithErrorCapture('google', { code: 'c', state: 's' })
        .catch(() => undefined);
      expect(spy).toHaveBeenCalledWith(
        'int-2',
        'ws-1',
        'OAUTH_CALLBACK_FAILED',
        'boom',
        // §2: 5번째 extra 인자 — invalid_scope 외에는 undefined.
        undefined,
      );
      spy.mockRestore();
    });

    it('still re-throws even if recording itself rejects (defence-in-depth)', async () => {
      dataSource.query.mockResolvedValue([
        [
          {
            provider: 'google',
            serviceType: 'google',
            mode: 'reauthorize',
            workspaceId: 'ws-1',
            userId: 'u-1',
            requestedScopes: ['scope'],
            integrationId: 'int-3',
            expiresAt: new Date(Date.now() - 60_000),
          },
        ],
        1,
      ]);
      jest
        .spyOn(service, 'markIntegrationCallbackError')
        .mockRejectedValue(new Error('db down'));
      const err = await service
        .handleCallbackWithErrorCapture('google', { code: 'c', state: 's' })
        .catch((e: Error) => e);
      expect(err).toBeInstanceOf(BadRequestException);
    });
  });

  describe('sanitizeLastErrorMessage', () => {
    it('passes short benign messages through', () => {
      expect(sanitizeLastErrorMessage('invalid_grant')).toBe('invalid_grant');
    });

    it('truncates to LAST_ERROR_MESSAGE_MAX_LEN with ellipsis', () => {
      const long = 'a'.repeat(LAST_ERROR_MESSAGE_MAX_LEN + 50);
      const out = sanitizeLastErrorMessage(long);
      expect(out.length).toBe(LAST_ERROR_MESSAGE_MAX_LEN + 1); // +1 for '…'
      expect(out.endsWith('…')).toBe(true);
    });

    it('masks Bearer tokens', () => {
      expect(
        sanitizeLastErrorMessage('failed: Bearer abc.def.ghi at line 2'),
      ).toBe('failed: *** at line 2');
    });

    it('masks client_secret/access_token/refresh_token assignments', () => {
      expect(
        sanitizeLastErrorMessage(
          'request body: client_secret=verySecret123 & grant_type=auth',
        ),
      ).toBe('request body: *** & grant_type=auth');
      expect(sanitizeLastErrorMessage('access_token: ya29.a0AfH6 fail')).toBe(
        '*** fail',
      );
      expect(
        sanitizeLastErrorMessage('refresh_token=eyJxxx invalid_grant'),
      ).toBe('*** invalid_grant');
    });

    it('masks Authorization header echoes', () => {
      expect(
        sanitizeLastErrorMessage(
          'upstream returned 401 Authorization: Bearer abc',
        ),
      ).toBe('upstream returned 401 ***');
    });

    it('returns input unchanged for empty / non-string', () => {
      expect(sanitizeLastErrorMessage('')).toBe('');
    });

    // SEC-C2 — Cafe24 가 응답에 `client-secret` (하이픈) 또는 `"secret":...`
    // 단독 키워드를 echo 하는 비정상 케이스 대비. 운영 보고 (2026-05-16)
    // 후 패턴 확장.
    it('masks hyphenated client-secret variant', () => {
      expect(
        sanitizeLastErrorMessage('error: client-secret=sk_abc123 invalid'),
      ).toBe('error: *** invalid');
    });

    it('masks standalone "secret:" keyword (JSON-style echo)', () => {
      expect(sanitizeLastErrorMessage('echo: "secret":"verySecret"')).toContain(
        '***',
      );
      expect(
        sanitizeLastErrorMessage('echo: "secret":"verySecret"'),
      ).not.toMatch(/verySecret/);
    });

    it('masks hyphenated access-token / refresh-token / api-key', () => {
      expect(sanitizeLastErrorMessage('access-token=abc def')).toBe('*** def');
      expect(sanitizeLastErrorMessage('api-key=xyz fail')).toBe('*** fail');
    });
  });

  describe('markIntegrationCallbackError', () => {
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

    it('runs sanitizeLastErrorMessage on the stored message', async () => {
      const row = {
        id: 'int-9',
        workspaceId: 'ws-1',
        status: 'pending_install',
        statusReason: null,
        lastError: null,
      };
      integrationRepo.findOne.mockResolvedValue(row);
      await service.markIntegrationCallbackError(
        'int-9',
        'ws-1',
        'OAUTH_TOKEN_EXCHANGE_FAILED',
        'upstream returned 401: Bearer secret-token-123',
      );
      const saved = integrationRepo.save.mock.calls[0][0] as Record<
        string,
        unknown
      >;
      const lastError = saved.lastError as { message: string };
      // Token masked.
      expect(lastError.message).not.toContain('secret-token-123');
      expect(lastError.message).toContain('***');
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
      dataSource.query.mockResolvedValue([[], 0]);
      await expect(
        service.consumePreviewToken('tmp_x', 'ws-1', 'u-1'),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects mismatched owner (filtered at SQL WHERE — returns 0 rows = INVALID)', async () => {
      // workspace_id + user_id 가 WHERE 절에 추가됐으므로 비소유자의 DELETE 는
      // 0 rows 로 반환되어 OAUTH_PREVIEW_INVALID 와 동일한 메시지로 fallthrough.
      // 토큰 존재 여부 자체를 노출하지 않는다.
      dataSource.query.mockResolvedValue([[], 0]);
      await expect(
        service.consumePreviewToken('tmp_x', 'ws-1', 'u-1'),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects expired preview', async () => {
      dataSource.query.mockResolvedValue([
        [
          {
            previewToken: 'tmp_x',
            workspaceId: 'ws-1',
            userId: 'u-1',
            serviceType: 'google',
            credentials: { access_token: 't' },
            tokenExpiresAt: null,
            expiresAt: new Date(Date.now() - 60_000),
          },
        ],
        1,
      ]);
      await expect(
        service.consumePreviewToken('tmp_x', 'ws-1', 'u-1'),
      ).rejects.toThrow(BadRequestException);
    });

    it('returns credentials on success', async () => {
      dataSource.query.mockResolvedValue([
        [
          {
            previewToken: 'tmp_x',
            workspaceId: 'ws-1',
            userId: 'u-1',
            serviceType: 'google',
            credentials: { access_token: 't' },
            tokenExpiresAt: null,
            expiresAt: new Date(Date.now() + 60_000),
          },
        ],
        1,
      ]);
      const result = await service.consumePreviewToken('tmp_x', 'ws-1', 'u-1');
      expect(result.serviceType).toBe('google');
      expect(result.credentials.access_token).toBe('t');
    });

    // SEC-C1/H-5: 옛 동작은 `enc:` prefix 가 없는 plaintext credentials 도
    // `JSON.parse` 해 통과시켰다. 이는 암호화 invariant 를 우회하는 경로를
    // 열어두는 보안 결함이라 hard-fail 로 변경. 이제 plaintext 는
    // `INTEGRATION_CREDENTIALS_INVALID` 로 거부된다.
    it('rejects plaintext (no enc: prefix) credentials as security defense', async () => {
      dataSource.query.mockResolvedValue([
        [
          {
            preview_token: 'tmp_x',
            workspace_id: 'ws-1',
            user_id: 'u-1',
            service_type: 'google',
            credentials: JSON.stringify({ access_token: 't-str' }),
            token_expires_at: null,
            expires_at: new Date(Date.now() + 60_000),
          },
        ],
        1,
      ]);
      await expect(
        service.consumePreviewToken('tmp_x', 'ws-1', 'u-1'),
      ).rejects.toMatchObject({
        response: expect.objectContaining({
          code: 'INTEGRATION_CREDENTIALS_INVALID',
        }),
      });
    });

    it('rejects with BadRequest when raw credentials string is corrupt (not unhandled 500)', async () => {
      dataSource.query.mockResolvedValue([
        [
          {
            preview_token: 'tmp_x',
            workspace_id: 'ws-1',
            user_id: 'u-1',
            service_type: 'google',
            credentials: '{ not-valid-json',
            token_expires_at: null,
            expires_at: new Date(Date.now() + 60_000),
          },
        ],
        1,
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

  // E-3: 단독 단위 테스트 — handleCallbackWithErrorCapture 의 의존을 떼고
  // null/primitive 등 비정상 throw 입력의 안전 분기를 잠근다.
  describe('callbackContextOf', () => {
    it('returns the attached context for a normal Error with attachCallbackContext', () => {
      const ctx = {
        integrationId: 'i-1',
        workspaceId: 'ws-1',
        mode: 'connect' as const,
      };
      const err = attachCallbackContext(new Error('boom'), ctx);
      expect(callbackContextOf(err)).toEqual(ctx);
    });

    it('returns undefined for an Error without context attached', () => {
      expect(callbackContextOf(new Error('boom'))).toBeUndefined();
    });

    it('returns undefined for null', () => {
      expect(callbackContextOf(null)).toBeUndefined();
    });

    it('returns undefined for undefined', () => {
      expect(callbackContextOf(undefined)).toBeUndefined();
    });

    it.each([
      ['string', 'oops'],
      ['number', 42],
      ['boolean', true],
      ['bigint', 1n],
    ])('returns undefined for primitive: %s', (_label, value) => {
      expect(callbackContextOf(value)).toBeUndefined();
    });

    it('returns undefined for a plain object without a `context` key', () => {
      expect(callbackContextOf({ message: 'x' })).toBeUndefined();
    });

    it('returns the raw context value even when undefined was attached', () => {
      // 'context' in err 가 true 이면 attach 자체는 일어났다는 의미라
      // attach 한 값(undefined 포함) 을 그대로 surface 한다.
      const err: { context?: unknown } = { context: undefined };
      expect(callbackContextOf(err)).toBeUndefined();
    });
  });
});
