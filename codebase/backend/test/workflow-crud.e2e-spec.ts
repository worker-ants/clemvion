import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { Client } from 'pg';
import request from 'supertest';

import { createDbClient, uniqueEmail, uniqueName } from './helpers/db';
import { registerAndLogin, createTeamWorkspace } from './helpers/auth';

/**
 * e2e: 워크플로우 CRUD 의 실 인프라 검증.
 *
 * 핵심:
 *   - POST /workflows 가 Manual Trigger 노드를 자동 생성 (saveCanvas 의 "정확히 하나"
 *     invariant 와 짝)
 *   - duplicate 가 새 ID + " (Copy)" 접미 + isActive=false 로 독립 생성
 *   - DELETE 후 GET 404
 *   - 동시 PATCH 가 마지막 쓰기로 수렴 (실패 없이)
 *
 * 권한·격리 invariants 는 workspace-rbac.e2e-spec.ts 가 담당. 본 spec 은 단일 owner
 * 단일 워크스페이스 하에서의 CRUD 의미만 본다.
 */

const BASE_URL = process.env.E2E_BASE_URL ?? 'http://backend-e2e:3011';

describe('Workflow CRUD (e2e)', () => {
  let db: Client;
  let ownerToken: string;
  let workspaceId: string;

  beforeAll(async () => {
    db = createDbClient();
    await db.connect();

    const owner = await registerAndLogin(BASE_URL, uniqueEmail('wfcrud'), db);
    ownerToken = owner.accessToken;
    workspaceId = await createTeamWorkspace(
      BASE_URL,
      ownerToken,
      uniqueName('WFCRUD'),
    );
  }, 60_000);

  afterAll(async () => {
    await db.end();
  });

  it('A. create → list 에 포함 / Manual Trigger 노드 자동 생성', async () => {
    const name = uniqueName('wf-a');
    const createRes = await request(BASE_URL)
      .post('/api/workflows')
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('X-Workspace-Id', workspaceId)
      .send({ name });
    expect(createRes.status).toBe(201);
    const id = (createRes.body.data as { id: string }).id;

    // list 에 등장.
    const listRes = await request(BASE_URL)
      .get('/api/workflows')
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('X-Workspace-Id', workspaceId);
    expect(listRes.status).toBe(200);
    const items =
      (listRes.body.data as { items?: Array<{ id: string }> }).items ??
      (listRes.body.data as Array<{ id: string }>);
    const ids = items.map((w: { id: string }) => w.id);
    expect(ids).toContain(id);

    // Manual Trigger 노드 1개 자동 생성.
    const nodeRows = await db.query<{ type: string }>(
      'SELECT type FROM node WHERE workflow_id = $1',
      [id],
    );
    expect(nodeRows.rows.length).toBe(1);
    expect(nodeRows.rows[0].type).toBe('manual_trigger');
  });

  it('B. PATCH 이름·설명 → 후속 GET 에 반영', async () => {
    const create = await request(BASE_URL)
      .post('/api/workflows')
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('X-Workspace-Id', workspaceId)
      .send({ name: uniqueName('wf-b'), description: 'before' });
    const id = create.body.data.id;

    const newName = uniqueName('wf-b-edited');
    const patch = await request(BASE_URL)
      .patch(`/api/workflows/${id}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('X-Workspace-Id', workspaceId)
      .send({ name: newName, description: 'after' });
    expect(patch.status).toBe(200);

    const get = await request(BASE_URL)
      .get(`/api/workflows/${id}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('X-Workspace-Id', workspaceId);
    expect(get.status).toBe(200);
    expect(get.body.data.name).toBe(newName);
    expect(get.body.data.description).toBe('after');
  });

  it('B2. PATCH settings.maxConcurrentExecutions — 검증 게이트(§8, workspace 대칭)', async () => {
    const create = await request(BASE_URL)
      .post('/api/workflows')
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('X-Workspace-Id', workspaceId)
      .send({ name: uniqueName('wf-cap') });
    const id = create.body.data.id;

    // 0 (양의 정수 아님) → 400.
    const zero = await request(BASE_URL)
      .patch(`/api/workflows/${id}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('X-Workspace-Id', workspaceId)
      .send({ settings: { maxConcurrentExecutions: 0 } });
    expect(zero.status).toBe(400);

    // 미지 settings 키 → 400 (forbidNonWhitelisted — workspace settings DTO 대칭).
    const unknownKey = await request(BASE_URL)
      .patch(`/api/workflows/${id}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('X-Workspace-Id', workspaceId)
      .send({ settings: { bogusKey: 1 } });
    expect(unknownKey.status).toBe(400);

    // 양의 정수 → 200 + 후속 GET 에 영속.
    const ok = await request(BASE_URL)
      .patch(`/api/workflows/${id}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('X-Workspace-Id', workspaceId)
      .send({ settings: { maxConcurrentExecutions: 5 } });
    expect(ok.status).toBe(200);

    const get = await request(BASE_URL)
      .get(`/api/workflows/${id}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('X-Workspace-Id', workspaceId);
    expect(get.status).toBe(200);
    expect(get.body.data.settings?.maxConcurrentExecutions).toBe(5);
  });

  it('C. duplicate → 새 ID, " (Copy)" 접미, isActive=false', async () => {
    const baseName = uniqueName('wf-c');
    const create = await request(BASE_URL)
      .post('/api/workflows')
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('X-Workspace-Id', workspaceId)
      .send({ name: baseName, isActive: true });
    const id = create.body.data.id;

    const dup = await request(BASE_URL)
      .post(`/api/workflows/${id}/duplicate`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('X-Workspace-Id', workspaceId);
    expect(dup.status).toBe(201);
    const dupId = dup.body.data.id;
    expect(dupId).not.toBe(id);
    expect(dup.body.data.name).toBe(`${baseName} (Copy)`);
    expect(dup.body.data.isActive).toBe(false);

    // 원본은 그대로.
    const original = await request(BASE_URL)
      .get(`/api/workflows/${id}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('X-Workspace-Id', workspaceId);
    expect(original.body.data.name).toBe(baseName);
  });

  it('D. DELETE → 204 그리고 후속 GET 404', async () => {
    const create = await request(BASE_URL)
      .post('/api/workflows')
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('X-Workspace-Id', workspaceId)
      .send({ name: uniqueName('wf-d') });
    const id = create.body.data.id;

    const del = await request(BASE_URL)
      .delete(`/api/workflows/${id}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('X-Workspace-Id', workspaceId);
    expect(del.status).toBe(204);

    const get = await request(BASE_URL)
      .get(`/api/workflows/${id}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('X-Workspace-Id', workspaceId);
    expect(get.status).toBe(404);

    // 노드 cascade 삭제 확인.
    const nodeRows = await db.query(
      'SELECT id FROM node WHERE workflow_id = $1',
      [id],
    );
    expect(nodeRows.rows.length).toBe(0);
  });

  it('E. 동시 PATCH — 모두 200, last-write 가 GET 에 반영 (실패 없음)', async () => {
    const create = await request(BASE_URL)
      .post('/api/workflows')
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('X-Workspace-Id', workspaceId)
      .send({ name: uniqueName('wf-e') });
    const id = create.body.data.id;

    const [r1, r2, r3] = await Promise.all([
      request(BASE_URL)
        .patch(`/api/workflows/${id}`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('X-Workspace-Id', workspaceId)
        .send({ description: 'v1' }),
      request(BASE_URL)
        .patch(`/api/workflows/${id}`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('X-Workspace-Id', workspaceId)
        .send({ description: 'v2' }),
      request(BASE_URL)
        .patch(`/api/workflows/${id}`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('X-Workspace-Id', workspaceId)
        .send({ description: 'v3' }),
    ]);
    // 동시 PATCH 가 충돌 없이 모두 200 — last-write-wins 정책.
    expect([r1.status, r2.status, r3.status].every((s) => s === 200)).toBe(
      true,
    );

    const final = await request(BASE_URL)
      .get(`/api/workflows/${id}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('X-Workspace-Id', workspaceId);
    expect(final.status).toBe(200);
    expect(['v1', 'v2', 'v3']).toContain(final.body.data.description);
  });

  it('F. export → 같은 형태로 import → 별도 워크플로우 생성', async () => {
    const create = await request(BASE_URL)
      .post('/api/workflows')
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('X-Workspace-Id', workspaceId)
      .send({ name: uniqueName('wf-f'), description: 'original' });
    const id = create.body.data.id;

    const exportRes = await request(BASE_URL)
      .get(`/api/workflows/${id}/export`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('X-Workspace-Id', workspaceId);
    expect(exportRes.status).toBe(200);
    expect(exportRes.body.data.name).toBeDefined();
    expect(Array.isArray(exportRes.body.data.nodes)).toBe(true);

    const importRes = await request(BASE_URL)
      .post('/api/workflows/import')
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('X-Workspace-Id', workspaceId)
      .send(exportRes.body.data);
    expect([200, 201]).toContain(importRes.status);
    const newId = importRes.body.data.id;
    expect(newId).not.toBe(id);
  });

  it('G. import settings.maxConcurrentExecutions — round-trip 영속 + 미지키 400 (§8, patch 대칭)', async () => {
    const create = await request(BASE_URL)
      .post('/api/workflows')
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('X-Workspace-Id', workspaceId)
      .send({ name: uniqueName('wf-g') });
    const id = create.body.data.id;

    // cap 설정(patch) → export 에 settings 가 실린다.
    const patch = await request(BASE_URL)
      .patch(`/api/workflows/${id}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('X-Workspace-Id', workspaceId)
      .send({ settings: { maxConcurrentExecutions: 5 } });
    expect(patch.status).toBe(200);

    const exportRes = await request(BASE_URL)
      .get(`/api/workflows/${id}/export`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('X-Workspace-Id', workspaceId);
    expect(exportRes.body.data.settings?.maxConcurrentExecutions).toBe(5);

    // export JSON 을 그대로 import → 새 워크플로우에 settings 영속.
    const importRes = await request(BASE_URL)
      .post('/api/workflows/import')
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('X-Workspace-Id', workspaceId)
      .send(exportRes.body.data);
    expect([200, 201]).toContain(importRes.status);
    const newId = importRes.body.data.id;
    const getNew = await request(BASE_URL)
      .get(`/api/workflows/${newId}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('X-Workspace-Id', workspaceId);
    expect(getNew.body.data.settings?.maxConcurrentExecutions).toBe(5);

    // 미지 settings 키 import → 400 (strict, UpdateWorkflowDto 대칭).
    const badImport = await request(BASE_URL)
      .post('/api/workflows/import')
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('X-Workspace-Id', workspaceId)
      .send({ ...exportRes.body.data, settings: { bogusKey: 1 } });
    expect(badImport.status).toBe(400);
  });
});
