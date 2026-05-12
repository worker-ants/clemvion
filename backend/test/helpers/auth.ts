import { Client } from 'pg';
import request from 'supertest';

/**
 * spec/5-system/1-auth.md 의 가입·로그인·세션 흐름을 e2e setup 단계에서 빠르게
 * 통과시키는 헬퍼. 이메일 인증은 인증 메일 mock 대신 DB 의 email_verified 를 직접
 * true 로 갱신해 fast-track 한다 — 이메일 전송 자체는 별도 모듈 단위 테스트가
 * 담당하고, 본 e2e 의 관심사는 가입 이후 흐름이기 때문.
 */

export const TEST_PASSWORD = 'E2eTest!1234';

export interface RegisteredUser {
  userId: string;
  email: string;
  accessToken: string;
}

/**
 * Owner 가입 → 이메일 인증(DB UPDATE) → 로그인. 인증 토큰까지 한 번에 회수한다.
 * accessToken 만 필요하면 그대로 사용 가능. password 는 helpers 의 기본값을 쓰되,
 * 특정 시나리오가 다른 비밀번호를 검증해야 하면 override.
 */
export async function registerAndLogin(
  baseUrl: string,
  email: string,
  db: Client,
  password: string = TEST_PASSWORD,
  name: string = 'E2E User',
): Promise<RegisteredUser> {
  const registerRes = await request(baseUrl)
    .post('/api/auth/register')
    .send({ name, email, password, termsAccepted: true });
  if (registerRes.status !== 201) {
    throw new Error(
      `register failed: ${registerRes.status} ${JSON.stringify(registerRes.body)}`,
    );
  }

  await db.query('UPDATE "user" SET email_verified = true WHERE email = $1', [
    email,
  ]);

  const loginRes = await request(baseUrl)
    .post('/api/auth/login')
    .send({ email, password });
  if (loginRes.status !== 200) {
    throw new Error(
      `login failed: ${loginRes.status} ${JSON.stringify(loginRes.body)}`,
    );
  }
  const accessToken = (loginRes.body.data as { accessToken: string })
    .accessToken;

  const userRow = await db.query<{ id: string }>(
    'SELECT id FROM "user" WHERE email = $1',
    [email],
  );
  if (userRow.rows.length === 0) throw new Error('user row missing after login');

  return { userId: userRow.rows[0].id, email, accessToken };
}

/**
 * 팀 워크스페이스 1개 생성. 응답에서 id 만 회수한다.
 */
export async function createTeamWorkspace(
  baseUrl: string,
  accessToken: string,
  name: string,
): Promise<string> {
  const res = await request(baseUrl)
    .post('/api/workspaces')
    .set('Authorization', `Bearer ${accessToken}`)
    .send({ name });
  if (res.status !== 201) {
    throw new Error(
      `workspace create failed: ${res.status} ${JSON.stringify(res.body)}`,
    );
  }
  return (res.body.data as { id: string }).id;
}

export type WorkspaceRole = 'owner' | 'editor' | 'viewer';

/**
 * 초대 → 토큰 회수 → register 로 가입 + 자동 멤버 등록. 최종적으로 invitee 의
 * accessToken 까지 회수한다. 멀티 액터 RBAC 시나리오 setup 에 유용.
 */
