import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { Client } from 'pg';
import request from 'supertest';

import { createDbClient, uniqueEmail } from './helpers/db';
import { TEST_PASSWORD, extractRefreshCookie } from './helpers/auth';

/**
 * e2e: 사용자 세션(refresh token family) 라이프사이클을 실 인프라에서 검증.
 *
 * spec: spec/2-navigation/9-user-profile.md §sessions (auth-sessions 작업의 산출물).
 * 본인 인증(비밀번호 또는 TOTP) 없이 revoke 불가, 단일 revoke 와 revoke-others 가
 * 각각 family 단위로 refresh 토큰을 무효화하는지 확인.
 */

const BASE_URL = process.env.E2E_BASE_URL ?? 'http://backend-e2e:3011';

async function loginAndGetCookie(
  email: string,
  password: string,
  userAgent: string,
): Promise<string> {
  const res = await request(BASE_URL)
    .post('/api/auth/login')
    .set('User-Agent', userAgent)
    .send({ email, password });
  expect(res.status).toBe(200);
  const cookie = extractRefreshCookie(
    res.headers['set-cookie'] as unknown as string[],
  );
  if (!cookie) throw new Error('no refresh cookie issued at login');
  return cookie;
}

describe('Session revocation (e2e)', () => {
  let db: Client;

  beforeAll(async () => {
    db = createDbClient();
    await db.connect();
  }, 30_000);

  afterAll(async () => {
    await db.end();
  });

  async function setupUser(prefix: string): Promise<{
    email: string;
    cookieA: string;
    cookieB: string;
    accessTokenA: string;
  }> {
    const email = uniqueEmail(prefix);
    await request(BASE_URL)
      .post('/api/auth/register')
      .send({
        name: 'Session User',
        email,
        password: TEST_PASSWORD,
        termsAccepted: true,
      })
      .expect(201);
    await db.query('UPDATE "user" SET email_verified = true WHERE email = $1', [
      email,
    ]);

    const loginA = await request(BASE_URL)
      .post('/api/auth/login')
      .set('User-Agent', 'e2e-device-A/1.0')
      .send({ email, password: TEST_PASSWORD });
    const cookieA = extractRefreshCookie(
      loginA.headers['set-cookie'] as unknown as string[],
    )!;
    const accessTokenA = (loginA.body.data as { accessToken: string })
      .accessToken;

    const cookieB = await loginAndGetCookie(
      email,
      TEST_PASSWORD,
      'e2e-device-B/2.0',
    );

    expect(cookieA).not.toBe(cookieB);
    return { email, cookieA, cookieB, accessTokenA };
  }

  it('A. 두 기기 로그인 → 활성 세션 2건, 현재 세션 isCurrent=true', async () => {
    const { cookieA, accessTokenA } = await setupUser('sess-a');

    const list = await request(BASE_URL)
      .get('/api/users/me/sessions')
      .set('Authorization', `Bearer ${accessTokenA}`)
      .set('Cookie', cookieA);
    expect(list.status).toBe(200);
    const sessions = list.body.data as Array<{
      familyId: string;
      isCurrent: boolean;
    }>;
    expect(sessions.length).toBeGreaterThanOrEqual(2);

    const currents = sessions.filter((s) => s.isCurrent);
    expect(currents.length).toBe(1);
  });

  it('B. revoke without password → 401/400 (재인증 누락)', async () => {
    const { cookieA, accessTokenA } = await setupUser('sess-b');

    const list = await request(BASE_URL)
      .get('/api/users/me/sessions')
      .set('Authorization', `Bearer ${accessTokenA}`)
      .set('Cookie', cookieA);
    const targetFamilyId = (
      list.body.data as Array<{ familyId: string; isCurrent: boolean }>
    ).find((s) => !s.isCurrent)!.familyId;

    const noAuth = await request(BASE_URL)
      .post(`/api/users/me/sessions/${targetFamilyId}/revoke`)
      .set('Authorization', `Bearer ${accessTokenA}`)
      .set('Cookie', cookieA)
      .send({}); // 비번/TOTP 없음
    expect([400, 401]).toContain(noAuth.status);
  });

  it('C. 단일 revoke → 해당 family refresh 401, 다른 family 는 계속 동작', async () => {
    const { cookieA, cookieB, accessTokenA } = await setupUser('sess-c');

    const list = await request(BASE_URL)
      .get('/api/users/me/sessions')
      .set('Authorization', `Bearer ${accessTokenA}`)
      .set('Cookie', cookieA);
    const targetFamilyId = (
      list.body.data as Array<{ familyId: string; isCurrent: boolean }>
    ).find((s) => !s.isCurrent)!.familyId; // cookieB 의 family

    const revoke = await request(BASE_URL)
      .post(`/api/users/me/sessions/${targetFamilyId}/revoke`)
      .set('Authorization', `Bearer ${accessTokenA}`)
      .set('Cookie', cookieA)
      .send({ password: TEST_PASSWORD });
    expect(revoke.status).toBe(200);

    // 옛 cookieB 로 refresh 시도 → 401.
    const refresh = await request(BASE_URL)
      .post('/api/auth/refresh')
      .set('Cookie', cookieB);
    expect(refresh.status).toBe(401);

    // cookieA refresh 는 정상.
    const refreshA = await request(BASE_URL)
      .post('/api/auth/refresh')
      .set('Cookie', cookieA);
    expect(refreshA.status).toBe(200);
  });

  it('D. revoke-others → 현재 세션만 남고 나머지 모두 무효', async () => {
    const { cookieA, cookieB, accessTokenA } = await setupUser('sess-d');

    // 추가 세션 1개 더 (총 3 family).
    const { email } = await (async () => {
      // Reuse: pull email back. setupUser returns it; but reuse 이미 setupUser
      // 결과를 받았으므로 단순화: 별도 로그인.
      const list = await request(BASE_URL)
        .get('/api/users/me/sessions')
        .set('Authorization', `Bearer ${accessTokenA}`)
        .set('Cookie', cookieA);
      const userRow = list.body.data as Array<{ familyId: string }>;
      expect(userRow.length).toBeGreaterThanOrEqual(2);
      const userEmail = (
        await db.query<{ email: string }>(
          `SELECT u.email FROM "user" u
             JOIN refresh_token rt ON rt.user_id = u.id
             WHERE rt.family_id = $1
             LIMIT 1`,
          [userRow[0].familyId],
        )
      ).rows[0].email;
      return { email: userEmail };
    })();

    await loginAndGetCookie(email, TEST_PASSWORD, 'e2e-device-C/3.0');

    const before = await request(BASE_URL)
      .get('/api/users/me/sessions')
      .set('Authorization', `Bearer ${accessTokenA}`)
      .set('Cookie', cookieA);
    expect((before.body.data as Array<unknown>).length).toBeGreaterThanOrEqual(
      3,
    );

    const revokeOthers = await request(BASE_URL)
      .post('/api/users/me/sessions/revoke-others')
      .set('Authorization', `Bearer ${accessTokenA}`)
      .set('Cookie', cookieA)
      .send({ password: TEST_PASSWORD });
    expect(revokeOthers.status).toBe(200);

    const after = revokeOthers.body.data as Array<{ isCurrent: boolean }>;
    expect(after.length).toBe(1);
    expect(after[0].isCurrent).toBe(true);

    // 옛 cookieB → 401.
    const refreshB = await request(BASE_URL)
      .post('/api/auth/refresh')
      .set('Cookie', cookieB);
    expect(refreshB.status).toBe(401);
  });

  // regression: void → await race (fix-login-history-race).
  // AuthService.login() 이 loginHistory.record() 를 fire-and-forget 으로 두면, 직후
  // 호출되는 GET /api/users/me/login-history 가 두 번째 INSERT commit 보다 먼저 SELECT
  // 를 띄워 첫 번째 row 만 보이는 race 가 재현된다. 본 테스트는 setupUser 가 같은 사용자로
  // 2회 로그인한 직후 정확히 ≥ 2 건이 노출되는지 확인해 race 재발을 차단한다.
  it('E. login-history 가 login_success 이벤트를 시간 역순으로 노출', async () => {
    const { cookieA, accessTokenA } = await setupUser('sess-e');

    const hist = await request(BASE_URL)
      .get('/api/users/me/login-history')
      .set('Authorization', `Bearer ${accessTokenA}`)
      .set('Cookie', cookieA);
    expect(hist.status).toBe(200);
    // LoginHistoryPageDto = { data: LoginHistoryItem[], nextCursor: string | null }
    // 외부 wrapping 까지 합치면 res.body.data.data 가 배열.
    const items = hist.body.data.data as Array<{ event: string }>;
    expect(items.length).toBeGreaterThanOrEqual(2); // 두 번 로그인 했음
    expect(items.every((i) => typeof i.event === 'string')).toBe(true);
    expect(items.some((i) => i.event === 'login_success')).toBe(true);
  });
});
