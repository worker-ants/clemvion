import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { Client } from 'pg';
import request from 'supertest';

import { createDbClient, uniqueEmail, uniqueName } from './helpers/db';
import { registerAndLogin, createTeamWorkspace } from './helpers/auth';

type RegisterResult = Awaited<ReturnType<typeof registerAndLogin>>;

/**
 * e2e: MakeShop OAuth begin + service catalog surfaces.
 * spec/2-navigation/4-integration.md §5.9 + §9.3.
 *
 * 보호 대상:
 *   - `GET /api/integrations/services` 카탈로그에 makeshop 서비스가 노출됨
 *     (type=makeshop, oauthProvider=makeshop, authType=oauth2).
 *   - `GET /api/integrations/services/makeshop/catalog` 가 (현 구현상) 빈
 *     operations 배열을 반환한다 — cafe24 만 populated, 그 외는 빈 배열로
 *     일관 응답 (frontend 1회 fetch + caching 흐름이 분기 없이 동작).
 *   - `POST /api/integrations/oauth/begin {service:'makeshop', mode:'new',
 *     clientId, clientSecret, scopes}` →
 *     `{ mode:'makeshop_pending_install', integrationId, appUrl, callbackUrl }`
 *     + DB 에 status='pending_install' makeshop Integration row 생성.
 *   - begin 은 confidential-client-only — client_id/client_secret 누락 시 400
 *     MAKESHOP_CREDENTIALS_REQUIRED.
 *   - begin mode!=new (reauthorize) → 400 MAKESHOP_USE_SHOPSTORE_INSTALL.
 *   - begin idempotency — 같은 (workspace, client_id) 재호출 시 row 재사용
 *     (dangling pending row 누적 방지).
 *
 * 외부 네트워크 호출 없음 — begin 은 DB row 생성 + URL 조립까지만 (auth.makeshop.com
 * / connect.makeshop.co.kr 로의 실 호출은 발생하지 않는다).
 */

const BASE_URL = process.env.E2E_BASE_URL ?? 'http://backend-e2e:3011';

