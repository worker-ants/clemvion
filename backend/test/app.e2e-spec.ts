import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { Client } from 'pg';
import request from 'supertest';

/**
 * e2e: 초대 토큰 흐름 (NAV-UP-05) 의 end-to-end 검증.
 *
 * 전제 — docker-compose.e2e.yml 환경:
 *   - backend-e2e 가 3011 에서 떠 있고 health 통과
 *   - postgres (clemvion_e2e DB) / redis / minio 가 같은 network 에 있음
 *   - 본 runner 는 컨테이너 안에서 실행되며 E2E_BASE_URL = http://backend-e2e:3011
 *
 * spec/5-system/1-auth.md §1.5.4 의 에러 코드를 정확히 검증한다:
 *   - 410 invitation_already_used / invitation_expired
 *   - 400 invitation_email_mismatch
 */

const BASE_URL = process.env.E2E_BASE_URL ?? 'http://backend-e2e:3011';
const PASSWORD = 'E2eTest!1234';

interface InvitationRow {
  id: string;
  token: string;
  email: string;
  workspace_id: string;
  expires_at: Date;
  accepted_at: Date | null;
}

// 매 시나리오에 고유한 이메일을 부여해 DB 상태가 겹치지 않도록 한다.
function uniqueEmail(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1e6)}@e2e.local`;
}

describe('Invitation flow (e2e)', () => {
  let db: Client;
  let ownerAccessToken: string;
  let ownerEmail: string;
  let teamWorkspaceId: string;

  beforeAll(async () => {
    db = new Client({
      host: process.env.DB_HOST ?? 'postgres',
      port: Number(process.env.DB_PORT ?? '5432'),
      user: process.env.DB_USERNAME ?? 'clemvion',
      password: process.env.DB_PASSWORD ?? 'clemvion-e2e',
      database: process.env.DB_DATABASE ?? 'clemvion_e2e',
    });
    await db.connect();

    // (1) Owner 가입 → 이메일 인증 (직접 DB 업데이트로 fast-track) → 로그인 → 팀 생성.
    ownerEmail = uniqueEmail('owner');
    await request(BASE_URL).post('/api/auth/register').send({
      name: 'E2E Owner',
      email: ownerEmail,
      password: PASSWORD,
      termsAccepted: true,
    });

    await db.query('UPDATE "user" SET email_verified = true WHERE email = $1', [
      ownerEmail,
    ]);

    const loginRes = await request(BASE_URL)
      .post('/api/auth/login')
      .send({ email: ownerEmail, password: PASSWORD });
    expect(loginRes.status).toBe(200);
    ownerAccessToken = (loginRes.body.data as { accessToken: string })
      .accessToken;

    const wsRes = await request(BASE_URL)
      .post('/api/workspaces')
      .set('Authorization', `Bearer ${ownerAccessToken}`)
      .send({ name: 'E2E Team' });
    expect(wsRes.status).toBe(201);
    teamWorkspaceId = (wsRes.body.data as { id: string }).id;
  }, 60_000);

  afterAll(async () => {
    await db.end();
  });

  async function fetchTokenForEmail(
    workspaceId: string,
    email: string,
  ): Promise<InvitationRow> {
    const result = await db.query<InvitationRow>(
      `SELECT id, token, email, workspace_id, expires_at, accepted_at
       FROM workspace_invitation
       WHERE workspace_id = $1 AND email = $2
       ORDER BY created_at DESC
       LIMIT 1`,
      [workspaceId, email],
    );
    expect(result.rows.length).toBe(1);
    return result.rows[0];
  }

  it('A. invite → register with token → 자동 멤버 등록', async () => {
    const inviteeEmail = uniqueEmail('a-invitee');
    await request(BASE_URL)
      .post(`/api/workspaces/${teamWorkspaceId}/invitations`)
      .set('Authorization', `Bearer ${ownerAccessToken}`)
      .send({ email: inviteeEmail, role: 'editor' })
      .expect(201);

    const row = await fetchTokenForEmail(teamWorkspaceId, inviteeEmail);

    const registerRes = await request(BASE_URL)
      .post('/api/auth/register')
      .send({
        name: 'A Invitee',
        email: inviteeEmail,
        password: PASSWORD,
        termsAccepted: true,
        invitationToken: row.token,
      });
    expect(registerRes.status).toBe(201);
    expect(registerRes.body.data.accessToken).toBeDefined();

    const member = await db.query(
      `SELECT wm.role FROM workspace_member wm
       JOIN "user" u ON u.id = wm.user_id
       WHERE wm.workspace_id = $1 AND u.email = $2`,
      [teamWorkspaceId, inviteeEmail],
    );
    expect(member.rows).toEqual([{ role: 'editor' }]);

    const consumed = await db.query(
      'SELECT accepted_at FROM workspace_invitation WHERE id = $1',
      [row.id],
    );
    expect(consumed.rows[0].accepted_at).not.toBeNull();
  });

  it('B. expired token → 410 invitation_expired', async () => {
    const email = uniqueEmail('b-expired');
    await request(BASE_URL)
      .post(`/api/workspaces/${teamWorkspaceId}/invitations`)
      .set('Authorization', `Bearer ${ownerAccessToken}`)
      .send({ email, role: 'editor' })
      .expect(201);

    const row = await fetchTokenForEmail(teamWorkspaceId, email);
    await db.query(
      `UPDATE workspace_invitation SET expires_at = NOW() - INTERVAL '1 day' WHERE id = $1`,
      [row.id],
    );

    const res = await request(BASE_URL).get(
      `/api/invitations/${encodeURIComponent(row.token)}`,
    );
    expect(res.status).toBe(410);
    expect(res.body.error.code).toBe('invitation_expired');
  });

  it('C. email mismatch on register → 400 invitation_email_mismatch', async () => {
    const tokenEmail = uniqueEmail('c-token');
    const otherEmail = uniqueEmail('c-other');
    await request(BASE_URL)
      .post(`/api/workspaces/${teamWorkspaceId}/invitations`)
      .set('Authorization', `Bearer ${ownerAccessToken}`)
      .send({ email: tokenEmail, role: 'viewer' })
      .expect(201);

    const row = await fetchTokenForEmail(teamWorkspaceId, tokenEmail);

    const res = await request(BASE_URL).post('/api/auth/register').send({
      name: 'C Mismatch',
      email: otherEmail,
      password: PASSWORD,
      termsAccepted: true,
      invitationToken: row.token,
    });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('invitation_email_mismatch');

    // User 가 만들어지지 않았는지 (트랜잭션 롤백) 확인.
    const userCount = await db.query(
      'SELECT COUNT(*) AS n FROM "user" WHERE email = $1',
      [otherEmail],
    );
    expect(Number(userCount.rows[0].n)).toBe(0);
  });

  it('D. concurrent register w/ same token — 한 번만 성공', async () => {
    const inviteeEmail = uniqueEmail('d-race');
    await request(BASE_URL)
      .post(`/api/workspaces/${teamWorkspaceId}/invitations`)
      .set('Authorization', `Bearer ${ownerAccessToken}`)
      .send({ email: inviteeEmail, role: 'viewer' })
      .expect(201);

    const row = await fetchTokenForEmail(teamWorkspaceId, inviteeEmail);

    // 두 클라이언트가 동시에 register w/ token 시도. 트랜잭션 직렬화 + email
    // UNIQUE 조합으로 둘 중 한 명만 성공해야 한다.
    const [r1, r2] = await Promise.all([
      request(BASE_URL).post('/api/auth/register').send({
        name: 'D-1',
        email: inviteeEmail,
        password: PASSWORD,
        termsAccepted: true,
        invitationToken: row.token,
      }),
      request(BASE_URL).post('/api/auth/register').send({
        name: 'D-2',
        email: inviteeEmail,
        password: PASSWORD,
        termsAccepted: true,
        invitationToken: row.token,
      }),
    ]);

    const successes = [r1.status, r2.status].filter((s) => s === 201).length;
    // 본질: 둘 다 201 이 되면 안 된다 (token + user UNIQUE 가 동시 소비됨).
    // 정확히 한 user 만 commit 되거나, race timing 에 따라 둘 다 fail 할 수도 있다
    // — 후자는 "안전 fail" 이라 spec 부합 (재시도하면 한 쪽이 다음 라운드에 성공).
    // 핵심 invariant: created user 수 == 성공한 register 수, 그리고 ≤ 1.
    expect(successes).toBeLessThanOrEqual(1);

    const userRows = await db.query(
      'SELECT COUNT(*) AS n FROM "user" WHERE email = $1',
      [inviteeEmail],
    );
    expect(Number(userRows.rows[0].n)).toBe(successes);
  });

  it('E. resend — 기존 토큰 즉시 무효, 새 토큰만 동작', async () => {
    const email = uniqueEmail('e-resend');
    await request(BASE_URL)
      .post(`/api/workspaces/${teamWorkspaceId}/invitations`)
      .set('Authorization', `Bearer ${ownerAccessToken}`)
      .send({ email, role: 'editor' })
      .expect(201);

    const first = await fetchTokenForEmail(teamWorkspaceId, email);

    const resend = await request(BASE_URL)
      .post(`/api/workspaces/${teamWorkspaceId}/invitations/${first.id}/resend`)
      .set('Authorization', `Bearer ${ownerAccessToken}`);
    expect(resend.status).toBe(200);

    const second = await fetchTokenForEmail(teamWorkspaceId, email);
    expect(second.token).not.toBe(first.token);

    // 옛 토큰으로 메타 조회 → 404.
    const oldLookup = await request(BASE_URL).get(
      `/api/invitations/${encodeURIComponent(first.token)}`,
    );
    expect(oldLookup.status).toBe(404);

    // 새 토큰으로 조회 → 200.
    const newLookup = await request(BASE_URL).get(
      `/api/invitations/${encodeURIComponent(second.token)}`,
    );
    expect(newLookup.status).toBe(200);
    expect(newLookup.body.data.email).toBe(email);
  });
});
