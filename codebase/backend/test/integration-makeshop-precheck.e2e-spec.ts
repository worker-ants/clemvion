import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { Client } from 'pg';
import request from 'supertest';

import { createDbClient, uniqueEmail, uniqueName } from './helpers/db';
import { registerAndLogin, createTeamWorkspace } from './helpers/auth';

type RegisterResult = Awaited<ReturnType<typeof registerAndLogin>>;

/**
 * e2e: MakeShop shop_uid precheck endpoint —
 * `GET /api/integrations/makeshop/precheck` (cafe24/precheck 의 makeshop 대응).
 * spec/2-navigation/4-integration.md §5.9.
 *
 * 보호 대상 (cafe24 precheck e2e 미러):
 *   - 새로운 shop_uid 는 conflict=false (begin 호출 안전)
 *   - 같은 shop_uid 의 connected makeshop 통합이 있으면 conflict=true + status='connected'
 *   - pending_install row 만 있으면 status='pending_install'
 *   - shopUid 형식 위반 시 400 (BadRequest)
 *   - 자격 증명 / 토큰 미노출 (response shape 검증)
 *   - 라우트 선언 순서 회귀 — `makeshop/precheck` 가 동적 `@Get(':id')` 보다 먼저
 *     매칭되어야 함 (ParseUUIDPipe 400 회귀 차단)
 *   - cross-workspace 격리 — 다른 워크스페이스의 makeshop 통합은 노출되지 않음
 *   - 미인증 시 401
 *
 * shop_uid 는 mall_id 컬럼에 투영된다 (V071) — precheck 는 그 컬럼만 본다.
 */

const BASE_URL = process.env.E2E_BASE_URL ?? 'http://backend-e2e:3011';