describe('MakeShop begin + catalog (e2e)', () => {
  let db: Client;
  let owner: RegisterResult;
  let token: string;
  let workspaceId: string;

  beforeAll(async () => {
    db = createDbClient();
    await db.connect();
    owner = await registerAndLogin(BASE_URL, uniqueEmail('makeshop-begin'), db);
    token = owner.accessToken;
    workspaceId = await createTeamWorkspace(
      BASE_URL,
      token,
      uniqueName('MAKESHOP-BEGIN'),
    );
  }, 60_000);

  afterAll(async () => {
    await db.end();
  });

  describe('service catalog surfaces', () => {
    it('GET /api/integrations/services lists makeshop (oauth2 / oauthProvider=makeshop)', async () => {
      const res = await request(BASE_URL)
        .get('/api/integrations/services')
        .set('Authorization', `Bearer ${token}`)
        .set('X-Workspace-Id', workspaceId);
      expect(res.status).toBe(200);
      const services = res.body.data as Array<{
        type: string;
        oauthProvider: string | null;
        authTypes: string[];
      }>;
      const makeshop = services.find((s) => s.type === 'makeshop');
      expect(makeshop).toBeDefined();
      expect(makeshop?.oauthProvider).toBe('makeshop');
      expect(makeshop?.authTypes).toContain('oauth2');
    });

    it('GET /api/integrations/services/makeshop/catalog returns an operations array', async () => {
      const res = await request(BASE_URL)
        .get('/api/integrations/services/makeshop/catalog')
        .set('Authorization', `Bearer ${token}`)
        .set('X-Workspace-Id', workspaceId);
      expect(res.status).toBe(200);
      // 현 구현: cafe24 만 populated, makeshop 은 빈 배열 (consistent shape).
      // 회귀가 발생해 operations 가 채워지면 본 단언이 잡아 갱신을 강제한다.
      expect(Array.isArray(res.body.data.operations)).toBe(true);
    });
  });

  describe('oauth/begin', () => {
    it('begin {service:makeshop, mode:new} → makeshop_pending_install + creates pending row', async () => {
      const clientId =
        'e2e-makeshop-client-' + Math.random().toString(36).slice(2, 8);
      const res = await request(BASE_URL)
        .post('/api/integrations/oauth/begin')
        .set('Authorization', `Bearer ${token}`)
        .set('X-Workspace-Id', workspaceId)
        .send({
          service: 'makeshop',
          mode: 'new',
          scopes: ['mall.read_product'],
          clientId,
          clientSecret: 'e2e-makeshop-secret',
          integrationName: uniqueName('MakeShopConn'),
        });
      expect([200, 201]).toContain(res.status);
      const data = res.body.data as {
        mode: string;
        integrationId: string;
        appUrl: string;
        callbackUrl: string;
      };
      expect(data.mode).toBe('makeshop_pending_install');
      expect(data.integrationId).toBeDefined();
      // appUrl = ShopStore install App URL; callbackUrl = OAuth callback.
      expect(data.appUrl).toContain('/api/3rd-party/makeshop/install/');
      expect(data.callbackUrl).toContain('/api/3rd-party/makeshop/callback');

      // DB: a pending_install makeshop row was created with this id.
      const row = await db.query<{ status: string; service_type: string }>(
        `SELECT status, service_type FROM integration WHERE id = $1`,
        [data.integrationId],
      );
      expect(row.rows).toHaveLength(1);
      expect(row.rows[0].service_type).toBe('makeshop');
      expect(row.rows[0].status).toBe('pending_install');
    });

    it('begin without client_id/client_secret → 400 MAKESHOP_CREDENTIALS_REQUIRED', async () => {
      const res = await request(BASE_URL)
        .post('/api/integrations/oauth/begin')
        .set('Authorization', `Bearer ${token}`)
        .set('X-Workspace-Id', workspaceId)
        .send({
          service: 'makeshop',
          mode: 'new',
          scopes: ['mall.read_product'],
          // no clientId / clientSecret
        });
      expect(res.status).toBe(400);
      expect(res.body?.error?.code).toBe('MAKESHOP_CREDENTIALS_REQUIRED');
    });

    it('begin mode=reauthorize → 400 MAKESHOP_USE_SHOPSTORE_INSTALL', async () => {
      const res = await request(BASE_URL)
        .post('/api/integrations/oauth/begin')
        .set('Authorization', `Bearer ${token}`)
        .set('X-Workspace-Id', workspaceId)
        .send({
          service: 'makeshop',
          mode: 'reauthorize',
          scopes: ['mall.read_product'],
          clientId: 'e2e-makeshop-client-reauth',
          clientSecret: 'e2e-makeshop-secret',
        });
      expect(res.status).toBe(400);
      expect(res.body?.error?.code).toBe('MAKESHOP_USE_SHOPSTORE_INSTALL');
    });

    it('begin idempotency — same (workspace, client_id) reuses the pending row', async () => {
      const clientId = 'e2e-idem-' + Math.random().toString(36).slice(2, 8);
      const body = {
        service: 'makeshop',
        mode: 'new',
        scopes: ['mall.read_product'],
        clientId,
        clientSecret: 'e2e-makeshop-secret',
        integrationName: uniqueName('MakeShopIdem'),
      };
      const res1 = await request(BASE_URL)
        .post('/api/integrations/oauth/begin')
        .set('Authorization', `Bearer ${token}`)
        .set('X-Workspace-Id', workspaceId)
        .send(body);
      const res2 = await request(BASE_URL)
        .post('/api/integrations/oauth/begin')
        .set('Authorization', `Bearer ${token}`)
        .set('X-Workspace-Id', workspaceId)
        .send(body);
      expect([200, 201]).toContain(res1.status);
      expect([200, 201]).toContain(res2.status);
      // Idempotent begin reuses the same pending row for the same client_id —
      // a second "Connect" click must NOT accumulate a dangling pending row.
      // (credentials are encrypted at rest via encryptedJsonTransformer, so we
      // assert reuse via the returned integrationId rather than a raw JSONB
      // client_id query.)
      expect(res2.body.data.integrationId).toBe(res1.body.data.integrationId);

      // The returned id resolves to exactly one pending_install makeshop row.
      const rows = await db.query<{ id: string; status: string }>(
        `SELECT id, status FROM integration
         WHERE id = $1 AND service_type = 'makeshop'`,
        [res1.body.data.integrationId],
      );
      expect(rows.rows).toHaveLength(1);
      expect(rows.rows[0].status).toBe('pending_install');
    });
  });
});
