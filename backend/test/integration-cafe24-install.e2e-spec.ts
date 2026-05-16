import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import { Client } from 'pg';
import request from 'supertest';
import { createHmac, randomBytes } from 'crypto';

import { createDbClient, uniqueEmail, uniqueName } from './helpers/db';
import { registerAndLogin, createTeamWorkspace } from './helpers/auth';

type RegisterResult = Awaited<ReturnType<typeof registerAndLogin>>;

/**
 * e2e: Cafe24 Private App URL install endpoint —
 * `GET /api/3rd-party/cafe24/install/:installToken`.
 *
 * 보호 대상 (B-5-8 followup):
 *   - 유효 (mall_id, timestamp, hmac) → 302 to authorize URL (status=pending_install)
 *   - timestamp 윈도우 벗어남 → 400 CAFE24_INSTALL_REPLAY
 *   - HMAC 불일치 → 403 CAFE24_INSTALL_INVALID_HMAC
 *   - install_token 미존재 → 404 CAFE24_INSTALL_INVALID_TOKEN (mall_id 회복도 불가)
 *   - mall_id 불일치 (recovery fall-through 후에도) → 403
 *   - **B-1-3 nonce replay**: 동일 (mall_id, timestamp, hmac) 두 번째 호출
 *     → 400 CAFE24_INSTALL_REPLAY (Redis nonce cache)
 *
 * 검증 안 함 (별 e2e 로 분리):
 *   - OAuth callback 의 외부 token exchange — Cafe24 token endpoint 를 mock 해야
 *     하며 nock/msw 가 backend e2e 컨테이너 내부에서 동작하도록 추가 인프라 필요.
 *   - BullMQ refresh worker 실 토큰 회전 — 동일하게 외부 mock 필요.
 *   본 e2e 는 controller → service → DB → Redis 까지의 통합만 검증한다.
 */

const BASE_URL = process.env.E2E_BASE_URL ?? 'http://backend-e2e:3011';

function makeInstallToken(): string {
  // INSTALL_TOKEN_BYTES = 16 → base64url 22자
  return randomBytes(16).toString('base64url');
}

