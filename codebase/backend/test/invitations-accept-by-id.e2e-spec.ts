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
 * e2e: 초대 알림의 초대 id 로 본인 초대를 보고 수락한다 (CLE-T-86E38Q).
 *
 * 근거: CLE-ACCT-WS-INVITE 「이미 가입한 사용자의 수락 경로」. 초대 알림(`team_invite`)의 `resource_id` 가 초대 id 다.
 * 수락 페이지는 그 id 로 `/api/users/me/invitations/:invitationId` 를 부른다. 토큰은 쓰지 않고 로그인 이메일이
 * 초대 이메일과 같은 초대만 찾는다.
 *
 * 검증:
 *   1) 받는 사람은 알림의 초대 id 로 메타를 보고 수락해 멤버가 된다.
 *   2) 다른 사용자는 그 초대 id 로 조회 · 수락할 수 없고 없는 초대와 같은 404 를 받는다(수락된 뒤에도 404).
 *   3) UUID 가 아닌 id, 취소한(지운) 초대는 404 다.
 *   4) 본인 초대가 이미 수락됐으면 410 invitation_already_used, 만료됐으면 410 invitation_expired 다.
 */

const BASE_URL = process.env.E2E_BASE_URL ?? 'http://backend-e2e:3011';

describe('Invitations — 초대 id 로 본인 초대 조회 · 수락 e2e', () => {
  let db: Client;
  let ownerToken: string;
  let invitee: { userId: string; email: string; accessToken: string };
  let stranger: { userId: string; email: string; accessToken: string };
  let teamWorkspaceId: string;
  let invitationId: string;

  const auth = (token: string) => ({ Authorization: `Bearer ${token}` });
  const metaOf = (token: string, id: string) =>
    request(BASE_URL).get(`/api/users/me/invitations/${id}`).set(auth(token));
  const acceptOf = (token: string, id: string) =>
    request(BASE_URL)
      .post(`/api/users/me/invitations/${id}/accept`)
      .set(auth(token));

  beforeAll(async () => {
    db = createDbClient();
    await db.connect();

    const owner = await registerAndLogin(
      BASE_URL,
      uniqueEmail('iid-owner'),
      db,
    );
    ownerToken = owner.accessToken;
    invitee = await registerAndLogin(BASE_URL, uniqueEmail('iid-invitee'), db);
    stranger = await registerAndLogin(
      BASE_URL,
      uniqueEmail('iid-stranger'),
      db,
    );
    teamWorkspaceId = await createTeamWorkspace(
      BASE_URL,
      ownerToken,
      uniqueName('iid-team'),
    );
    invitationId = await createInvitation(
      BASE_URL,
      ownerToken,
      teamWorkspaceId,
      invitee.email,
      'editor',
    );
  });

  afterAll(async () => {
    await db.end();
  });

  it('초대 알림의 resource_id 가 초대 id 다', async () => {
    const r = await db.query<{ resource_type: string; resource_id: string }>(
      `SELECT resource_type, resource_id FROM notification
        WHERE user_id = $1 AND type = 'team_invite'`,
      [invitee.userId],
    );
    expect(r.rows).toHaveLength(1);
    expect(r.rows[0]).toEqual({
      resource_type: 'workspace_invitation',
      resource_id: invitationId,
    });
  });

  it('받는 사람은 초대 id 로 메타를 본다', async () => {
    const res = await metaOf(invitee.accessToken, invitationId);
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({
      email: invitee.email.toLowerCase(),
      role: 'editor',
    });
    expect(typeof res.body.data.workspaceName).toBe('string');
  });

  it('다른 사용자 · UUID 가 아닌 id 는 없는 초대와 같은 404 다', async () => {
    for (const res of [
      await metaOf(stranger.accessToken, invitationId),
      await acceptOf(stranger.accessToken, invitationId),
      await metaOf(invitee.accessToken, 'not-a-uuid'),
      await acceptOf(invitee.accessToken, 'not-a-uuid'),
    ]) {
      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('invitation_not_found');
    }
    const member = await db.query(
      `SELECT 1 FROM workspace_member WHERE workspace_id = $1 AND user_id = $2`,
      [teamWorkspaceId, stranger.userId],
    );
    expect(member.rows).toHaveLength(0);
  });

  it('받는 사람이 수락하면 멤버가 되고 다시 보면 410 이다. 다른 사용자는 여전히 404 다', async () => {
    const res = await acceptOf(invitee.accessToken, invitationId);
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({
      workspaceId: teamWorkspaceId,
      role: 'editor',
    });
    const member = await db.query<{ role: string }>(
      `SELECT role FROM workspace_member WHERE workspace_id = $1 AND user_id = $2`,
      [teamWorkspaceId, invitee.userId],
    );
    expect(member.rows).toEqual([{ role: 'editor' }]);

    const again = await acceptOf(invitee.accessToken, invitationId);
    expect(again.status).toBe(410);
    expect(again.body.error.code).toBe('invitation_already_used');
    const meta = await metaOf(invitee.accessToken, invitationId);
    expect(meta.status).toBe(410);
    expect(meta.body.error.code).toBe('invitation_already_used');

    const foreign = await metaOf(stranger.accessToken, invitationId);
    expect(foreign.status).toBe(404);
  });

  it('만료한 본인 초대는 410 invitation_expired, 취소한 초대는 404 다', async () => {
    const expiredId = await createInvitation(
      BASE_URL,
      ownerToken,
      teamWorkspaceId,
      stranger.email,
      'viewer',
    );
    await db.query(
      `UPDATE workspace_invitation SET expires_at = NOW() - interval '1 minute' WHERE id = $1`,
      [expiredId],
    );
    const expired = await acceptOf(stranger.accessToken, expiredId);
    expect(expired.status).toBe(410);
    expect(expired.body.error.code).toBe('invitation_expired');

    const revoke = await request(BASE_URL)
      .delete(`/api/workspaces/${teamWorkspaceId}/invitations/${expiredId}`)
      .set(auth(ownerToken))
      .set('X-Workspace-Id', teamWorkspaceId);
    expect(revoke.status).toBe(200);
    const gone = await metaOf(stranger.accessToken, expiredId);
    expect(gone.status).toBe(404);
    expect(gone.body.error.code).toBe('invitation_not_found');
  });
});