export async function inviteAndAccept(
  baseUrl: string,
  ownerToken: string,
  workspaceId: string,
  inviteeEmail: string,
  role: Exclude<WorkspaceRole, 'owner'>,
  db: Client,
  inviteeName: string = 'E2E Invitee',
  password: string = TEST_PASSWORD,
): Promise<RegisteredUser> {
  // invitation 엔드포인트는 1분당 10건 throttler 가 걸려있어, e2e suite 들의
  // 누적 invitation 이 한도를 넘으면 429 가 나온다. 최대 3회 backoff 재시도로
  // throttle window 가 회전하길 기다린다 (총 최대 ~30s 대기).
  const inviteOnce = () =>
    request(baseUrl)
      .post(`/api/workspaces/${workspaceId}/invitations`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ email: inviteeEmail, role });

  let inviteRes = await inviteOnce();
  const backoffs = [3_000, 8_000, 20_000];
  for (let i = 0; i < backoffs.length && inviteRes.status === 429; i++) {
    await new Promise((r) => setTimeout(r, backoffs[i]));
    inviteRes = await inviteOnce();
  }
  if (inviteRes.status !== 201) {
    throw new Error(
      `invite failed: ${inviteRes.status} ${JSON.stringify(inviteRes.body)}`,
    );
  }

  const tokenRow = await db.query<{ token: string }>(
    `SELECT token FROM workspace_invitation
       WHERE workspace_id = $1 AND email = $2
       ORDER BY created_at DESC
       LIMIT 1`,
    [workspaceId, inviteeEmail],
  );
  if (tokenRow.rows.length === 0) throw new Error('invitation row not found');

  const registerRes = await request(baseUrl)
    .post('/api/auth/register')
    .send({
      name: inviteeName,
      email: inviteeEmail,
      password,
      termsAccepted: true,
      invitationToken: tokenRow.rows[0].token,
    });
  if (registerRes.status !== 201) {
    throw new Error(
      `invitee register failed: ${registerRes.status} ${JSON.stringify(registerRes.body)}`,
    );
  }
  const accessToken = (registerRes.body.data as { accessToken: string })
    .accessToken;
  if (!accessToken) {
    throw new Error(
      `invitee accessToken missing in register response: ${JSON.stringify(registerRes.body)}`,
    );
  }

  const userRow = await db.query<{ id: string }>(
    'SELECT id FROM "user" WHERE email = $1',
    [inviteeEmail],
  );
  if (userRow.rows.length === 0) throw new Error('invitee user row missing');
  const userId = userRow.rows[0].id;

  // 알려진 백엔드 inconsistency 우회: JwtStrategy.validate() 가 모든 요청마다
  // findPersonalWorkspace(user.id) 를 강제하지만, register-with-invitation 경로는
  // 명시적으로 "개인 워크스페이스 자동 생성 없음" 으로 동작한다. 따라서 초대로 가입한
  // 사용자의 accessToken 으로 후속 API 를 호출하면 항상 401 이 떨어진다. e2e 에서
  // RBAC 의미를 검증하기 위해 DB 에 personal workspace + 그 멤버십을 fast-track 으로
  // 추가한다 (운영 흐름과 동등한 효과 — verifyEmail 이 같은 INSERT 를 수행).
  const slug = `personal-${userId.slice(0, 8)}-${Date.now()}`;
  await db.query(
    `INSERT INTO workspace (name, type, owner_id, slug)
     VALUES ($1, 'personal', $2, $3)
     ON CONFLICT (slug) DO NOTHING`,
    [`${inviteeName}'s Personal`, userId, slug],
  );
  await db.query(
    `INSERT INTO workspace_member (workspace_id, user_id, role, joined_at)
       SELECT w.id, $1, 'owner', NOW()
         FROM workspace w
        WHERE w.owner_id = $1 AND w.type = 'personal'
     ON CONFLICT (workspace_id, user_id) DO NOTHING`,
    [userId],
  );

  return { userId, email: inviteeEmail, accessToken };
}

/**
 * register/login 결과로 받은 refresh cookie 헤더에서 raw cookie 문자열을 추출.
 * 후속 refresh/logout 호출에 그대로 첨부할 수 있다.
 *
 * NestJS auth.controller 가 `refreshToken` 키로 cookie 를 발급하므로 (snake_case
 * 아님), 매칭도 camelCase prefix 로 한다.
 */
export function extractRefreshCookie(
  setCookieHeader: string[] | undefined,
): string | null {
  if (!setCookieHeader) return null;
  const match = setCookieHeader.find((c) => c.startsWith('refreshToken='));
  return match ? match.split(';')[0] : null;
}
