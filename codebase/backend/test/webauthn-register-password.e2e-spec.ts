import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { Client } from 'pg';
import request from 'supertest';

import { createDbClient, uniqueEmail } from './helpers/db';
import { registerAndLogin, TEST_PASSWORD } from './helpers/auth';
import { SoftWebAuthnDevice, registerDevice } from './helpers/webauthn';

/**
 * e2e: NERV CLE-ACCT-SIGNIN 「Passkey 등록·인증 흐름」 등록 옵션의 비밀번호 재확인(CLE-T-FRCRF7).
 *
 * 로그인 세션만으로는 Passkey 등록 옵션을 받지 못한다. 본문 검증 → 비밀번호 확인 순서로 거부하고, 실패하면 등록 옵션과
 * `optionsToken` 을 만들지 않는다. 맞는 비밀번호로 받은 옵션은 등록 검증까지 이어지는지 실 인프라에서 본다.
 * 활성 전제: docker-compose.e2e.yml backend-e2e 가 WebAuthn 을 켜 둔다(webauthn-2fa.e2e-spec.ts 와 같다).
 */

const BASE_URL = process.env.E2E_BASE_URL ?? 'http://backend-e2e:3011';
const WRONG_PASSWORD = 'Wrong!Passw0rd';

describe('Passkey 등록 옵션의 비밀번호 재확인 (e2e)', () => {
  let db: Client;

  beforeAll(async () => {
    db = createDbClient();
    await db.connect();
  });

  afterAll(async () => {
    await db.end();
  });

  function postOptions(token: string, body: object) {
    return request(BASE_URL)
      .post('/api/auth/2fa/webauthn/register/options')
      .set('Authorization', `Bearer ${token}`)
      .send(body);
  }

  async function credentialCount(userId: string): Promise<number> {
    const { rows } = await db.query<{ n: string }>(
      'SELECT count(*) AS n FROM webauthn_credential WHERE user_id = $1',
      [userId],
    );
    return Number(rows[0].n);
  }

  it.each([
    { name: '본문 없음', body: {} },
    { name: '7자 비밀번호', body: { password: 'Short1!' } },
  ])(
    '$name → 400 VALIDATION_ERROR 이고 옵션을 주지 않는다',
    async ({ body }) => {
      const user = await registerAndLogin(
        BASE_URL,
        uniqueEmail('passkey-opts-400'),
        db,
      );
      const res = await postOptions(user.accessToken, body);
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
      expect(res.body.data).toBeUndefined();
    },
    60_000,
  );

  it('틀린 비밀번호 → 401 PASSWORD_INVALID 이고 옵션과 optionsToken 을 주지 않는다', async () => {
    const user = await registerAndLogin(
      BASE_URL,
      uniqueEmail('passkey-opts-wrong'),
      db,
    );
    const res = await postOptions(user.accessToken, {
      password: WRONG_PASSWORD,
    });
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('PASSWORD_INVALID');
    expect(res.body.data).toBeUndefined();
    expect(JSON.stringify(res.body)).not.toContain('optionsToken');
    expect(await credentialCount(user.userId)).toBe(0);
  }, 60_000);

  it('비밀번호가 없는 계정(OAuth 전용) → 401 PASSWORD_REQUIRED 이고 옵션을 주지 않는다', async () => {
    const user = await registerAndLogin(
      BASE_URL,
      uniqueEmail('passkey-opts-oauth'),
      db,
    );
    await db.query('UPDATE "user" SET password_hash = NULL WHERE id = $1', [
      user.userId,
    ]);

    const res = await postOptions(user.accessToken, {
      password: TEST_PASSWORD,
    });
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('PASSWORD_REQUIRED');
    expect(res.body.data).toBeUndefined();
  }, 60_000);

  it('맞는 비밀번호 → 200 이고 받은 옵션으로 등록까지 마친다', async () => {
    const user = await registerAndLogin(
      BASE_URL,
      uniqueEmail('passkey-opts-ok'),
      db,
    );
    const res = await postOptions(user.accessToken, {
      password: TEST_PASSWORD,
    });
    expect(res.status).toBe(200);
    expect(typeof res.body.data.publicKey.challenge).toBe('string');
    expect(typeof res.body.data.optionsToken).toBe('string');

    // registerDevice 는 같은 비밀번호로 옵션을 받아 등록 검증까지 한다.
    const result = await registerDevice(
      BASE_URL,
      user.accessToken,
      new SoftWebAuthnDevice(),
    );
    expect(result.webauthnRecoveryCodes).toHaveLength(10);
    expect(await credentialCount(user.userId)).toBe(1);
  }, 60_000);
});
