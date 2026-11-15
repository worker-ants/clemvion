import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import crypto from 'node:crypto';
import { Client } from 'pg';
import request from 'supertest';

import { createDbClient, uniqueEmail } from './helpers/db';
import { TEST_PASSWORD, extractRefreshCookie } from './helpers/auth';

/**
 * e2e: 소셜 로그인이 이메일로 기존 계정에 연결될 때 그 계정의 이메일 인증 여부에 따라
 * 비밀번호와 세션을 어떻게 다루는지 실제 DB 위에서 확인한다(CLE-T-327K37).
 *
 * - 미인증 계정: 연결과 같은 갱신에서 비밀번호 · 재설정 토큰 · 인증 토큰을 비우고, 연결 전에
 *   받은 refresh 패밀리를 모두 폐기한다. 남의 이메일로 먼저 가입만 해 둔 사람이 정해 둔
 *   비밀번호나 세션으로 연결 뒤의 계정에 들어오지 못해야 한다.
 * - 인증된 계정(대조군): 지금처럼 비밀번호와 세션을 그대로 둔다.
 *
 * 공급자 이메일은 stub 모드의 `stub-email:<이메일>` 인가 코드로 정한다.
 *
 * 미인증 계정은 보통 세션을 받지 못한다(가입은 토큰을 주지 않고 로그인은
 * `EMAIL_VERIFICATION_REQUIRED` 로 막힌다). 그래서 폐기를 관측하려고 인증 상태에서 로그인해
 * 세션을 받은 뒤 DB 에서 `email_verified` 를 false 로 되돌린다.
 */

const BASE_URL = process.env.E2E_BASE_URL ?? 'http://backend-e2e:3011';

async function seedState(db: Client, provider: string): Promise<string> {
  const state = crypto.randomBytes(24).toString('hex');
  await db.query(
    `INSERT INTO auth_oauth_state (state, provider, mode, remember_me, expires_at)
       VALUES ($1, $2, 'login', false, NOW() + interval '60 seconds')`,
    [state, provider],
  );
  return state;
}

async function socialCallback(db: Client, email: string) {
  const state = await seedState(db, 'google');
  return request(BASE_URL)
    .get('/api/auth/oauth/google/callback')
    .query({ code: `stub-email:${email}`, state })
    .redirects(0);
}

/** 가입 → 인증(DB) → 로그인. 로그인 응답의 refresh 쿠키와 사용자 id 를 돌려준다. */
async function registerVerifyLogin(
  db: Client,
  email: string,
): Promise<{ userId: string; refreshCookie: string }> {
  const reg = await request(BASE_URL).post('/api/auth/register').send({
    name: 'Squatter',
    email,
    password: TEST_PASSWORD,
    termsAccepted: true,
  });
  expect(reg.status).toBe(201);
  await db.query('UPDATE "user" SET email_verified = true WHERE email = $1', [
    email,
  ]);
  const login = await request(BASE_URL)
    .post('/api/auth/login')
    .send({ email, password: TEST_PASSWORD });
  expect(login.status).toBe(200);
  const refreshCookie = extractRefreshCookie(
    login.headers['set-cookie'] as unknown as string[],
  );
  expect(refreshCookie).not.toBeNull();
  const row = await db.query<{ id: string }>(
    'SELECT id FROM "user" WHERE email = $1',
    [email],
  );
  return { userId: row.rows[0].id, refreshCookie: refreshCookie! };
}

describe('소셜 로그인의 이메일 연결과 미인증 계정 (e2e, CLE-T-327K37)', () => {
  let db: Client;

  beforeAll(async () => {
    db = createDbClient();
    await db.connect();
  });

  afterAll(async () => {
    await db.end();
  });

  it('미인증 계정에 연결하면 비밀번호와 연결 전 세션이 더는 통하지 않는다', async () => {
    const email = uniqueEmail('oauth-link-unverified');
    const { userId, refreshCookie } = await registerVerifyLogin(db, email);
    // 미인증 상태로 되돌리고 재설정 · 인증 토큰을 심어 둔다(비워지는지 본다).
    await db.query(
      `UPDATE "user"
          SET email_verified = false,
              email_verify_token = 'e2e-verify-token',
              email_verify_expires_at = NOW() + interval '1 day',
              password_reset_token = 'e2e-reset-token',
              password_reset_expires_at = NOW() + interval '30 minutes'
        WHERE id = $1`,
      [userId],
    );

    const res = await socialCallback(db, email);
    expect(String(res.headers.location ?? '')).toContain('success=true');

    const after = await db.query<{
      password_hash: string | null;
      email_verified: boolean;
      oauth_provider: string | null;
      email_verify_token: string | null;
      email_verify_expires_at: Date | null;
      password_reset_token: string | null;
      password_reset_expires_at: Date | null;
    }>(
      `SELECT password_hash, email_verified, oauth_provider,
              email_verify_token, email_verify_expires_at,
              password_reset_token, password_reset_expires_at
         FROM "user" WHERE id = $1`,
      [userId],
    );
    expect(after.rows[0]).toEqual({
      password_hash: null,
      email_verified: true,
      oauth_provider: 'google',
      email_verify_token: null,
      email_verify_expires_at: null,
      password_reset_token: null,
      password_reset_expires_at: null,
    });

    // 연결 전에 받은 refresh 쿠키는 폐기됐다.
    const oldRefresh = await request(BASE_URL)
      .post('/api/auth/refresh')
      .set('Cookie', refreshCookie);
    expect(oldRefresh.status).toBe(401);

    // 선점자가 정해 둔 비밀번호로는 로그인할 수 없다.
    const login = await request(BASE_URL)
      .post('/api/auth/login')
      .send({ email, password: TEST_PASSWORD });
    expect(login.status).toBe(401);

    // 폐기는 로그인 이력에 일괄 `session_revoked` 로 남는다.
    const history = await db.query<{ n: string }>(
      `SELECT count(*)::text AS n FROM login_history
        WHERE user_id = $1 AND event = 'session_revoked' AND family_id IS NULL`,
      [userId],
    );
    expect(Number(history.rows[0].n)).toBe(1);

    // 콜백이 새로 발급한 세션은 살아 있다(폐기가 발급보다 먼저다).
    const newCookie = extractRefreshCookie(
      res.headers['set-cookie'] as unknown as string[],
    );
    expect(newCookie).not.toBeNull();
    const newRefresh = await request(BASE_URL)
      .post('/api/auth/refresh')
      .set('Cookie', newCookie!);
    expect(newRefresh.status).toBe(200);
  });

  it('인증된 계정에 연결하면 비밀번호와 세션을 그대로 둔다 (대조군)', async () => {
    const email = uniqueEmail('oauth-link-verified');
    const { userId, refreshCookie } = await registerVerifyLogin(db, email);

    const res = await socialCallback(db, email);
    expect(String(res.headers.location ?? '')).toContain('success=true');

    const after = await db.query<{
      has_password: boolean;
      oauth_provider: string | null;
    }>(
      `SELECT password_hash IS NOT NULL AS has_password, oauth_provider
         FROM "user" WHERE id = $1`,
      [userId],
    );
    expect(after.rows[0]).toEqual({
      has_password: true,
      oauth_provider: 'google',
    });

    const oldRefresh = await request(BASE_URL)
      .post('/api/auth/refresh')
      .set('Cookie', refreshCookie);
    expect(oldRefresh.status).toBe(200);

    const login = await request(BASE_URL)
      .post('/api/auth/login')
      .send({ email, password: TEST_PASSWORD });
    expect(login.status).toBe(200);
  });
});
