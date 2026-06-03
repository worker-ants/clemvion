import {
  describe,
  it,
  expect,
  beforeAll,
  afterAll,
  beforeEach,
} from '@jest/globals';
import { Client } from 'pg';
import request from 'supertest';
import { createHmac, randomBytes } from 'crypto';

import { createDbClient, uniqueEmail, uniqueName } from './helpers/db';
import { registerAndLogin, createTeamWorkspace } from './helpers/auth';

type RegisterResult = Awaited<ReturnType<typeof registerAndLogin>>;

/**
 * e2e: MakeShop ShopStore install endpoint —
 * `GET /api/3rd-party/makeshop/install/:installToken`.
 *
 * cafe24 install e2e (`integration-makeshop-install.e2e-spec.ts` 의 모태)
 * 와 동일 구조를 makeshop contract 에 맞춰 적응:
 *   - 유효 (shop_uid, timestamp, hmac) → 302 to makeshop authorize URL
 *     (status=pending_install) — `auth.makeshop.com/oauth/authorize`, PKCE
 *     S256, space-separated scope.
 *   - timestamp 윈도우 벗어남 → 400 MAKESHOP_INSTALL_REPLAY
 *   - HMAC 불일치 → 403 MAKESHOP_INSTALL_INVALID_HMAC
 *   - shop_uid 형식 위반 → 400 MAKESHOP_INVALID_SHOP_UID
 *   - install_token 미존재 → 404 MAKESHOP_INSTALL_INVALID_TOKEN
 *   - shop_uid 불일치 (이미 다른 shop 에 bound 된 row) → 403
 *   - missing params → 400 MAKESHOP_INSTALL_MISSING_PARAMS
 *   - nonce replay: 동일 (shop_uid, timestamp, hmac) 두 번째 호출
 *     → 400 MAKESHOP_INSTALL_REPLAY (Redis nonce cache)
 *
 * 검증 안 함 (별 e2e 로 분리, cafe24 와 동일 정책):
 *   - OAuth callback 의 외부 token exchange — auth.makeshop.com 토큰
 *     endpoint 를 mock 해야 하며 backend e2e 컨테이너 내부 nock/msw 인프라
 *     필요. 본 e2e 는 controller → service → DB → Redis 까지의 통합만 검증.
 *   - 외부 connect.makeshop.co.kr 데이터 호출은 절대 발생하지 않음 (install
 *     은 authorize redirect 까지만 — 실 네트워크 호출 없음).
 */

const BASE_URL = process.env.E2E_BASE_URL ?? 'http://backend-e2e:3011';

function makeInstallToken(): string {
  // INSTALL_TOKEN_BYTES = 16 → base64url 22자
  return randomBytes(16).toString('base64url');
}

function buildHmacMessage(rawQuery: string): string {
  // backend 의 buildMakeshopHmacMessage 와 동일 알고리즘 — raw URL-encoded
  // 값 보존, alphabetical sort by key, hmac 자체는 제외. (cafe24 와 동일
  // 구성. SoT: integration-oauth.service.ts buildMakeshopHmacMessage.)
  return rawQuery
    .split('&')
    .map((part) => {
      const eqIdx = part.indexOf('=');
      const key = eqIdx === -1 ? part : part.slice(0, eqIdx);
      return { key, raw: part };
    })
    .filter((p) => p.key.length > 0 && p.key !== 'hmac')
    .sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0))
    .map((p) => p.raw)
    .join('&');
}

function computeHmac(message: string, secret: string): string {
  return createHmac('sha256', secret).update(message, 'utf8').digest('base64');
}

function newShopUid(): string {
  return 'shop' + randomBytes(4).toString('hex');
}

