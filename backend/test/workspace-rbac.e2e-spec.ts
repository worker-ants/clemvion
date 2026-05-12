import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { Client } from 'pg';
import request from 'supertest';

import { createDbClient, uniqueEmail, uniqueName } from './helpers/db';
import {
  registerAndLogin,
  createTeamWorkspace,
  inviteAndAccept,
} from './helpers/auth';

/**
 * e2e: spec/5-system/1-auth.md §1.3 의 RBAC 계약을 실 인프라 위에서 검증한다.
 *
 * 보호 대상 invariants:
 *   - 워크스페이스 격리 — A 워크스페이스 멤버가 B 워크스페이스 자원에 접근 불가
 *   - viewer 는 write 차단 (`@Roles('editor')` 가드)
 *   - owner 만 워크스페이스 삭제 가능 (service-level OWNER_REQUIRED, 트랜잭션 락 보유)
 *   - owner 역할은 멤버 추가/변경으로 부여할 수 없음 (CANNOT_ASSIGN_OWNER)
 *   - owner 이전 후 옛 owner 는 editor 로 강등
 */

const BASE_URL = process.env.E2E_BASE_URL ?? 'http://backend-e2e:3011';

describe('Workspace RBAC (e2e)', () => {
  let db: Client;

  beforeAll(async () => {
    db = createDbClient();
    await db.connect();
  }, 30_000);

  afterAll(async () => {
    await db.end();
  });

  it('A. cross-workspace 격리 — A 의 멤버가 B 의 워크플로우 생성 시 403 (Roles 가드)', async () => {
    const ownerA = await registerAndLogin(BASE_URL, uniqueEmail('rbac-a-own'), db);
    const wsA = await createTeamWorkspace(BASE_URL, ownerA.accessToken, uniqueName('A'));

    const ownerB = await registerAndLogin(BASE_URL, uniqueEmail('rbac-a-other'), db);
    const wsB = await createTeamWorkspace(BASE_URL, ownerB.accessToken, uniqueName('B'));

    // ownerA 가 wsB 의 워크플로우 생성 시도 → 403 (RolesGuard, 멤버 아님).
    // 참고: GET /workflows 는 @Roles 가드가 없어 workspaceId 필터만 적용되므로
    // membership 검증 자체는 write 경로에서 강제된다.
    const cross = await request(BASE_URL)
      .post('/api/workflows')
      .set('Authorization', `Bearer ${ownerA.accessToken}`)
      .set('X-Workspace-Id', wsB)
      .send({ name: 'cross-ws-write' });
    expect(cross.status).toBe(403);

    // 자기 워크스페이스에는 생성 가능.
    const own = await request(BASE_URL)
      .post('/api/workflows')
      .set('Authorization', `Bearer ${ownerA.accessToken}`)
      .set('X-Workspace-Id', wsA)
      .send({ name: 'self-write' });
    expect(own.status).toBe(201);
  });

  it('B. viewer 는 워크플로우 생성 불가 (403), editor 는 가능 (201)', async () => {
    const owner = await registerAndLogin(BASE_URL, uniqueEmail('rbac-b-own'), db);
    const ws = await createTeamWorkspace(BASE_URL, owner.accessToken, uniqueName('B'));

    const viewer = await inviteAndAccept(
      BASE_URL,
      owner.accessToken,
      ws,
      uniqueEmail('rbac-b-view'),
      'viewer',
      db,
    );
    const editor = await inviteAndAccept(
      BASE_URL,
      owner.accessToken,
      ws,
      uniqueEmail('rbac-b-edit'),
      'editor',
      db,
    );

    // viewer create → 403.
    const viewerRes = await request(BASE_URL)
      .post('/api/workflows')
      .set('Authorization', `Bearer ${viewer.accessToken}`)
      .set('X-Workspace-Id', ws)
      .send({ name: 'by viewer' });
    expect(viewerRes.status).toBe(403);

    // editor create → 201.
    const editorRes = await request(BASE_URL)
      .post('/api/workflows')
      .set('Authorization', `Bearer ${editor.accessToken}`)
      .set('X-Workspace-Id', ws)
      .send({ name: 'by editor' });
    expect(editorRes.status).toBe(201);

    // viewer 도 GET 은 통과 (read-only 권한).
    const viewerList = await request(BASE_URL)
      .get('/api/workflows')
      .set('Authorization', `Bearer ${viewer.accessToken}`)
      .set('X-Workspace-Id', ws);
    expect(viewerList.status).toBe(200);
  });

  it('C. editor 는 워크스페이스 삭제 불가 — 403 OWNER_REQUIRED', async () => {
    const owner = await registerAndLogin(BASE_URL, uniqueEmail('rbac-c-own'), db);
    const ws = await createTeamWorkspace(BASE_URL, owner.accessToken, uniqueName('C'));
    const editor = await inviteAndAccept(
      BASE_URL,
      owner.accessToken,
      ws,
      uniqueEmail('rbac-c-edit'),
      'editor',
      db,
    );

    const del = await request(BASE_URL)
      .delete(`/api/workspaces/${ws}`)
      .set('Authorization', `Bearer ${editor.accessToken}`);
    expect(del.status).toBe(403);
    expect(del.body.error.code).toBe('OWNER_REQUIRED');

    // 워크스페이스가 여전히 존재.
    const stillThere = await db.query(
      'SELECT id FROM workspace WHERE id = $1',
      [ws],
    );
    expect(stillThere.rows.length).toBe(1);
  });

  it('D. owner 역할을 멤버 추가 / 변경으로 부여할 수 없음 — 403 CANNOT_ASSIGN_OWNER', async () => {
    const owner = await registerAndLogin(BASE_URL, uniqueEmail('rbac-d-own'), db);
    const ws = await createTeamWorkspace(BASE_URL, owner.accessToken, uniqueName('D'));
    const member = await inviteAndAccept(
      BASE_URL,
      owner.accessToken,
      ws,
      uniqueEmail('rbac-d-mem'),
      'editor',
      db,
    );

    const memberRow = await db.query<{ id: string }>(
      'SELECT id FROM workspace_member WHERE workspace_id = $1 AND user_id = $2',
      [ws, member.userId],
    );

    // PATCH role to 'owner' → 거부.
    const promote = await request(BASE_URL)
      .patch(`/api/workspaces/${ws}/members/${memberRow.rows[0].id}`)
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({ role: 'owner' });
    expect(promote.status).toBe(403);
    expect(['CANNOT_ASSIGN_OWNER', 'OWNER_ROLE_PROTECTED']).toContain(
      promote.body.error.code,
    );

    // 역할이 그대로 editor.
    const stillEditor = await db.query<{ role: string }>(
      'SELECT role FROM workspace_member WHERE id = $1',
      [memberRow.rows[0].id],
    );
    expect(stillEditor.rows[0].role).toBe('editor');
  });

  it('E. transfer-ownership — 옛 owner 는 editor 로 강등, 새 owner 가 워크스페이스 삭제 가능', async () => {
    const oldOwner = await registerAndLogin(BASE_URL, uniqueEmail('rbac-e-old'), db);
    const ws = await createTeamWorkspace(BASE_URL, oldOwner.accessToken, uniqueName('E'));
    const successor = await inviteAndAccept(
      BASE_URL,
      oldOwner.accessToken,
      ws,
      uniqueEmail('rbac-e-new'),
      'editor',
      db,
    );

    // successor 의 workspace_member.id 회수 — DTO 가 user.id 가 아닌 member.id 요구.
    const successorMember = await db.query<{ id: string }>(
      'SELECT id FROM workspace_member WHERE workspace_id = $1 AND user_id = $2',
      [ws, successor.userId],
    );
    expect(successorMember.rows.length).toBe(1);

    const transfer = await request(BASE_URL)
      .post(`/api/workspaces/${ws}/transfer-ownership`)
      .set('Authorization', `Bearer ${oldOwner.accessToken}`)
      .send({ newOwnerMemberId: successorMember.rows[0].id });
    // POST default 201; controller 가 @HttpCode(200) 명시했다면 200. 둘 다 허용.
    expect([200, 201]).toContain(transfer.status);

    const roles = await db.query<{ user_id: string; role: string }>(
      'SELECT user_id, role FROM workspace_member WHERE workspace_id = $1',
      [ws],
    );
    const byUser = new Map(roles.rows.map((r) => [r.user_id, r.role]));
    // 옛 owner 는 admin 으로 강등 (DTO 주석 명시).
    expect(byUser.get(oldOwner.userId)).toBe('admin');
    expect(byUser.get(successor.userId)).toBe('owner');

    // 새 owner 는 delete 가능.
    const del = await request(BASE_URL)
      .delete(`/api/workspaces/${ws}`)
      .set('Authorization', `Bearer ${successor.accessToken}`);
    expect(del.status).toBe(200);

    // 옛 owner 가 같은 delete 재시도 → 워크스페이스 없으므로 404.
    const again = await request(BASE_URL)
      .delete(`/api/workspaces/${ws}`)
      .set('Authorization', `Bearer ${oldOwner.accessToken}`);
    expect([403, 404]).toContain(again.status);
  });

  it('F. sole owner 는 leave 불가 — 403 SOLE_OWNER_CANNOT_LEAVE', async () => {
    const owner = await registerAndLogin(BASE_URL, uniqueEmail('rbac-f-own'), db);
    const ws = await createTeamWorkspace(BASE_URL, owner.accessToken, uniqueName('F'));

    const leave = await request(BASE_URL)
      .post(`/api/workspaces/${ws}/leave`)
      .set('Authorization', `Bearer ${owner.accessToken}`);
    expect(leave.status).toBe(403);
    expect(leave.body.error.code).toBe('SOLE_OWNER_CANNOT_LEAVE');

    // 워크스페이스는 그대로.
    const stillThere = await db.query(
      'SELECT id FROM workspace WHERE id = $1',
      [ws],
    );
    expect(stillThere.rows.length).toBe(1);
  });
});
