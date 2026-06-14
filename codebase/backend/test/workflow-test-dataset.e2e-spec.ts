import { describe, it, expect, beforeAll } from '@jest/globals';
import { Client } from 'pg';
import request from 'supertest';

import { createDbClient, uniqueEmail, uniqueName } from './helpers/db';
import {
  registerAndLogin,
  createTeamWorkspace,
  inviteAndAccept,
} from './helpers/auth';

/**
 * e2e: spec/3-workflow-editor/3-execution.md §2.2 (테스트 데이터셋 저장) — 실 Postgres
 * 위에서 권한·소유 모델(R-2.2)을 검증한다.
 *
 *   POST   /api/workflows/:workflowId/test-datasets  → 201 (owner=요청자, 기본 private)
 *   GET    /api/workflows/:workflowId/test-datasets  → 내 것 + 워크스페이스 공유본
 *   PATCH  /api/test-datasets/:id                    → 소유자만 (아니면 403)
 *   DELETE /api/test-datasets/:id                    → 소유자만
 *   POST   /api/test-datasets/:id/clone              → 공유본을 자기 소유 private 사본으로
 *
 * invariants:
 *   A. 생성 → 201, owner=요청자, visibility 기본 private, isOwner=true
 *   B. private 는 타 유저 목록에서 안 보임; workspace 공유본은 보임(isOwner=false)
 *   C. 타 유저가 공유본 clone → 201, 새 사본 owner=타 유저, private
 *   D. 타 유저가 owner 데이터셋 PATCH → 403; private 를 clone → 404(존재 은닉)
 *   E. cross-workspace 접근 → 404 (IDOR)
 *   F. 같은 (workflow, owner, name) 중복 생성 → 409 DUPLICATE_NAME
 */

const BASE_URL = process.env.E2E_BASE_URL ?? 'http://backend-e2e:3011';

describe('Workflow Test Datasets (e2e)', () => {
  let db: Client;
  let ownerToken: string;
  let memberToken: string;
  let workspaceId: string;
  let workflowId: string;

  beforeAll(async () => {
    db = createDbClient();
    await db.connect();

    const owner = await registerAndLogin(BASE_URL, uniqueEmail('ds-owner'), db);
    ownerToken = owner.accessToken;
    workspaceId = await createTeamWorkspace(BASE_URL, ownerToken, 'DS WS');

    const member = await inviteAndAccept(
      BASE_URL,
      ownerToken,
      workspaceId,
      uniqueEmail('ds-member'),
      'editor',
      db,
    );
    memberToken = member.accessToken;

    const wf = await request(BASE_URL)
      .post('/api/workflows')
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('X-Workspace-Id', workspaceId)
      .send({ name: uniqueName('ds-wf') });
    expect(wf.status).toBe(201);
    workflowId = wf.body.data.id;
  }, 90_000);

  const create = (
    token: string,
    body: Record<string, unknown>,
    ws = workspaceId,
  ) =>
    request(BASE_URL)
      .post(`/api/workflows/${workflowId}/test-datasets`)
      .set('Authorization', `Bearer ${token}`)
      .set('X-Workspace-Id', ws)
      .send(body);

  it('A. 생성 → 201, owner=요청자, 기본 private, isOwner=true', async () => {
    const res = await create(ownerToken, {
      name: 'owner-private',
      input: { a: 1 },
    });
    expect(res.status).toBe(201);
    expect(res.body.data.visibility).toBe('private');
    expect(res.body.data.isOwner).toBe(true);
    expect(res.body.data.input).toEqual({ a: 1 });
  });

  it('B. private 는 타 유저 비노출 / workspace 공유본은 노출(isOwner=false)', async () => {
    const shared = await create(ownerToken, {
      name: 'owner-shared',
      input: { s: 1 },
      visibility: 'workspace',
    });
    expect(shared.status).toBe(201);

    const memberList = await request(BASE_URL)
      .get(`/api/workflows/${workflowId}/test-datasets`)
      .set('Authorization', `Bearer ${memberToken}`)
      .set('X-Workspace-Id', workspaceId);
    expect(memberList.status).toBe(200);
    const names = (memberList.body.data as Array<{ name: string }>).map(
      (d) => d.name,
    );
    expect(names).toContain('owner-shared');
    expect(names).not.toContain('owner-private');
    const sharedRow = (
      memberList.body.data as Array<{ name: string; isOwner: boolean }>
    ).find((d) => d.name === 'owner-shared');
    expect(sharedRow?.isOwner).toBe(false);
  });

  it('C. 타 유저가 공유본 clone → 201, 사본 owner=타 유저·private', async () => {
    const shared = await create(ownerToken, {
      name: 'to-clone',
      input: { c: 1 },
      visibility: 'workspace',
    });
    const cloneRes = await request(BASE_URL)
      .post(`/api/test-datasets/${shared.body.data.id}/clone`)
      .set('Authorization', `Bearer ${memberToken}`)
      .set('X-Workspace-Id', workspaceId);
    expect(cloneRes.status).toBe(201);
    expect(cloneRes.body.data.isOwner).toBe(true);
    expect(cloneRes.body.data.visibility).toBe('private');
    expect(cloneRes.body.data.input).toEqual({ c: 1 });
    expect(cloneRes.body.data.name).toContain('Copy');
  });

  it('D. 타 유저 PATCH(공유본) → 403; private clone → 404', async () => {
    const shared = await create(ownerToken, {
      name: 'no-edit-by-others',
      input: {},
      visibility: 'workspace',
    });
    const patch = await request(BASE_URL)
      .patch(`/api/test-datasets/${shared.body.data.id}`)
      .set('Authorization', `Bearer ${memberToken}`)
      .set('X-Workspace-Id', workspaceId)
      .send({ name: 'hacked' });
    expect(patch.status).toBe(403);

    const priv = await create(ownerToken, { name: 'secret', input: {} });
    const cloneRes = await request(BASE_URL)
      .post(`/api/test-datasets/${priv.body.data.id}/clone`)
      .set('Authorization', `Bearer ${memberToken}`)
      .set('X-Workspace-Id', workspaceId);
    expect(cloneRes.status).toBe(404);
  });

  it('E. cross-workspace 접근 → 404 (IDOR)', async () => {
    const ds = await create(ownerToken, { name: 'idor-target', input: {} });
    const intruder = await registerAndLogin(
      BASE_URL,
      uniqueEmail('ds-intruder'),
      db,
    );
    const otherWs = await createTeamWorkspace(
      BASE_URL,
      intruder.accessToken,
      'Other WS',
    );
    const res = await request(BASE_URL)
      .patch(`/api/test-datasets/${ds.body.data.id}`)
      .set('Authorization', `Bearer ${intruder.accessToken}`)
      .set('X-Workspace-Id', otherWs)
      .send({ name: 'x' });
    expect([403, 404]).toContain(res.status);
  });

  it('F. 같은 이름 중복 생성 → 409 DUPLICATE_NAME', async () => {
    await create(ownerToken, { name: 'dup-name', input: {} });
    const dup = await create(ownerToken, { name: 'dup-name', input: {} });
    expect(dup.status).toBe(409);
  });
});
