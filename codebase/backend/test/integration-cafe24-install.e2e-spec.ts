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
 *   - **재설치 대기 표시** (CLE-T-NNENG8): 설치가 끝난 행은 App URL 이 상세 화면으로 보내다가
 *     `:id/reauthorize` · `:id/request-scopes` 가 `reinstall_requested_at` 을 남기면 authorize URL 로 보낸다
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

  async function insertPrivateIntegration(opts: {
    mallId: string;
    installToken: string;
    status: 'connected' | 'error' | 'expired';
  }): Promise<string> {
    // 설치가 끝난 Cafe24 Private 행. credentials 는 insertPendingInstall 과 같은 이유로 평문 JSONB 다.
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
       VALUES ($1, 'cafe24', 'oauth2', $2, 'personal', $3,
         $4, $5, NOW(), $6::jsonb, $7)
       RETURNING id`,
      [
        workspaceId,
        uniqueName('cafe24-reinstall'),
        opts.status,
        opts.mallId,
        opts.installToken,
        JSON.stringify(credentials),
        owner.userId,
      ],
    );
    return r.rows[0].id;
  }

  /** 매 호출마다 다른 timestamp 를 써서 nonce replay 가드를 피한다. */
  let tsOffset = 0;
  function signedInstallQuery(mallId: string): string {
    tsOffset += 1;
    const ts = (Math.floor(Date.now() / 1000) - tsOffset).toString();
    const base = `mall_id=${mallId}&timestamp=${ts}&user_id=admin&user_name=John`;
    const hmac = computeHmac(buildHmacMessage(base), clientSecret);
    return `${base}&hmac=${encodeURIComponent(hmac)}`;
  }

  async function readMark(id: string): Promise<Date | null> {
    const r = await db.query<{ reinstall_requested_at: Date | null }>(
      'SELECT reinstall_requested_at FROM integration WHERE id = $1',
      [id],
    );
    return r.rows[0].reinstall_requested_at;
  }

  describe('reinstall request mark (CLE-T-NNENG8)', () => {
    it.each(['connected', 'error'] as const)(
      '%s row: App URL goes to the detail page until reauthorize leaves the mark, then to the authorize URL',
      async (status) => {
        const mallId = 'mall-' + randomBytes(4).toString('hex');
        const installToken = makeInstallToken();
        const id = await insertPrivateIntegration({
          mallId,
          installToken,
          status,
        });

        const before = await request(BASE_URL)
          .get(`/api/3rd-party/cafe24/install/${installToken}`)
          .query(signedInstallQuery(mallId));
        expect(before.status).toBe(302);
        expect(before.headers.location).not.toContain('oauth/authorize');
        expect(before.headers.location).toContain(id);

        const reauth = await request(BASE_URL)
          .post(`/api/integrations/${id}/reauthorize`)
          .set('Authorization', `Bearer ${owner.accessToken}`)
          .set('X-Workspace-Id', workspaceId);
        expect(reauth.status).toBe(200);
        expect(reauth.body.data).toEqual(
          expect.objectContaining({
            mode: 'cafe24_private_pending',
            integrationId: id,
            appUrl: expect.stringContaining(`/install/${installToken}`),
          }),
        );
        expect(reauth.body.data.scopesAdded).toBeUndefined();

        // 표시만 남고 상태 · 사유는 그대로다.
        const row = await db.query<{
          status: string;
          reinstall_requested_at: Date | null;
        }>(
          'SELECT status, reinstall_requested_at FROM integration WHERE id = $1',
          [id],
        );
        expect(row.rows[0].status).toBe(status);
        expect(row.rows[0].reinstall_requested_at).toBeInstanceOf(Date);

        const after = await request(BASE_URL)
          .get(`/api/3rd-party/cafe24/install/${installToken}`)
          .query(signedInstallQuery(mallId));
        expect(after.status).toBe(302);
        expect(after.headers.location).toContain('oauth/authorize');
        expect(after.headers.location).toContain(`${mallId}.cafe24api.com`);

        // 통합 조회 응답에도 표시가 실린다.
        const got = await request(BASE_URL)
          .get(`/api/integrations/${id}`)
          .set('Authorization', `Bearer ${owner.accessToken}`)
          .set('X-Workspace-Id', workspaceId);
        expect(got.status).toBe(200);
        expect(typeof got.body.data.reinstallRequestedAt).toBe('string');
      },
    );

    it('request-scopes merges scopes and leaves the mark on a connected row', async () => {
      const mallId = 'mall-' + randomBytes(4).toString('hex');
      const installToken = makeInstallToken();
      const id = await insertPrivateIntegration({
        mallId,
        installToken,
        status: 'connected',
      });

      const res = await request(BASE_URL)
        .post(`/api/integrations/${id}/request-scopes`)
        .set('Authorization', `Bearer ${owner.accessToken}`)
        .set('X-Workspace-Id', workspaceId)
        .send({ scopes: ['mall.read_order'] });
      expect(res.status).toBe(200);
      expect(res.body.data).toEqual(
        expect.objectContaining({
          mode: 'cafe24_private_pending',
          scopesAdded: ['mall.read_order'],
        }),
      );
      expect(await readMark(id)).toBeInstanceOf(Date);
    });

    it('pending_install row: reauthorize is rejected and leaves no mark', async () => {
      const mallId = 'mall-' + randomBytes(4).toString('hex');
      const installToken = makeInstallToken();
      const id = await insertPendingInstall({ mallId, installToken });

      const res = await request(BASE_URL)
        .post(`/api/integrations/${id}/reauthorize`)
        .set('Authorization', `Bearer ${owner.accessToken}`)
        .set('X-Workspace-Id', workspaceId);
      // 설치 대기 행은 begin 으로 넘어가 400 으로 거절된다(화면은 버튼을 막는다). 코드는 고정하지 않는다:
      // `:id/reauthorize` 가 begin 에 mall_id 를 넘기지 않아 지금은 CAFE24_INVALID_MALL_ID 가 먼저 난다
      // (이번 변경 전부터 있던 결함, NERV Task CLE-T-WB7JPC 가 고친다).
      expect(res.status).toBe(400);
      expect(await readMark(id)).toBeNull();
    });
  });

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

    // W-38 — App URL spec §header 의 rejection paths 표에 "mall_id 불일치
    // (row recovery fall-through 후에도) → 403" 케이스가 명시됐으나 e2e 누락.
    // install_token 으로 찾은 row 의 mall_id 와 query 의 mall_id 가 다르면
    // (intruder 가 자기 mall 로 다른 사람의 install_token 을 들고 와도)
    // HMAC 메시지 안에 mall_id 가 포함돼 검증이 실패한다. spec 표기와 실제
    // 동작이 일치함을 회귀로 박제.
    it('mall_id mismatch with install_token row → 403 CAFE24_INSTALL_INVALID_HMAC', async () => {
      const rowMallId = 'mall-' + randomBytes(4).toString('hex');
      const installToken = makeInstallToken();
      await insertPendingInstall({ mallId: rowMallId, installToken });

      // 공격 시나리오: install_token 은 정상이지만 query 의 mall_id 가 row
      // 와 다르다. attacker 는 row 의 client_secret 을 모르므로 정확한 HMAC
      // 을 만들 수 없지만, 설령 자신의 secret 으로 HMAC 을 만들어도 거부됨.
      const intruderMallId = 'mall-' + randomBytes(4).toString('hex');
      const ts = Math.floor(Date.now() / 1000).toString();
      const base = `mall_id=${intruderMallId}&timestamp=${ts}&user_id=admin`;
      const hmac = computeHmac(buildHmacMessage(base), clientSecret);
      const rawQuery = `${base}&hmac=${encodeURIComponent(hmac)}`;

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
