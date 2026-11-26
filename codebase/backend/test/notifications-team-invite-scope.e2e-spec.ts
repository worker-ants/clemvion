import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { Client } from 'pg';
import request from 'supertest';

import { createDbClient, uniqueEmail, uniqueName } from './helpers/db';
import {
  registerAndLogin,
  createTeamWorkspace,
  createInvitation,
} from './helpers/auth';

/**
 * e2e: 초대 알림은 받는 사람이 그 워크스페이스 멤버가 아니어도 벨에 보인다 (CLE-T-NE4KKZ).
 *
 * 초대 알림은 초대한 워크스페이스로 저장되고 받는 사람은 아직 멤버가 아니다. 그래서 벨 조회가
 * 현재 워크스페이스 조건만 쓰면 초대 알림은 어느 워크스페이스에서도 보이지 않았다.
 *
 * 검증:
 *   1) 비멤버가 자기 개인 워크스페이스에서 연 벨 목록과 미읽음 수에 초대 알림이 있다.
 *   2) 다른 유형의 알림은 여전히 그 알림의 워크스페이스에서만 보인다.
 *   3) 모두 읽음 · 모두 닫기는 초대 알림을 포함하고 다른 워크스페이스의 다른 유형은 건드리지 않는다.
 */

const BASE_URL = process.env.E2E_BASE_URL ?? 'http://backend-e2e:3011';

interface NotificationRow {
  id: string;
  type: string;
  isRead: boolean;
}

describe('Notifications — team_invite 는 워크스페이스 조건 밖에서 보인다 e2e', () => {
  let db: Client;
  let ownerToken: string;
  let invitee: { userId: string; email: string; accessToken: string };
  let inviteeAuth: { Authorization: string };
  let teamWorkspaceId: string;
  let otherTeamWorkspaceId: string;
  let personalWorkspaceId: string;
  let inviteNotificationId: string;
  let foreignNotificationId: string;

  async function list(workspaceId: string): Promise<NotificationRow[]> {
    const res = await request(BASE_URL)
      .get('/api/notifications?limit=50')
      .set(inviteeAuth)
      .set('X-Workspace-Id', workspaceId);
    expect(res.status).toBe(200);
    return (res.body.data?.data ?? res.body.data ?? []) as NotificationRow[];
  }

  async function unreadCount(workspaceId: string): Promise<number> {
    const res = await request(BASE_URL)
      .get('/api/notifications/unread-count')
      .set(inviteeAuth)
      .set('X-Workspace-Id', workspaceId);
    expect(res.status).toBe(200);
    return res.body.data.count as number;
  }

  async function rowState(
    id: string,
  ): Promise<{ is_read: boolean; dismissed: boolean }> {
    const r = await db.query<{ is_read: boolean; dismissed: boolean }>(
      `SELECT is_read, dismissed_at IS NOT NULL AS dismissed
         FROM notification WHERE id = $1`,
      [id],
    );
    return r.rows[0];
  }

  beforeAll(async () => {
    db = createDbClient();
    await db.connect();

    const owner = await registerAndLogin(
      BASE_URL,
      uniqueEmail('ninv-owner'),
      db,
    );
    ownerToken = owner.accessToken;
    invitee = await registerAndLogin(BASE_URL, uniqueEmail('ninv-invitee'), db);
    inviteeAuth = { Authorization: `Bearer ${invitee.accessToken}` };

    teamWorkspaceId = await createTeamWorkspace(
      BASE_URL,
      ownerToken,
      uniqueName('ninv-team'),
    );

    const personal = await db.query<{ id: string }>(
      `SELECT w.id FROM workspace w
         JOIN workspace_member m ON m.workspace_id = w.id
        WHERE m.user_id = $1 AND w.type = 'personal'`,
      [invitee.userId],
    );
    expect(personal.rows).toHaveLength(1);
    personalWorkspaceId = personal.rows[0].id;

    // 받는 사람이 멤버인 두 번째 팀 워크스페이스. 다른 유형의 알림이 워크스페이스 밖으로 새지 않는지 본다.
    otherTeamWorkspaceId = await createTeamWorkspace(
      BASE_URL,
      invitee.accessToken,
      uniqueName('ninv-own'),
    );
    const foreign = await db.query<{ id: string }>(
      `INSERT INTO notification (workspace_id, user_id, type, title, message, is_read, channel)
       VALUES ($1, $2, 'execution_failed', $3, $4, false, 'in_app')
       RETURNING id`,
      [otherTeamWorkspaceId, invitee.userId, 'foreign', 'foreign'],
    );
    foreignNotificationId = foreign.rows[0].id;

    const invitationId = await createInvitation(
      BASE_URL,
      ownerToken,
      teamWorkspaceId,
      invitee.email,
      'editor',
    );
    const invite = await db.query<{ id: string; workspace_id: string }>(
      `SELECT id, workspace_id FROM notification
        WHERE user_id = $1 AND type = 'team_invite' AND resource_id = $2`,
      [invitee.userId, invitationId],
    );
    expect(invite.rows).toHaveLength(1);
    // 저장은 그대로 초대한 워크스페이스다. 조회 쪽만 바꿨다.
    expect(invite.rows[0].workspace_id).toBe(teamWorkspaceId);
    inviteNotificationId = invite.rows[0].id;
  });

  afterAll(async () => {
    await db.end();
  });

  it('비멤버도 개인 워크스페이스의 벨 목록과 미읽음 수에서 초대 알림을 본다', async () => {
    const ids = (await list(personalWorkspaceId)).map((n) => n.id);
    expect(ids).toContain(inviteNotificationId);
    expect(ids).not.toContain(foreignNotificationId);
    expect(await unreadCount(personalWorkspaceId)).toBe(1);
  });

  it('다른 유형의 알림은 그 알림의 워크스페이스에서만 보인다', async () => {
    const ids = (await list(otherTeamWorkspaceId)).map((n) => n.id);
    expect(ids).toContain(foreignNotificationId);
    // 초대 알림은 어느 워크스페이스에서 열어도 보인다.
    expect(ids).toContain(inviteNotificationId);
    expect(await unreadCount(otherTeamWorkspaceId)).toBe(2);
  });

  it('모두 읽음은 초대 알림을 읽음으로 바꾸고 다른 워크스페이스의 알림은 그대로 둔다', async () => {
    const res = await request(BASE_URL)
      .post('/api/notifications/mark-all-read')
      .set(inviteeAuth)
      .set('X-Workspace-Id', personalWorkspaceId);
    expect([200, 201]).toContain(res.status);
    expect(res.body.data.affected).toBe(1);

    expect((await rowState(inviteNotificationId)).is_read).toBe(true);
    expect((await rowState(foreignNotificationId)).is_read).toBe(false);
    expect(await unreadCount(personalWorkspaceId)).toBe(0);
  });

  it('모두 닫기는 초대 알림을 닫고 다른 워크스페이스의 알림은 그대로 둔다', async () => {
    const res = await request(BASE_URL)
      .post('/api/notifications/dismiss-all')
      .set(inviteeAuth)
      .set('X-Workspace-Id', personalWorkspaceId);
    expect([200, 201]).toContain(res.status);
    expect(res.body.data.affected).toBe(1);

    expect((await rowState(inviteNotificationId)).dismissed).toBe(true);
    expect((await rowState(foreignNotificationId)).dismissed).toBe(false);
    expect((await list(personalWorkspaceId)).map((n) => n.id)).not.toContain(
      inviteNotificationId,
    );
  });
});
