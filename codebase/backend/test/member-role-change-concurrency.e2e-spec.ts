import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { Client } from 'pg';
import request from 'supertest';

import { createDbClient, uniqueEmail, uniqueName } from './helpers/db';
import {
  registerAndLogin,
  createTeamWorkspace,
  inviteAndAccept,
  createInvitation,
} from './helpers/auth';
import { raceUnderHeldLock } from './helpers/concurrency';

/**
 * e2e: 관리자 역할을 건드리는 두 변경이 겹쳐도 소유자가 올린 admin 이 되돌려지지 않는다.
 *
 * 보호 대상은 `updateMemberRole` 과 `invite` 의 대기 초대 덮어쓰기가 거는 행 잠금
 * (`pessimistic_write`)이다. 단위 테스트는 잠금 인자와 호출 순서만 고정하고, «지금 역할을 읽은 뒤
 * 동시에 바뀐 값을 save 가 되돌린다» 는 결과는 실 DB 에서만 드러난다.
 *
 * 겹침은 테스트가 만든다 — 대상 행(멤버 · 대기 초대)을 `SELECT … FOR UPDATE` 로 쥔 채 두 요청을 쏘고
 * COMMIT 으로 함께 푼다(`helpers/concurrency.ts`).
 *
 * **도착 순서를 고정한다.** 소유자의 요청이 먼저 잠금 대기에 들어가고 관리자의 요청이 그 뒤에 들어간다.
 * 순서가 정해지지 않으면 고치기 전 코드도 초록이 될 수 있다 — 관리자 쪽이 먼저 저장되면 마지막에 저장하는
 * 소유자의 값(admin)이 남기 때문이다. 소유자가 먼저면 이렇게 갈린다.
 *
 * - 잠그기 전 코드: 두 요청이 모두 옛 역할(editor)을 읽고, 나중에 저장하는 관리자의 viewer 가 소유자의 admin 을
 *   덮는다. 최종 역할은 viewer 다.
 * - 잠근 뒤 코드: 관리자의 요청이 소유자가 저장한 admin 을 읽고 403 `OWNER_REQUIRED` 로 거부된다. 최종 역할은
 *   admin 이다.
 */

const BASE_URL = process.env.E2E_BASE_URL ?? 'http://backend-e2e:3011';

