import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { createHmac } from 'crypto';
import { IntegrationOAuthService } from './integration-oauth.service';

type Mock = jest.Mock;

function makeQueryBuilder(results: unknown[] = []) {
  const qb: Record<string, Mock> = {
    where: jest.fn(),
    andWhere: jest.fn(),
    take: jest.fn(),
    getMany: jest.fn().mockResolvedValue(results),
  };
  qb.where.mockReturnValue(qb);
  qb.andWhere.mockReturnValue(qb);
  qb.take.mockReturnValue(qb);
  return qb;
}

function computeTestHmac(rawQuery: string, secret: string): string {
  const params = new URLSearchParams(rawQuery);
  params.delete('hmac');
  const message = [...params.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
    .join('&');
  return createHmac('sha256', secret).update(message, 'utf8').digest('base64');
}

function makeRepo(): Record<string, Mock> {
  return {
    create: jest.fn().mockImplementation((data: unknown) => data),
    save: jest
      .fn()
      .mockImplementation((entity: unknown) => Promise.resolve(entity)),
    find: jest.fn().mockResolvedValue([]),
    findOne: jest.fn().mockResolvedValue(null),
    delete: jest.fn().mockResolvedValue(undefined),
    createQueryBuilder: jest.fn().mockImplementation(() => makeQueryBuilder()),
  };
}

describe('IntegrationOAuthService — Cafe24', () => {
  let service: IntegrationOAuthService;
  let integrationRepo: Record<string, Mock>;
  let stateRepo: Record<string, Mock>;
  let previewRepo: Record<string, Mock>;
  let dataSource: { query: Mock; transaction: Mock };

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
    process.env.CAFE24_CLIENT_ID = 'test-cafe24-client-id';
    process.env.CAFE24_CLIENT_SECRET = 'test-cafe24-client-secret';

    service = new IntegrationOAuthService(
      integrationRepo as never,
      stateRepo as never,
      previewRepo as never,
      dataSource as never,
    );
  });

  afterEach(() => {
    delete process.env.OAUTH_STUB_MODE;
    delete process.env.CAFE24_CLIENT_ID;
    delete process.env.CAFE24_CLIENT_SECRET;
  });

  describe('begin — validation', () => {
    it('throws CAFE24_INVALID_MALL_ID when mall_id is missing', async () => {
      await expect(
        service.begin({
          workspaceId: 'ws-1',
          userId: 'u-1',
          service: 'cafe24',
          scopes: ['mall.read_product'],
          mode: 'new',
          providerMeta: { app_type: 'public' },
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects mall_id with invalid characters', async () => {
      await expect(
        service.begin({
          workspaceId: 'ws-1',
          userId: 'u-1',
          service: 'cafe24',
          scopes: [],
          mode: 'new',
          providerMeta: { mall_id: 'BAD shop!', app_type: 'public' },
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects mall_id shorter than 3 chars', async () => {
      await expect(
        service.begin({
          workspaceId: 'ws-1',
          userId: 'u-1',
          service: 'cafe24',
          scopes: [],
          mode: 'new',
          providerMeta: { mall_id: 'ab', app_type: 'public' },
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws CAFE24_INVALID_APP_TYPE when app_type missing', async () => {
      await expect(
        service.begin({
          workspaceId: 'ws-1',
          userId: 'u-1',
          service: 'cafe24',
          scopes: [],
          mode: 'new',
          providerMeta: { mall_id: 'myshop' },
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('private app rejects begin without client_id/secret', async () => {
      await expect(
        service.begin({
          workspaceId: 'ws-1',
          userId: 'u-1',
          service: 'cafe24',
          scopes: [],
          mode: 'new',
          providerMeta: { mall_id: 'myshop', app_type: 'private' },
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('public app rejects when CAFE24_CLIENT_ID env is missing', async () => {
      delete process.env.CAFE24_CLIENT_ID;
      await expect(
        service.begin({
          workspaceId: 'ws-1',
          userId: 'u-1',
          service: 'cafe24',
          scopes: [],
          mode: 'new',
          providerMeta: { mall_id: 'myshop', app_type: 'public' },
        }),
      ).rejects.toThrow(/CAFE24_CLIENT_ID|OAUTH_CONFIG_MISSING/);
    });
  });

  describe('begin — happy path', () => {
    it('public app — saves state with provider_meta and returns mall-specific authorize URL', async () => {
      const result = await service.begin({
        workspaceId: 'ws-1',
        userId: 'u-1',
        service: 'cafe24',
        scopes: ['mall.read_product', 'mall.write_order'],
        mode: 'new',
        providerMeta: { mall_id: 'myshop', app_type: 'public' },
      });

      expect(result.authUrl).toMatch(
        /^https:\/\/myshop\.cafe24api\.com\/api\/v2\/oauth\/authorize\?/,
      );
      // Cafe24 deviates from RFC 6749 §3.3 and demands comma-delimited
      // scopes (NOT space). Sending space ('+' after URL encoding) makes
      // Cafe24 treat the whole string as a single token and reject even
      // a 1-scope request with `invalid_scope`. Verify the wire format
      // explicitly so a future "fix" reverting to .join(' ') is caught.
      expect(result.authUrl).toContain(
        'scope=mall.read_product%2Cmall.write_order',
      );
      expect(result.authUrl).not.toContain(
        'mall.read_product+mall.write_order',
      );
      expect(result.authUrl).not.toContain(
        'mall.read_product%20mall.write_order',
      );
      expect(result.state).toHaveLength(48);
      expect(stateRepo.save).toHaveBeenCalledTimes(1);
      const saved = stateRepo.save.mock.calls[0][0] as Record<string, unknown>;
      expect(saved.provider).toBe('cafe24');
      expect(saved.serviceType).toBe('cafe24');
      expect(saved.providerMeta).toEqual({
        mall_id: 'myshop',
        app_type: 'public',
      });
    });

    it('private app — creates pending_install integration and returns pending result', async () => {
      integrationRepo.save = jest
        .fn()
        .mockResolvedValue({ id: 'pending-integration-id' });

      const result = await service.begin({
        workspaceId: 'ws-1',
        userId: 'u-1',
        service: 'cafe24',
        scopes: ['mall.read_product'],
        mode: 'new',
        providerMeta: {
          mall_id: 'priv-shop',
          app_type: 'private',
          client_id: 'priv-client-id',
          client_secret: 'priv-client-secret',
        },
      });

      // New private-app flow: no popup — returns pending indicator instead.
      expect(result).toMatchObject({
        mode: 'cafe24_private_pending',
        integrationId: 'pending-integration-id',
      });
      const r = result as { appUrl: string; callbackUrl: string };
      // appUrl must include the install_token path segment so cafe24
      // Developers can call our single-row lookup endpoint (V043).
      expect(r.appUrl).toMatch(/\/oauth\/install\/cafe24\/[a-f0-9]{64}$/);
      expect(r.callbackUrl).toContain('/oauth/callback/cafe24');

      // Integration saved with pending_install status and credentials embedded.
      expect(integrationRepo.save).toHaveBeenCalledTimes(1);
      const created = integrationRepo.create.mock.calls[0][0] as Record<
        string,
        unknown
      >;
      expect(created.status).toBe('pending_install');
      expect(created.serviceType).toBe('cafe24');
      const creds = created.credentials as Record<string, unknown>;
      expect(creds.client_id).toBe('priv-client-id');
      expect(creds.client_secret).toBe('priv-client-secret');

      // No state row yet (state is created later in handleInstall).
      expect(stateRepo.save).not.toHaveBeenCalled();
      // No authUrl — the browser never opens a popup for private apps.
      expect((result as Record<string, unknown>).authUrl).toBeUndefined();
    });
  });

  describe('begin — private app duplicate prevention', () => {
    function privateBeginParams() {
      return {
        workspaceId: 'ws-1',
        userId: 'u-1',
        service: 'cafe24',
        scopes: ['mall.read_product'],
        mode: 'new' as const,
        providerMeta: {
          mall_id: 'priv-shop',
          app_type: 'private' as const,
          client_id: 'cid',
          client_secret: 'csec',
        },
      };
    }

    it('rejects with 409 when a connected private integration exists for the same mall_id', async () => {
      integrationRepo.find = jest.fn().mockResolvedValue([
        {
          id: 'existing-connected',
          workspaceId: 'ws-1',
          status: 'connected',
          serviceType: 'cafe24',
          credentials: { mall_id: 'priv-shop', app_type: 'private' },
        },
      ]);
      const error = await service
        .begin(privateBeginParams())
        .catch((e: Error) => e);
      const response = (error as { response?: { code?: string } }).response;
      expect(response?.code).toBe('CAFE24_PRIVATE_APP_ALREADY_CONNECTED');
      // No row should be created — the duplicate guard fires before save.
      expect(integrationRepo.save).not.toHaveBeenCalled();
    });

    it('reuses an existing pending_install row instead of creating a duplicate', async () => {
      const existingPending = {
        id: 'existing-pending',
        workspaceId: 'ws-1',
        status: 'pending_install',
        serviceType: 'cafe24',
        installToken: 'old-token',
        credentials: {
          mall_id: 'priv-shop',
          app_type: 'private',
          client_id: 'old-cid',
          client_secret: 'old-csec',
          scopes: [],
        },
        statusReason: 'oauth_token_exchange_failed',
        lastError: { code: 'OAUTH_TOKEN_EXCHANGE_FAILED' },
      };
      integrationRepo.find = jest.fn().mockResolvedValue([existingPending]);

      const result = await service.begin(privateBeginParams());
      // The result must point at the SAME integration id (reused).
      const r = result as { integrationId: string };
      expect(r.integrationId).toBe('existing-pending');
      // save called on the existing row, not a fresh create.
      expect(integrationRepo.save).toHaveBeenCalledTimes(1);
      const saved = integrationRepo.save.mock.calls[0][0] as Record<
        string,
        unknown
      >;
      expect(saved.id).toBe('existing-pending');
      // Stale diagnostic cleared on reuse so the user starts from a clean slate.
      expect(saved.statusReason).toBeNull();
      expect(saved.lastError).toBeNull();
      // Token refreshed.
      expect(saved.installToken).not.toBe('old-token');
      // Credentials replaced with new submission.
      const creds = saved.credentials as Record<string, unknown>;
      expect(creds.client_id).toBe('cid');
      expect(creds.client_secret).toBe('csec');
    });

    it('creates a new row when no existing cafe24 private row matches the mall_id', async () => {
      integrationRepo.find = jest.fn().mockResolvedValue([
        // Different mall_id — does not collide.
        {
          id: 'other',
          status: 'connected',
          credentials: { mall_id: 'other-shop', app_type: 'private' },
        },
        // Same mall_id but public — does not collide.
        {
          id: 'public-row',
          status: 'connected',
          credentials: { mall_id: 'priv-shop', app_type: 'public' },
        },
      ]);
      integrationRepo.save.mockImplementation((entity: unknown) =>
        Promise.resolve({ ...(entity as object), id: 'new-id' }),
      );

      const result = await service.begin(privateBeginParams());
      const r = result as { integrationId: string };
      expect(r.integrationId).toBe('new-id');
      // create was called (fresh row), not just save on existing.
      expect(integrationRepo.create).toHaveBeenCalled();
    });
  });

  describe('handleInstall — Cafe24 private app App URL', () => {
    const clientSecret = 'test-private-secret';
    const INSTALL_TOKEN = 'a'.repeat(64);

    function buildRawQuery(
      timestampSec: number,
      secret = clientSecret,
    ): string {
      const base = `is_multi_shop=T&mall_id=priv-shop&timestamp=${timestampSec}&user_id=admin`;
      const hmac = computeTestHmac(base, secret);
      return `${base}&hmac=${encodeURIComponent(hmac)}`;
    }

    function makePendingRow(overrides: Record<string, unknown> = {}) {
      return {
        id: 'integration-1',
        workspaceId: 'ws-1',
        createdBy: 'u-1',
        name: 'priv-shop (Cafe24 Private)',
        scope: 'personal',
        installToken: INSTALL_TOKEN,
        status: 'pending_install',
        serviceType: 'cafe24',
        credentials: {
          mall_id: 'priv-shop',
          app_type: 'private',
          client_id: 'priv-client-id',
          client_secret: clientSecret,
          scopes: ['mall.read_product'],
        },
        ...overrides,
      };
    }

    it('throws CAFE24_INSTALL_REPLAY when timestamp is older than 5 minutes', async () => {
      const staleTs = Math.floor(Date.now() / 1000) - 400;
      const rawQuery = buildRawQuery(staleTs);
      const params = new URLSearchParams(rawQuery);

      await expect(
        service.handleInstall(INSTALL_TOKEN, {
          mall_id: 'priv-shop',
          timestamp: String(staleTs),
          hmac: params.get('hmac')!,
          rawQuery,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws CAFE24_INSTALL_INVALID_TOKEN when install_token is unknown', async () => {
      integrationRepo.findOne.mockResolvedValue(null);

      const validTs = Math.floor(Date.now() / 1000);
      const rawQuery = buildRawQuery(validTs);
      const params = new URLSearchParams(rawQuery);

      const error = await service
        .handleInstall(INSTALL_TOKEN, {
          mall_id: 'priv-shop',
          timestamp: String(validTs),
          hmac: params.get('hmac')!,
          rawQuery,
        })
        .catch((e: Error) => e);
      const code = (error as { response?: { code?: string } }).response?.code;
      expect(code).toBe('CAFE24_INSTALL_INVALID_TOKEN');
    });

    it('throws CAFE24_INSTALL_INVALID_HMAC when HMAC does not verify against the row', async () => {
      integrationRepo.findOne.mockResolvedValue(makePendingRow());

      const validTs = Math.floor(Date.now() / 1000);
      // Compute HMAC with the WRONG secret to force a mismatch.
      const rawQuery = buildRawQuery(validTs, 'attacker-controlled-secret');
      const params = new URLSearchParams(rawQuery);

      await expect(
        service.handleInstall(INSTALL_TOKEN, {
          mall_id: 'priv-shop',
          timestamp: String(validTs),
          hmac: params.get('hmac')!,
          rawQuery,
        }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws CAFE24_INSTALL_INVALID_HMAC when mall_id of the row does not match the query', async () => {
      // install_token row exists but the caller's mall_id differs — defensive
      // path; in practice install_token uniqueness should prevent this.
      integrationRepo.findOne.mockResolvedValue(
        makePendingRow({
          credentials: {
            mall_id: 'different-shop',
            app_type: 'private',
            client_id: 'priv-client-id',
            client_secret: clientSecret,
            scopes: [],
          },
        }),
      );
      const validTs = Math.floor(Date.now() / 1000);
      const rawQuery = buildRawQuery(validTs);
      const params = new URLSearchParams(rawQuery);

      const error = await service
        .handleInstall(INSTALL_TOKEN, {
          mall_id: 'priv-shop',
          timestamp: String(validTs),
          hmac: params.get('hmac')!,
          rawQuery,
        })
        .catch((e: Error) => e);
      const code = (error as { response?: { code?: string } }).response?.code;
      expect(code).toBe('CAFE24_INSTALL_INVALID_HMAC');
    });

    it('returns Cafe24 authorize URL for valid token + HMAC', async () => {
      integrationRepo.findOne.mockResolvedValue(makePendingRow());

      const validTs = Math.floor(Date.now() / 1000);
      const rawQuery = buildRawQuery(validTs);
      const params = new URLSearchParams(rawQuery);

      const authorizeUrl = await service.handleInstall(INSTALL_TOKEN, {
        mall_id: 'priv-shop',
        timestamp: String(validTs),
        hmac: params.get('hmac')!,
        rawQuery,
      });

      expect(authorizeUrl).toContain(
        'https://priv-shop.cafe24api.com/api/v2/oauth/authorize',
      );
      expect(authorizeUrl).toContain('client_id=priv-client-id');
      // client_secret must NEVER leak into the authorize URL.
      expect(authorizeUrl).not.toContain('client_secret');
      expect(authorizeUrl).not.toContain(clientSecret);

      // Single-row lookup, not the old in-memory scan.
      expect(integrationRepo.findOne).toHaveBeenCalledWith({
        where: {
          installToken: INSTALL_TOKEN,
          status: 'pending_install',
          serviceType: 'cafe24',
        },
      });

      expect(stateRepo.save).toHaveBeenCalledTimes(1);
      const savedState = stateRepo.create.mock.calls[0][0] as Record<
        string,
        unknown
      >;
      expect(savedState.mode).toBe('reauthorize');
      expect(savedState.integrationId).toBe('integration-1');
      expect(savedState.provider).toBe('cafe24');
    });
  });

  describe('handleCallback — cafe24 stub flow', () => {
    it('uses state.providerMeta to capture mall_id / app_type into preview credentials', async () => {
      const stateRecord = {
        id: 'state-1',
        state: 'state-token',
        workspaceId: 'ws-1',
        userId: 'u-1',
        provider: 'cafe24',
        serviceType: 'cafe24',
        mode: 'new',
        integrationId: null,
        requestedScopes: ['mall.read_product'],
        integrationName: null,
        scope: null,
        providerMeta: {
          mall_id: 'myshop',
          app_type: 'public',
        },
        expiresAt: new Date(Date.now() + 60_000),
        createdAt: new Date(),
      };

      dataSource.query.mockResolvedValueOnce([stateRecord]);

      const result = await service.handleCallback('cafe24', {
        code: 'authz-code',
        state: 'state-token',
      });

      expect(result.mode).toBe('new');
      expect(result.provider).toBe('cafe24');
      expect(result.previewToken).toMatch(/^tmp_/);

      // Preview row contains the cafe24-specific credentials including
      // mall_id / app_type carried over from state.providerMeta.
      expect(previewRepo.save).toHaveBeenCalledTimes(1);
      const previewArg = previewRepo.save.mock.calls[0][0] as Record<
        string,
        unknown
      >;
      const creds = previewArg.credentials as Record<string, unknown>;
      expect(creds.mall_id).toBe('myshop');
      expect(creds.app_type).toBe('public');
      expect(creds.cafe24_operator_id).toMatch(/^stub-operator-/);
      expect(typeof creds.access_token).toBe('string');
      expect(creds.scopes).toEqual(['mall.read_product']);
    });

    it('private app — preserves client_id/secret on credentials', async () => {
      const stateRecord = {
        id: 'state-2',
        state: 'state-token-2',
        workspaceId: 'ws-1',
        userId: 'u-1',
        provider: 'cafe24',
        serviceType: 'cafe24',
        mode: 'new',
        integrationId: null,
        requestedScopes: [],
        integrationName: null,
        scope: null,
        providerMeta: {
          mall_id: 'priv-shop',
          app_type: 'private',
          client_id: 'priv-id',
          client_secret: 'priv-secret',
        },
        expiresAt: new Date(Date.now() + 60_000),
        createdAt: new Date(),
      };

      dataSource.query.mockResolvedValueOnce([stateRecord]);

      await service.handleCallback('cafe24', {
        code: 'authz-code',
        state: 'state-token-2',
      });

      const previewArg = previewRepo.save.mock.calls[0][0] as Record<
        string,
        unknown
      >;
      const creds = previewArg.credentials as Record<string, unknown>;
      expect(creds.client_id).toBe('priv-id');
      expect(creds.client_secret).toBe('priv-secret');
    });

    it('pending_install integration — transitions to connected and clears installToken', async () => {
      const pendingIntegration = {
        id: 'pending-int-id',
        workspaceId: 'ws-1',
        status: 'pending_install',
        credentials: {
          mall_id: 'priv-shop',
          app_type: 'private',
          client_id: 'priv-id',
          client_secret: 'priv-secret',
          scopes: [],
        },
        installToken: 'some-install-token',
        statusReason: 'oauth_token_exchange_failed',
        lastError: {
          code: 'OAUTH_TOKEN_EXCHANGE_FAILED',
          message: 'previous attempt',
          at: '2026-05-13T00:00:00.000Z',
        },
        tokenExpiresAt: null,
        lastRotatedAt: null,
      };
      integrationRepo.findOne = jest.fn().mockResolvedValue(pendingIntegration);

      const stateRecord = {
        id: 'state-3',
        state: 'state-token-3',
        workspaceId: 'ws-1',
        userId: 'u-1',
        provider: 'cafe24',
        serviceType: 'cafe24',
        mode: 'reauthorize',
        integrationId: 'pending-int-id',
        requestedScopes: ['mall.read_product'],
        integrationName: 'priv-shop (Cafe24 Private)',
        scope: 'personal',
        providerMeta: {
          mall_id: 'priv-shop',
          app_type: 'private',
          client_id: 'priv-id',
          client_secret: 'priv-secret',
        },
        expiresAt: new Date(Date.now() + 60_000),
        createdAt: new Date(),
      };

      dataSource.query.mockResolvedValueOnce([stateRecord]);

      const result = await service.handleCallback('cafe24', {
        code: 'authz-code',
        state: 'state-token-3',
      });

      expect(result.mode).toBe('reauthorize');
      expect(result.integrationId).toBe('pending-int-id');

      // Integration must be saved with connected status and cleared installToken.
      expect(integrationRepo.save).toHaveBeenCalledTimes(1);
      const savedIntegration = integrationRepo.save.mock.calls[0][0] as Record<
        string,
        unknown
      >;
      expect(savedIntegration.status).toBe('connected');
      expect(savedIntegration.installToken).toBeNull();
      expect(savedIntegration.statusReason).toBeNull();
      expect(savedIntegration.lastError).toBeNull();
    });
  });
});
