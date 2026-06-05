import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { randomUUID } from 'crypto';
import { Client } from 'pg';
import request from 'supertest';

import { createDbClient, uniqueEmail, uniqueName } from './helpers/db';
import {
  registerAndLogin,
  createTeamWorkspace,
  inviteAndAccept,
} from './helpers/auth';

/**
 * e2e: AI Agent 메모리 관리(조회·삭제) admin REST surface 를 실 인프라 위에서
 * 검증한다 (spec/5-system/17-agent-memory.md §6, AGM-12/13).
 *
 * 보호 대상 invariants:
 *   - GET scopes/memories 는 워크스페이스 멤버(@Roles('viewer')) 만 — 비멤버는
 *     `X-Workspace-Id` 스푸핑으로도 403 (RolesGuard 멤버십 검증).
 *   - 워크스페이스 격리 — 다른 워크스페이스의 메모리는 목록/단건에 노출되지 않음.
 *   - DELETE 는 editor+ (viewer 403), 비UUID 400, 존재X·cross-workspace 404,
 *     정상 204.
 *   - scope 전체 삭제는 scopeKey 누락 시 400, 정상 204, 워크스페이스 격리.
 *
 * agent_memory row 는 런타임 저장 경로(추출 큐) 를 우회해 DB 에 직접 INSERT 로
 * 시드한다 — 본 e2e 의 관심사는 admin read/delete surface 와 권한·격리이기 때문.
 */

const BASE_URL = process.env.E2E_BASE_URL ?? 'http://backend-e2e:3011';

/** agent_memory row 직접 시드. embedding 은 admin surface 가 반환하지 않으므로 NULL. */
async function seedMemory(
  db: Client,
  workspaceId: string,
  scopeKey: string,
  content: string,
  kind: string,
): Promise<string> {
  const res = await db.query<{ id: string }>(
    `INSERT INTO agent_memory (workspace_id, scope_key, content, metadata)
       VALUES ($1, $2, $3, $4::jsonb)
     RETURNING id`,
    [workspaceId, scopeKey, content, JSON.stringify({ kind })],
  );
  return res.rows[0].id;
}