/** 다른 연결이 `table` 을 다루는 문장에서 행 잠금을 기다리는 것을 볼 때까지 기다린다. */
async function waitUntilBlocked(db: Client, table: string): Promise<void> {
  const deadline = Date.now() + 5_000;
  while (Date.now() < deadline) {
    const res = await db.query<{ n: number }>(
      `SELECT count(*)::int AS n FROM pg_stat_activity
        WHERE datname = current_database()
          AND wait_event_type = 'Lock'
          AND pid <> pg_backend_pid()
          AND query ILIKE $1`,
      [`%${table}%`],
    );
    if (res.rows[0].n > 0) return;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  // 대기를 보지 못하면 도착 순서를 보장할 수 없다 — 조용히 넘어가면 이 테스트가 고치기 전 코드도 통과시킨다.
  throw new Error(`no request was observed waiting on a ${table} lock`);
}

describe('Workspace admin role change concurrency (e2e)', () => {
  let db: Client;
  /** 락을 쥐는 쪽 — 요청이 도는 동안 열려 있어야 하므로 별도 커넥션이다. */
  let locker: Client;
  let ownerToken: string;
  let adminToken: string;
  let workspaceId: string;

  beforeAll(async () => {
    db = createDbClient();
    await db.connect();
    locker = createDbClient();
    await locker.connect();
    const owner = await registerAndLogin(BASE_URL, uniqueEmail('arc-own'), db);
    ownerToken = owner.accessToken;
    workspaceId = await createTeamWorkspace(
      BASE_URL,
      ownerToken,
      uniqueName('ARC'),
    );
    // 관리자 역할로 초대하는 것은 소유자만 할 수 있다.
    const admin = await inviteAndAccept(
      BASE_URL,
      ownerToken,
      workspaceId,
      uniqueEmail('arc-adm'),
      'admin',
      db,
    );
    adminToken = admin.accessToken;
  }, 120_000);

  afterAll(async () => {
    await locker.end();
    await db.end();
  });

  const settled = (res: request.Response) => ({
    status: res.status,
    code: res.body?.error?.code as string | undefined,
  });

  it('멤버 역할 변경: 소유자의 editor→admin 을 겹친 관리자의 editor→viewer 가 되돌리지 않는다', async () => {
    const editor = await inviteAndAccept(
      BASE_URL,
      ownerToken,
      workspaceId,
      uniqueEmail('arc-edt'),
      'editor',
      db,
    );
    const memberRow = await db.query<{ id: string }>(
      'SELECT id FROM workspace_member WHERE workspace_id = $1 AND user_id = $2',
      [workspaceId, editor.userId],
    );
    expect(memberRow.rows).toHaveLength(1);
    const memberId = memberRow.rows[0].id;

    const patchRole = (token: string, role: string) =>
      request(BASE_URL)
        .patch(`/api/workspaces/${workspaceId}/members/${memberId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ role })
        .then(settled);

    const fireOwner = () => patchRole(ownerToken, 'admin');
    const fireAdmin = async () => {
      // 소유자의 요청이 대기에 들어간 뒤에 관리자의 요청을 쏜다.
      await waitUntilBlocked(db, 'workspace_member');
      return patchRole(adminToken, 'viewer');
    };

    const lockMember = {
      sql: 'SELECT id FROM workspace_member WHERE id = $1 FOR UPDATE',
      params: [memberId],
    };

    const [ownerRes, adminRes] = await raceUnderHeldLock(locker, lockMember, [
      fireOwner,
      fireAdmin,
    ]);

    expect(ownerRes.status).toBe(200);
    // 관리자의 요청은 소유자가 저장한 admin 을 읽고 거부된다.
    expect(adminRes.status).toBe(403);
    expect(adminRes.code).toBe('OWNER_REQUIRED');
    const role = await db.query<{ role: string }>(
      'SELECT role FROM workspace_member WHERE id = $1',
      [memberId],
    );
    expect(role.rows[0].role).toBe('admin');
  }, 120_000);

  it('대기 초대 덮어쓰기: 소유자의 editor→admin 초대를 겹친 관리자의 viewer 초대가 되돌리지 않는다', async () => {
    const email = uniqueEmail('arc-inv');
    await createInvitation(BASE_URL, ownerToken, workspaceId, email, 'editor');

    const payload = (role: string) => ({
      email,
      role,
    });

    const invite = (token: string, role: string) =>
      request(BASE_URL)
        .post(`/api/workspaces/${workspaceId}/invitations`)
        .set('Authorization', `Bearer ${token}`)
        .send(payload(role))
        .then(settled);

    const fireOwner = () => invite(ownerToken, 'admin');
    const fireAdmin = async () => {
      await waitUntilBlocked(db, 'workspace_invitation');
      return invite(adminToken, 'viewer');
    };

    const lockPending = {
      sql:
        'SELECT id FROM workspace_invitation WHERE workspace_id = $1 AND email = $2 ' +
        'AND accepted_at IS NULL FOR UPDATE',
      params: [workspaceId, email],
    };

    const [ownerRes, adminRes] = await raceUnderHeldLock(locker, lockPending, [
      fireOwner,
      fireAdmin,
    ]);

    expect(ownerRes.status).toBe(201);
    expect(adminRes.status).toBe(403);
    expect(adminRes.code).toBe('OWNER_REQUIRED');
    // 대기 초대는 하나뿐이고 역할은 소유자가 정한 admin 이다.
    const pending = await db.query<{ role: string }>(
      'SELECT role FROM workspace_invitation WHERE workspace_id = $1 AND email = $2 AND accepted_at IS NULL',
      [workspaceId, email],
    );
    expect(pending.rows.map((r) => r.role)).toEqual(['admin']);
  }, 120_000);
});
