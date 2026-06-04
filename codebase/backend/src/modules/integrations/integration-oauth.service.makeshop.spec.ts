import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { createHash, createHmac } from 'crypto';
import {
  IntegrationOAuthService,
  buildMakeshopHmacMessage,
  generatePkcePair,
  type MakeshopInstallQuery,
} from './integration-oauth.service';

type Mock = jest.Mock;

/**
 * Mirrors production `buildMakeshopHmacMessage` — drop `hmac`, sort entries by
 * key, preserve raw URL-encoded values. ⚠ Both compute + verify use the same
 * algorithm; the production note (spec §9.7) flags the message construction as
 * an open question to confirm against makeshop docs.
 */
function computeMakeshopHmac(rawQuery: string, secret: string): string {
  const message = buildMakeshopHmacMessage(rawQuery);
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
    createQueryBuilder: jest.fn(),
  };
}

function buildFakeMakeshopIntegration(
  overrides: Partial<{
    id: string;
    workspaceId: string;
    createdBy: string;
    name: string;
    status: string;
    mallId: string | null;
    clientId: string;
    clientSecret: string;
    scopes: string[];
    installToken: string | null;
    scope: string;
  }> = {},
): Record<string, unknown> {
  const credentials: Record<string, unknown> = {
    client_id: overrides.clientId ?? 'mk-client-id',
    client_secret: overrides.clientSecret ?? 'mk-client-secret',
    scopes: overrides.scopes ?? ['store.read', 'product.write'],
  };
  return {
    id: overrides.id ?? 'mk-integration-1',
    workspaceId: overrides.workspaceId ?? 'ws-1',
    createdBy: overrides.createdBy ?? 'u-1',
    name: overrides.name ?? 'MakeShop',
    status: overrides.status ?? 'pending_install',
    serviceType: 'makeshop',
    mallId: overrides.mallId === undefined ? null : overrides.mallId,
    installToken:
      overrides.installToken === undefined
        ? 'AbCdEfGhIjKlMnOpQrStUv'
        : overrides.installToken,
    installTokenIssuedAt: new Date(),
    statusReason: null,
    lastError: null,
    scope: overrides.scope ?? 'personal',
    credentials,
  };
}

const INSTALL_TOKEN = 'AbCdEfGhIjKlMnOpQrStUv';

function makeInstallQuery(
  shopUid: string,
  secret: string,
  overrides: Partial<{ timestamp: string; action_type: string }> = {},
): MakeshopInstallQuery {
  const timestamp =
    overrides.timestamp ?? String(Math.floor(Date.now() / 1000));
  const actionType = overrides.action_type ?? 'install';
  const rawQuery = `shop_uid=${shopUid}&timestamp=${timestamp}&action_type=${actionType}`;
  const hmac = computeMakeshopHmac(rawQuery, secret);
  return {
    shop_uid: shopUid,
    timestamp,
    hmac,
    action_type: actionType,
    rawQuery: `${rawQuery}&hmac=${encodeURIComponent(hmac)}`,
  };
}