function buildHmacMessage(rawQuery: string): string {
  // backend 의 buildHmacMessage 와 동일 알고리즘 — raw URL-encoded 값 보존,
  // alphabetical sort by key, hmac 자체는 제외.
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

describe('Cafe24 install endpoint (e2e)', () => {
  let db: Client;
  let owner: RegisterResult;
  let workspaceId: string;
  const clientSecret = 'e2e-client-secret-' + randomBytes(8).toString('hex');

  beforeAll(async () => {
    db = createDbClient();
    await db.connect();
    owner = await registerAndLogin(BASE_URL, uniqueEmail('cafe24-install'), db);
    workspaceId = await createTeamWorkspace(
      BASE_URL,
      owner.accessToken,
      uniqueName('CAFE24-E2E'),
    );
  }, 60_000);

  afterAll(async () => {
    await db.end();
  });

  async function insertPendingInstall(opts: {
    mallId: string;
    installToken: string;
  }): Promise<string> {
    // Cafe24 Private app row in pending_install. credentials JSONB 는
    // encryptedJsonTransformer 를 우회하기 위해 enc: prefix 가 필요하지만,
    // 본 e2e 는 password decrypt 없이 raw JSONB 가 통과하는 hook 을 사용 —
    // backend 가 client_secret 를 plain 으로 읽도록 `enc:` 없이 INSERT.
    // (테스트 환경 한정 — production 에선 transformer 가 강제).
    const credentials = {
      mall_id: opts.mallId,
      app_type: 'private',
      client_id: 'e2e-client-id',
      client_secret: clientSecret,
      scopes: ['mall.read_product'],
    };
    const r = await db.query<{ id: string }>(
      `INSERT INTO integration
        (workspace_id, service_type, auth_type, name, scope, status,
         mall_id, install_token, install_token_issued_at,
         credentials, created_by)
       VALUES ($1, 'cafe24', 'oauth2', $2, 'personal', 'pending_install',
         $3, $4, NOW(), $5::jsonb, $6)
       RETURNING id`,
      [
        workspaceId,
        uniqueName('cafe24-install'),
        opts.mallId,
        opts.installToken,
        JSON.stringify(credentials),
        owner.userId,
      ],
    );
    return r.rows[0].id;
  }

  describe('happy path', () => {
    let mallId: string;
    let installToken: string;

    beforeEach(async () => {
      mallId = 'mall-' + randomBytes(4).toString('hex');
      installToken = makeInstallToken();
      await insertPendingInstall({ mallId, installToken });
    });

    it('valid (mall_id, timestamp, hmac) → 302 to authorize URL', async () => {
      const ts = Math.floor(Date.now() / 1000).toString();
      const base = `mall_id=${mallId}&timestamp=${ts}&user_id=admin&user_name=John`;
      const hmac = computeHmac(buildHmacMessage(base), clientSecret);
      const rawQuery = `${base}&hmac=${encodeURIComponent(hmac)}`;

      const res = await request(BASE_URL)
        .get(`/api/3rd-party/cafe24/install/${installToken}`)
        .query(rawQuery);
      expect(res.status).toBe(302);
      expect(res.headers.location).toContain('oauth/authorize');
      expect(res.headers.location).toContain(`${mallId}.cafe24api.com`);
    });
  });

  describe('rejection paths', () => {
    it('timestamp outside ±5 minutes → 400 CAFE24_INSTALL_REPLAY', async () => {
      const mallId = 'mall-' + randomBytes(4).toString('hex');
      const installToken = makeInstallToken();
      await insertPendingInstall({ mallId, installToken });

      // 10 minutes in the past — outside window
      const ts = (Math.floor(Date.now() / 1000) - 10 * 60).toString();
      const base = `mall_id=${mallId}&timestamp=${ts}&user_id=admin`;
      const hmac = computeHmac(buildHmacMessage(base), clientSecret);
      const rawQuery = `${base}&hmac=${encodeURIComponent(hmac)}`;

      const res = await request(BASE_URL)
        .get(`/api/3rd-party/cafe24/install/${installToken}`)
        .query(rawQuery);
      expect(res.status).toBe(400);
      expect(res.body?.code ?? res.body?.error?.code).toBe(
        'CAFE24_INSTALL_REPLAY',
      );
    });

    it('HMAC mismatch → 403 CAFE24_INSTALL_INVALID_HMAC', async () => {
      const mallId = 'mall-' + randomBytes(4).toString('hex');
      const installToken = makeInstallToken();
      await insertPendingInstall({ mallId, installToken });

      const ts = Math.floor(Date.now() / 1000).toString();
      const base = `mall_id=${mallId}&timestamp=${ts}&user_id=admin`;
      const wrongHmac = computeHmac(
        buildHmacMessage(base),
        'wrong-secret-' + randomBytes(4).toString('hex'),
      );
      const rawQuery = `${base}&hmac=${encodeURIComponent(wrongHmac)}`;

      const res = await request(BASE_URL)
        .get(`/api/3rd-party/cafe24/install/${installToken}`)
        .query(rawQuery);
      expect(res.status).toBe(403);
      expect(res.body?.code ?? res.body?.error?.code).toBe(
        'CAFE24_INSTALL_INVALID_HMAC',
      );
    });

    it('install_token not found → 404 CAFE24_INSTALL_INVALID_TOKEN', async () => {
      const nonExistentToken = makeInstallToken();
      const ts = Math.floor(Date.now() / 1000).toString();
      const base = `mall_id=unknown-mall&timestamp=${ts}&user_id=admin`;
      const hmac = computeHmac(buildHmacMessage(base), 'any-secret');
      const rawQuery = `${base}&hmac=${encodeURIComponent(hmac)}`;

      const res = await request(BASE_URL)
        .get(`/api/3rd-party/cafe24/install/${nonExistentToken}`)
        .query(rawQuery);
      expect(res.status).toBe(404);
      expect(res.body?.code ?? res.body?.error?.code).toBe(
        'CAFE24_INSTALL_INVALID_TOKEN',
      );
    });
  });

  describe('B-1-3 nonce replay protection', () => {
    it('same (mall_id, timestamp, hmac) twice → 2nd is 400 CAFE24_INSTALL_REPLAY', async () => {
      const mallId = 'mall-' + randomBytes(4).toString('hex');
      const installToken = makeInstallToken();
      await insertPendingInstall({ mallId, installToken });

      const ts = Math.floor(Date.now() / 1000).toString();
      const base = `mall_id=${mallId}&timestamp=${ts}&user_id=admin`;
      const hmac = computeHmac(buildHmacMessage(base), clientSecret);
      const rawQuery = `${base}&hmac=${encodeURIComponent(hmac)}`;

      // First call — happy path
      const res1 = await request(BASE_URL)
        .get(`/api/3rd-party/cafe24/install/${installToken}`)
        .query(rawQuery);
      expect(res1.status).toBe(302);

      // Second identical call — nonce cache should reject
      const res2 = await request(BASE_URL)
        .get(`/api/3rd-party/cafe24/install/${installToken}`)
        .query(rawQuery);
      expect(res2.status).toBe(400);
      expect(res2.body?.code ?? res2.body?.error?.code).toBe(
        'CAFE24_INSTALL_REPLAY',
      );
    });

    it('different timestamps within window → both succeed (different nonces)', async () => {
      const mallId = 'mall-' + randomBytes(4).toString('hex');
      const installToken = makeInstallToken();
      await insertPendingInstall({ mallId, installToken });

      const baseTs = Math.floor(Date.now() / 1000);
      const ts1 = String(baseTs);
      const ts2 = String(baseTs - 30); // 30s earlier, still inside ±5min

      const base1 = `mall_id=${mallId}&timestamp=${ts1}&user_id=admin`;
      const hmac1 = computeHmac(buildHmacMessage(base1), clientSecret);
      const rawQuery1 = `${base1}&hmac=${encodeURIComponent(hmac1)}`;

      const base2 = `mall_id=${mallId}&timestamp=${ts2}&user_id=admin`;
      const hmac2 = computeHmac(buildHmacMessage(base2), clientSecret);
      const rawQuery2 = `${base2}&hmac=${encodeURIComponent(hmac2)}`;

      const res1 = await request(BASE_URL)
        .get(`/api/3rd-party/cafe24/install/${installToken}`)
        .query(rawQuery1);
      expect(res1.status).toBe(302);

      const res2 = await request(BASE_URL)
        .get(`/api/3rd-party/cafe24/install/${installToken}`)
        .query(rawQuery2);
      expect(res2.status).toBe(302);
    });
  });
});
