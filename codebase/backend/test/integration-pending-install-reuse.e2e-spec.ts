import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { randomBytes } from 'crypto';
import { Client } from 'pg';
import request from 'supertest';

import { createDbClient, uniqueEmail, uniqueName } from './helpers/db';
import {
  registerAndLogin,
  createTeamWorkspace,
  inviteAndAccept,
} from './helpers/auth';

/**
 * e2e: `oauth/begin`(`new`)의 설치 대기 행 재사용 권한과 잠금 (NERV Task CLE-T-N7ENKQ).
 *
 * 근거: [OAuth 연결과 토큰 갱신 「설치 대기 행 재사용의 권한」](CLE-INT-OAUTH#설치-대기-행-재사용의-권한)
 * REQ-INTOAUTH-058 ~ 062 · 065 ~ 067.
 *
 * 보호 대상 invariants:
 *   - 같은 `(workspace_id, client_id)` 의 MakeShop begin 이 동시에 들어와도 설치 대기 행은 하나다(advisory lock)
 *   - 같은 상점의 Cafe24 Private begin 이 동시에 들어와도 모두 같은 행을 받는다(UNIQUE 위반 뒤 한 번 다시 판정)
 *   - 남의 개인 설치 대기 행은 다시 쓰지 않는다. 409 에 그 행의 통합 ID · App URL 이 없고 설치 기한만 있다
 *   - 조직 설치 대기 행은 관리자 이상만 다시 쓴다. 다시 쓰면 응답 `scope` 는 그 행의 공개 범위다
 *   - MakeShop 설치 대기 행이 여럿이면 요청자가 바꿀 수 있는 행을 먼저 고른다
 *   - 409 `CAFE24_PRIVATE_APP_ALREADY_CONNECTED` 는 겹친 행의 통합 ID 를 싣지 않는다
 *
 * 액터: Owner · Admin(승격) · Editor A · Editor B.
 */

const BASE_URL = process.env.E2E_BASE_URL ?? 'http://backend-e2e:3011';

type Actor = { userId: string; accessToken: string };

/** 동시 begin 수. 잠금이 없으면 이만큼 행이 생긴다. */
const CONCURRENT_BEGINS = 5;

