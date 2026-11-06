import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { Client } from 'pg';
import request from 'supertest';

import { createDbClient, uniqueEmail, uniqueName } from './helpers/db';
import {
  TEST_PASSWORD,
  createTeamWorkspace,
  postInvitation,
  registerAndLogin,
} from './helpers/auth';

/**
 * e2e: 워크스페이스 멤버 직접 추가와 초대가 기존 가입자를 가입과 로그인 「이메일 비교 규칙」대로 찾는지 본다
 * (NERV CLE-ACCT-WS REQ-WSPACE-070 ~ 072, CLE-T-KG01YT).
 *
 * 가입이 이메일을 소문자로 저장하기 전에 생긴 계정은 대소문자가 섞인 채 남아 있다. 그런 계정을 흉내 내려고
 * 가입한 뒤 DB 의 `email` 을 직접 바꾼다(`email UNIQUE` 는 대소문자를 구분한다). 대소문자만 다른 계정 묶음도
 * 같은 방법으로 만든다(auth.e2e-spec 의 I 와 같다).
 */

const BASE_URL = process.env.E2E_BASE_URL ?? 'http://backend-e2e:3011';

describe('Workspace member email case (e2e)', () => {
  let db: Client;
  let ownerToken: string;

  beforeAll(async () => {
    db = createDbClient();
    await db.connect();
    const owner = await registerAndLogin(
      BASE_URL,
      uniqueEmail('ws-case-owner'),
      db,
    );
    ownerToken = owner.accessToken;
  }, 30_000);

  afterAll(async () => {
    await db.end();
  });

  /**
   * 다른 이메일로 가입한 뒤 저장된 이메일을 `stored` 로 바꾼다. 바꾼 계정의 id 를 돌려준다. 가입 이메일은 따로 만든다.
   * 대소문자만 다른 두 `stored` 를 소문자로 바꿔 가입하면 둘째 가입이 409 이기 때문이다.
   */
  async function registerWithStoredEmail(stored: string): Promise<string> {
    const signup = uniqueEmail('ws-case-signup');
    await request(BASE_URL)
      .post('/api/auth/register')
      .send({
        name: 'Case User',
        email: signup,
        password: TEST_PASSWORD,
        termsAccepted: true,
      })
      .expect(201);
    const row = await db.query<{ id: string }>(
      'UPDATE "user" SET email = $1, email_verified = true WHERE email = $2 RETURNING id',
      [stored, signup],
    );
    return row.rows[0].id;
  }

  function addMember(workspaceId: string, email: string) {
    return request(BASE_URL)
      .post(`/api/workspaces/${workspaceId}/members`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ email, role: 'editor' });
  }

  async function memberUserIds(workspaceId: string): Promise<string[]> {
    const rows = await db.query<{ user_id: string }>(
      'SELECT user_id FROM workspace_member WHERE workspace_id = $1',
      [workspaceId],
    );
    return rows.rows.map((r) => r.user_id);
  }

  async function teamInviteCount(userIds: string[]): Promise<number> {
    const rows = await db.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM notification
        WHERE type = 'team_invite' AND user_id = ANY($1::uuid[])`,
      [userIds],
    );
    return Number(rows.rows[0].count);
  }

  it('A. 직접 추가는 대소문자가 섞여 저장된 기존 계정을 소문자 입력으로 찾고 다시 추가하면 409 다', async () => {
    const stored = uniqueEmail('Ws-Case-A').replace('e2e.local', 'E2E.Local');
    const userId = await registerWithStoredEmail(stored);
    const workspaceId = await createTeamWorkspace(
      BASE_URL,
      ownerToken,
      uniqueName('ws-case-a'),
    );

    const added = await addMember(workspaceId, stored.toLowerCase());
    expect(added.status).toBe(201);
    expect(await memberUserIds(workspaceId)).toContain(userId);

    const again = await addMember(workspaceId, stored.toUpperCase());
    expect(again.status).toBe(409);
    expect(again.body.error.code).toBe('ALREADY_A_MEMBER');
  });

  it('B. 초대는 대소문자가 섞여 저장된 기존 계정에 team_invite 알림을 남기고 멤버면 409 다', async () => {
    const stored = uniqueEmail('Ws-Case-B').replace('e2e.local', 'E2E.Local');
    const userId = await registerWithStoredEmail(stored);
    const workspaceId = await createTeamWorkspace(
      BASE_URL,
      ownerToken,
      uniqueName('ws-case-b'),
    );

    const invited = await postInvitation(
      BASE_URL,
      ownerToken,
      workspaceId,
      stored.toLowerCase(),
      'editor',
    );
    expect(invited.status).toBe(201);
    expect(invited.body.data.email).toBe(stored.toLowerCase());
    expect(await teamInviteCount([userId])).toBe(1);

    await addMember(workspaceId, stored).expect(201);
    const asMember = await postInvitation(
      BASE_URL,
      ownerToken,
      workspaceId,
      stored.toLowerCase(),
      'editor',
    );
    expect(asMember.status).toBe(409);
    expect(asMember.body.error.code).toBe('already_a_member');
  });

  it('C. 대소문자만 다른 계정 묶음에서는 입력과 정확히 같은 계정만 쓰고 정할 수 없으면 직접 추가는 404 이고 초대는 메일만 보낸다', async () => {
    const lower = uniqueEmail('ws-case-c');
    const variant = lower.replace('ws-case-c', 'Ws-Case-C');
    const lowerId = await registerWithStoredEmail(lower);
    const variantId = await registerWithStoredEmail(variant);
    const workspaceId = await createTeamWorkspace(
      BASE_URL,
      ownerToken,
      uniqueName('ws-case-c'),
    );
    const ambiguous = lower.toUpperCase();

    const notFound = await addMember(workspaceId, ambiguous);
    expect(notFound.status).toBe(404);
    expect(notFound.body.error.code).toBe('USER_NOT_FOUND');

    const invited = await postInvitation(
      BASE_URL,
      ownerToken,
      workspaceId,
      ambiguous,
      'editor',
    );
    expect(invited.status).toBe(201);
    expect(invited.body.data.email).toBe(lower);
    expect(await teamInviteCount([lowerId, variantId])).toBe(0);

    const exact = await addMember(workspaceId, variant);
    expect(exact.status).toBe(201);
    const members = await memberUserIds(workspaceId);
    expect(members).toContain(variantId);
    expect(members).not.toContain(lowerId);
  });
});
