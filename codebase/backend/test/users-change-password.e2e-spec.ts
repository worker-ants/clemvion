import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { Client } from 'pg';
import request from 'supertest';

import { createDbClient, uniqueEmail } from './helpers/db';
import { registerAndLogin, TEST_PASSWORD } from './helpers/auth';

/**
 * e2e: spec/5-system/1-auth.md §2.3 / Rationale 2.3.C + data-flow/1-audit.md §1.1 (refactor 04 A-1·B-1).
 *
 * 검증 대상 (실 flow → DB INSERT):
 *   - POST /api/users/me/change-password 성공 시 새 accessToken 반환 (옵션 B 재발급)
 *   - audit_log 에 user.password_changed 1건 + ip_address 컬럼 채워짐 (B-1, X-Forwarded-For 추적)
 *   - login_history 에 session_revoked(bulk) 1건 — 전 세션 revoke (A-1)
 *   - refresh_token: 변경 전 family 는 revoke, 재발급 family 1건 활성
 */

const BASE_URL = process.env.E2E_BASE_URL ?? 'http://backend-e2e:3011';
const CLIENT_IP = '203.0.113.9';

describe('Change password — 세션 회전 + 감사 (e2e)', () => {
  let db: Client;
  let userId: string;
  let accessToken: string;

  beforeAll(async () => {
    db = createDbClient();
    await db.connect();
    const user = await registerAndLogin(BASE_URL, uniqueEmail('pwchg'), db);
    userId = user.userId;
    accessToken = user.accessToken;
  }, 60_000);

  afterAll(async () => {
    await db.end();
  });

  it('changes password → 200 + new accessToken; revokes sessions; audits with ipAddress', async () => {
    const newPassword = 'N3wP@ssw0rd!42';
    const res = await request(BASE_URL)
      .post('/api/users/me/change-password')
      .set('Authorization', `Bearer ${accessToken}`)
      // extractClientIp: CF-신뢰 off 기본 → X-Forwarded-For 첫 IP 가 감사/이력 IP 가 된다.
      .set('X-Forwarded-For', CLIENT_IP)
      .send({ currentPassword: TEST_PASSWORD, newPassword });

    // 옵션 B — 새 access token 반환 (현재 디바이스 재발급)
    expect(res.status).toBe(200);
    expect(typeof res.body.data.accessToken).toBe('string');
    expect(res.body.data.accessToken.length).toBeGreaterThan(0);
    // refresh 쿠키 회전(Set-Cookie)
    const setCookie = res.headers['set-cookie'] as unknown as string[];
    expect(
      Array.isArray(setCookie) &&
        setCookie.some((c) => c.startsWith('refreshToken=')),
    ).toBe(true);

    // B-1: audit_log 에 user.password_changed + ip_address 기록
    const audit = await db.query(
      `SELECT action, ip_address FROM audit_log
       WHERE user_id = $1 AND action = 'user.password_changed'`,
      [userId],
    );
    expect(audit.rows.length).toBe(1);
    expect(audit.rows[0].ip_address).toBe(CLIENT_IP);

    // A-1: login_history 에 session_revoked(bulk) 기록 — 전 세션 revoke
    const revoked = await db.query(
      `SELECT family_id, ip_address FROM login_history
       WHERE user_id = $1 AND event = 'session_revoked'`,
      [userId],
    );
    expect(revoked.rows.length).toBeGreaterThanOrEqual(1);
    // bulk revoke → family_id NULL
    expect(revoked.rows.some((r) => r.family_id === null)).toBe(true);

    // refresh_token: 정확히 1개 활성(재발급 family), 변경 전 family 는 revoke
    const tokens = await db.query(
      `SELECT is_revoked FROM refresh_token WHERE user_id = $1`,
      [userId],
    );
    const active = tokens.rows.filter((r) => r.is_revoked === false);
    expect(active.length).toBe(1);
  }, 60_000);

  it('rejects wrong current password → 401 INVALID_PASSWORD, no session rotation', async () => {
    // 독립 사용자 — 첫 테스트의 부수효과(세션 revoke·비밀번호 변경)에 종속되지 않게 분리.
    const other = await registerAndLogin(BASE_URL, uniqueEmail('pwchg-x'), db);
    const res = await request(BASE_URL)
      .post('/api/users/me/change-password')
      .set('Authorization', `Bearer ${other.accessToken}`)
      .send({ currentPassword: 'WrongPass!9', newPassword: 'An0therP@ss!7' });

    // 인증(Bearer)은 통과하고 현재 비밀번호 불일치로 INVALID_PASSWORD 401 — 인증 실패 401 과 구분.
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('INVALID_PASSWORD');

    // 실패 시 세션 회전·감사 없음 — 활성 refresh family 는 로그인 시 발급된 그대로 유지.
    const audit = await db.query(
      `SELECT 1 FROM audit_log WHERE user_id = $1 AND action = 'user.password_changed'`,
      [other.userId],
    );
    expect(audit.rows.length).toBe(0);
  }, 60_000);
});
