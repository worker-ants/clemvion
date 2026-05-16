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

/**
 * production `buildHmacMessage` 와 정확히 동일한 알고리즘을 사용해야 한다.
 * **2026-05-16 재정정**: Cafe24 의 실제 알고리즘은 URL value 를 decode/
 * re-encode 없이 raw byte 그대로 HMAC 메시지에 사용한다 (`validationCheckHmac`
 * Java 샘플: `request.getQueryString()` → split → TreeMap 보존). 옛 SEC H-1
 * 의 `formUrlEncodeForTest` 헬퍼는 self-fulfilling 검증 (compute 와 verify
 * 가 같은 broken 알고리즘) 이어서 실제 Cafe24 동작을 못 잡았던 회귀 원인.
 */
function computeTestHmac(rawQuery: string, secret: string): string {
  const parts = rawQuery
    .split('&')
    .filter((p) => p.length > 0 && !p.startsWith('hmac=') && p.includes('='))
    .sort((a, b) => {
      const keyA = a.slice(0, a.indexOf('='));
      const keyB = b.slice(0, b.indexOf('='));
      return keyA < keyB ? -1 : keyA > keyB ? 1 : 0;
    });
  const message = parts.join('&');
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
      // DTO branch invariants (spec §9.2): Cafe24 Public 분기는 popup 흐름
      // 이므로 (a) wire shape 키가 `authUrl` (NOT `authorizeUrl` — DTO 분리
      // 시 정정한 필드명) 으로 채워지고 (b) Private 전용 필드(integrationId /
      // appUrl / callbackUrl / mode) 는 응답에 포함되지 않아야 한다. DTO 가
      // required→optional 로 완화된 상태에서 호출부가 분기를 잘못 식별하지
      // 않도록 명시 단언. mode discriminator 부재 = popup 분기.
      const publicResp = result as Record<string, unknown>;
      expect(publicResp.mode).toBeUndefined();
      expect(typeof publicResp.authUrl).toBe('string');
      expect((publicResp.authUrl as string).length).toBeGreaterThan(0);
      expect(typeof publicResp.state).toBe('string');
      expect(publicResp.integrationId).toBeUndefined();
      expect(publicResp.appUrl).toBeUndefined();
      expect(publicResp.callbackUrl).toBeUndefined();
      // Sanity: 옛 이름 `authorizeUrl` 으로 응답을 만들지 않도록 회귀 안전망.
      expect(publicResp.authorizeUrl).toBeUndefined();
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
      // DTO branch invariants (spec §9.2): Private 분기는 popup 흐름이 아니므로
      // (a) `mode` discriminator 가 정확히 'cafe24_private_pending' 이며
      // (b) Public 전용 필드(authUrl / state / authorizeUrl) 가 응답에 포함되지
      // 않아야 한다. discriminator 기반으로 분기 단언 — 호출부가 type narrowing
      // 으로 분기를 식별할 수 있는 contract 보장.
      const privateResp = result as Record<string, unknown>;
      expect(privateResp.mode).toBe('cafe24_private_pending');
      expect(privateResp.authUrl).toBeUndefined();
      expect(privateResp.state).toBeUndefined();
      expect(privateResp.authorizeUrl).toBeUndefined();
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

    it('creates a new row when no existing cafe24 row matches the mall_id', async () => {
      // C2 follow-up (2026-05-16) — `find` 은 이제 `{ workspaceId,
      // serviceType, mallId }` 로 SQL 직접 조회. mockResolvedValue 가
      // 두 번 호출되며 (mall 직접 조회 + legacy NULL fallback) 둘 다 빈
      // 배열 → 새 row 생성.
      integrationRepo.find = jest.fn().mockResolvedValue([]);
      integrationRepo.save.mockImplementation((entity: unknown) =>
        Promise.resolve({ ...(entity as object), id: 'new-id' }),
      );

      const result = await service.begin(privateBeginParams());
      const r = result as { integrationId: string };
      expect(r.integrationId).toBe('new-id');
      // create was called (fresh row), not just save on existing.
      expect(integrationRepo.create).toHaveBeenCalled();
    });

    // REQ HIGH-5 회귀 — spec §9.2 가 명시한 "app_type 무관" 중복 감지.
    // 옛 코드는 `sameMall.filter((row) => row.credentials?.app_type === 'private')`
    // 으로 public 충돌을 허용했다. 이제 같은 mall_id 의 connected 통합이
    // public 이든 private 이든 모두 ConflictException.
    it('rejects when same mall_id is already connected as public (spec §9.2 — app_type 무관)', async () => {
      integrationRepo.find = jest.fn().mockResolvedValue([
        {
          id: 'public-row',
          status: 'connected',
          mallId: 'priv-shop',
          credentials: { mall_id: 'priv-shop', app_type: 'public' },
        },
      ]);

      await expect(service.begin(privateBeginParams())).rejects.toMatchObject({
        response: expect.objectContaining({
          code: 'CAFE24_PRIVATE_APP_ALREADY_CONNECTED',
        }),
      });
    });
  });

  // Public 흐름 사전 가드 (2026-05-16). 옛 코드는 public begin 단계에서
  // 중복 체크가 없어 사용자가 Cafe24 동의까지 마친 뒤 finalize 단계의
  // V045 partial UNIQUE 위반이 500 으로 빠지던 UX 결함을 막는다.
  // 동일 mall_id 의 `connected` row 가 존재하면 begin 자체가 409 로 거부.
  describe('begin — public app duplicate prevention', () => {
    function publicBeginParams() {
      return {
        workspaceId: 'ws-1',
        userId: 'u-1',
        service: 'cafe24',
        scopes: ['mall.read_product'],
        mode: 'new' as const,
        providerMeta: {
          mall_id: 'pub-shop',
          app_type: 'public' as const,
        },
      };
    }

    it('rejects with 409 when a connected public integration exists for the same mall_id', async () => {
      integrationRepo.find = jest.fn().mockResolvedValue([
        {
          id: 'existing-public-connected',
          workspaceId: 'ws-1',
          status: 'connected',
          serviceType: 'cafe24',
          mallId: 'pub-shop',
          credentials: { mall_id: 'pub-shop', app_type: 'public' },
        },
      ]);

      const error = await service
        .begin(publicBeginParams())
        .catch((e: Error) => e);
      const response = (error as { response?: { code?: string } }).response;
      expect(response?.code).toBe('CAFE24_PRIVATE_APP_ALREADY_CONNECTED');
      // No OAuth state row created — the guard fires before save.
      expect(stateRepo.save).not.toHaveBeenCalled();
    });

    it('rejects with 409 when a connected private integration exists for the same mall_id (app_type 무관)', async () => {
      integrationRepo.find = jest.fn().mockResolvedValue([
        {
          id: 'existing-private-connected',
          workspaceId: 'ws-1',
          status: 'connected',
          serviceType: 'cafe24',
          mallId: 'pub-shop',
          credentials: { mall_id: 'pub-shop', app_type: 'private' },
        },
      ]);

      const error = await service
        .begin(publicBeginParams())
        .catch((e: Error) => e);
      const response = (error as { response?: { code?: string } }).response;
      expect(response?.code).toBe('CAFE24_PRIVATE_APP_ALREADY_CONNECTED');
      expect(stateRepo.save).not.toHaveBeenCalled();
    });

    it('proceeds when only non-connected rows exist (pending/expired/error — V045 backstop handles finalize)', async () => {
      integrationRepo.find = jest.fn().mockResolvedValue([
        {
          id: 'existing-expired',
          status: 'expired',
          serviceType: 'cafe24',
          mallId: 'pub-shop',
          credentials: { mall_id: 'pub-shop', app_type: 'public' },
        },
      ]);

      const result = await service.begin(publicBeginParams());
      // Begin succeeds (returns authorize URL); duplicate is caught at
      // POST /api/integrations finalize by `throwIfUniqueViolation` against
      // `idx_integration_cafe24_workspace_mall`.
      expect((result as { authUrl: string }).authUrl).toMatch(
        /^https:\/\/pub-shop\.cafe24api\.com\/api\/v2\/oauth\/authorize\?/,
      );
      expect(stateRepo.save).toHaveBeenCalledTimes(1);
    });

    it('proceeds when no cafe24 row exists for this mall', async () => {
      integrationRepo.find = jest.fn().mockResolvedValue([]);
      const result = await service.begin(publicBeginParams());
      expect((result as { authUrl: string }).authUrl).toContain(
        'pub-shop.cafe24api.com',
      );
    });

    it('matches legacy rows (mall_id stored in credentials JSONB only)', async () => {
      // V045 이전 row 는 plain `mall_id` 컬럼이 NULL — JSONB 의 mall_id 로
      // 매칭. find() 가 두 번 호출되며 첫 번째 (mallId='pub-shop') 는 빈
      // 배열, 두 번째 (mallId IS NULL) 는 legacy row 를 반환.
      let callCount = 0;
      integrationRepo.find = jest.fn().mockImplementation(() => {
        callCount += 1;
        if (callCount === 1) return Promise.resolve([]);
        return Promise.resolve([
          {
            id: 'legacy-connected',
            status: 'connected',
            serviceType: 'cafe24',
            mallId: null,
            credentials: { mall_id: 'pub-shop', app_type: 'public' },
          },
        ]);
      });

      const error = await service
        .begin(publicBeginParams())
        .catch((e: Error) => e);
      expect((error as { response?: { code?: string } }).response?.code).toBe(
        'CAFE24_PRIVATE_APP_ALREADY_CONNECTED',
      );
    });
  });

  // precheck — frontend 의 사전 감지 inline 알림을 위한 read-only API.
  // 동일 (workspaceId, mallId) cafe24 row 의 status / id / name 을 반환.
  // priority: connected > pending_install > error > expired.
  describe('precheckCafe24Mall', () => {
    it('returns conflict=false when no cafe24 row exists', async () => {
      integrationRepo.find = jest.fn().mockResolvedValue([]);
      const result = await service.precheckCafe24Mall('ws-1', 'fresh-mall');
      expect(result).toEqual({ conflict: false });
    });

    it('returns conflict=true with status=connected when a connected row exists', async () => {
      integrationRepo.find = jest.fn().mockResolvedValue([
        {
          id: 'conn-1',
          name: 'priv-shop (Cafe24 Private)',
          status: 'connected',
          serviceType: 'cafe24',
          mallId: 'priv-shop',
          credentials: { mall_id: 'priv-shop', app_type: 'private' },
        },
      ]);
      const result = await service.precheckCafe24Mall('ws-1', 'priv-shop');
      expect(result).toEqual({
        conflict: true,
        existingIntegrationId: 'conn-1',
        existingName: 'priv-shop (Cafe24 Private)',
        status: 'connected',
      });
    });

    it('prefers connected over pending_install when both exist', async () => {
      integrationRepo.find = jest.fn().mockResolvedValue([
        {
          id: 'pending-1',
          name: 'pending',
          status: 'pending_install',
          serviceType: 'cafe24',
          mallId: 'priv-shop',
          credentials: { mall_id: 'priv-shop', app_type: 'private' },
        },
        {
          id: 'conn-1',
          name: 'connected',
          status: 'connected',
          serviceType: 'cafe24',
          mallId: 'priv-shop',
          credentials: { mall_id: 'priv-shop', app_type: 'private' },
        },
      ]);
      const result = await service.precheckCafe24Mall('ws-1', 'priv-shop');
      expect(result.status).toBe('connected');
      expect(result.existingIntegrationId).toBe('conn-1');
    });

    it('returns status=pending_install when only pending row exists', async () => {
      integrationRepo.find = jest.fn().mockResolvedValue([
        {
          id: 'pending-1',
          name: 'pending',
          status: 'pending_install',
          serviceType: 'cafe24',
          mallId: 'priv-shop',
          credentials: { mall_id: 'priv-shop', app_type: 'private' },
        },
      ]);
      const result = await service.precheckCafe24Mall('ws-1', 'priv-shop');
      expect(result.status).toBe('pending_install');
      expect(result.existingIntegrationId).toBe('pending-1');
    });

    it('returns status=error when only error row exists', async () => {
      integrationRepo.find = jest.fn().mockResolvedValue([
        {
          id: 'err-1',
          name: 'broken',
          status: 'error',
          serviceType: 'cafe24',
          mallId: 'priv-shop',
          credentials: { mall_id: 'priv-shop', app_type: 'private' },
        },
      ]);
      const result = await service.precheckCafe24Mall('ws-1', 'priv-shop');
      expect(result.status).toBe('error');
    });

    it('returns status=expired when only expired row exists', async () => {
      integrationRepo.find = jest.fn().mockResolvedValue([
        {
          id: 'exp-1',
          name: 'gone',
          status: 'expired',
          serviceType: 'cafe24',
          mallId: 'priv-shop',
          credentials: { mall_id: 'priv-shop', app_type: 'private' },
        },
      ]);
      const result = await service.precheckCafe24Mall('ws-1', 'priv-shop');
      expect(result.status).toBe('expired');
      expect(result.existingIntegrationId).toBe('exp-1');
    });

    /**
     * Fallback 분기 — priority 외 status (예: 미래 추가될 transitional
     * `initializing`) 가 들어오면 frontend 가 unknown enum 으로 silent
     * fallthrough 하지 않도록 `status` 필드를 omit. conflict 만 true.
     */
    it('omits status when row has a status outside the priority enum (fallback)', async () => {
      integrationRepo.find = jest.fn().mockResolvedValue([
        {
          id: 'tx-1',
          name: 'unknown-state',
          status: 'initializing',
          serviceType: 'cafe24',
          mallId: 'priv-shop',
          credentials: { mall_id: 'priv-shop', app_type: 'private' },
        },
      ]);
      const result = await service.precheckCafe24Mall('ws-1', 'priv-shop');
      expect(result.conflict).toBe(true);
      expect(result.existingIntegrationId).toBe('tx-1');
      expect(result.status).toBeUndefined();
    });

    /**
     * Legacy row (V045 이전) — plain `mall_id` 컬럼이 NULL 이라 primary 쿼리
     * 에선 매칭되지 않고, fallback (mallId IS NULL) + JSONB filter 로 잡힌다.
     * backfill 완료 후 본 분기 제거 예정.
     */
    it('matches legacy rows via credentials.mall_id JSONB when plain column is NULL', async () => {
      let callCount = 0;
      integrationRepo.find = jest.fn().mockImplementation(() => {
        callCount += 1;
        if (callCount === 1) return Promise.resolve([]);
        return Promise.resolve([
          {
            id: 'legacy-conn',
            name: 'legacy',
            status: 'connected',
            serviceType: 'cafe24',
            mallId: null,
            credentials: { mall_id: 'priv-shop', app_type: 'public' },
          },
        ]);
      });
      const result = await service.precheckCafe24Mall('ws-1', 'priv-shop');
      expect(result.conflict).toBe(true);
      expect(result.status).toBe('connected');
      expect(result.existingIntegrationId).toBe('legacy-conn');
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

    // 회귀 보호 (2026-05-16 hmac-raw-fix) — Cafe24 는 URL value 를 raw byte 그대로
    // HMAC 메시지에 사용한다. 운영 환경에서 Cafe24 가 공백을 `%20` 으로 보내는데,
    // 옛 SEC H-1 (PR #67) 의 `formUrlEncode` 가 `%20` 을 `+` 로 변환해 byte 불일치
    // → 신규 통합 직후 즉시 HMAC 실패하던 결함을 raw-value 보존으로 정정.
    // 결정 배경: spec/2-navigation/4-integration.md Rationale
    // "HMAC 검증 알고리즘 — raw URL-encoded 값 보존 (2026-05-16 재정정)".
    it('accepts HMAC for %20 space-encoded values (Cafe24 실제 운영 형식)', async () => {
      integrationRepo.findOne.mockResolvedValue(makePendingRow());
      const validTs = Math.floor(Date.now() / 1000);
      // Cafe24 가 실제로 보내는 형식 — 공백을 %20 으로 인코딩 ("대표 관리자")
      const base = `mall_id=priv-shop&timestamp=${validTs}&user_id=admin&user_name=%EB%8C%80%ED%91%9C%20%EA%B4%80%EB%A6%AC%EC%9E%90`;
      const hmac = computeTestHmac(base, clientSecret);
      const rawQuery = `${base}&hmac=${encodeURIComponent(hmac)}`;
      const params = new URLSearchParams(rawQuery);

      const result = await service.handleInstall(INSTALL_TOKEN, {
        mall_id: 'priv-shop',
        timestamp: String(validTs),
        hmac: params.get('hmac')!,
        rawQuery,
      });
      expect(result).toContain('oauth/authorize');
    });

    // 회귀 보호 — Cafe24 가 향후 `+` 인코딩으로 바꿔도 raw-value 보존 알고리즘은
    // 자동 호환 (encoder invariant). URL value 의 byte 가 같으면 메시지의 byte 도
    // 같으므로 매칭 성립.
    it('accepts HMAC for + space-encoded values (encoder invariant)', async () => {
      integrationRepo.findOne.mockResolvedValue(makePendingRow());
      const validTs = Math.floor(Date.now() / 1000);
      const base = `mall_id=priv-shop&timestamp=${validTs}&user_id=admin&user_name=John+Doe`;
      const hmac = computeTestHmac(base, clientSecret);
      const rawQuery = `${base}&hmac=${encodeURIComponent(hmac)}`;
      const params = new URLSearchParams(rawQuery);

      const result = await service.handleInstall(INSTALL_TOKEN, {
        mall_id: 'priv-shop',
        timestamp: String(validTs),
        hmac: params.get('hmac')!,
        rawQuery,
      });
      expect(result).toContain('oauth/authorize');
    });

    // 회귀 보호 — 옛 SEC H-1 알고리즘 (formUrlEncode 가 `%20` 을 `+` 로 변환한
    // 메시지로 HMAC 계산) 으로 만든 hmac 은 거부되어야 한다. 이 테스트가 통과해야
    // self-fulfilling 회귀가 다시 일어나지 않는다.
    it('rejects HMAC computed by old SEC H-1 algorithm (%20 → + re-encoding)', async () => {
      integrationRepo.findOne.mockResolvedValue(makePendingRow());
      const validTs = Math.floor(Date.now() / 1000);
      // URL 은 %20, 그러나 HMAC 은 옛 SEC H-1 처럼 + 로 변환된 메시지로 계산
      const realUrl = `mall_id=priv-shop&timestamp=${validTs}&user_id=admin&user_name=%EB%8C%80%ED%91%9C%20%EA%B4%80%EB%A6%AC%EC%9E%90`;
      const oldStyleMessage = `mall_id=priv-shop&timestamp=${validTs}&user_id=admin&user_name=%EB%8C%80%ED%91%9C+%EA%B4%80%EB%A6%AC%EC%9E%90`;
      const wrongHmac = createHmac('sha256', clientSecret)
        .update(oldStyleMessage, 'utf8')
        .digest('base64');
      const rawQuery = `${realUrl}&hmac=${encodeURIComponent(wrongHmac)}`;
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

    // ---------------------------------------------------------------
    // 진단 로그 (2026-05-16) — HMAC 검증 실패 3 분기는 모두 동일한
    // CAFE24_INSTALL_INVALID_HMAC 응답을 반환하지만, 운영 환경에서 어느
    // 분기에서 실패했는지 판별 가능해야 한다. `logger.warn` 로
    // reason / urlMallId / dbMallId / dbAppType / status / statusReason /
    // 토큰 prefix+suffix 4자 를 기록한다. **client_secret 자체는 절대
    // 로깅하지 않는다** (SECRET_LEAK_PATTERNS 와 일관).
    // spec/2-navigation/4-integration.md ## Rationale "Cafe24 App URL
    // 상세 페이지 표시" 의 "HMAC 검증 진단 로그 보강" 단락.
    // ---------------------------------------------------------------
    describe('handleInstall — HMAC 진단 로그', () => {
      let warnSpy: jest.SpyInstance;
      beforeEach(() => {
        warnSpy = jest
          .spyOn(
            (service as unknown as { logger: { warn: (msg: string) => void } })
              .logger,
            'warn',
          )
          .mockImplementation(() => undefined);
      });
      afterEach(() => {
        warnSpy.mockRestore();
      });

      function logCalls(): string[] {
        return warnSpy.mock.calls.map((args) => String(args[0]));
      }

      it('logs reason=mall_id_mismatch with both mall_ids (client_secret 누락 없음)', async () => {
        integrationRepo.findOne.mockResolvedValue(
          makePendingRow({
            credentials: {
              mall_id: 'different-shop',
              app_type: 'private',
              client_id: 'priv-client-id',
              client_secret: clientSecret,
              scopes: [],
            },
            status: 'connected',
            statusReason: null,
          }),
        );
        const validTs = Math.floor(Date.now() / 1000);
        const rawQuery = buildRawQuery(validTs);
        const params = new URLSearchParams(rawQuery);

        await service
          .handleInstall(INSTALL_TOKEN, {
            mall_id: 'priv-shop',
            timestamp: String(validTs),
            hmac: params.get('hmac')!,
            rawQuery,
          })
          .catch(() => undefined);

        const joined = logCalls().join('\n');
        expect(joined).toContain('cafe24-install-hmac-fail');
        expect(joined).toContain('mall_id_mismatch');
        expect(joined).toContain('priv-shop'); // urlMallId
        expect(joined).toContain('different-shop'); // dbMallId
        // 토큰 전체가 아니라 prefix..suffix 형태로만 기록
        expect(joined).toContain('AbCd');
        expect(joined).toContain('StUv');
        expect(joined).not.toContain(INSTALL_TOKEN); // 전체 토큰 미포함
        // client_secret 절대 누출 금지
        expect(joined).not.toContain(clientSecret);
      });

      it('logs reason=no_client_secret when credentials lack client_secret', async () => {
        integrationRepo.findOne.mockResolvedValue(
          makePendingRow({
            credentials: {
              mall_id: 'priv-shop',
              app_type: 'private',
              client_id: 'priv-client-id',
              // client_secret intentionally omitted
              scopes: [],
            },
          }),
        );
        const validTs = Math.floor(Date.now() / 1000);
        const rawQuery = buildRawQuery(validTs);
        const params = new URLSearchParams(rawQuery);

        await service
          .handleInstall(INSTALL_TOKEN, {
            mall_id: 'priv-shop',
            timestamp: String(validTs),
            hmac: params.get('hmac')!,
            rawQuery,
          })
          .catch(() => undefined);

        const joined = logCalls().join('\n');
        expect(joined).toContain('no_client_secret');
      });

      it('logs reason=hmac_verify_failed when HMAC does not match', async () => {
        integrationRepo.findOne.mockResolvedValue(makePendingRow());
        const validTs = Math.floor(Date.now() / 1000);
        const rawQuery = buildRawQuery(validTs, 'attacker-controlled-secret');
        const params = new URLSearchParams(rawQuery);

        await service
          .handleInstall(INSTALL_TOKEN, {
            mall_id: 'priv-shop',
            timestamp: String(validTs),
            hmac: params.get('hmac')!,
            rawQuery,
          })
          .catch(() => undefined);

        const joined = logCalls().join('\n');
        expect(joined).toContain('hmac_verify_failed');
        // 정상 매칭 분기라 dbMallId 도 priv-shop
        expect(joined).toContain('priv-shop');
        expect(joined).not.toContain(clientSecret);
      });

      it('does not log diagnostic on happy path (no spurious warn)', async () => {
        integrationRepo.findOne.mockResolvedValue(makePendingRow());
        const validTs = Math.floor(Date.now() / 1000);
        const rawQuery = buildRawQuery(validTs);
        const params = new URLSearchParams(rawQuery);

        await service.handleInstall(INSTALL_TOKEN, {
          mall_id: 'priv-shop',
          timestamp: String(validTs),
          hmac: params.get('hmac')!,
          rawQuery,
        });

        const hmacFailLogs = logCalls().filter((m) =>
          m.includes('cafe24-install-hmac-fail'),
        );
        expect(hmacFailLogs).toHaveLength(0);
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
      // Regression — `credentials.expires_at` must be mirrored from
      // `tokenExpiresAt` so the Cafe24ApiClient proactive-refresh gate
      // fires on freshly-connected rows. Spec §10.5 — without this
      // mirror, the JSONB-only legacy gate skipped refresh silently and
      // every Cafe24 integration flipped to `error(auth_failed)` ~2h
      // after the initial connect.
      expect(typeof creds.expires_at).toBe('string');
      const previewTokenExpiresAt = previewArg.tokenExpiresAt as Date;
      expect(creds.expires_at).toBe(previewTokenExpiresAt.toISOString());
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
