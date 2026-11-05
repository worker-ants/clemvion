import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { Client } from 'pg';
import request from 'supertest';
import { generateSync } from 'otplib';

import { createDbClient, uniqueEmail } from './helpers/db';
import { registerAndLogin, TEST_PASSWORD } from './helpers/auth';
import {
  enableTotp,
  readTwoFactor,
  secretFromSetup,
  setupTotp,
  verifyTotp,
} from './helpers/totp';

/**
 * e2e: NERV CLE-ACCT-SIGNIN 「2단계 인증」 켜기 가드(CLE-T-94FTMV).
 *
 * 설정 시작(setup)은 계정 비밀번호를 다시 확인한다. 로그인 세션만 가진 사람이 자기 인증 앱으로 TOTP 를 켜지 못한다.
 * TOTP 가 켜진 계정에서는 setup 이 secret 을 덮어쓰지 못하고 활성화 검증(verify)이 복구 코드를 다시 발급하지 못한다.
 * 인증 수단을 바꾸려면 끄기(비밀번호 + 인증 코드) 뒤 다시 켜는 흐름만 남는지를 실 DB 로 본다.
 *
 * 본문 없이 온 setup 은 전역 검증 파이프가 500 이 아니라 400 `VALIDATION_ERROR` 로 거부한다(CLE-T-GDBMF8).
 */

const BASE_URL = process.env.E2E_BASE_URL ?? 'http://backend-e2e:3011';
const ALREADY_ENABLED = 'TOTP_ALREADY_ENABLED';
const WRONG_PASSWORD = 'Wrong!Passw0rd';

describe('2FA 켜기 가드 (e2e)', () => {
  let db: Client;

  beforeAll(async () => {
    db = createDbClient();
    await db.connect();
  });

  afterAll(async () => {
    await db.end();
  });

  it('setup 은 비밀번호가 틀리거나 없으면 거부하고 secret 을 만들지 않는다', async () => {
    const user = await registerAndLogin(
      BASE_URL,
      uniqueEmail('totp-setup-pw'),
      db,
    );

    const wrong = await setupTotp(BASE_URL, user.accessToken, WRONG_PASSWORD);
    expect(wrong.status).toBe(401);
    expect(wrong.body.error.code).toBe('PASSWORD_INVALID');

    const missing = await request(BASE_URL)
      .post('/api/auth/2fa/setup')
      .set('Authorization', `Bearer ${user.accessToken}`)
      .send({});
    expect(missing.status).toBe(400);
    expect(missing.body.error.code).toBe('VALIDATION_ERROR');

    // 본문도 Content-Type 도 없는 요청. Express 가 `req.body` 를 채우지 않아 예전에는 검증 파이프가 500 을 냈다.
    const noBody = await request(BASE_URL)
      .post('/api/auth/2fa/setup')
      .set('Authorization', `Bearer ${user.accessToken}`);
    expect(noBody.status).toBe(400);
    expect(noBody.body.error.code).toBe('VALIDATION_ERROR');
    expect(
      (noBody.body.error.details as { field: string }[]).map((d) => d.field),
    ).toContain('password');

    const row = await readTwoFactor(db, user.userId);
    expect(row.two_factor_enabled).toBe(false);
    expect(row.two_factor_secret).toBeNull();
  }, 60_000);

  it('비밀번호가 없는 계정(OAuth 전용)의 setup 은 401 PASSWORD_REQUIRED 이고 secret 을 만들지 않는다', async () => {
    const user = await registerAndLogin(
      BASE_URL,
      uniqueEmail('totp-setup-oauth'),
      db,
    );
    await db.query('UPDATE "user" SET password_hash = NULL WHERE id = $1', [
      user.userId,
    ]);

    const res = await setupTotp(BASE_URL, user.accessToken, TEST_PASSWORD);
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('PASSWORD_REQUIRED');

    expect((await readTwoFactor(db, user.userId)).two_factor_secret).toBeNull();
  }, 60_000);

  it('켜진 계정의 setup 은 409 이고 secret 과 복구 코드를 바꾸지 않는다', async () => {
    const user = await registerAndLogin(
      BASE_URL,
      uniqueEmail('totp-resetup'),
      db,
    );
    await enableTotp(BASE_URL, user.accessToken);
    const before = await readTwoFactor(db, user.userId);

    // 비밀번호를 먼저 확인한다. 틀리면 켜짐 여부와 상관없이 401 이다.
    const wrong = await setupTotp(BASE_URL, user.accessToken, WRONG_PASSWORD);
    expect(wrong.status).toBe(401);
    expect(wrong.body.error.code).toBe('PASSWORD_INVALID');

    const res = await setupTotp(BASE_URL, user.accessToken, TEST_PASSWORD);
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe(ALREADY_ENABLED);
    expect(res.body.data).toBeUndefined();

    expect(await readTwoFactor(db, user.userId)).toEqual(before);
  }, 60_000);

  it('켜진 계정의 verify 는 맞는 코드여도 409 이고 복구 코드를 다시 발급하지 않는다', async () => {
    const user = await registerAndLogin(
      BASE_URL,
      uniqueEmail('totp-reverify'),
      db,
    );
    const { secret } = await enableTotp(BASE_URL, user.accessToken);
    const before = await readTwoFactor(db, user.userId);

    const res = await verifyTotp(
      BASE_URL,
      user.accessToken,
      generateSync({ secret }),
    );
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe(ALREADY_ENABLED);
    expect(res.body.data).toBeUndefined();

    expect(await readTwoFactor(db, user.userId)).toEqual(before);
  }, 60_000);

  it('꺼진 계정은 setup · verify 로 켜고, 끈 뒤에는 새 secret 으로 다시 켤 수 있다', async () => {
    const user = await registerAndLogin(BASE_URL, uniqueEmail('totp-reon'), db);

    const first = await setupTotp(BASE_URL, user.accessToken, TEST_PASSWORD);
    expect(first.status).toBe(200);
    const firstSecret = secretFromSetup(first.body);
    // 켜기 전에는 setup 을 다시 불러 secret 을 바꿀 수 있다(QR 을 다시 받는 경우).
    const again = await setupTotp(BASE_URL, user.accessToken, TEST_PASSWORD);
    expect(again.status).toBe(200);
    const secret = secretFromSetup(again.body);
    expect(secret).not.toBe(firstSecret);

    const verify = await verifyTotp(
      BASE_URL,
      user.accessToken,
      generateSync({ secret }),
    );
    expect(verify.status).toBe(200);
    expect(verify.body.data.recoveryCodes).toHaveLength(10);
    expect((await readTwoFactor(db, user.userId)).two_factor_enabled).toBe(
      true,
    );

    const disable = await request(BASE_URL)
      .post('/api/auth/2fa/disable')
      .set('Authorization', `Bearer ${user.accessToken}`)
      .send({ password: TEST_PASSWORD, code: generateSync({ secret }) });
    expect(disable.status).toBe(200);

    const { secret: newSecret } = await enableTotp(BASE_URL, user.accessToken);
    expect(newSecret).not.toBe(secret);
    const row = await readTwoFactor(db, user.userId);
    expect(row.two_factor_enabled).toBe(true);
    expect(row.two_factor_secret).toBe(newSecret);
  }, 60_000);
});
