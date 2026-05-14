import { BadRequestException } from '@nestjs/common';
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

    it('private app — persists client_id/secret on provider_meta', async () => {
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

      expect(result.authUrl).toContain(
        'https://priv-shop.cafe24api.com/api/v2/oauth/authorize',
      );
      expect(result.authUrl).toContain('client_id=priv-client-id');
      // The private app secret must NEVER appear in the authorize URL —
      // it only travels server-to-server during the token exchange step.
      // Guards against accidental future regressions that might put it
      // on the wire as a query parameter (browser history / Referer /
      // proxy access logs would leak it otherwise).
      expect(result.authUrl).not.toContain('client_secret');
      expect(result.authUrl).not.toContain('priv-client-secret');
      const saved = stateRepo.save.mock.calls[0][0] as Record<string, unknown>;
      expect(saved.providerMeta).toEqual({
        mall_id: 'priv-shop',
        app_type: 'private',
        client_id: 'priv-client-id',
        client_secret: 'priv-client-secret',
      });
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
  });
});