describe('oauth/begin pending-install reuse (e2e)', () => {
  let db: Client;
  let owner: Actor;
  let admin: Actor;
  let editorA: Actor;
  let editorB: Actor;
  let ws: string;

  const begin = (actor: Actor, body: object) =>
    request(BASE_URL)
      .post('/api/integrations/oauth/begin')
      .set('Authorization', `Bearer ${actor.accessToken}`)
      .set('X-Workspace-Id', ws)
      .send({ scopes: [], mode: 'new', ...body });

  // 이름을 비우면 기본 이름 'MakeShop' 이 워크스페이스 이름 UNIQUE 에 걸린다. 화면은 늘 이름을 보낸다.
  const makeshop = (clientId: string, scope?: string) => ({
    service: 'makeshop',
    clientId,
    clientSecret: 'e2e-makeshop-secret',
    integrationName: uniqueName('ipr-mk'),
    ...(scope ? { scope } : {}),
  });

  // 이름을 비워 같은 상점의 begin 이 같은 기본 이름(`<mall> (Cafe24 Private)`)을 쓰게 한다. 동시 begin 의 늦은 쪽이
  // 이름 UNIQUE 에 먼저 걸리는 경로를 덮는다.
  const cafe24Private = (mallId: string, scope?: string) => ({
    service: 'cafe24',
    mallId,
    appType: 'private',
    clientId: 'e2e-cafe24-client',
    clientSecret: 'e2e-cafe24-secret',
    ...(scope ? { scope } : {}),
  });

  const answerOf = (res: request.Response): string =>
    `${res.status} ${res.body?.error?.code ?? ''}`.trim();

  const freshClientId = () => `mk-${randomBytes(6).toString('hex')}`;
  const freshMall = () => `mall-${randomBytes(4).toString('hex')}`;

  const countPending = async (serviceType: string): Promise<number> => {
    const r = await db.query<{ n: string }>(
      `SELECT count(*) AS n FROM integration
        WHERE workspace_id = $1 AND service_type = $2 AND status = 'pending_install'`,
      [ws, serviceType],
    );
    return Number(r.rows[0].n);
  };

  /** 409 본문이 그 행의 통합 ID 와 설치 토큰을 싣지 않고 설치 기한만 싣는지 본다. */
  const expectPendingConflict = async (
    res: request.Response,
    code: string,
    rowId: string,
  ) => {
    expect(answerOf(res)).toBe(`409 ${code}`);
    const r = await db.query<{ install_token: string; expires_at: Date }>(
      `SELECT install_token,
              COALESCE(install_token_issued_at, created_at) + interval '24 hours' AS expires_at
         FROM integration WHERE id = $1`,
      [rowId],
    );
    const { install_token: token, expires_at: expiresAt } = r.rows[0];
    expect(res.body.error.details).toEqual({
      pendingInstallExpiresAt: new Date(expiresAt).toISOString(),
    });
    const raw = JSON.stringify(res.body);
    expect(raw).not.toContain(rowId);
    expect(raw).not.toContain(token);
  };

  beforeAll(async () => {
    db = createDbClient();
    await db.connect();

    owner = await registerAndLogin(BASE_URL, uniqueEmail('ipr-own'), db);
    ws = await createTeamWorkspace(
      BASE_URL,
      owner.accessToken,
      uniqueName('IPR'),
    );
    editorA = await inviteAndAccept(
      BASE_URL,
      owner.accessToken,
      ws,
      uniqueEmail('ipr-ed-a'),
      'editor',
      db,
    );
    editorB = await inviteAndAccept(
      BASE_URL,
      owner.accessToken,
      ws,
      uniqueEmail('ipr-ed-b'),
      'editor',
      db,
    );
    // 헬퍼 `inviteAndAccept` 는 admin 을 받지 않는다 — editor 로 초대한 뒤 owner 가 승격한다.
    admin = await inviteAndAccept(
      BASE_URL,
      owner.accessToken,
      ws,
      uniqueEmail('ipr-adm'),
      'editor',
      db,
    );
    const adminMember = await db.query<{ id: string }>(
      'SELECT id FROM workspace_member WHERE workspace_id = $1 AND user_id = $2',
      [ws, admin.userId],
    );
    const promote = await request(BASE_URL)
      .patch(`/api/workspaces/${ws}/members/${adminMember.rows[0].id}`)
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({ role: 'admin' });
    expect(promote.status).toBe(200);
  }, 120_000);

  afterAll(async () => {
    await db.end();
  });

  describe('MakeShop', () => {
    it(`같은 client_id 의 begin ${CONCURRENT_BEGINS}건이 동시에 들어와도 설치 대기 행은 하나다`, async () => {
      const clientId = freshClientId();
      const before = await countPending('makeshop');
      const results = await Promise.all(
        Array.from({ length: CONCURRENT_BEGINS }, () =>
          begin(editorA, makeshop(clientId)),
        ),
      );
      for (const res of results) expect(res.status).toBe(200);
      const ids = new Set(
        results.map(
          (res) => (res.body.data as { integrationId: string }).integrationId,
        ),
      );
      expect(ids.size).toBe(1);
      expect(await countPending('makeshop')).toBe(before + 1);
    });

    it('남의 개인 설치 대기 행은 409 MAKESHOP_INSTALL_PENDING 이고, 기한이 지났어도 스캐너 전이면 같은 409 다', async () => {
      const clientId = freshClientId();
      const first = await begin(editorA, makeshop(clientId));
      expect(first.status).toBe(200);
      const rowId = (first.body.data as { integrationId: string })
        .integrationId;
      expect((first.body.data as { scope: string }).scope).toBe('personal');

      const res = await begin(editorB, makeshop(clientId));
      await expectPendingConflict(res, 'MAKESHOP_INSTALL_PENDING', rowId);

      // 기한이 지났지만 만료 스캐너가 아직 바꾸지 않은 행 — 지난 기한이 그대로 실린다.
      await db.query(
        `UPDATE integration SET install_token_issued_at = now() - interval '30 hours' WHERE id = $1`,
        [rowId],
      );
      const late = await begin(editorB, makeshop(clientId));
      await expectPendingConflict(late, 'MAKESHOP_INSTALL_PENDING', rowId);
      expect(
        new Date(late.body.error.details.pendingInstallExpiresAt).getTime(),
      ).toBeLessThan(Date.now());
    });

    it('설치 대기 행이 여럿이면 요청자가 바꿀 수 있는 행을 먼저 고른다', async () => {
      const clientId = freshClientId();
      const mine = await begin(editorA, makeshop(clientId));
      expect(mine.status).toBe(200);
      const mineId = (mine.body.data as { integrationId: string })
        .integrationId;
      // 더 앞선 남의 개인 행을 직접 넣는다. 자격 증명은 평문 JSONB 다(복호화가 그대로 읽는다).
      const others = await db.query<{ id: string }>(
        `INSERT INTO integration
          (workspace_id, service_type, auth_type, name, scope, status,
           install_token, install_token_issued_at, credentials, created_by, created_at)
         VALUES ($1, 'makeshop', 'oauth2', $2, 'personal', 'pending_install',
           $3, now(), $4::jsonb, $5, now() - interval '1 hour')
         RETURNING id`,
        [
          ws,
          uniqueName('ipr-mk-older'),
          randomBytes(16).toString('base64url'),
          JSON.stringify({
            client_id: clientId,
            client_secret: 'e2e-makeshop-secret',
            scopes: [],
          }),
          editorB.userId,
        ],
      );
      const othersId = others.rows[0].id;

      const again = await begin(editorA, makeshop(clientId));
      expect(again.status).toBe(200);
      expect((again.body.data as { integrationId: string }).integrationId).toBe(
        mineId,
      );
      // 바꿀 수 있는 행이 없는 멤버는 순서상 첫 행(남의 개인 행)으로 409 를 받는다.
      const byAdmin = await begin(admin, makeshop(clientId));
      await expectPendingConflict(
        byAdmin,
        'MAKESHOP_INSTALL_PENDING',
        othersId,
      );
    });

    it('조직 설치 대기 행은 편집자에게 403 ADMIN_REQUIRED, 관리자는 개인 범위로 요청해도 그 행을 다시 쓴다', async () => {
      const clientId = freshClientId();
      const org = await begin(admin, makeshop(clientId, 'organization'));
      expect(org.status).toBe(200);
      const orgId = (org.body.data as { integrationId: string }).integrationId;
      expect((org.body.data as { scope: string }).scope).toBe('organization');
      const before = await countPending('makeshop');

      const byEditor = await begin(editorA, makeshop(clientId));
      expect(answerOf(byEditor)).toBe('403 ADMIN_REQUIRED');

      const byOwner = await begin(owner, makeshop(clientId, 'personal'));
      expect(byOwner.status).toBe(200);
      expect(byOwner.body.data).toMatchObject({
        integrationId: orgId,
        scope: 'organization',
      });
      const row = await db.query<{ scope: string; created_by: string }>(
        'SELECT scope, created_by FROM integration WHERE id = $1',
        [orgId],
      );
      expect(row.rows[0]).toEqual({
        scope: 'organization',
        created_by: admin.userId,
      });
      expect(await countPending('makeshop')).toBe(before);
    });
  });

  describe('Cafe24 Private', () => {
    it('같은 상점의 begin 이 동시에 들어와도 모두 같은 설치 대기 행을 받는다', async () => {
      const mallId = freshMall();
      const before = await countPending('cafe24');
      const results = await Promise.all(
        Array.from({ length: CONCURRENT_BEGINS }, () =>
          begin(editorA, cafe24Private(mallId)),
        ),
      );
      for (const res of results) expect(answerOf(res)).toBe('200');
      const ids = new Set(
        results.map(
          (res) => (res.body.data as { integrationId: string }).integrationId,
        ),
      );
      expect(ids.size).toBe(1);
      expect(await countPending('cafe24')).toBe(before + 1);
    });

    it('남의 개인 설치 대기 행은 409 CAFE24_PRIVATE_APP_INSTALL_PENDING, 통합 소유자는 다시 쓴다', async () => {
      const mallId = freshMall();
      const first = await begin(editorA, cafe24Private(mallId));
      expect(first.status).toBe(200);
      const rowId = (first.body.data as { integrationId: string })
        .integrationId;

      const byOther = await begin(editorB, cafe24Private(mallId));
      await expectPendingConflict(
        byOther,
        'CAFE24_PRIVATE_APP_INSTALL_PENDING',
        rowId,
      );

      const again = await begin(editorA, cafe24Private(mallId));
      expect(again.status).toBe(200);
      expect(again.body.data).toMatchObject({
        integrationId: rowId,
        scope: 'personal',
        appUrl: (first.body.data as { appUrl: string }).appUrl,
      });
    });

    it('조직 설치 대기 행은 편집자에게 403 ADMIN_REQUIRED 다', async () => {
      const mallId = freshMall();
      const org = await begin(admin, cafe24Private(mallId, 'organization'));
      expect(org.status).toBe(200);
      const byEditor = await begin(editorA, cafe24Private(mallId));
      expect(answerOf(byEditor)).toBe('403 ADMIN_REQUIRED');
    });

    it('409 CAFE24_PRIVATE_APP_ALREADY_CONNECTED 는 겹친 행의 통합 ID 를 싣지 않는다', async () => {
      const mallId = freshMall();
      const connected = await db.query<{ id: string }>(
        `INSERT INTO integration
          (workspace_id, service_type, auth_type, name, scope, status,
           mall_id, credentials, created_by)
         VALUES ($1, 'cafe24', 'oauth2', $2, 'personal', 'connected',
           $3, $4::jsonb, $5)
         RETURNING id`,
        [
          ws,
          uniqueName('ipr-cafe24-connected'),
          mallId,
          JSON.stringify({
            mall_id: mallId,
            app_type: 'private',
            client_id: 'x',
            client_secret: 'y',
          }),
          editorB.userId,
        ],
      );
      const res = await begin(editorA, cafe24Private(mallId));
      expect(answerOf(res)).toBe('409 CAFE24_PRIVATE_APP_ALREADY_CONNECTED');
      expect(JSON.stringify(res.body)).not.toContain(connected.rows[0].id);
    });
  });
});