describe('MakeShop install endpoint (e2e)', () => {
  let db: Client;
  let owner: RegisterResult;
  let workspaceId: string;
  const clientSecret = 'e2e-makeshop-secret-' + randomBytes(8).toString('hex');

  beforeAll(async () => {
    db = createDbClient();
    await db.connect();
    owner = await registerAndLogin(
      BASE_URL,
      uniqueEmail('makeshop-install'),
      db,
    );
    workspaceId = await createTeamWorkspace(
      BASE_URL,
      owner.accessToken,
      uniqueName('MAKESHOP-E2E'),
    );
  }, 60_000);

  afterAll(async () => {
    await db.end();
  });

  /**
   * Insert a pending_install makeshop row directly. The begin flow is OAuth-
   * adjacent and shop_uid is unknown until install, so a minimal DB row with
   * plain credentials (no `enc:` prefix → test-env transformer passthrough)
   * is sufficient for the install controller path. mall_id (=shop_uid
   * projection) stays NULL until the first successful install.
   */
  async function insertPendingInstall(opts: {
    installToken: string;
    mallId?: string | null;
  }): Promise<string> {
    const credentials = {
      client_id: 'e2e-makeshop-client-id',
      client_secret: clientSecret,
      scopes: ['mall.read_product'],
    };
    const r = await db.query<{ id: string }>(
      `INSERT INTO integration
        (workspace_id, service_type, auth_type, name, scope, status,
         mall_id, install_token, install_token_issued_at,
         credentials, created_by)
       VALUES ($1, 'makeshop', 'oauth2', $2, 'personal', 'pending_install',
         $3, $4, NOW(), $5::jsonb, $6)
       RETURNING id`,
      [
        workspaceId,
        uniqueName('makeshop-install'),
        opts.mallId ?? null,
        opts.installToken,
        JSON.stringify(credentials),
        owner.userId,
      ],
    );
    return r.rows[0].id;
  }

  describe('happy path', () => {
    let shopUid: string;
    let installToken: string;

    beforeEach(async () => {
      shopUid = newShopUid();
      installToken = makeInstallToken();
      await insertPendingInstall({ installToken });
    });

    it('valid (shop_uid, timestamp, hmac) → 302 to makeshop authorize URL (PKCE S256)', async () => {
      const ts = Math.floor(Date.now() / 1000).toString();
      const base = `shop_uid=${shopUid}&timestamp=${ts}&action_type=install`;
      const hmac = computeHmac(buildHmacMessage(base), clientSecret);
      const rawQuery = `${base}&hmac=${encodeURIComponent(hmac)}`;

      const res = await request(BASE_URL)
        .get(`/api/3rd-party/makeshop/install/${installToken}`)
        .query(rawQuery);
      expect(res.status).toBe(302);
      // MakeShop authorize host (NOT cafe24's mall-specific host).
      expect(res.headers.location).toContain('auth.makeshop.com');
      expect(res.headers.location).toContain('oauth/authorize');
      // OAuth 2.1 / PKCE required.
      expect(res.headers.location).toContain('code_challenge=');
      expect(res.headers.location).toContain('code_challenge_method=S256');
    });
  });

  describe('rejection paths', () => {
    it('timestamp outside ±5 minutes → 400 MAKESHOP_INSTALL_REPLAY', async () => {
      const shopUid = newShopUid();
      const installToken = makeInstallToken();
      await insertPendingInstall({ installToken });

      // 10 minutes in the past — outside window
      const ts = (Math.floor(Date.now() / 1000) - 10 * 60).toString();
      const base = `shop_uid=${shopUid}&timestamp=${ts}&action_type=install`;
      const hmac = computeHmac(buildHmacMessage(base), clientSecret);
      const rawQuery = `${base}&hmac=${encodeURIComponent(hmac)}`;

      const res = await request(BASE_URL)
        .get(`/api/3rd-party/makeshop/install/${installToken}`)
        .query(rawQuery);
      expect(res.status).toBe(400);
      expect(res.body?.code ?? res.body?.error?.code).toBe(
        'MAKESHOP_INSTALL_REPLAY',
      );
    });

    it('HMAC mismatch → 403 MAKESHOP_INSTALL_INVALID_HMAC', async () => {
      const shopUid = newShopUid();
      const installToken = makeInstallToken();
      await insertPendingInstall({ installToken });

      const ts = Math.floor(Date.now() / 1000).toString();
      const base = `shop_uid=${shopUid}&timestamp=${ts}&action_type=install`;
      const wrongHmac = computeHmac(
        buildHmacMessage(base),
        'wrong-secret-' + randomBytes(4).toString('hex'),
      );
      const rawQuery = `${base}&hmac=${encodeURIComponent(wrongHmac)}`;

      const res = await request(BASE_URL)
        .get(`/api/3rd-party/makeshop/install/${installToken}`)
        .query(rawQuery);
      expect(res.status).toBe(403);
      expect(res.body?.code ?? res.body?.error?.code).toBe(
        'MAKESHOP_INSTALL_INVALID_HMAC',
      );
    });

    it('invalid shop_uid charset → 400 MAKESHOP_INVALID_SHOP_UID', async () => {
      const installToken = makeInstallToken();
      await insertPendingInstall({ installToken });

      // shop_uid with a slash — path-traversal/SSRF vector, rejected before DB.
      const ts = Math.floor(Date.now() / 1000).toString();
      const badShopUid = 'bad/uid';
      const base = `shop_uid=${badShopUid}&timestamp=${ts}&action_type=install`;
      const hmac = computeHmac(buildHmacMessage(base), clientSecret);
      const rawQuery = `${base}&hmac=${encodeURIComponent(hmac)}`;

      const res = await request(BASE_URL)
        .get(`/api/3rd-party/makeshop/install/${installToken}`)
        .query(rawQuery);
      expect(res.status).toBe(400);
      expect(res.body?.code ?? res.body?.error?.code).toBe(
        'MAKESHOP_INVALID_SHOP_UID',
      );
    });

    /**
     * shop_uid mismatch — a row already bound to one shop_uid must not be
     * re-bound by an install for another shop. The row's mall_id is set to a
     * different shop, so even a correctly-signed install for `intruderShop`
     * is refused as a bad HMAC (no info leak). makeshop §9.7 defensive guard.
     */
    it('shop_uid mismatch with bound install_token row → 403 MAKESHOP_INSTALL_INVALID_HMAC', async () => {
      const boundShop = newShopUid();
      const installToken = makeInstallToken();
      // Row already projected onto a concrete shop_uid (mall_id column).
      await insertPendingInstall({ installToken, mallId: boundShop });

      const intruderShop = newShopUid();
      const ts = Math.floor(Date.now() / 1000).toString();
      const base = `shop_uid=${intruderShop}&timestamp=${ts}&action_type=install`;
      const hmac = computeHmac(buildHmacMessage(base), clientSecret);
      const rawQuery = `${base}&hmac=${encodeURIComponent(hmac)}`;

      const res = await request(BASE_URL)
        .get(`/api/3rd-party/makeshop/install/${installToken}`)
        .query(rawQuery);
      expect(res.status).toBe(403);
      expect(res.body?.code ?? res.body?.error?.code).toBe(
        'MAKESHOP_INSTALL_INVALID_HMAC',
      );
    });

    it('install_token not found → 404 MAKESHOP_INSTALL_INVALID_TOKEN', async () => {
      const nonExistentToken = makeInstallToken();
      const ts = Math.floor(Date.now() / 1000).toString();
      const base = `shop_uid=${newShopUid()}&timestamp=${ts}&action_type=install`;
      const hmac = computeHmac(buildHmacMessage(base), 'any-secret');
      const rawQuery = `${base}&hmac=${encodeURIComponent(hmac)}`;

      const res = await request(BASE_URL)
        .get(`/api/3rd-party/makeshop/install/${nonExistentToken}`)
        .query(rawQuery);
      expect(res.status).toBe(404);
      expect(res.body?.code ?? res.body?.error?.code).toBe(
        'MAKESHOP_INSTALL_INVALID_TOKEN',
      );
    });

    it('missing shop_uid/timestamp/hmac → 400 MAKESHOP_INSTALL_MISSING_PARAMS', async () => {
      const installToken = makeInstallToken();
      await insertPendingInstall({ installToken });

      // No shop_uid/timestamp/hmac at all.
      const res = await request(BASE_URL).get(
        `/api/3rd-party/makeshop/install/${installToken}`,
      );
      expect(res.status).toBe(400);
      expect(res.body?.code ?? res.body?.error?.code).toBe(
        'MAKESHOP_INSTALL_MISSING_PARAMS',
      );
    });

    it('malformed install_token (not 22-char base64url) → 404 MAKESHOP_INSTALL_INVALID_TOKEN', async () => {
      const ts = Math.floor(Date.now() / 1000).toString();
      const base = `shop_uid=${newShopUid()}&timestamp=${ts}&action_type=install`;
      const hmac = computeHmac(buildHmacMessage(base), clientSecret);
      const rawQuery = `${base}&hmac=${encodeURIComponent(hmac)}`;

      const res = await request(BASE_URL)
        .get('/api/3rd-party/makeshop/install/too-short')
        .query(rawQuery);
      expect(res.status).toBe(404);
      expect(res.body?.code ?? res.body?.error?.code).toBe(
        'MAKESHOP_INSTALL_INVALID_TOKEN',
      );
    });
  });

  describe('nonce replay protection', () => {
    it('same (shop_uid, timestamp, hmac) twice → 2nd is 400 MAKESHOP_INSTALL_REPLAY', async () => {
      const shopUid = newShopUid();
      const installToken = makeInstallToken();
      await insertPendingInstall({ installToken });

      const ts = Math.floor(Date.now() / 1000).toString();
      const base = `shop_uid=${shopUid}&timestamp=${ts}&action_type=install`;
      const hmac = computeHmac(buildHmacMessage(base), clientSecret);
      const rawQuery = `${base}&hmac=${encodeURIComponent(hmac)}`;

      // First call — happy path (302 authorize redirect).
      const res1 = await request(BASE_URL)
        .get(`/api/3rd-party/makeshop/install/${installToken}`)
        .query(rawQuery);
      expect(res1.status).toBe(302);

      // Second identical call — nonce cache should reject.
      const res2 = await request(BASE_URL)
        .get(`/api/3rd-party/makeshop/install/${installToken}`)
        .query(rawQuery);
      expect(res2.status).toBe(400);
      expect(res2.body?.code ?? res2.body?.error?.code).toBe(
        'MAKESHOP_INSTALL_REPLAY',
      );
    });

    it('different timestamps within window → both succeed (different nonces)', async () => {
      const shopUid = newShopUid();
      const installToken = makeInstallToken();
      await insertPendingInstall({ installToken });

      const baseTs = Math.floor(Date.now() / 1000);
      const ts1 = String(baseTs);
      const ts2 = String(baseTs - 30); // 30s earlier, still inside ±5min

      const base1 = `shop_uid=${shopUid}&timestamp=${ts1}&action_type=install`;
      const hmac1 = computeHmac(buildHmacMessage(base1), clientSecret);
      const rawQuery1 = `${base1}&hmac=${encodeURIComponent(hmac1)}`;

      const base2 = `shop_uid=${shopUid}&timestamp=${ts2}&action_type=install`;
      const hmac2 = computeHmac(buildHmacMessage(base2), clientSecret);
      const rawQuery2 = `${base2}&hmac=${encodeURIComponent(hmac2)}`;

      const res1 = await request(BASE_URL)
        .get(`/api/3rd-party/makeshop/install/${installToken}`)
        .query(rawQuery1);
      expect(res1.status).toBe(302);

      const res2 = await request(BASE_URL)
        .get(`/api/3rd-party/makeshop/install/${installToken}`)
        .query(rawQuery2);
      expect(res2.status).toBe(302);
    });
  });
});
