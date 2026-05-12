import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { Client } from 'pg';
import request from 'supertest';

import { createDbClient, uniqueEmail } from './helpers/db';
import { TEST_PASSWORD, extractRefreshCookie } from './helpers/auth';

/**
 * e2e: spec/5-system/1-auth.md 의 인증 라이프사이클을 실 인프라(Postgres + JWT
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

  it('D. login with unverified email → 401 LOGIN_FAILED (이메일 enumeration 방지)', async () => {
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
    // email_verified=false 유지 — login 거부되어야 함.

    const res = await request(BASE_URL).post('/api/auth/login').send({
      email,
      password: TEST_PASSWORD,
    });
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('LOGIN_FAILED');
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

    const tokenRow = await db.query<{ id: string; email_verify_token: string }>(
      'SELECT id, email_verify_token FROM "user" WHERE email = $1',
      [email],
    );
    const verifyToken = tokenRow.rows[0].email_verify_token;
    expect(verifyToken).toBeDefined();

    const verifyRes = await request(BASE_URL)
      .post('/api/auth/verify-email')
      .send({ token: verifyToken });
    expect(verifyRes.status).toBe(200);
    expect(verifyRes.body.data.accessToken).toBeDefined();

    // 개인 워크스페이스가 생성됐는지 — workspace 가 user 와 1:1 로 연결.
    const wsRow = await db.query(
      `SELECT w.type FROM workspace w
         JOIN workspace_member wm ON wm.workspace_id = w.id
         WHERE wm.user_id = $1 AND wm.role = 'owner'`,
      [tokenRow.rows[0].id],
    );
    expect(wsRow.rows.length).toBeGreaterThanOrEqual(1);
    expect(wsRow.rows[0].type).toBe('personal');

    // 토큰이 단발성으로 무효화됐는지.
    const after = await db.query<{ email_verify_token: string | null }>(
      'SELECT email_verify_token FROM "user" WHERE id = $1',
      [tokenRow.rows[0].id],
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

    // 2) forgot-password → DB 에 reset 토큰 기록.
    await request(BASE_URL)
      .post('/api/auth/forgot-password')
      .send({ email })
      .expect(200);

    const resetRow = await db.query<{ password_reset_token: string }>(
      'SELECT password_reset_token FROM "user" WHERE email = $1',
      [email],
    );
    expect(resetRow.rows[0].password_reset_token).not.toBeNull();

    // 3) reset-password 로 비밀번호 교체.
    const newPassword = 'NewPass!4567';
    const resetRes = await request(BASE_URL)
      .post('/api/auth/reset-password')
      .send({
        token: resetRow.rows[0].password_reset_token,
        newPassword,
      });
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