describe('Agent Memory Admin (e2e, spec §6 AGM-12/13)', () => {
  let db: Client;

  beforeAll(async () => {
    db = createDbClient();
    await db.connect();
  }, 30_000);

  afterAll(async () => {
    await db.end();
  });

  it('A. GET scopes/memories 200 + 워크스페이스 격리 (다른 ws 데이터 안 보임)', async () => {
    const owner = await registerAndLogin(
      BASE_URL,
      uniqueEmail('agm-a-own'),
      db,
    );
    const ws = await createTeamWorkspace(
      BASE_URL,
      owner.accessToken,
      uniqueName('agm-a'),
    );

    // 다른 워크스페이스 + 그 안의 메모리 (격리 검증용 noise).
    const other = await registerAndLogin(
      BASE_URL,
      uniqueEmail('agm-a-other'),
      db,
    );
    const wsOther = await createTeamWorkspace(
      BASE_URL,
      other.accessToken,
      uniqueName('agm-a-other'),
    );

    const scopeKey = uniqueName('scope');
    await seedMemory(db, ws, scopeKey, 'user likes tea', 'preference');
    await seedMemory(db, ws, scopeKey, 'order #42 shipped', 'fact');
    await seedMemory(db, wsOther, scopeKey, 'OTHER ws secret', 'fact');

    // scopes — 자기 워크스페이스의 scope 만, count=2.
    const scopes = await request(BASE_URL)
      .get('/api/agent-memories/scopes')
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .set('X-Workspace-Id', ws);
    expect(scopes.status).toBe(200);
    const mine = (
      scopes.body.data as { scopeKey: string; count: number }[]
    ).find((s) => s.scopeKey === scopeKey);
    expect(mine).toBeDefined();
    expect(mine?.count).toBe(2);

    // memories — 자기 scope 의 2건만, 다른 ws 의 content 미노출.
    const memories = await request(BASE_URL)
      .get('/api/agent-memories')
      .query({ scopeKey })
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .set('X-Workspace-Id', ws);
    expect(memories.status).toBe(200);
    expect(memories.body.pagination.totalItems).toBe(2);
    const contents = (memories.body.data as { content: string }[]).map(
      (m) => m.content,
    );
    expect(contents).toEqual(
      expect.arrayContaining(['user likes tea', 'order #42 shipped']),
    );
    expect(contents).not.toContain('OTHER ws secret');

    // kind 필터.
    const factsOnly = await request(BASE_URL)
      .get('/api/agent-memories')
      .query({ scopeKey, kind: 'fact' })
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .set('X-Workspace-Id', ws);
    expect(factsOnly.status).toBe(200);
    expect(factsOnly.body.pagination.totalItems).toBe(1);
    expect(factsOnly.body.data[0].kind).toBe('fact');
  });

  it('B. 비멤버는 X-Workspace-Id 스푸핑으로도 GET 403 (RolesGuard 멤버십 검증)', async () => {
    const owner = await registerAndLogin(
      BASE_URL,
      uniqueEmail('agm-b-own'),
      db,
    );
    const ws = await createTeamWorkspace(
      BASE_URL,
      owner.accessToken,
      uniqueName('agm-b'),
    );
    const scopeKey = uniqueName('scope');
    await seedMemory(db, ws, scopeKey, 'secret', 'fact');

    // 다른 워크스페이스 소속(이 ws 의 비멤버)인 사용자가 헤더만 위조.
    const outsider = await registerAndLogin(
      BASE_URL,
      uniqueEmail('agm-b-out'),
      db,
    );

    const spoofScopes = await request(BASE_URL)
      .get('/api/agent-memories/scopes')
      .set('Authorization', `Bearer ${outsider.accessToken}`)
      .set('X-Workspace-Id', ws);
    expect(spoofScopes.status).toBe(403);

    const spoofMemories = await request(BASE_URL)
      .get('/api/agent-memories')
      .query({ scopeKey })
      .set('Authorization', `Bearer ${outsider.accessToken}`)
      .set('X-Workspace-Id', ws);
    expect(spoofMemories.status).toBe(403);
  });

  it('C. viewer 는 GET 가능(200) / DELETE 불가(403), editor 는 DELETE 가능(204)', async () => {
    const owner = await registerAndLogin(
      BASE_URL,
      uniqueEmail('agm-c-own'),
      db,
    );
    const ws = await createTeamWorkspace(
      BASE_URL,
      owner.accessToken,
      uniqueName('agm-c'),
    );
    const viewer = await inviteAndAccept(
      BASE_URL,
      owner.accessToken,
      ws,
      uniqueEmail('agm-c-view'),
      'viewer',
      db,
    );
    const editor = await inviteAndAccept(
      BASE_URL,
      owner.accessToken,
      ws,
      uniqueEmail('agm-c-edit'),
      'editor',
      db,
    );

    const scopeKey = uniqueName('scope');
    const memId = await seedMemory(db, ws, scopeKey, 'deletable', 'fact');

    // viewer GET → 200.
    const viewerGet = await request(BASE_URL)
      .get('/api/agent-memories/scopes')
      .set('Authorization', `Bearer ${viewer.accessToken}`)
      .set('X-Workspace-Id', ws);
    expect(viewerGet.status).toBe(200);

    // viewer DELETE → 403 (editor+ 필요).
    const viewerDel = await request(BASE_URL)
      .delete(`/api/agent-memories/${memId}`)
      .set('Authorization', `Bearer ${viewer.accessToken}`)
      .set('X-Workspace-Id', ws);
    expect(viewerDel.status).toBe(403);

    // editor DELETE → 204, 실제 삭제.
    const editorDel = await request(BASE_URL)
      .delete(`/api/agent-memories/${memId}`)
      .set('Authorization', `Bearer ${editor.accessToken}`)
      .set('X-Workspace-Id', ws);
    expect(editorDel.status).toBe(204);

    const gone = await db.query('SELECT id FROM agent_memory WHERE id = $1', [
      memId,
    ]);
    expect(gone.rows.length).toBe(0);
  });

  it('D. DELETE /:id — 비UUID 400, 존재X 404, cross-workspace 404', async () => {
    const owner = await registerAndLogin(
      BASE_URL,
      uniqueEmail('agm-d-own'),
      db,
    );
    const ws = await createTeamWorkspace(
      BASE_URL,
      owner.accessToken,
      uniqueName('agm-d'),
    );

    // 다른 워크스페이스 + 그 안의 메모리 (cross-workspace 차단 검증).
    const other = await registerAndLogin(
      BASE_URL,
      uniqueEmail('agm-d-other'),
      db,
    );
    const wsOther = await createTeamWorkspace(
      BASE_URL,
      other.accessToken,
      uniqueName('agm-d-other'),
    );
    const otherMemId = await seedMemory(
      db,
      wsOther,
      uniqueName('scope'),
      'other ws row',
      'fact',
    );

    // 비UUID → 400 (ParseUUIDPipe).
    const badUuid = await request(BASE_URL)
      .delete('/api/agent-memories/not-a-uuid')
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .set('X-Workspace-Id', ws);
    expect(badUuid.status).toBe(400);

    // 형식 유효하나 어떤 워크스페이스에도 없는 id → 404 (affected=0 → NotFound).
    const missing = await request(BASE_URL)
      .delete(`/api/agent-memories/${randomUUID()}`)
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .set('X-Workspace-Id', ws);
    expect(missing.status).toBe(404);

    // 다른 워크스페이스의 실재 id → 404 (workspace_id 격리, AGM-13).
    const cross = await request(BASE_URL)
      .delete(`/api/agent-memories/${otherMemId}`)
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .set('X-Workspace-Id', ws);
    expect(cross.status).toBe(404);

    // 다른 ws 의 row 는 그대로 존재.
    const stillThere = await db.query(
      'SELECT id FROM agent_memory WHERE id = $1',
      [otherMemId],
    );
    expect(stillThere.rows.length).toBe(1);
  });

  it('E. DELETE scope — scopeKey 누락 400, 정상 204 + 워크스페이스 격리', async () => {
    const owner = await registerAndLogin(
      BASE_URL,
      uniqueEmail('agm-e-own'),
      db,
    );
    const ws = await createTeamWorkspace(
      BASE_URL,
      owner.accessToken,
      uniqueName('agm-e'),
    );

    const scopeKey = uniqueName('scope');
    await seedMemory(db, ws, scopeKey, 'a', 'fact');
    await seedMemory(db, ws, scopeKey, 'b', 'preference');

    // 다른 scope (삭제 후에도 남아있어야 함).
    const keepScope = uniqueName('keep');
    await seedMemory(db, ws, keepScope, 'keep', 'fact');

    // scopeKey 누락 → 400.
    const missing = await request(BASE_URL)
      .delete('/api/agent-memories')
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .set('X-Workspace-Id', ws);
    expect(missing.status).toBe(400);

    // 정상 → 204, 해당 scope 만 삭제.
    const ok = await request(BASE_URL)
      .delete('/api/agent-memories')
      .query({ scopeKey })
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .set('X-Workspace-Id', ws);
    expect(ok.status).toBe(204);

    const cleared = await db.query(
      'SELECT id FROM agent_memory WHERE workspace_id = $1 AND scope_key = $2',
      [ws, scopeKey],
    );
    expect(cleared.rows.length).toBe(0);

    const kept = await db.query(
      'SELECT id FROM agent_memory WHERE workspace_id = $1 AND scope_key = $2',
      [ws, keepScope],
    );
    expect(kept.rows.length).toBe(1);
  });
});
