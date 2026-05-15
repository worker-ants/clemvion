import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { createHmac } from 'crypto';
import { IntegrationOAuthService } from './integration-oauth.service';
import { encryptJson } from './services/credentials-transformer';

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
      // appUrl must include the install_token path segment so Cafe24 can
      // hit our single-row lookup endpoint. New namespace
      // /api/3rd-party/cafe24/install/<22-char base64url> — see
      // spec/2-navigation/4-integration.md §9.2 Rationale "Cafe24 App URL
      // 100자 한도 대응".
      expect(r.appUrl).toMatch(
        /\/api\/3rd-party\/cafe24\/install\/[A-Za-z0-9_-]{22}$/,
      );
      expect(r.callbackUrl).toContain('/api/3rd-party/cafe24/callback');

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
      // Credentials changed (old-cid → cid) → token refreshed.
      expect(saved.installToken).not.toBe('old-token');
      // Credentials replaced with new submission.
      const creds = saved.credentials as Record<string, unknown>;
      expect(creds.client_id).toBe('cid');
      expect(creds.client_secret).toBe('csec');
    });

    /**
     * Idempotent begin (2026-05-15) — `existingPending` 재사용 시 credentials
     * 가 동일하면 install_token 을 **보존**한다. 옛 동작은 매 호출 토큰을
     * 재발급해 사용자가 Cafe24 Developers 에 등록한 URL 이 갑자기 무효화되는
     * UX 버그가 있었다.
     */
    it('preserves install_token on reuse when credentials are unchanged (idempotent begin)', async () => {
      const existingPending = {
        id: 'existing-pending',
        workspaceId: 'ws-1',
        status: 'pending_install',
        serviceType: 'cafe24',
        installToken: 'preserved-token',
        installTokenIssuedAt: new Date('2026-05-15T00:00:00Z'),
        credentials: {
          mall_id: 'priv-shop',
          app_type: 'private',
          client_id: 'cid',
          client_secret: 'csec',
          scopes: ['mall.read_product'],
        },
        statusReason: null,
        lastError: null,
      };
      integrationRepo.find = jest.fn().mockResolvedValue([existingPending]);

      const result = await service.begin(privateBeginParams());
      const r = result as { appUrl: string; integrationId: string };
      expect(r.integrationId).toBe('existing-pending');
      // URL must carry the preserved token so the user can keep the
      // already-registered Cafe24 Developers App URL.
      expect(r.appUrl).toContain('preserved-token');
      // The save call must NOT overwrite the token.
      const saved = integrationRepo.save.mock.calls[0][0] as Record<
        string,
        unknown
      >;
      expect(saved.installToken).toBe('preserved-token');
    });

    it('refreshes install_token when client_id changes (credentials differ)', async () => {
      const existingPending = {
        id: 'existing-pending',
        workspaceId: 'ws-1',
        status: 'pending_install',
        serviceType: 'cafe24',
        installToken: 'preserved-token',
        installTokenIssuedAt: new Date('2026-05-15T00:00:00Z'),
        credentials: {
          mall_id: 'priv-shop',
          app_type: 'private',
          client_id: 'different-cid',
          client_secret: 'csec',
          scopes: ['mall.read_product'],
        },
        statusReason: null,
        lastError: null,
      };
      integrationRepo.find = jest.fn().mockResolvedValue([existingPending]);

      await service.begin(privateBeginParams());
      const saved = integrationRepo.save.mock.calls[0][0] as Record<
        string,
        unknown
      >;
      expect(saved.installToken).not.toBe('preserved-token');
    });

    it('issues a new install_token when existing row has null token (legacy / cleared)', async () => {
      const existingPending = {
        id: 'existing-pending',
        workspaceId: 'ws-1',
        status: 'pending_install',
        serviceType: 'cafe24',
        installToken: null,
        installTokenIssuedAt: null,
        credentials: {
          mall_id: 'priv-shop',
          app_type: 'private',
          client_id: 'cid',
          client_secret: 'csec',
          scopes: ['mall.read_product'],
        },
        statusReason: null,
        lastError: null,
      };
      integrationRepo.find = jest.fn().mockResolvedValue([existingPending]);

      await service.begin(privateBeginParams());
      const saved = integrationRepo.save.mock.calls[0][0] as Record<
        string,
        unknown
      >;
      expect(saved.installToken).toBeTruthy();
      expect(typeof saved.installToken).toBe('string');
      expect((saved.installToken as string).length).toBe(22);
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
    // 16바이트 base64url = 22자 (spec/2-navigation/4-integration.md §9.2)
    const INSTALL_TOKEN = 'AbCdEfGhIjKlMnOpQrStUv';

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

    /**
     * 회귀 보호 (2026-05-15 — install 404 자동 회복) — 사용자가 Cafe24
     * Developers 에 등록한 App URL 이 stale token (예: 폼 재제출로 token 이
     * 재발급되었지만 Cafe24 측 URL 갱신을 잊은 케이스) 일 때, 같은 mall_id 의
     * pending_install row 의 client_secret 으로 HMAC 검증이 통과하면 그 row 의
     * OAuth 흐름으로 자동 fall-through 한다.
     */
    it('recovery — stale URL falls through to current pending_install row when HMAC validates against its client_secret', async () => {
      const validTs = Math.floor(Date.now() / 1000);
      // 사용자의 URL token (DB 에는 없음) — 옛 token 시뮬레이션
      const staleUrlToken = 'STALE_TOKEN_______ABC_'; // 22 chars base64url
      // DB 에는 현재 token (다른 값) 으로 row 가 존재
      const currentRow = makePendingRow({
        installToken: 'CURRENT_TOKEN_____xyz_', // 22 chars
      });
      const rawQuery = buildRawQuery(validTs);
      const params = new URLSearchParams(rawQuery);

      // 1차 findOne (urlToken 으로 검색) → null
      // 2차 find (mallId 로 검색) → [currentRow]
      integrationRepo.findOne.mockResolvedValueOnce(null);
      integrationRepo.find.mockResolvedValueOnce([currentRow]);

      const result = await service.handleInstall(staleUrlToken, {
        mall_id: 'priv-shop',
        timestamp: String(validTs),
        hmac: params.get('hmac')!,
        rawQuery,
      });

      // 정상 OAuth authorize URL 로 진행
      expect(result).toContain(
        'https://priv-shop.cafe24api.com/api/v2/oauth/authorize',
      );
      expect(result).toContain('client_id=priv-client-id');

      // OAuthState 가 currentRow.id 로 생성됨 (recovery 성공)
      expect(stateRepo.save).toHaveBeenCalledTimes(1);
      const savedState = stateRepo.create.mock.calls[0][0] as Record<
        string,
        unknown
      >;
      expect(savedState.integrationId).toBe('integration-1');
    });

    it('recovery — does NOT recover when HMAC fails against all candidates (real attacker scenario)', async () => {
      const validTs = Math.floor(Date.now() / 1000);
      const staleUrlToken = 'STALE_TOKEN_______ABC_';
      const currentRow = makePendingRow({
        installToken: 'CURRENT_TOKEN_____xyz_',
      });
      // HMAC 을 잘못된 secret 으로 계산 — 어떤 후보로도 검증 불가
      const rawQuery = buildRawQuery(validTs, 'attacker-secret');
      const params = new URLSearchParams(rawQuery);

      integrationRepo.findOne.mockResolvedValueOnce(null);
      integrationRepo.find.mockResolvedValueOnce([currentRow]);

      const error = await service
        .handleInstall(staleUrlToken, {
          mall_id: 'priv-shop',
          timestamp: String(validTs),
          hmac: params.get('hmac')!,
          rawQuery,
        })
        .catch((e: Error) => e);
      const code = (error as { response?: { code?: string } }).response?.code;
      expect(code).toBe('CAFE24_INSTALL_INVALID_TOKEN');
      expect(stateRepo.save).not.toHaveBeenCalled();
    });

    it('recovery — does NOT recover when multiple candidates pass HMAC (ambiguous workspaces)', async () => {
      const validTs = Math.floor(Date.now() / 1000);
      const staleUrlToken = 'STALE_TOKEN_______ABC_';
      // 두 row 모두 동일 client_secret 보유 — 어느 row 로 진행할지 모호
      const row1 = makePendingRow({
        id: 'int-1',
        workspaceId: 'ws-1',
        installToken: 'WS1_TOKEN_________xyz_',
      });
      const row2 = makePendingRow({
        id: 'int-2',
        workspaceId: 'ws-2',
        installToken: 'WS2_TOKEN_________abc_',
      });
      const rawQuery = buildRawQuery(validTs);
      const params = new URLSearchParams(rawQuery);

      integrationRepo.findOne.mockResolvedValueOnce(null);
      integrationRepo.find.mockResolvedValueOnce([row1, row2]);

      const error = await service
        .handleInstall(staleUrlToken, {
          mall_id: 'priv-shop',
          timestamp: String(validTs),
          hmac: params.get('hmac')!,
          rawQuery,
        })
        .catch((e: Error) => e);
      const code = (error as { response?: { code?: string } }).response?.code;
      expect(code).toBe('CAFE24_INSTALL_INVALID_TOKEN');
      expect(stateRepo.save).not.toHaveBeenCalled();
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

      // Single-row lookup, not the old in-memory scan. Status is NOT in
      // the where clause — `install_token` 의 V045 partial UNIQUE 가
      // 결과를 단일 row 로 강제하고, status 분기는 lookup 후 처리한다
      // (post-install navigation 흐름 추가 — 2026-05-15).
      expect(integrationRepo.findOne).toHaveBeenCalledWith({
        where: {
          installToken: INSTALL_TOKEN,
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

    /**
     * 회귀 보호 (2026-05-15 — post-install navigation) — Cafe24 의
     * "앱으로 가기" 버튼이 같은 App URL 을 재호출. status='connected'
     * 인 통합에 대해서는 OAuth authorize 가 아닌 우리 frontend 의 통합
     * 상세 페이지로 302 한다.
     */
    it('redirects to frontend integrations page when row status is connected (post-install navigation)', async () => {
      integrationRepo.findOne.mockResolvedValue(
        makePendingRow({ status: 'connected', installToken: INSTALL_TOKEN }),
      );
      const originalFrontend = process.env.FRONTEND_URL;
      process.env.FRONTEND_URL = 'https://app.example.com';

      try {
        const validTs = Math.floor(Date.now() / 1000);
        const rawQuery = buildRawQuery(validTs);
        const params = new URLSearchParams(rawQuery);

        const url = await service.handleInstall(INSTALL_TOKEN, {
          mall_id: 'priv-shop',
          timestamp: String(validTs),
          hmac: params.get('hmac')!,
          rawQuery,
        });

        expect(url).toBe('https://app.example.com/integrations/integration-1');
        // Must NOT generate an OAuthState — no OAuth re-auth on post-install nav.
        expect(stateRepo.save).not.toHaveBeenCalled();
      } finally {
        if (originalFrontend === undefined) delete process.env.FRONTEND_URL;
        else process.env.FRONTEND_URL = originalFrontend;
      }
    });

    it.each(['error', 'expired'] as const)(
      'redirects to frontend for status=%s (post-install nav also works for non-connected non-pending rows)',
      async (status) => {
        integrationRepo.findOne.mockResolvedValue(
          makePendingRow({ status, installToken: INSTALL_TOKEN }),
        );
        const originalFrontend = process.env.FRONTEND_URL;
        process.env.FRONTEND_URL = 'https://app.example.com';

        try {
          const validTs = Math.floor(Date.now() / 1000);
          const rawQuery = buildRawQuery(validTs);
          const params = new URLSearchParams(rawQuery);

          const url = await service.handleInstall(INSTALL_TOKEN, {
            mall_id: 'priv-shop',
            timestamp: String(validTs),
            hmac: params.get('hmac')!,
            rawQuery,
          });

          expect(url).toBe(
            'https://app.example.com/integrations/integration-1',
          );
          expect(stateRepo.save).not.toHaveBeenCalled();
        } finally {
          if (originalFrontend === undefined) delete process.env.FRONTEND_URL;
          else process.env.FRONTEND_URL = originalFrontend;
        }
      },
    );

    it('still rejects bad HMAC on connected row (no bypass on post-install nav)', async () => {
      integrationRepo.findOne.mockResolvedValue(
        makePendingRow({ status: 'connected', installToken: INSTALL_TOKEN }),
      );

      const validTs = Math.floor(Date.now() / 1000);
      // Use the WRONG secret to force HMAC mismatch.
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

      // TypeORM 0.3.x PostgresQueryRunner: DELETE/UPDATE returns
      // `[rowsArray, rowCount]` tuple, not a flat rows array.
      dataSource.query.mockResolvedValueOnce([[stateRecord], 1]);

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

      // TypeORM 0.3.x PostgresQueryRunner: DELETE/UPDATE returns
      // `[rowsArray, rowCount]` tuple, not a flat rows array.
      dataSource.query.mockResolvedValueOnce([[stateRecord], 1]);

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

      // TypeORM 0.3.x PostgresQueryRunner: DELETE/UPDATE returns
      // `[rowsArray, rowCount]` tuple, not a flat rows array.
      dataSource.query.mockResolvedValueOnce([[stateRecord], 1]);

      const result = await service.handleCallback('cafe24', {
        code: 'authz-code',
        state: 'state-token-3',
      });

      expect(result.mode).toBe('reauthorize');
      expect(result.integrationId).toBe('pending-int-id');

      // Integration must be saved with connected status. installToken is
      // PRESERVED (not cleared) — needed for post-install navigation
      // (카페24 "앱으로 가기" 버튼의 App URL 재호출 식별 키).
      expect(integrationRepo.save).toHaveBeenCalledTimes(1);
      const savedIntegration = integrationRepo.save.mock.calls[0][0] as Record<
        string,
        unknown
      >;
      expect(savedIntegration.status).toBe('connected');
      expect(savedIntegration.installToken).toBe('some-install-token');
      expect(savedIntegration.statusReason).toBeNull();
      expect(savedIntegration.lastError).toBeNull();
    });

    /**
     * 회귀 보호: production raw SQL `DELETE...RETURNING` 의 실제 응답은
     * snake_case column + encrypted `provider_meta` envelope 문자열이다.
     * normalizeRawStateRow 가 두 조건을 모두 처리하지 못하면 callback 이
     * `mall_id missing on OAuth state — cannot build token URL` 로 실패한다
     * (2026-05-15 운영 보고 사례).
     */
    it('handles production raw SQL shape — snake_case + encrypted provider_meta', async () => {
      const pendingIntegration = {
        id: 'pending-int-prod',
        workspaceId: 'ws-1',
        status: 'pending_install',
        credentials: {
          mall_id: 'gehrig0301',
          app_type: 'private',
          client_id: 'prod-cid',
          client_secret: 'prod-secret',
          scopes: ['mall.read_product'],
        },
        installToken: 'install-token-prod',
        statusReason: null,
        lastError: null,
        tokenExpiresAt: null,
        lastRotatedAt: null,
      };
      integrationRepo.findOne = jest.fn().mockResolvedValue(pendingIntegration);

      // raw row matches what PostgreSQL DELETE...RETURNING actually returns:
      // snake_case column names + encrypted provider_meta envelope string.
      const rawStateRow = {
        id: 'state-prod',
        state: 'state-token-prod',
        workspace_id: 'ws-1',
        user_id: 'u-1',
        provider: 'cafe24',
        service_type: 'cafe24',
        mode: 'reauthorize',
        integration_id: 'pending-int-prod',
        requested_scopes: ['mall.read_product'],
        integration_name: 'gehrig0301 (Cafe24 Private)',
        scope: 'personal',
        provider_meta: encryptJson({
          mall_id: 'gehrig0301',
          app_type: 'private',
          client_id: 'prod-cid',
          client_secret: 'prod-secret',
        }),
        expires_at: new Date(Date.now() + 60_000),
        created_at: new Date(),
      };
      dataSource.query.mockResolvedValueOnce([[rawStateRow], 1]);

      const result = await service.handleCallback('cafe24', {
        code: 'authz-code-prod',
        state: 'state-token-prod',
      });

      expect(result.mode).toBe('reauthorize');
      expect(result.provider).toBe('cafe24');
      expect(result.integrationId).toBe('pending-int-prod');

      // Integration transitioned to connected — exchange used decrypted
      // provider_meta.mall_id (would have failed with CAFE24_INVALID_MALL_ID
      // if the normalizer didn't decrypt the envelope). installToken is
      // PRESERVED (for post-install navigation re-call).
      const savedIntegration = integrationRepo.save.mock.calls[0][0] as Record<
        string,
        unknown
      >;
      expect(savedIntegration.status).toBe('connected');
      expect(savedIntegration.installToken).toBe('install-token-prod');
    });

    /**
     * 회귀 보호 (2026-05-15) — Cafe24 의 `/api/v2/oauth/token` 은 Basic auth
     * **만** 받고 body 에 client_id/client_secret 을 같이 넣으면
     * `invalid_request: The request is invalid. check the request parameters.`
     * 로 거부한다. 이 테스트는 real fetch path 에서:
     *   1. Authorization 헤더에 Basic <base64(client_id:client_secret)> 포함
     *   2. request body 에는 client_id / client_secret 미포함 (grant_type +
     *      code + redirect_uri 만)
     * 둘 다 검증한다.
     */
    /**
     * 회귀 보호 (2026-05-15 — 2차) — Cafe24 는 `scopes` 필드를 **배열로**
     * 반환한다 (OAuth 표준의 `scope` 문자열이 아님). 옛 코드는 array 파싱이
     * 없어 항상 requestedScopes 로 fallback → 사용자에게 "권한 부여 완료" 로
     * 표시되지만 실제 token 은 더 적은 scope 만 보유 → API 호출 시 403.
     */
    it('cafe24 token exchange stores Cafe24-returned scopes ARRAY (not requested scopes fallback)', async () => {
      delete process.env.OAUTH_STUB_MODE;
      const originalFetch = global.fetch;
      const fetchMock = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          access_token: 'tok-cafe24',
          refresh_token: 'refresh-cafe24',
          expires_in: 7200,
          // Cafe24 returns scopes as ARRAY — and possibly narrower than
          // what we requested (app-level permission setting).
          scopes: ['mall.read_product'],
        }),
        text: async () => '',
      });
      (global as { fetch: jest.Mock }).fetch = fetchMock;

      integrationRepo.findOne = jest.fn().mockResolvedValue({
        id: 'int-cafe24-scopes',
        workspaceId: 'ws-1',
        status: 'pending_install',
        credentials: {
          mall_id: 'priv-shop',
          app_type: 'private',
          client_id: 'priv-cid',
          client_secret: 'priv-secret',
          scopes: ['mall.read_product', 'mall.write_product'],
        },
        installToken: 'token',
      });

      const stateRecord = {
        id: 'state-scopes-array',
        state: 'state-scopes-array',
        workspaceId: 'ws-1',
        userId: 'u-1',
        provider: 'cafe24',
        serviceType: 'cafe24',
        mode: 'reauthorize',
        integrationId: 'int-cafe24-scopes',
        // We REQUESTED two scopes, but Cafe24 only grants one.
        requestedScopes: ['mall.read_product', 'mall.write_product'],
        integrationName: 'priv-shop (Cafe24 Private)',
        scope: 'personal',
        providerMeta: {
          mall_id: 'priv-shop',
          app_type: 'private',
          client_id: 'priv-cid',
          client_secret: 'priv-secret',
        },
        expiresAt: new Date(Date.now() + 60_000),
        createdAt: new Date(),
      };
      dataSource.query.mockResolvedValueOnce([[stateRecord], 1]);

      try {
        await service.handleCallback('cafe24', {
          code: 'authz-code',
          state: 'state-scopes-array',
        });

        const savedIntegration = integrationRepo.save.mock
          .calls[0][0] as Record<string, unknown>;
        const creds = savedIntegration.credentials as Record<string, unknown>;
        // Stored scopes must be what Cafe24 ACTUALLY granted (1), not what
        // we requested (2). Without this, the UI silently shows the wrong
        // permissions to the user.
        expect(creds.scopes).toEqual(['mall.read_product']);
      } finally {
        global.fetch = originalFetch;
        process.env.OAUTH_STUB_MODE = 'true';
      }
    });

    it('cafe24 token exchange uses Basic auth ONLY (no client_id/secret in body)', async () => {
      delete process.env.OAUTH_STUB_MODE;
      const originalFetch = global.fetch;
      const fetchMock = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          access_token: 'tok-cafe24',
          refresh_token: 'refresh-cafe24',
          expires_in: 7200,
          scopes: 'mall.read_product',
        }),
        text: async () => '',
      });
      (global as { fetch: jest.Mock }).fetch = fetchMock;

      integrationRepo.findOne = jest.fn().mockResolvedValue({
        id: 'int-cafe24',
        workspaceId: 'ws-1',
        status: 'pending_install',
        credentials: {
          mall_id: 'priv-shop',
          app_type: 'private',
          client_id: 'priv-cid',
          client_secret: 'priv-secret',
          scopes: ['mall.read_product'],
        },
        installToken: 'token',
      });

      const stateRecord = {
        id: 'state-token-auth',
        state: 'state-token-auth',
        workspaceId: 'ws-1',
        userId: 'u-1',
        provider: 'cafe24',
        serviceType: 'cafe24',
        mode: 'reauthorize',
        integrationId: 'int-cafe24',
        requestedScopes: ['mall.read_product'],
        integrationName: 'priv-shop (Cafe24 Private)',
        scope: 'personal',
        providerMeta: {
          mall_id: 'priv-shop',
          app_type: 'private',
          client_id: 'priv-cid',
          client_secret: 'priv-secret',
        },
        expiresAt: new Date(Date.now() + 60_000),
        createdAt: new Date(),
      };
      dataSource.query.mockResolvedValueOnce([[stateRecord], 1]);

      try {
        await service.handleCallback('cafe24', {
          code: 'authz-code',
          state: 'state-token-auth',
        });

        expect(fetchMock).toHaveBeenCalledTimes(1);
        const [url, init] = fetchMock.mock.calls[0] as [
          string,
          { headers: Record<string, string>; body: string },
        ];
        expect(url).toBe('https://priv-shop.cafe24api.com/api/v2/oauth/token');
        // Authorization header present with Basic auth.
        expect(init.headers.Authorization).toBe(
          'Basic ' + Buffer.from('priv-cid:priv-secret').toString('base64'),
        );
        // Body must NOT contain client_id / client_secret — Cafe24 rejects
        // duplicated credentials.
        const bodyParams = new URLSearchParams(init.body);
        expect(bodyParams.has('client_id')).toBe(false);
        expect(bodyParams.has('client_secret')).toBe(false);
        // Body must contain the standard OAuth grant params.
        expect(bodyParams.get('grant_type')).toBe('authorization_code');
        expect(bodyParams.get('code')).toBe('authz-code');
        expect(bodyParams.get('redirect_uri')).toContain(
          '/api/3rd-party/cafe24/callback',
        );
      } finally {
        global.fetch = originalFetch;
        process.env.OAUTH_STUB_MODE = 'true';
      }
    });
  });
});