describe('MakeShop precheck endpoint (e2e)', () => {
  let db: Client;
  let owner: RegisterResult;
  let token: string;
  let workspaceId: string;
  let otherWorkspaceId: string;

  beforeAll(async () => {
    db = createDbClient();
    await db.connect();
    owner = await registerAndLogin(BASE_URL, uniqueEmail('makeshop-pre'), db);
    token = owner.accessToken;
    workspaceId = await createTeamWorkspace(
      BASE_URL,
      token,
      uniqueName('MAKESHOP'),
    );
    otherWorkspaceId = await createTeamWorkspace(
      BASE_URL,
      token,
      uniqueName('MAKESHOP-OTHER'),
    );
  }, 60_000);

  afterAll(async () => {
    await db.end();
  });

  async function insertMakeshopRow(opts: {
    workspaceId: string;
    shopUid: string;
    status: 'connected' | 'pending_install' | 'expired' | 'error';
    name?: string;
  }): Promise<string> {
    const name = opts.name ?? uniqueName('makeshop');
    // 직접 DB INSERT — makeshop create 흐름은 ShopStore install (OAuth) 가
    // 필요해 e2e 에서 시뮬레이션이 번거롭다. precheck endpoint 는 row 의
    // status / shop_uid(=mall_id 투영) 만 보므로 minimal row 로 충분.
    // credentials 는 precheck 가 읽지 않으므로 빈 객체.
    const r = await db.query<{ id: string }>(
      `INSERT INTO integration
        (workspace_id, service_type, auth_type, name, scope, status, mall_id, credentials, created_by)
       VALUES ($1, 'makeshop', 'oauth2', $2, 'personal', $3, $4, '{}'::jsonb, $5)
       RETURNING id`,
      [opts.workspaceId, name, opts.status, opts.shopUid, owner.userId],
    );
    return r.rows[0].id;
  }

  it('returns conflict=false when no makeshop row matches the shop_uid', async () => {
    const res = await request(BASE_URL)
      .get('/api/integrations/makeshop/precheck')
      .query({ shopUid: 'freshshop' + Date.now().toString(36) })
      .set('Authorization', `Bearer ${token}`)
      .set('X-Workspace-Id', workspaceId);
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ conflict: false });
  });

  it('returns conflict=true with status=connected when a connected row exists', async () => {
    const shopUid = 'conn' + Math.random().toString(36).slice(2, 8);
    const name = uniqueName('MakeshopConn');
    const integrationId = await insertMakeshopRow({
      workspaceId,
      shopUid,
      status: 'connected',
      name,
    });

    const res = await request(BASE_URL)
      .get('/api/integrations/makeshop/precheck')
      .query({ shopUid })
      .set('Authorization', `Bearer ${token}`)
      .set('X-Workspace-Id', workspaceId);
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({
      conflict: true,
      existingIntegrationId: integrationId,
      existingName: name,
      status: 'connected',
    });
    // 자격 증명 누설 방어 — 응답 shape 에 (id, name, status, conflict) 외
    // 어떤 키도 있어서는 안 된다.
    expect(Object.keys(res.body.data).sort()).toEqual([
      'conflict',
      'existingIntegrationId',
      'existingName',
      'status',
    ]);
  });

  it('returns status=pending_install when only a pending_install row exists', async () => {
    const shopUid = 'pend' + Math.random().toString(36).slice(2, 8);
    const name = uniqueName('MakeshopPending');
    const integrationId = await insertMakeshopRow({
      workspaceId,
      shopUid,
      status: 'pending_install',
      name,
    });

    const res = await request(BASE_URL)
      .get('/api/integrations/makeshop/precheck')
      .query({ shopUid })
      .set('Authorization', `Bearer ${token}`)
      .set('X-Workspace-Id', workspaceId);
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({
      conflict: true,
      existingIntegrationId: integrationId,
      existingName: name,
      status: 'pending_install',
    });
  });

  it('rejects shopUid with invalid characters (400)', async () => {
    const res = await request(BASE_URL)
      .get('/api/integrations/makeshop/precheck')
      .query({ shopUid: 'bad/uid' })
      .set('Authorization', `Bearer ${token}`)
      .set('X-Workspace-Id', workspaceId);
    expect(res.status).toBe(400);
  });

  it('rejects missing shopUid (400)', async () => {
    const res = await request(BASE_URL)
      .get('/api/integrations/makeshop/precheck')
      .set('Authorization', `Bearer ${token}`)
      .set('X-Workspace-Id', workspaceId);
    expect(res.status).toBe(400);
  });

  /**
   * 라우트 순서 회귀 — `makeshop/precheck` 가 `@Get(':id')` 보다 앞에 선언되어야
   * 한다. 뒤에 선언되면 NestJS 가 `id='makeshop'` 의 ParseUUIDPipe 위반을
   * 먼저 발생시켜 본 endpoint 가 절대 호출되지 않는다. (cafe24/precheck 와 동일
   * 회귀 안전망.)
   */
  it('route order — makeshop/precheck is matched before @Get(":id") (no ParseUUIDPipe 400)', async () => {
    const res = await request(BASE_URL)
      .get('/api/integrations/makeshop/precheck')
      .query({
        shopUid: 'routeorder' + Math.random().toString(36).slice(2, 8),
      })
      .set('Authorization', `Bearer ${token}`)
      .set('X-Workspace-Id', workspaceId);
    // route 가 잘못 잡히면 ParseUUIDPipe 가 'makeshop' 를 UUID 로 해석 시도해
    // 400 으로 떨어진다. 200 인 경우만 정상.
    expect(res.status).toBe(200);
  });

  it('isolates conflicts across workspaces — other workspace rows are not visible', async () => {
    const shopUid = 'cross' + Math.random().toString(36).slice(2, 8);
    // 다른 워크스페이스에만 row 생성
    await insertMakeshopRow({
      workspaceId: otherWorkspaceId,
      shopUid,
      status: 'connected',
    });

    const res = await request(BASE_URL)
      .get('/api/integrations/makeshop/precheck')
      .query({ shopUid })
      .set('Authorization', `Bearer ${token}`)
      .set('X-Workspace-Id', workspaceId);
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ conflict: false });
  });

  it('requires authentication (401 without bearer token)', async () => {
    const res = await request(BASE_URL)
      .get('/api/integrations/makeshop/precheck')
      .query({ shopUid: 'unauthshop' });
    expect(res.status).toBe(401);
  });
});
