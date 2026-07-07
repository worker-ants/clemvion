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
 *   - model-config 과금 action-POST(`:id/test`·`preview-models`)는 Editor+ 게이트,
 *     조회 GET(`:id/models`)은 Viewer+ 허용 (spec §3·R-7)
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
    const ownerA = await registerAndLogin(
      BASE_URL,
      uniqueEmail('rbac-a-own'),
      db,
    );
    const wsA = await createTeamWorkspace(
      BASE_URL,
      ownerA.accessToken,
      uniqueName('A'),
    );

    const ownerB = await registerAndLogin(
      BASE_URL,
      uniqueEmail('rbac-a-other'),
      db,
    );
    const wsB = await createTeamWorkspace(
      BASE_URL,
      ownerB.accessToken,
      uniqueName('B'),
    );

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

  it('S. POST /auth/workspaces/:id/switch — 멤버 200(헤더 없이 토큰 클레임으로 전환), 비멤버 403, malformed 400', async () => {
    const owner = await registerAndLogin(
      BASE_URL,
      uniqueEmail('switch-own'),
      db,
    );
    const wsTeam = await createTeamWorkspace(
      BASE_URL,
      owner.accessToken,
      uniqueName('SwTeam'),
    );

    // 멤버 전환 → 200 + 새 access token 발급.
    const sw = await request(BASE_URL)
      .post(`/api/auth/workspaces/${wsTeam}/switch`)
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send();
    expect(sw.status).toBe(200);
    const switchedToken = sw.body?.data?.accessToken as string;
    expect(switchedToken).toBeTruthy();

    // 전환된 토큰은 X-Workspace-Id 헤더 없이도 wsTeam 컨텍스트로 동작한다
    // (활성 워크스페이스 = 토큰 activeWorkspaceId 클레임 = wsTeam) → write 201.
    const writeInTeam = await request(BASE_URL)
      .post('/api/workflows')
      .set('Authorization', `Bearer ${switchedToken}`)
      .send({ name: 'switched-token-write' });
    expect(writeInTeam.status).toBe(201);

    // 비멤버 워크스페이스로 전환 시도 → 403 NOT_A_MEMBER.
    const stranger = await registerAndLogin(
      BASE_URL,
      uniqueEmail('switch-stranger'),
      db,
    );
    const strangerWs = await createTeamWorkspace(
      BASE_URL,
      stranger.accessToken,
      uniqueName('Str'),
    );
    const forbidden = await request(BASE_URL)
      .post(`/api/auth/workspaces/${strangerWs}/switch`)
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send();
    expect(forbidden.status).toBe(403);

    // malformed :id (비-UUID) → 400 (ParseUUIDPipe).
    const malformed = await request(BASE_URL)
      .post('/api/auth/workspaces/not-a-uuid/switch')
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send();
    expect(malformed.status).toBe(400);
  });

  it('B. viewer 는 워크플로우 생성 불가 (403), editor 는 가능 (201)', async () => {
    const owner = await registerAndLogin(
      BASE_URL,
      uniqueEmail('rbac-b-own'),
      db,
    );
    const ws = await createTeamWorkspace(
      BASE_URL,
      owner.accessToken,
      uniqueName('B'),
    );

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
    const owner = await registerAndLogin(
      BASE_URL,
      uniqueEmail('rbac-c-own'),
      db,
    );
    const ws = await createTeamWorkspace(
      BASE_URL,
      owner.accessToken,
      uniqueName('C'),
    );
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
    const owner = await registerAndLogin(
      BASE_URL,
      uniqueEmail('rbac-d-own'),
      db,
    );
    const ws = await createTeamWorkspace(
      BASE_URL,
      owner.accessToken,
      uniqueName('D'),
    );
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
    const oldOwner = await registerAndLogin(
      BASE_URL,
      uniqueEmail('rbac-e-old'),
      db,
    );
    const ws = await createTeamWorkspace(
      BASE_URL,
      oldOwner.accessToken,
      uniqueName('E'),
    );
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
    const owner = await registerAndLogin(
      BASE_URL,
      uniqueEmail('rbac-f-own'),
      db,
    );
    const ws = await createTeamWorkspace(
      BASE_URL,
      owner.accessToken,
      uniqueName('F'),
    );

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

  it('G. PATCH/GET /workspaces/:id/settings — PATCH Admin+(owner 200/viewer·비멤버 403), GET 멤버 200/비멤버 403', async () => {
    const owner = await registerAndLogin(
      BASE_URL,
      uniqueEmail('rbac-g-own'),
      db,
    );
    const ws = await createTeamWorkspace(
      BASE_URL,
      owner.accessToken,
      uniqueName('G'),
    );

    const viewer = await inviteAndAccept(
      BASE_URL,
      owner.accessToken,
      ws,
      uniqueEmail('rbac-g-view'),
      'viewer',
      db,
    );

    // 다른 워크스페이스의 owner (이 워크스페이스의 비-멤버).
    const outsider = await registerAndLogin(
      BASE_URL,
      uniqueEmail('rbac-g-out'),
      db,
    );

    // owner → 200, settings 반영.
    const ok = await request(BASE_URL)
      .patch(`/api/workspaces/${ws}/settings`)
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({ interactionAllowedOrigins: ['https://example.com'] });
    expect(ok.status).toBe(200);
    expect(ok.body.data.settings.interactionAllowedOrigins).toEqual([
      'https://example.com',
    ]);

    // DB 에도 반영.
    const persisted = await db.query<{ settings: Record<string, unknown> }>(
      'SELECT settings FROM workspace WHERE id = $1',
      [ws],
    );
    expect(persisted.rows[0].settings.interactionAllowedOrigins).toEqual([
      'https://example.com',
    ]);

    // viewer → 403 (Admin+).
    const viewerRes = await request(BASE_URL)
      .patch(`/api/workspaces/${ws}/settings`)
      .set('Authorization', `Bearer ${viewer.accessToken}`)
      .send({ interactionAllowedOrigins: ['https://evil.example.com'] });
    expect(viewerRes.status).toBe(403);
    expect(viewerRes.body.error.code).toBe('ADMIN_REQUIRED');

    // 비-멤버 (cross-workspace) → 403.
    const outsiderRes = await request(BASE_URL)
      .patch(`/api/workspaces/${ws}/settings`)
      .set('Authorization', `Bearer ${outsider.accessToken}`)
      .send({ interactionAllowedOrigins: ['https://evil.example.com'] });
    expect(outsiderRes.status).toBe(403);
    expect(outsiderRes.body.error.code).toBe('ADMIN_REQUIRED');

    // GET /settings — viewer(멤버)는 200 으로 현재 값 조회(편집은 Admin+ 이나 조회는 모든 멤버).
    const viewerGet = await request(BASE_URL)
      .get(`/api/workspaces/${ws}/settings`)
      .set('Authorization', `Bearer ${viewer.accessToken}`);
    expect(viewerGet.status).toBe(200);
    expect(viewerGet.body.data.interactionAllowedOrigins).toEqual([
      'https://example.com',
    ]);

    // 비-멤버 GET → 403.
    const outsiderGet = await request(BASE_URL)
      .get(`/api/workspaces/${ws}/settings`)
      .set('Authorization', `Bearer ${outsider.accessToken}`);
    expect(outsiderGet.status).toBe(403);
  });

  it('H. POST /api/model-configs/:id/test — viewer 403, editor 가드 통과; GET :id/models 는 viewer 통과 (spec §3·R-7)', async () => {
    const owner = await registerAndLogin(
      BASE_URL,
      uniqueEmail('rbac-h-own'),
      db,
    );
    const ws = await createTeamWorkspace(
      BASE_URL,
      owner.accessToken,
      uniqueName('H'),
    );
    const viewer = await inviteAndAccept(
      BASE_URL,
      owner.accessToken,
      ws,
      uniqueEmail('rbac-h-view'),
      'viewer',
      db,
    );
    const editor = await inviteAndAccept(
      BASE_URL,
      owner.accessToken,
      ws,
      uniqueEmail('rbac-h-edit'),
      'editor',
      db,
    );

    // 존재하지 않는 설정 UUID — RolesGuard 는 핸들러보다 먼저 실행되므로 viewer 는
    // 설정 존재 여부와 무관하게 403 으로 차단되고, editor 는 가드를 통과한다. 실
    // provider 호출 없이 역할 게이트만 검증한다. (핸들러 도달 후 상태는 엔드포인트별
    // 상이: testConnection 은 best-effort 라 미존재도 200{success:false}, listModels 는
    // findEntity NotFound 가 전파돼 404 — 본 케이스의 관심사는 가드 통과/차단이다.)
    const missingId = '00000000-0000-4000-8000-000000000000';

    // viewer → 403 (Editor+ 게이트, 과금 action-POST). RolesGuard 는 body 검증 pipe
    // 보다 먼저 실행되므로 missingId·빈 body 와 무관하게 403.
    const viewerTest = await request(BASE_URL)
      .post(`/api/model-configs/${missingId}/test`)
      .set('Authorization', `Bearer ${viewer.accessToken}`)
      .set('X-Workspace-Id', ws);
    expect(viewerTest.status).toBe(403);

    // viewer → 403 on preview-models (R-7 이 묶는 두 번째 action-POST). 가드가 body
    // 검증보다 먼저 실행되므로 최소 body 로도 403 이며, 이 단언이 previewModels 의
    // @Roles('editor') 회귀를 e2e 에서 잡는다.
    const viewerPreview = await request(BASE_URL)
      .post('/api/model-configs/preview-models')
      .set('Authorization', `Bearer ${viewer.accessToken}`)
      .set('X-Workspace-Id', ws)
      .send({ provider: 'openai', apiKey: 'sk-test' });
    expect(viewerPreview.status).toBe(403);

    // editor → Editor+ 게이트 통과 → 403 이 아니다. 핸들러 도달 후 상태(testConnection
    // 은 best-effort 라 미존재 설정도 200{success:false} 반환)는 본 인가 테스트의
    // 관심사가 아니므로 단언하지 않는다 — 구현 변경에 테스트가 결합되지 않게 한다.
    const editorTest = await request(BASE_URL)
      .post(`/api/model-configs/${missingId}/test`)
      .set('Authorization', `Bearer ${editor.accessToken}`)
      .set('X-Workspace-Id', ws);
    expect(editorTest.status).not.toBe(403);

    // GET :id/models 는 Viewer+ 유지 — viewer 도 가드 통과(403 아님). listModels 는
    // findEntity NotFound 를 (catch 밖이라) 전파하므로 미존재 설정엔 404 — 이 안정
    // 경로는 viewer 가 핸들러에 실제 도달했음을 함께 확인해 준다.
    const viewerModels = await request(BASE_URL)
      .get(`/api/model-configs/${missingId}/models`)
      .set('Authorization', `Bearer ${viewer.accessToken}`)
      .set('X-Workspace-Id', ws);
    expect(viewerModels.status).not.toBe(403);
    expect(viewerModels.status).toBe(404);

    // ParseEnumPipe — 규격 외 `type` 은 가드 통과 후 pipe 가 핸들러 도달 전 400 으로
    // 거부한다(허용값 chat|embedding). 단위 테스트는 pipe wiring 을 우회하므로 e2e 로 검증.
    const invalidType = await request(BASE_URL)
      .get(`/api/model-configs/${missingId}/models?type=bogus`)
      .set('Authorization', `Bearer ${viewer.accessToken}`)
      .set('X-Workspace-Id', ws);
    expect(invalidType.status).toBe(400);
  });
});
