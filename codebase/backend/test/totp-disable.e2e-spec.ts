import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { Client } from 'pg';
import request from 'supertest';
import { generateSync } from 'otplib';

import { createDbClient, uniqueEmail } from './helpers/db';
import { registerAndLogin, TEST_PASSWORD } from './helpers/auth';

/**
 * e2e: NERV CLE-ACCT-SIGNIN 「2단계 인증 해제」(CLE-T-75TDTN).
 *
 * 2FA 해제는 비밀번호와 코드(6자리 TOTP 또는 TOTP 복구 코드)를 모두 확인한다. 비밀번호만 아는
 * 사람이 2FA 를 끄지 못하는지, 끈 뒤 DB 의 2FA 상태가 실제로 지워지는지를 실 DB 로 본다.
 */

const BASE_URL = process.env.E2E_BASE_URL ?? 'http://backend-e2e:3011';

interface TwoFactorRow {
  two_factor_enabled: boolean;
  two_factor_secret: string | null;
  totp_recovery_codes: string[] | null;
}

describe('2FA 해제 (e2e)', () => {
  let db: Client;

  beforeAll(async () => {
    db = createDbClient();
    await db.connect();
  });

  afterAll(async () => {
    await db.end();
  });

  async function readTwoFactor(userId: string): Promise<TwoFactorRow> {
    const { rows } = await db.query<TwoFactorRow>(
      'SELECT two_factor_enabled, two_factor_secret, totp_recovery_codes FROM "user" WHERE id = $1',
      [userId],
    );
    return rows[0];
  }

  /** setup 응답의 otpauth URL 에서 secret 을 꺼내 활성화하고 secret 과 복구 코드를 돌려준다. */
  async function enableTotp(
    token: string,
  ): Promise<{ secret: string; recoveryCodes: string[] }> {
    const setup = await request(BASE_URL)
      .post('/api/auth/2fa/setup')
      .set('Authorization', `Bearer ${token}`);
    expect(setup.status).toBe(200);
    const otpauthUrl: string = setup.body.data.otpauthUrl;
    const secret = new URL(otpauthUrl).searchParams.get('secret');
    if (!secret)
      throw new Error(`otpauth URL 에 secret 이 없다: ${otpauthUrl}`);

    const verify = await request(BASE_URL)
      .post('/api/auth/2fa/verify')
      .set('Authorization', `Bearer ${token}`)
      .send({ code: generateSync({ secret }) });
    expect(verify.status).toBe(200);
    return { secret, recoveryCodes: verify.body.data.recoveryCodes };
  }

  function disable(token: string, body: Record<string, string>) {
    return request(BASE_URL)
      .post('/api/auth/2fa/disable')
      .set('Authorization', `Bearer ${token}`)
      .send(body);
  }

  /** 지금 유효한 코드와 앞뒤 시간 창 코드를 모두 피한 6자리 코드. */
  function wrongCode(secret: string): string {
    const valid = Number(generateSync({ secret }));
    return String((valid + 500_000) % 1_000_000).padStart(6, '0');
  }

  it('코드 없이 비밀번호만 보내면 400 이고 2FA 는 그대로다', async () => {
    const user = await registerAndLogin(
      BASE_URL,
      uniqueEmail('totp-nocode'),
      db,
    );
    await enableTotp(user.accessToken);

    const res = await disable(user.accessToken, { password: TEST_PASSWORD });
    expect(res.status).toBe(400);

    expect((await readTwoFactor(user.userId)).two_factor_enabled).toBe(true);
  }, 60_000);

  it('틀린 코드면 401 TOTP_INVALID 이고 2FA 는 그대로다', async () => {
    const user = await registerAndLogin(
      BASE_URL,
      uniqueEmail('totp-wrong'),
      db,
    );
    const { secret } = await enableTotp(user.accessToken);

    const res = await disable(user.accessToken, {
      password: TEST_PASSWORD,
      code: wrongCode(secret),
    });
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('TOTP_INVALID');

    const row = await readTwoFactor(user.userId);
    expect(row.two_factor_enabled).toBe(true);
    expect(row.two_factor_secret).not.toBeNull();
  }, 60_000);

  it('비밀번호가 틀리면 올바른 코드여도 401 이고 2FA 는 그대로다', async () => {
    const user = await registerAndLogin(
      BASE_URL,
      uniqueEmail('totp-badpw'),
      db,
    );
    const { secret } = await enableTotp(user.accessToken);

    const res = await disable(user.accessToken, {
      password: 'Wrong!Passw0rd',
      code: generateSync({ secret }),
    });
    expect(res.status).toBe(401);
    expect(res.body.error.code).not.toBe('TOTP_INVALID');

    expect((await readTwoFactor(user.userId)).two_factor_enabled).toBe(true);
  }, 60_000);

  it('비밀번호와 올바른 TOTP 코드면 200 이고 2FA 상태를 지운다', async () => {
    const user = await registerAndLogin(BASE_URL, uniqueEmail('totp-ok'), db);
    const { secret } = await enableTotp(user.accessToken);

    const res = await disable(user.accessToken, {
      password: TEST_PASSWORD,
      code: generateSync({ secret }),
    });
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ ok: true });

    expect(await readTwoFactor(user.userId)).toEqual({
      two_factor_enabled: false,
      two_factor_secret: null,
      totp_recovery_codes: null,
    });
  }, 60_000);

  it('비밀번호와 복구 코드로도 끌 수 있다', async () => {
    const user = await registerAndLogin(
      BASE_URL,
      uniqueEmail('totp-recovery'),
      db,
    );
    const { recoveryCodes } = await enableTotp(user.accessToken);

    const res = await disable(user.accessToken, {
      password: TEST_PASSWORD,
      code: recoveryCodes[0],
    });
    expect(res.status).toBe(200);

    expect((await readTwoFactor(user.userId)).two_factor_enabled).toBe(false);
  }, 60_000);
});
