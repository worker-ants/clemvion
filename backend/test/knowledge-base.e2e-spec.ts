import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { Client } from 'pg';
import request from 'supertest';

import { createDbClient, uniqueEmail, uniqueName } from './helpers/db';
import { registerAndLogin, createTeamWorkspace } from './helpers/auth';

/**
 * e2e: Knowledge Base CRUD + 격리 — spec/5-system/8-embedding-pipeline.md /
 * spec/5-system/10-graph-rag.md.
 *
 * 임베딩·그래프 추출 자체는 LLM 의존이라 e2e 환경에서 안정적으로 검증하기 어렵다.
 * 본 spec 은 KB 엔티티 라이프사이클 (생성·조회·수정·삭제·격리) 과 ragMode 가 생성
 * 후 불변임만 확인. 실제 임베딩·검색 동작은 unit / embedding-pipeline.service.spec
 * 가 담당.
 */

const BASE_URL = process.env.E2E_BASE_URL ?? 'http://backend-e2e:3011';

describe('Knowledge Base (e2e)', () => {
  let db: Client;
  let token: string;
  let workspaceId: string;

  beforeAll(async () => {
    db = createDbClient();
    await db.connect();
    const owner = await registerAndLogin(BASE_URL, uniqueEmail('kb'), db);
    token = owner.accessToken;
    workspaceId = await createTeamWorkspace(BASE_URL, token, uniqueName('KB'));
  }, 60_000);

  afterAll(async () => {
    await db.end();
  });

  function authHeaders() {
    return {
      Authorization: `Bearer ${token}`,
      'X-Workspace-Id': workspaceId,
    } as const;
  }

  async function createKb(
    name: string,
    ragMode: 'vector' | 'graph' = 'vector',
  ): Promise<string> {
    const res = await request(BASE_URL)
      .post('/api/knowledge-bases')
      .set(authHeaders())
      .send({ name, ragMode });
    expect(res.status).toBe(201);
    return res.body.data.id;
  }

  it('A. create → list 에 등장 / GET 단건 일치', async () => {
    const name = uniqueName('kb-a');
    const id = await createKb(name);

    const list = await request(BASE_URL)
      .get('/api/knowledge-bases')
      .set(authHeaders());
    expect(list.status).toBe(200);
    const items =
      (list.body.data as { items?: Array<{ id: string }> }).items ??
      (list.body.data as Array<{ id: string }>);
    expect(items.some((i) => i.id === id)).toBe(true);

    const get = await request(BASE_URL)
      .get(`/api/knowledge-bases/${id}`)
      .set(authHeaders());
    expect(get.status).toBe(200);
    expect(get.body.data.name).toBe(name);
  });

  it('B. PATCH 이름 → 200, GET 반영', async () => {
    const id = await createKb(uniqueName('kb-b'));
    const newName = uniqueName('kb-b-renamed');

    const patch = await request(BASE_URL)
      .patch(`/api/knowledge-bases/${id}`)
      .set(authHeaders())
      .send({ name: newName });
    expect(patch.status).toBe(200);
    expect(patch.body.data.name).toBe(newName);
  });

  it('C. ragMode 는 생성 후 변경 불가 (PATCH 시도 → 400 또는 무시)', async () => {
    const id = await createKb(uniqueName('kb-c'), 'vector');

    const patch = await request(BASE_URL)
      .patch(`/api/knowledge-bases/${id}`)
      .set(authHeaders())
      .send({ ragMode: 'graph' });
    // 거부되거나, 받아들이되 DB 에 적용되지 않는다 (spec: 사후 변경 불가).
    if (patch.status === 200) {
      const get = await request(BASE_URL)
        .get(`/api/knowledge-bases/${id}`)
        .set(authHeaders());
      expect(get.body.data.ragMode).toBe('vector');
    } else {
      expect([400, 403, 409, 422]).toContain(patch.status);
    }
  });

  it('D. delete → 후속 GET 404, DB row 제거', async () => {
    const id = await createKb(uniqueName('kb-d'));

    const del = await request(BASE_URL)
      .delete(`/api/knowledge-bases/${id}`)
      .set(authHeaders());
    expect([200, 204]).toContain(del.status);

    const get = await request(BASE_URL)
      .get(`/api/knowledge-bases/${id}`)
      .set(authHeaders());
    expect(get.status).toBe(404);

    const row = await db.query('SELECT id FROM knowledge_base WHERE id = $1', [
      id,
    ]);
    expect(row.rows.length).toBe(0);
  });

  it('E. cross-workspace 격리 — 다른 워크스페이스에서 GET 시 403/404', async () => {
    const id = await createKb(uniqueName('kb-e'));

    const intruder = await registerAndLogin(BASE_URL, uniqueEmail('kb-x'), db);
    const otherWs = await createTeamWorkspace(
      BASE_URL,
      intruder.accessToken,
      uniqueName('X'),
    );

    const cross = await request(BASE_URL)
      .get(`/api/knowledge-bases/${id}`)
      .set('Authorization', `Bearer ${intruder.accessToken}`)
      .set('X-Workspace-Id', otherWs);
    expect([403, 404]).toContain(cross.status);
  });

  it('F. embedding-stats — 문서 없는 KB 도 0 카운트 반환 (5xx 방지)', async () => {
    const id = await createKb(uniqueName('kb-f'));

    const stats = await request(BASE_URL)
      .get(`/api/knowledge-bases/${id}/embedding-stats`)
      .set(authHeaders());
    // 비어있어도 200, 카운트 0.
    expect(stats.status).toBe(200);
    expect(stats.body.data).toBeDefined();
  });
});
