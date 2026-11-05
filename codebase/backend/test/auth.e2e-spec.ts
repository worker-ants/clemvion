import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import crypto from 'node:crypto';
import { Client } from 'pg';
import request from 'supertest';

import { createDbClient, uniqueEmail } from './helpers/db';
import { TEST_PASSWORD, extractRefreshCookie } from './helpers/auth';

/**
 * e2e: CLE-ACCT-SIGNIN · CLE-ACCT-SESSION 의 인증 라이프사이클을 실 인프라(Postgres + JWT
 * 발급) 위에서 검증한다. unit 테스트(auth.service.spec.ts, auth.controller.spec.ts)
 * 가 이미 단일 흐름·에러 분기를 보장하므로, 본 spec 은 multi-step (verify → login)
 * 및 트랜잭션 정합성(reset 시 refresh 무효화·refresh rotation reuse 감지) 만 다룬다.
 */

const BASE_URL = process.env.E2E_BASE_URL ?? 'http://backend-e2e:3011';

describe('Auth flow (e2e)', () => {
  let db: Client;

  beforeAll(async () => {
    db = createDbClient();
    await db.connect();
  }, 30_000);

  afterAll(async () => {
    await db.end();
  });

  it('A. register with valid input → 201, email 미인증 상태로 message 반환', async () => {
    const email = uniqueEmail('auth-a');
    const res = await request(BASE_URL).post('/api/auth/register').send({
      name: 'A User',
      email,
      password: TEST_PASSWORD,
      termsAccepted: true,
    });
    expect(res.status).toBe(201);
    expect(res.body.data.message).toBeDefined();
    expect(res.body.data.accessToken).toBeUndefined();

    const row = await db.query<{
      email_verified: boolean;
      email_verify_token: string | null;
    }>(
      'SELECT email_verified, email_verify_token FROM "user" WHERE email = $1',
      [email],
    );
    expect(row.rows[0].email_verified).toBe(false);
    expect(row.rows[0].email_verify_token).not.toBeNull();
  });

  it('B. register with duplicate email → 409 RESOURCE_CONFLICT', async () => {
    const email = uniqueEmail('auth-b');
    await request(BASE_URL)
      .post('/api/auth/register')
      .send({
        name: 'B1',
        email,
        password: TEST_PASSWORD,
        termsAccepted: true,
      })
      .expect(201);

    const dup = await request(BASE_URL).post('/api/auth/register').send({
      name: 'B2',
      email,
      password: TEST_PASSWORD,
      termsAccepted: true,
    });
    expect(dup.status).toBe(409);
    expect(dup.body.error.code).toBe('RESOURCE_CONFLICT');
  });

  it('C. login with wrong password → 401 LOGIN_FAILED', async () => {
    const email = uniqueEmail('auth-c');
    await request(BASE_URL)
      .post('/api/auth/register')
      .send({
        name: 'C User',
        email,
        password: TEST_PASSWORD,
        termsAccepted: true,
      })
      .expect(201);
    await db.query('UPDATE "user" SET email_verified = true WHERE email = $1', [
      email,
    ]);

    const res = await request(BASE_URL).post('/api/auth/login').send({
      email,
      password: 'WrongPass!9999',
    });
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('LOGIN_FAILED');
  });

  // NERV CLE-ACCT-SIGNIN 「로그인 처리」 3 · 7번(REQ-SIGNIN-065 · 066, CLE-T-AYT4VB).
  // 이메일 인증 여부는 비밀번호가 맞을 때만 알린다. 비밀번호가 틀리면 인증 전 계정도 LOGIN_FAILED 다.
  it('D. 이메일 인증 전 계정 — 비밀번호가 틀리면 LOGIN_FAILED, 맞으면 EMAIL_VERIFICATION_REQUIRED', async () => {
    const email = uniqueEmail('auth-d');
    await request(BASE_URL)
      .post('/api/auth/register')
      .send({
        name: 'D User',
        email,
        password: TEST_PASSWORD,
        termsAccepted: true,
      })
      .expect(201);
    // email_verified=false 유지.

    async function latest(): Promise<{
      failure_reason: string | null;
      login_attempts: number;
    }> {
      const res = await db.query<{
        failure_reason: string | null;
        login_attempts: number;
      }>(
        `SELECT h.failure_reason, u.login_attempts
           FROM login_history h JOIN "user" u ON u.email = h.email
          WHERE h.email = $1
          ORDER BY h.created_at DESC
          LIMIT 1`,
        [email],
      );
      return res.rows[0];
    }

    const wrong = await request(BASE_URL).post('/api/auth/login').send({
      email,
      password: 'WrongPass!9999',
    });
    expect(wrong.status).toBe(401);
    expect(wrong.body.error.code).toBe('LOGIN_FAILED');
    expect(wrong.body.error.message).toBe('Invalid email or password');
    expect(await latest()).toEqual({
      failure_reason: 'INVALID_PASSWORD',
      login_attempts: 1,
    });

    const right = await request(BASE_URL).post('/api/auth/login').send({
      email,
      password: TEST_PASSWORD,
    });
    expect(right.status).toBe(401);
    expect(right.body.error.code).toBe('EMAIL_VERIFICATION_REQUIRED');
    expect(right.body.error.message).toBe(
      'Please verify your email before logging in',
    );
    expect(right.body).not.toHaveProperty('accessToken');
    expect(
      extractRefreshCookie(
        right.headers['set-cookie'] as unknown as string[] | undefined,
      ),
    ).toBeNull();
    // 비밀번호가 맞았으므로 실패 횟수는 0 으로 돌아간다.
    expect(await latest()).toEqual({
      failure_reason: 'EMAIL_NOT_VERIFIED',
      login_attempts: 0,
    });
  });

  it('E. verify-email 토큰으로 인증 완료 → 개인 워크스페이스 자동 생성', async () => {
    const email = uniqueEmail('auth-e');
    await request(BASE_URL)
      .post('/api/auth/register')
      .send({
        name: 'E User',
        email,
        password: TEST_PASSWORD,
        termsAccepted: true,
      })
      .expect(201);

    // DB now stores SHA-256(rawToken); the API hashes the received token before
    // comparing. We inject a known rawToken into the DB (as its hash) so we can
    // send the raw value to the endpoint.
    const rawToken = crypto.randomUUID();
    const hashedToken = crypto
      .createHash('sha256')
      .update(rawToken)
      .digest('hex');

    const idRow = await db.query<{ id: string }>(
      'SELECT id FROM "user" WHERE email = $1',
      [email],
    );
    const userId = idRow.rows[0].id;
    await db.query('UPDATE "user" SET email_verify_token = $1 WHERE id = $2', [
      hashedToken,
      userId,
    ]);

    const verifyRes = await request(BASE_URL)
      .post('/api/auth/verify-email')
      .send({ token: rawToken }); // raw token → API hashes and matches stored hash
    expect(verifyRes.status).toBe(200);
    expect(verifyRes.body.data.accessToken).toBeDefined();

    // 개인 워크스페이스가 생성됐는지 — workspace 가 user 와 1:1 로 연결.
    const wsRow = await db.query(
      `SELECT w.type FROM workspace w
         JOIN workspace_member wm ON wm.workspace_id = w.id
         WHERE wm.user_id = $1 AND wm.role = 'owner'`,
      [userId],
    );
    expect(wsRow.rows.length).toBeGreaterThanOrEqual(1);
    expect(wsRow.rows[0].type).toBe('personal');

    // 토큰이 단발성으로 무효화됐는지.
    const after = await db.query<{ email_verify_token: string | null }>(
      'SELECT email_verify_token FROM "user" WHERE id = $1',
      [userId],
    );
    expect(after.rows[0].email_verify_token).toBeNull();
  });

  it('F. password reset 전체 흐름 → 새 비밀번호로 로그인 / refresh 일괄 무효화', async () => {
    const email = uniqueEmail('auth-f');
    await request(BASE_URL)
      .post('/api/auth/register')
      .send({
        name: 'F User',
        email,
        password: TEST_PASSWORD,
        termsAccepted: true,
      })
      .expect(201);
    await db.query('UPDATE "user" SET email_verified = true WHERE email = $1', [
      email,
    ]);

    // 1) login 으로 첫 refresh 발급.
    const firstLogin = await request(BASE_URL).post('/api/auth/login').send({
      email,
      password: TEST_PASSWORD,
    });
    expect(firstLogin.status).toBe(200);
    const refreshCookie = extractRefreshCookie(
      firstLogin.headers['set-cookie'] as unknown as string[],
    );
    expect(refreshCookie).not.toBeNull();

    // 2) forgot-password → DB 에 reset 토큰 hash 기록.
    await request(BASE_URL)
      .post('/api/auth/forgot-password')
      .send({ email })
      .expect(200);

    const resetRow = await db.query<{ password_reset_token: string }>(
      'SELECT password_reset_token FROM "user" WHERE email = $1',
      [email],
    );
    expect(resetRow.rows[0].password_reset_token).not.toBeNull();

    // 3) reset-password — DB 에는 sha256(raw) hash 만 저장. 원본 token 은 메일로만
    //    전달되므로 e2e 에서 회수 불가. 우회: 자체 raw token 발급 후 hash 를 DB 에
    //    직접 주입해 backend 가 정상 매칭하도록 만든다.
    const rawToken = crypto.randomUUID();
    const hashedToken = crypto
      .createHash('sha256')
      .update(rawToken)
      .digest('hex');
    await db.query(
      `UPDATE "user"
         SET password_reset_token = $1,
             password_reset_expires_at = NOW() + INTERVAL '30 minutes'
       WHERE email = $2`,
      [hashedToken, email],
    );

    const newPassword = 'NewPass!4567';
    const resetRes = await request(BASE_URL)
      .post('/api/auth/reset-password')
      .send({ token: rawToken, newPassword });
    expect(resetRes.status).toBe(200);

    // 4) 옛 비밀번호 → 실패.
    await request(BASE_URL)
      .post('/api/auth/login')
      .send({ email, password: TEST_PASSWORD })
      .expect(401);

    // 5) 새 비밀번호 → 성공.
    const newLogin = await request(BASE_URL)
      .post('/api/auth/login')
      .send({ email, password: newPassword });
    expect(newLogin.status).toBe(200);

    // 6) reset 으로 무효화된 옛 refresh cookie → 401.
    const oldRefresh = await request(BASE_URL)
      .post('/api/auth/refresh')
      .set('Cookie', refreshCookie!);
    expect(oldRefresh.status).toBe(401);
  });

  it('H. 이메일은 대소문자를 무시한다 — 소문자로 저장, 다른 대소문자로 check-email · 중복 가입 · 로그인 (CLE-T-SFWX84)', async () => {
    const lower = uniqueEmail('auth-h');
    const mixed = lower.replace('auth-h', 'Auth-H').toUpperCase();
    const res = await request(BASE_URL).post('/api/auth/register').send({
      name: 'H User',
      email: mixed,
      password: TEST_PASSWORD,
      termsAccepted: true,
    });
    expect(res.status).toBe(201);

    const stored = await db.query<{ email: string }>(
      'SELECT email FROM "user" WHERE LOWER(email) = $1',
      [lower],
    );
    expect(stored.rows.map((r) => r.email)).toEqual([lower]);

    const check = await request(BASE_URL)
      .post('/api/auth/check-email')
      .send({ email: lower.toUpperCase() });
    expect(check.status).toBe(200);
    expect(check.body.data.available).toBe(false);

    const dup = await request(BASE_URL).post('/api/auth/register').send({
      name: 'H Dup',
      email: lower.toUpperCase(),
      password: TEST_PASSWORD,
      termsAccepted: true,
    });
    expect(dup.status).toBe(409);
    expect(dup.body.error.code).toBe('RESOURCE_CONFLICT');

    await db.query('UPDATE "user" SET email_verified = true WHERE email = $1', [
      lower,
    ]);
    const login = await request(BASE_URL)
      .post('/api/auth/login')
      .send({ email: lower.toUpperCase(), password: TEST_PASSWORD });
    expect(login.status).toBe(200);
  });

  it('I. 대소문자만 다른 기존 계정 묶음 — 정확히 같은 계정만 쓰고 없으면 거부한다 (CLE-T-SFWX84)', async () => {
    // 정규화 전에 생긴 묶음을 흉내 낸다. 두 계정을 가입시킨 뒤 둘째의 이메일을 첫째와
    // 대소문자만 다르게 바꾼다(`email UNIQUE` 는 대소문자를 구분한다).
    const first = uniqueEmail('auth-i');
    const second = uniqueEmail('auth-i2');
    for (const email of [first, second]) {
      await request(BASE_URL)
        .post('/api/auth/register')
        .send({
          name: 'I User',
          email,
          password: TEST_PASSWORD,
          termsAccepted: true,
        })
        .expect(201);
    }
    const variant = first.replace('auth-i', 'Auth-I');
    await db.query(
      'UPDATE "user" SET email = $1, email_verified = true WHERE email = $2',
      [variant, second],
    );
    await db.query('UPDATE "user" SET email_verified = true WHERE email = $1', [
      first,
    ]);

    const exactFirst = await request(BASE_URL)
      .post('/api/auth/login')
      .send({ email: first, password: TEST_PASSWORD });
    expect(exactFirst.status).toBe(200);
    const exactSecond = await request(BASE_URL)
      .post('/api/auth/login')
      .send({ email: variant, password: TEST_PASSWORD });
    expect(exactSecond.status).toBe(200);

    const ambiguous = first.toUpperCase();
    const login = await request(BASE_URL)
      .post('/api/auth/login')
      .send({ email: ambiguous, password: TEST_PASSWORD });
    expect(login.status).toBe(401);
    expect(login.body.error.code).toBe('LOGIN_FAILED');

    const check = await request(BASE_URL)
      .post('/api/auth/check-email')
      .send({ email: ambiguous });
    expect(check.body.data.available).toBe(false);

    await request(BASE_URL)
      .post('/api/auth/forgot-password')
      .send({ email: ambiguous })
      .expect(200);
    const resetRows = await db.query<{ password_reset_token: string | null }>(
      'SELECT password_reset_token FROM "user" WHERE LOWER(email) = $1',
      [first],
    );
    expect(resetRows.rows).toHaveLength(2);
    expect(resetRows.rows.every((r) => r.password_reset_token === null)).toBe(
      true,
    );
  });

  it.each([
    [true, 30],
    [false, 7],
  ])(
    'J. rememberMe=%s 로그인 세션은 회전해도 로그인 유지 여부를 이어받고 회전 시점부터 %i일 유효하다 (CLE-T-BYCGF1)',
    async (rememberMe, days) => {
      const DAY_S = 24 * 60 * 60;
      const email = uniqueEmail(`auth-j-${days}`);
      await request(BASE_URL)
        .post('/api/auth/register')
        .send({
          name: 'J User',
          email,
          password: TEST_PASSWORD,
          termsAccepted: true,
        })
        .expect(201);
      await db.query(
        'UPDATE "user" SET email_verified = true WHERE email = $1',
        [email],
      );

      const login = await request(BASE_URL)
        .post('/api/auth/login')
        .send({ email, password: TEST_PASSWORD, rememberMe });
      expect(login.status).toBe(200);
      let cookie = extractRefreshCookie(
        login.headers['set-cookie'] as unknown as string[],
      );
      expect(cookie).not.toBeNull();

      // 마지막 갱신에서 8일이 지난 것처럼 만든다. 옛 구현은 첫 회전에서 7일로 줄여
      // rememberMe=true 세션도 여기서 만료됐다.
      const ageRows = async (): Promise<void> => {
        await db.query(
          `UPDATE refresh_token
              SET created_at = created_at - interval '8 days',
                  expires_at = expires_at - interval '8 days'
            WHERE user_id = (SELECT id FROM "user" WHERE email = $1)
              AND is_revoked = false`,
          [email],
        );
      };

      for (let round = 0; round < 2; round += 1) {
        if (rememberMe) await ageRows();
        const res = await request(BASE_URL)
          .post('/api/auth/refresh')
          .set('Cookie', cookie!);
        expect(res.status).toBe(200);
        const setCookie = (
          res.headers['set-cookie'] as unknown as string[]
        ).find((c) => c.startsWith('refreshToken='));
        expect(setCookie).toMatch(new RegExp(`Max-Age=${days * DAY_S}(;|$)`));
        cookie = extractRefreshCookie([setCookie!]);

        const live = await db.query<{ remember_me: boolean; ttl_s: number }>(
          `SELECT remember_me,
                  EXTRACT(EPOCH FROM (expires_at - now()))::int AS ttl_s
             FROM refresh_token
            WHERE user_id = (SELECT id FROM "user" WHERE email = $1)
              AND is_revoked = false`,
          [email],
        );
        expect(live.rows).toHaveLength(1);
        expect(live.rows[0].remember_me).toBe(rememberMe);
        expect(live.rows[0].ttl_s).toBeGreaterThan(days * DAY_S - 120);
        expect(live.rows[0].ttl_s).toBeLessThanOrEqual(days * DAY_S);
      }
    },
  );

  it('G. refresh rotation — 같은 refresh 두 번 사용 시 두 번째 호출은 401', async () => {
    const email = uniqueEmail('auth-g');
    await request(BASE_URL)
      .post('/api/auth/register')
      .send({
        name: 'G User',
        email,
        password: TEST_PASSWORD,
        termsAccepted: true,
      })
      .expect(201);
    await db.query('UPDATE "user" SET email_verified = true WHERE email = $1', [
      email,
    ]);

    const login = await request(BASE_URL)
      .post('/api/auth/login')
      .send({ email, password: TEST_PASSWORD });
    expect(login.status).toBe(200);
    const firstCookie = extractRefreshCookie(
      login.headers['set-cookie'] as unknown as string[],
    );
    expect(firstCookie).not.toBeNull();

    // 첫 refresh — 성공, 새 cookie 발급.
    const firstRefresh = await request(BASE_URL)
      .post('/api/auth/refresh')
      .set('Cookie', firstCookie!);
    expect(firstRefresh.status).toBe(200);
    const secondCookie = extractRefreshCookie(
      firstRefresh.headers['set-cookie'] as unknown as string[],
    );
    expect(secondCookie).not.toBe(firstCookie);

    // 옛 토큰 재사용 → 401. spec: "재사용이 감지되면 해당 토큰 패밀리 전체가 무효화".
    const reuse = await request(BASE_URL)
      .post('/api/auth/refresh')
      .set('Cookie', firstCookie!);
    expect(reuse.status).toBe(401);

    // 새 토큰도 같은 family 라 함께 무효 — 정책상 패밀리 통째 무효.
    const newAlso = await request(BASE_URL)
      .post('/api/auth/refresh')
      .set('Cookie', secondCookie!);
    expect(newAlso.status).toBe(401);
  });
});
