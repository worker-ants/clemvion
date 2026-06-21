import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { Client } from 'pg';
import { createHash } from 'crypto';
import request from 'supertest';

import { createDbClient, uniqueEmail } from './helpers/db';
import { registerAndLogin, TEST_PASSWORD } from './helpers/auth';

/**
 * e2e: spec/5-system/1-auth.md §1.1.B 이메일 변경 흐름.
 *
 * 검증 대상 (실 flow → DB):
 *   - request: 재인증(비밀번호) → pending_email + email_change_token(SHA-256) 저장
 *   - request 실패: 현재와 동일 이메일 400 / 재인증 실패 401 / 타 계정 사용 중 409
 *   - verify: 토큰 검증 → email 교체 + email_verified=true + pending 정리,
 *             전 세션 revoke(login_history session_revoked) + 재발급(accessToken/refresh 쿠키),
 *             audit_log user.email_changed
 *   - resend: 토큰·만료 시각 갱신 / pending 없으면 400
 *   - verify race: 확인 시점 신규 이메일 선점 → 409 + pending 정리
 *   - cancel: pending 정리 (멱등)
 */

const BASE_URL = process.env.E2E_BASE_URL ?? 'http://backend-e2e:3011';
const CLIENT_IP = '203.0.113.21';

function sha256(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/**
 * pending 이메일 변경 상태를 DB 에 직접 시드한다 (raw 토큰은 메일로만 전달되므로
 * e2e 는 해시를 주입). `expiresSql` 로 만료 시각을 제어 (만료 케이스는 과거 시각).
 */
async function seedPendingEmailChange(
  db: Client,
  userId: string,
  newEmail: string,
  rawToken: string,
  expiresSql = "NOW() + INTERVAL '1 hour'",
): Promise<void> {
  await db.query(
    `UPDATE "user"
       SET pending_email = $2, email_change_token = $3,
           email_change_expires_at = ${expiresSql}
     WHERE id = $1`,
    [userId, newEmail, sha256(rawToken)],
  );
}

describe('Email change — 재인증 + 신규 이메일 확인 (e2e)', () => {
  let db: Client;

  beforeAll(async () => {
    db = createDbClient();
    await db.connect();
  }, 60_000);

  afterAll(async () => {
    await db.end();
  });

  it('request → 200; pending_email + hashed token 저장', async () => {
    const user = await registerAndLogin(BASE_URL, uniqueEmail('emchg'), db);
    const newEmail = uniqueEmail('emchg-new');

    const res = await request(BASE_URL)
      .post('/api/users/me/email-change/request')
      .set('Authorization', `Bearer ${user.accessToken}`)
      .send({ newEmail, password: TEST_PASSWORD });

    expect(res.status).toBe(200);

    const row = await db.query(
      `SELECT pending_email, email_change_token, email_change_expires_at
       FROM "user" WHERE id = $1`,
      [user.userId],
    );
    expect(row.rows[0].pending_email).toBe(newEmail);
    // raw 토큰은 저장되지 않는다 — 64-hex SHA-256 해시만.
    expect(row.rows[0].email_change_token).toMatch(/^[a-f0-9]{64}$/);
    expect(row.rows[0].email_change_expires_at).not.toBeNull();
  }, 60_000);

  it('request rejects same email (400) and wrong password (401)', async () => {
    const user = await registerAndLogin(BASE_URL, uniqueEmail('emchg-rej'), db);
    const me = await db.query(`SELECT email FROM "user" WHERE id = $1`, [
      user.userId,
    ]);

    const sameRes = await request(BASE_URL)
      .post('/api/users/me/email-change/request')
      .set('Authorization', `Bearer ${user.accessToken}`)
      .send({ newEmail: me.rows[0].email, password: TEST_PASSWORD });
    expect(sameRes.status).toBe(400);

    const wrongPw = await request(BASE_URL)
      .post('/api/users/me/email-change/request')
      .set('Authorization', `Bearer ${user.accessToken}`)
      .send({ newEmail: uniqueEmail('emchg-rej2'), password: 'WrongPass!9' });
    expect(wrongPw.status).toBe(401);
    expect(wrongPw.body.error.code).toBe('PASSWORD_INVALID');
  }, 60_000);

  it('request rejects email already used by another account (409)', async () => {
    const taken = await registerAndLogin(
      BASE_URL,
      uniqueEmail('emchg-taken'),
      db,
    );
    const takenEmail = (
      await db.query(`SELECT email FROM "user" WHERE id = $1`, [taken.userId])
    ).rows[0].email;

    const user = await registerAndLogin(BASE_URL, uniqueEmail('emchg-dup'), db);
    const res = await request(BASE_URL)
      .post('/api/users/me/email-change/request')
      .set('Authorization', `Bearer ${user.accessToken}`)
      .send({ newEmail: takenEmail, password: TEST_PASSWORD });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('RESOURCE_CONFLICT');
  }, 60_000);

  it('verify → email swapped, sessions revoked, audited; new accessToken + refresh cookie', async () => {
    const user = await registerAndLogin(BASE_URL, uniqueEmail('emchg-v'), db);
    const newEmail = uniqueEmail('emchg-v-new');
    const rawToken = `e2e-token-${user.userId}`;

    await seedPendingEmailChange(db, user.userId, newEmail, rawToken);

    const res = await request(BASE_URL)
      .post('/api/users/me/email-change/verify')
      .set('Authorization', `Bearer ${user.accessToken}`)
      .set('X-Forwarded-For', CLIENT_IP)
      .send({ token: rawToken });

    expect(res.status).toBe(200);
    expect(typeof res.body.data.accessToken).toBe('string');
    expect(res.body.data.accessToken.length).toBeGreaterThan(0);
    const setCookie = res.headers['set-cookie'] as unknown as string[];
    expect(
      Array.isArray(setCookie) &&
        setCookie.some((c) => c.startsWith('refreshToken=')),
    ).toBe(true);

    // email 교체 + email_verified + pending 정리
    const row = await db.query(
      `SELECT email, email_verified, pending_email, email_change_token
       FROM "user" WHERE id = $1`,
      [user.userId],
    );
    expect(row.rows[0].email).toBe(newEmail);
    expect(row.rows[0].email_verified).toBe(true);
    expect(row.rows[0].pending_email).toBeNull();
    expect(row.rows[0].email_change_token).toBeNull();

    // audit_log user.email_changed + ip_address
    const audit = await db.query(
      `SELECT ip_address FROM audit_log
       WHERE user_id = $1 AND action = 'user.email_changed'`,
      [user.userId],
    );
    expect(audit.rows.length).toBe(1);
    expect(audit.rows[0].ip_address).toBe(CLIENT_IP);

    // login_history session_revoked(bulk, family_id NULL) — 전 세션 revoke
    const revoked = await db.query(
      `SELECT family_id FROM login_history
       WHERE user_id = $1 AND event = 'session_revoked'`,
      [user.userId],
    );
    expect(revoked.rows.some((r) => r.family_id === null)).toBe(true);
  }, 60_000);

  it('verify rejects invalid/expired token (400)', async () => {
    const user = await registerAndLogin(BASE_URL, uniqueEmail('emchg-bad'), db);
    await seedPendingEmailChange(
      db,
      user.userId,
      uniqueEmail('emchg-bad-new'),
      'expired-token',
      "NOW() - INTERVAL '1 minute'",
    );

    const res = await request(BASE_URL)
      .post('/api/users/me/email-change/verify')
      .set('Authorization', `Bearer ${user.accessToken}`)
      .send({ token: 'expired-token' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  }, 60_000);

  it('cancel clears the pending change (idempotent)', async () => {
    const user = await registerAndLogin(BASE_URL, uniqueEmail('emchg-c'), db);
    await seedPendingEmailChange(
      db,
      user.userId,
      uniqueEmail('emchg-c-new'),
      'cancel-token',
    );

    const res = await request(BASE_URL)
      .post('/api/users/me/email-change/cancel')
      .set('Authorization', `Bearer ${user.accessToken}`)
      .send({});
    expect(res.status).toBe(200);

    const row = await db.query(
      `SELECT pending_email, email_change_token FROM "user" WHERE id = $1`,
      [user.userId],
    );
    expect(row.rows[0].pending_email).toBeNull();
    expect(row.rows[0].email_change_token).toBeNull();

    // 멱등 — 다시 호출해도 200
    const again = await request(BASE_URL)
      .post('/api/users/me/email-change/cancel')
      .set('Authorization', `Bearer ${user.accessToken}`)
      .send({});
    expect(again.status).toBe(200);
  }, 60_000);

  it('resend → 200; 토큰·만료 시각 갱신', async () => {
    const user = await registerAndLogin(BASE_URL, uniqueEmail('emchg-rs'), db);
    const newEmail = uniqueEmail('emchg-rs-new');

    // request 로 pending 생성
    await request(BASE_URL)
      .post('/api/users/me/email-change/request')
      .set('Authorization', `Bearer ${user.accessToken}`)
      .send({ newEmail, password: TEST_PASSWORD })
      .expect(200);

    const before = await db.query(
      `SELECT email_change_token, email_change_expires_at
       FROM "user" WHERE id = $1`,
      [user.userId],
    );

    const res = await request(BASE_URL)
      .post('/api/users/me/email-change/resend')
      .set('Authorization', `Bearer ${user.accessToken}`)
      .send({});
    expect(res.status).toBe(200);

    const after = await db.query(
      `SELECT pending_email, email_change_token, email_change_expires_at
       FROM "user" WHERE id = $1`,
      [user.userId],
    );
    // pending 은 유지, 토큰은 재발급(변경)
    expect(after.rows[0].pending_email).toBe(newEmail);
    expect(after.rows[0].email_change_token).toMatch(/^[a-f0-9]{64}$/);
    expect(after.rows[0].email_change_token).not.toBe(
      before.rows[0].email_change_token,
    );
    // 만료 시각도 재발급 시점 기준으로 갱신됨 (resend 가 NOW()+1h 로 다시 설정)
    expect(
      new Date(after.rows[0].email_change_expires_at).getTime(),
    ).toBeGreaterThan(
      new Date(before.rows[0].email_change_expires_at).getTime(),
    );
  }, 60_000);

  it('resend without pending → 400 VALIDATION_ERROR', async () => {
    const user = await registerAndLogin(BASE_URL, uniqueEmail('emchg-rs0'), db);
    const res = await request(BASE_URL)
      .post('/api/users/me/email-change/resend')
      .set('Authorization', `Bearer ${user.accessToken}`)
      .send({});
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  }, 60_000);

  it('verify 시점 신규 이메일 선점 → 409 + pending 정리', async () => {
    // userA 가 newEmail 로 변경 대기 중인데, 그 사이 userB 가 newEmail 로 가입(선점).
    const newEmail = uniqueEmail('emchg-race-new');
    const userA = await registerAndLogin(
      BASE_URL,
      uniqueEmail('emchg-raceA'),
      db,
    );
    const rawToken = `race-token-${userA.userId}`;
    await seedPendingEmailChange(db, userA.userId, newEmail, rawToken);

    // userB 가 newEmail 선점
    await registerAndLogin(BASE_URL, newEmail, db);

    const res = await request(BASE_URL)
      .post('/api/users/me/email-change/verify')
      .set('Authorization', `Bearer ${userA.accessToken}`)
      .send({ token: rawToken });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('RESOURCE_CONFLICT');

    // userA 이메일 미변경 + pending 정리됨
    const row = await db.query(
      `SELECT email, pending_email, email_change_token FROM "user" WHERE id = $1`,
      [userA.userId],
    );
    expect(row.rows[0].email).not.toBe(newEmail);
    expect(row.rows[0].pending_email).toBeNull();
    expect(row.rows[0].email_change_token).toBeNull();
  }, 60_000);
});
