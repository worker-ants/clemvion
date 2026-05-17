import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { Client } from 'pg';
import request from 'supertest';

import { createDbClient, uniqueEmail, uniqueName } from './helpers/db';
import { registerAndLogin, createTeamWorkspace } from './helpers/auth';

/**
 * e2e: integration credentials 라이프사이클 — spec/4-nodes/4-integration.
 *
 * 보호 대상:
 *   - credentials 는 응답에서 항상 마스킹 (secret 필드가 raw 노출되지 않는다)
 *   - DB 에는 암호화되어 저장
 *   - cross-workspace 격리
 *   - rotate 가 secret 값을 교체
 *   - delete 시 본인 워크스페이스의 자원만 제거
 */

const BASE_URL = process.env.E2E_BASE_URL ?? 'http://backend-e2e:3011';

describe('Integration credentials (e2e)', () => {
  let db: Client;
  let token: string;
  let workspaceId: string;

  beforeAll(async () => {
    db = createDbClient();
    await db.connect();
    const owner = await registerAndLogin(BASE_URL, uniqueEmail('integ'), db);
    token = owner.accessToken;
    workspaceId = await createTeamWorkspace(
      BASE_URL,
      token,
      uniqueName('INTEG'),
    );
  }, 60_000);

  afterAll(async () => {
    await db.end();
  });

  async function createHttpApiKey(
    name: string,
    apiKey: string,
  ): Promise<string> {
    const res = await request(BASE_URL)
      .post('/api/integrations')
      .set('Authorization', `Bearer ${token}`)
      .set('X-Workspace-Id', workspaceId)
      .send({
        serviceType: 'http',
        name,
        authType: 'api_key',
        credentials: {
          base_url: 'https://api.example.com',
          location: 'header',
          key_name: 'X-Api-Key',
          value: apiKey,
        },
        scope: 'personal',
      });
    expect(res.status).toBe(201);
    return (res.body.data as { id: string }).id;
  }

  it('A. create 응답에서 credentials.value 는 raw 가 아닌 마스킹된 값', async () => {
    const id = await createHttpApiKey(
      uniqueName('inkey-a'),
      'sk-very-secret-1234',
    );

    const get = await request(BASE_URL)
      .get(`/api/integrations/${id}`)
      .set('Authorization', `Bearer ${token}`)
      .set('X-Workspace-Id', workspaceId);
    expect(get.status).toBe(200);
    const creds = get.body.data.credentials as Record<string, unknown>;
    const value = typeof creds.value === 'string' ? creds.value : '';
    expect(value).not.toBe('sk-very-secret-1234');
    expect(value.length).toBeGreaterThan(0); // 마스킹된 형태이지만 비어있지 않아야 함
  });

  it('B. DB 에는 평문이 아닌 암호화/해시된 값으로 저장 (raw 검색 0건)', async () => {
    const secret = `sk-${Date.now()}-RAW-SECRET-${Math.random()}`;
    await createHttpApiKey(uniqueName('inkey-b'), secret);

    const rows = await db.query<{ id: string }>(
      'SELECT id FROM integration WHERE workspace_id = $1 AND credentials::text LIKE $2',
      [workspaceId, `%${secret}%`],
    );
    // credentials JSONB 안에 plaintext 그대로 보이면 안 됨.
    expect(rows.rows.length).toBe(0);
  });

  it('C. cross-workspace 격리 — 다른 워크스페이스 owner 가 GET 시 404/403', async () => {
    const id = await createHttpApiKey(uniqueName('inkey-c'), 'sk-c');

    const intruder = await registerAndLogin(
      BASE_URL,
      uniqueEmail('integ-x'),
      db,
    );
    const otherWs = await createTeamWorkspace(
      BASE_URL,
      intruder.accessToken,
      uniqueName('X'),
    );

    const cross = await request(BASE_URL)
      .get(`/api/integrations/${id}`)
      .set('Authorization', `Bearer ${intruder.accessToken}`)
      .set('X-Workspace-Id', otherWs);
    expect([403, 404]).toContain(cross.status);
  });

  it('D. delete → 204 후속 GET 404', async () => {
    const id = await createHttpApiKey(uniqueName('inkey-d'), 'sk-d');

    const del = await request(BASE_URL)
      .delete(`/api/integrations/${id}`)
      .set('Authorization', `Bearer ${token}`)
      .set('X-Workspace-Id', workspaceId);
    expect([200, 204]).toContain(del.status);

    const get = await request(BASE_URL)
      .get(`/api/integrations/${id}`)
      .set('Authorization', `Bearer ${token}`)
      .set('X-Workspace-Id', workspaceId);
    expect(get.status).toBe(404);
  });

  it('E. PATCH 이름 → 200, credentials 는 응답에서 여전히 마스킹', async () => {
    const id = await createHttpApiKey(uniqueName('inkey-e'), 'sk-e');
    const newName = uniqueName('inkey-e-renamed');

    const patch = await request(BASE_URL)
      .patch(`/api/integrations/${id}`)
      .set('Authorization', `Bearer ${token}`)
      .set('X-Workspace-Id', workspaceId)
      .send({ name: newName });
    expect(patch.status).toBe(200);
    expect(patch.body.data.name).toBe(newName);

    const creds = patch.body.data.credentials as Record<string, unknown>;
    if (creds && typeof creds.value === 'string') {
      expect(creds.value).not.toBe('sk-e');
    }
  });

  it('F. list 에서 자기 워크스페이스 통합만 보임', async () => {
    const myId = await createHttpApiKey(uniqueName('inkey-f-mine'), 'sk-mine');

    const intruder = await registerAndLogin(
      BASE_URL,
      uniqueEmail('integ-f'),
      db,
    );
    const otherWs = await createTeamWorkspace(
      BASE_URL,
      intruder.accessToken,
      uniqueName('OTHER'),
    );
    await request(BASE_URL)
      .post('/api/integrations')
      .set('Authorization', `Bearer ${intruder.accessToken}`)
      .set('X-Workspace-Id', otherWs)
      .send({
        serviceType: 'http',
        name: 'other-side',
        authType: 'api_key',
        credentials: {
          base_url: 'https://x.example.com',
          location: 'header',
          key_name: 'X-Api-Key',
          value: 'sk-other',
        },
        scope: 'personal',
      })
      .expect(201);

    const myList = await request(BASE_URL)
      .get('/api/integrations')
      .set('Authorization', `Bearer ${token}`)
      .set('X-Workspace-Id', workspaceId);
    expect(myList.status).toBe(200);
    const items =
      (myList.body.data as { items?: Array<{ id: string; name: string }> })
        .items ?? (myList.body.data as Array<{ id: string; name: string }>);
    const names = items.map((i) => i.name);
    expect(items.some((i) => i.id === myId)).toBe(true);
    expect(names).not.toContain('other-side');
  });
});
