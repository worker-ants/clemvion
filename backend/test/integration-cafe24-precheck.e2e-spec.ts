import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { Client } from 'pg';
import request from 'supertest';

import { createDbClient, uniqueEmail, uniqueName } from './helpers/db';
import { registerAndLogin, createTeamWorkspace } from './helpers/auth';

/**
 * e2e: Cafe24 mall_id precheck endpoint — spec/2-navigation/4-integration.md §9.2.
 *
 * 보호 대상:
 *   - 새로운 mall_id 는 conflict=false (begin 호출 안전)
 *   - 같은 mall_id 의 connected cafe24 통합이 있으면 conflict=true + status='connected'
 *   - mallId 형식 위반 시 400 (BadRequest)
 *   - 자격 증명 / 토큰 / timestamps 미노출 (response shape 검증)
 *   - 라우트 선언 순서 회귀 — `cafe24/precheck` 가 동적 `@Get(':id')` 보다 먼저 매칭되어야 함
 *     (NestJS 라우트가 `@Get(':id')` 와 `ParseUUIDPipe` 에 잡혀 400 으로 빠지는 회귀 차단)
 *   - cross-workspace 격리 — 다른 워크스페이스의 cafe24 통합은 노출되지 않음
 */

const BASE_URL = process.env.E2E_BASE_URL ?? 'http://backend-e2e:3011';

describe('Cafe24 precheck endpoint (e2e)', () => {
  let db: Client;
  let token: string;
  let workspaceId: string;
  let otherWorkspaceId: string;

  beforeAll(async () => {
    db = createDbClient();
    await db.connect();
    const owner = await registerAndLogin(BASE_URL, uniqueEmail('cafe24-pre'), db);
    token = owner.accessToken;
    workspaceId = await createTeamWorkspace(
      BASE_URL,
      token,
      uniqueName('CAFE24'),
    );
    otherWorkspaceId = await createTeamWorkspace(
      BASE_URL,
      token,
      uniqueName('CAFE24-OTHER'),
    );
  }, 60_000);

  afterAll(async () => {
    await db.end();
  });

  async function insertCafe24Row(opts: {
    workspaceId: string;
    mallId: string;
    status: 'connected' | 'pending_install' | 'expired' | 'error';
    name?: string;
  }): Promise<string> {
    const name = opts.name ?? uniqueName('cafe24');
    // 직접 DB INSERT — controller 의 cafe24 create 흐름은 OAuth 가 필요해
    // e2e 에서 시뮬레이션이 번거롭다. precheck endpoint 는 row 의 status /
    // mallId 만 보므로 minimal row 로 충분.
    const r = await db.query<{ id: string }>(
      `INSERT INTO integration
        (workspace_id, service_type, auth_type, name, scope, status, mall_id, credentials)
       VALUES ($1, 'cafe24', 'oauth2', $2, 'personal', $3, $4, '\\x'::bytea)
       RETURNING id`,
      [opts.workspaceId, name, opts.status, opts.mallId],
    );
    return r.rows[0].id;
  }

  it('returns conflict=false when no cafe24 row matches the mall_id', async () => {
    const res = await request(BASE_URL)
      .get('/api/integrations/cafe24/precheck')
      .query({ mallId: 'fresh-mall-' + Date.now().toString(36) })
      .set('Authorization', `Bearer ${token}`)
      .set('X-Workspace-Id', workspaceId);
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ conflict: false });
  });

  it('returns conflict=true with status=connected when a connected row exists', async () => {
    const mallId = 'conn-' + Math.random().toString(36).slice(2, 8);
    const name = uniqueName('Cafe24Conn');
    const integrationId = await insertCafe24Row({
      workspaceId,
      mallId,
      status: 'connected',
      name,
    });

    const res = await request(BASE_URL)
      .get('/api/integrations/cafe24/precheck')
      .query({ mallId })
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

  it('rejects mallId with invalid characters (400)', async () => {
    const res = await request(BASE_URL)
      .get('/api/integrations/cafe24/precheck')
      .query({ mallId: 'INVALID_UPPER' })
      .set('Authorization', `Bearer ${token}`)
      .set('X-Workspace-Id', workspaceId);
    expect(res.status).toBe(400);
  });

  it('rejects missing mallId (400)', async () => {
    const res = await request(BASE_URL)
      .get('/api/integrations/cafe24/precheck')
      .set('Authorization', `Bearer ${token}`)
      .set('X-Workspace-Id', workspaceId);
    expect(res.status).toBe(400);
  });

  /**
   * 라우트 순서 회귀 — `cafe24/precheck` 가 `@Get(':id')` 보다 앞에 선언되어야
   * 한다. 뒤에 선언되면 NestJS 가 `id='cafe24'` 의 ParseUUIDPipe 위반을
   * 먼저 발생시켜 본 endpoint 가 절대 호출되지 않는다. consistency-check
   * Warning #7 (2026-05-16) 회귀 안전망.
   */
  it('route order — cafe24/precheck is matched before @Get(":id") (no ParseUUIDPipe 400)', async () => {
    const res = await request(BASE_URL)
      .get('/api/integrations/cafe24/precheck')
      .query({ mallId: 'route-order-' + Math.random().toString(36).slice(2, 8) })
      .set('Authorization', `Bearer ${token}`)
      .set('X-Workspace-Id', workspaceId);
    // route 가 잘못 잡히면 ParseUUIDPipe 가 'cafe24' 를 UUID 로 해석 시도해
    // 400 (BAD_REQUEST: Validation failed (uuid is expected)) 으로 떨어진다.
    // 200 인 경우만 정상.
    expect(res.status).toBe(200);
  });

  it('isolates conflicts across workspaces — other workspace rows are not visible', async () => {
    const mallId = 'cross-' + Math.random().toString(36).slice(2, 8);
    // 다른 워크스페이스에만 row 생성
    await insertCafe24Row({
      workspaceId: otherWorkspaceId,
      mallId,
      status: 'connected',
    });

    const res = await request(BASE_URL)
      .get('/api/integrations/cafe24/precheck')
      .query({ mallId })
      .set('Authorization', `Bearer ${token}`)
      .set('X-Workspace-Id', workspaceId);
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ conflict: false });
  });

  it('requires authentication (401 without bearer token)', async () => {
    const res = await request(BASE_URL)
      .get('/api/integrations/cafe24/precheck')
      .query({ mallId: 'unauth-test' });
    expect(res.status).toBe(401);
  });
});