describe('IntegrationOAuthService — MakeShop', () => {
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

    service = new IntegrationOAuthService(
      integrationRepo as never,
      stateRepo as never,
      previewRepo as never,
      dataSource as never,
    );
  });

  afterEach(() => {
    delete process.env.OAUTH_STUB_MODE;
    jest.restoreAllMocks();
  });

  // -------------------------------------------------------------------
  // PKCE
  // -------------------------------------------------------------------
  describe('generatePkcePair', () => {
    it('derives challenge = BASE64URL(SHA256(verifier))', () => {
      const { verifier, challenge } = generatePkcePair();
      expect(verifier.length).toBeGreaterThanOrEqual(43);
      const expected = createHash('sha256')
        .update(verifier)
        .digest('base64url');
      expect(challenge).toBe(expected);
      // base64url charset only (no +/=)
      expect(challenge).toMatch(/^[A-Za-z0-9_-]+$/);
    });

    it('produces a fresh pair each call', () => {
      const a = generatePkcePair();
      const b = generatePkcePair();
      expect(a.verifier).not.toBe(b.verifier);
    });
  });

  // -------------------------------------------------------------------
  // begin
  // -------------------------------------------------------------------
  describe('begin — makeshop', () => {
    it('rejects begin without client_id/client_secret', async () => {
      await expect(
        service.begin({
          workspaceId: 'ws-1',
          userId: 'u-1',
          service: 'makeshop',
          scopes: ['store.read'],
          mode: 'new',
          providerMeta: {},
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects reauthorize mode (must reinstall from ShopStore)', async () => {
      await expect(
        service.begin({
          workspaceId: 'ws-1',
          userId: 'u-1',
          service: 'makeshop',
          scopes: ['store.read'],
          mode: 'reauthorize',
          providerMeta: {
            client_id: 'mk-client-id',
            client_secret: 'mk-client-secret',
          },
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('creates a pending_install integration and returns makeshop_pending_install', async () => {
      integrationRepo.save = jest.fn().mockResolvedValue({
        id: 'pending-mk-id',
        installToken: INSTALL_TOKEN,
      });

      const result = await service.begin({
        workspaceId: 'ws-1',
        userId: 'u-1',
        service: 'makeshop',
        scopes: ['store.read', 'product.write'],
        mode: 'new',
        providerMeta: {
          client_id: 'mk-client-id',
          client_secret: 'mk-client-secret',
        },
      });

      expect(result).toMatchObject({
        mode: 'makeshop_pending_install',
        integrationId: 'pending-mk-id',
      });
      const r = result as { appUrl: string; callbackUrl: string };
      expect(r.appUrl).toMatch(
        /\/api\/3rd-party\/makeshop\/install\/[A-Za-z0-9_-]{22}$/,
      );
      expect(r.callbackUrl).toContain('/api/3rd-party/makeshop/callback');

      // pending_install row with confidential creds embedded, no shop_uid yet.
      expect(integrationRepo.save).toHaveBeenCalledTimes(1);
      const created = integrationRepo.create.mock.calls[0][0] as Record<
        string,
        unknown
      >;
      expect(created.status).toBe('pending_install');
      expect(created.serviceType).toBe('makeshop');
      const creds = created.credentials as Record<string, unknown>;
      expect(creds.client_id).toBe('mk-client-id');
      expect(creds.client_secret).toBe('mk-client-secret');
      expect(creds.shop_uid).toBeUndefined();
      // no state row created at begin (created later in install).
      expect(stateRepo.save).not.toHaveBeenCalled();
    });

    it('reuses an existing pending_install row for the same client_id', async () => {
      const existing = buildFakeMakeshopIntegration({
        id: 'existing-mk',
        installToken: 'OldOldOldOldOldOldOldO',
      });
      integrationRepo.find = jest.fn().mockResolvedValue([existing]);
      integrationRepo.save = jest
        .fn()
        .mockImplementation((e: unknown) => Promise.resolve(e));

      const result = await service.begin({
        workspaceId: 'ws-1',
        userId: 'u-1',
        service: 'makeshop',
        scopes: ['store.read'],
        mode: 'new',
        providerMeta: {
          client_id: 'mk-client-id',
          client_secret: 'mk-client-secret',
        },
      });

      // existing install_token preserved (idempotent begin).
      const r = result as { appUrl: string };
      expect(r.appUrl).toContain('OldOldOldOldOldOldOldO');
      expect(integrationRepo.create).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------
  // handleMakeshopInstall
  // -------------------------------------------------------------------
  describe('handleMakeshopInstall', () => {
    it('rejects stale timestamp (replay window ±5min)', async () => {
      const oldTs = String(Math.floor(Date.now() / 1000) - 10 * 60);
      await expect(
        service.handleMakeshopInstall(INSTALL_TOKEN, {
          shop_uid: 'myshop',
          timestamp: oldTs,
          hmac: 'x',
          rawQuery: `shop_uid=myshop&timestamp=${oldTs}`,
        }),
      ).rejects.toMatchObject({
        response: { code: 'MAKESHOP_INSTALL_REPLAY' },
      });
    });

    it('rejects invalid shop_uid format', async () => {
      const ts = String(Math.floor(Date.now() / 1000));
      await expect(
        service.handleMakeshopInstall(INSTALL_TOKEN, {
          shop_uid: 'bad shop!',
          timestamp: ts,
          hmac: 'x',
          rawQuery: `shop_uid=bad%20shop!&timestamp=${ts}`,
        }),
      ).rejects.toMatchObject({
        response: { code: 'MAKESHOP_INVALID_SHOP_UID' },
      });
    });

    it('returns 404 when install_token matches no row', async () => {
      integrationRepo.findOne = jest.fn().mockResolvedValue(null);
      await expect(
        service.handleMakeshopInstall(
          INSTALL_TOKEN,
          makeInstallQuery('myshop', 'mk-client-secret'),
        ),
      ).rejects.toMatchObject({
        response: { code: 'MAKESHOP_INSTALL_INVALID_TOKEN' },
      });
    });

    it('rejects a forged HMAC (wrong secret)', async () => {
      const row = buildFakeMakeshopIntegration({
        clientSecret: 'real-secret',
      });
      integrationRepo.findOne = jest.fn().mockResolvedValue(row);
      const query = makeInstallQuery('myshop', 'WRONG-secret');
      await expect(
        service.handleMakeshopInstall(INSTALL_TOKEN, query),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('happy path — verifies HMAC, projects shop_uid, returns authorize URL with PKCE + space-separated scopes', async () => {
      const row = buildFakeMakeshopIntegration({
        clientId: 'mk-client-id',
        clientSecret: 'mk-client-secret',
        scopes: ['store.read', 'product.write'],
        mallId: null,
      });
      integrationRepo.findOne = jest.fn().mockResolvedValue(row);
      integrationRepo.find = jest.fn().mockResolvedValue([]); // no connected dup
      integrationRepo.save = jest
        .fn()
        .mockImplementation((e: unknown) => Promise.resolve(e));

      const query = makeInstallQuery('myshop', 'mk-client-secret');
      const url = await service.handleMakeshopInstall(INSTALL_TOKEN, query);

      expect(url).toMatch(/^https:\/\/auth\.makeshop\.com\/oauth\/authorize\?/);
      // OAuth 2.1 — SPACE-separated scopes (NOT cafe24's comma).
      expect(url).toContain('scope=store.read+product.write');
      expect(url).not.toContain('store.read%2Cproduct.write');
      // PKCE S256 present.
      expect(url).toContain('code_challenge_method=S256');
      expect(url).toMatch(/code_challenge=[A-Za-z0-9_-]+/);
      expect(url).toContain('response_type=code');

      // shop_uid projected onto mall_id column + credentials.
      expect(row.mallId).toBe('myshop');
      expect((row.credentials as Record<string, unknown>).shop_uid).toBe(
        'myshop',
      );
      // state row stores code_verifier for the exchange.
      expect(stateRepo.save).toHaveBeenCalledTimes(1);
      const stateRow = stateRepo.create.mock.calls[0][0] as Record<
        string,
        unknown
      >;
      const pm = stateRow.providerMeta as Record<string, unknown>;
      expect(typeof pm.code_verifier).toBe('string');
      expect(pm.shop_uid).toBe('myshop');
      expect(stateRow.provider).toBe('makeshop');
    });

    it('returns 409 when a connected makeshop row already owns the shop_uid', async () => {
      const row = buildFakeMakeshopIntegration({ mallId: null });
      const connectedDup = buildFakeMakeshopIntegration({
        id: 'other-connected',
        status: 'connected',
        mallId: 'myshop',
      });
      integrationRepo.findOne = jest.fn().mockResolvedValue(row);
      integrationRepo.find = jest.fn().mockResolvedValue([connectedDup]);

      const query = makeInstallQuery('myshop', 'mk-client-secret');
      await expect(
        service.handleMakeshopInstall(INSTALL_TOKEN, query),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('routes a connected row to the frontend detail page (post-install navigation)', async () => {
      process.env.FRONTEND_URL = 'https://app.example.com';
      const row = buildFakeMakeshopIntegration({
        id: 'mk-connected',
        status: 'connected',
        mallId: 'myshop',
      });
      integrationRepo.findOne = jest.fn().mockResolvedValue(row);

      const query = makeInstallQuery('myshop', 'mk-client-secret');
      const url = await service.handleMakeshopInstall(INSTALL_TOKEN, query);
      expect(url).toBe('https://app.example.com/integrations/mk-connected');
      delete process.env.FRONTEND_URL;
    });

    // W-3 — V072 통일 인덱스명(`idx_integration_workspace_service_mall`)을 사용하는
    // race-backstop catch 분기 검증. in-memory 사전 체크가 통과한 후 동시 save() 가
    // UNIQUE 위반을 발생시키면 409(MAKESHOP_ALREADY_CONNECTED) 로 변환한다.
    // ALREADY_CONNECTED_BY_SERVICE['makeshop'] 레지스트리 경유 — 에러 코드·메시지를
    // throwIfUniqueViolation 과 공유.
    it('translates idx_integration_workspace_service_mall violation → MAKESHOP_ALREADY_CONNECTED (409) on concurrent save', async () => {
      const row = buildFakeMakeshopIntegration({ mallId: null });
      integrationRepo.findOne = jest.fn().mockResolvedValue(row);
      integrationRepo.find = jest.fn().mockResolvedValue([]); // pre-check: no connected dup
      const dbRaceError = Object.assign(
        new Error('duplicate key value violates unique constraint'),
        {
          code: '23505',
          constraint: 'idx_integration_workspace_service_mall',
        },
      );
      integrationRepo.save = jest.fn().mockRejectedValueOnce(dbRaceError);

      const query = makeInstallQuery('myshop', 'mk-client-secret');
      const error = await service
        .handleMakeshopInstall(INSTALL_TOKEN, query)
        .catch((e) => e);
      expect((error as { response?: { code?: string } }).response?.code).toBe(
        'MAKESHOP_ALREADY_CONNECTED',
      );
    });

    it('re-throws non-unique-violation errors from the makeshop race-backstop catch', async () => {
      const row = buildFakeMakeshopIntegration({ mallId: null });
      integrationRepo.findOne = jest.fn().mockResolvedValue(row);
      integrationRepo.find = jest.fn().mockResolvedValue([]);
      const otherError = Object.assign(new Error('connection reset'), {
        code: '08006',
      });
      integrationRepo.save = jest.fn().mockRejectedValueOnce(otherError);

      const query = makeInstallQuery('myshop', 'mk-client-secret');
      await expect(
        service.handleMakeshopInstall(INSTALL_TOKEN, query),
      ).rejects.toMatchObject({ message: 'connection reset' });
    });
  });

  // -------------------------------------------------------------------
  // precheckMakeshopShop
  // -------------------------------------------------------------------
  describe('precheckMakeshopShop', () => {
    it('returns no conflict when no makeshop row exists', async () => {
      integrationRepo.find = jest.fn().mockResolvedValue([]);
      const result = await service.precheckMakeshopShop('ws-1', 'freshshop');
      expect(result).toEqual({ conflict: false });
    });

    it('returns the most-restrictive (connected) status on conflict', async () => {
      integrationRepo.find = jest.fn().mockResolvedValue([
        buildFakeMakeshopIntegration({
          id: 'pend',
          status: 'pending_install',
          mallId: 'myshop',
        }),
        buildFakeMakeshopIntegration({
          id: 'conn',
          status: 'connected',
          mallId: 'myshop',
        }),
      ]);
      const result = await service.precheckMakeshopShop('ws-1', 'myshop');
      expect(result).toMatchObject({
        conflict: true,
        existingIntegrationId: 'conn',
        status: 'connected',
      });
    });
  });

  // -------------------------------------------------------------------
  // token exchange (handleCallback → exchangeCodeForToken)
  // -------------------------------------------------------------------
  describe('token exchange — makeshop', () => {
    it('uses Basic auth + code_verifier (PKCE), parses space-separated scope string, persists shop_uid', async () => {
      delete process.env.OAUTH_STUB_MODE;
      const originalFetch = global.fetch;
      const fetchMock = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          access_token: 'mk-access',
          refresh_token: 'mk-refresh',
          expires_in: 3600,
          // MakeShop (OAuth 2.1) returns scope as a SPACE-separated string.
          scope: 'store.read product.write',
        }),
        text: async () => '',
      });
      (global as { fetch: jest.Mock }).fetch = fetchMock;

      integrationRepo.findOne = jest.fn().mockResolvedValue({
        id: 'mk-int',
        workspaceId: 'ws-1',
        status: 'pending_install',
        credentials: {
          client_id: 'mk-cid',
          client_secret: 'mk-secret',
          scopes: ['store.read', 'product.write'],
        },
        installToken: 'token',
      });

      const stateRecord = {
        id: 'mk-state',
        state: 'mk-state',
        workspaceId: 'ws-1',
        userId: 'u-1',
        provider: 'makeshop',
        serviceType: 'makeshop',
        mode: 'reauthorize',
        integrationId: 'mk-int',
        requestedScopes: ['store.read', 'product.write'],
        integrationName: 'MakeShop',
        scope: 'personal',
        providerMeta: {
          shop_uid: 'myshop',
          client_id: 'mk-cid',
          client_secret: 'mk-secret',
          code_verifier: 'verifier-xyz',
        },
        expiresAt: new Date(Date.now() + 60_000),
        createdAt: new Date(),
      };
      dataSource.query.mockResolvedValueOnce([[stateRecord], 1]);

      try {
        await service.handleCallback('makeshop', {
          code: 'authz-code',
          state: 'mk-state',
        });

        // token endpoint hit with Basic auth + code_verifier in body, NO
        // client creds in body.
        expect(fetchMock).toHaveBeenCalledTimes(1);
        const [calledUrl, opts] = fetchMock.mock.calls[0] as [
          string,
          { headers: Record<string, string>; body: string },
        ];
        expect(calledUrl).toBe('https://auth.makeshop.com/oauth/token');
        expect(opts.headers.Authorization).toBe(
          `Basic ${Buffer.from('mk-cid:mk-secret').toString('base64')}`,
        );
        expect(opts.body).toContain('grant_type=authorization_code');
        expect(opts.body).toContain('code_verifier=verifier-xyz');
        expect(opts.body).not.toContain('client_secret=');

        const savedIntegration = integrationRepo.save.mock
          .calls[0][0] as Record<string, unknown>;
        const creds = savedIntegration.credentials as Record<string, unknown>;
        expect(creds.access_token).toBe('mk-access');
        expect(creds.refresh_token).toBe('mk-refresh');
        expect(creds.scopes).toEqual(['store.read', 'product.write']);
        expect(creds.shop_uid).toBe('myshop');
        // code_verifier must NOT be persisted to credentials.
        expect(creds.code_verifier).toBeUndefined();
        expect(savedIntegration.mallId).toBe('myshop');
        expect(savedIntegration.status).toBe('connected');
      } finally {
        global.fetch = originalFetch;
        process.env.OAUTH_STUB_MODE = 'true';
      }
    });
  });
});
