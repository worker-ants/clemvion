import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { Client } from 'pg';
import { generateSync } from 'otplib';

import { createDbClient, uniqueEmail } from './helpers/db';
import { registerAndLogin, TEST_PASSWORD } from './helpers/auth';
import {
  readTwoFactor,
  secretFromSetup,
  setupTotp,
  verifyTotp,
} from './helpers/totp';

/**
 * e2e: NERV CLE-ACCT-SIGNIN 「TOTP 켜기」 대기 secret 의 10분 만료(REQ-SIGNIN-084, CLE-T-FRCRF7).
 *
 * 설정 시작이 secret 과 설정 시작 시각을 함께 쓰는지, 활성화 검증이 시각이 없거나 10분이 지난 대기 secret 을 코드 확인 없이
 * 비우고 400 `TOTP_NOT_INITIALIZED` 로 거부하는지를 실 DB 로 본다. 10분을 기다리지 않고 DB 의 시각을 앞당긴다.
 */

const BASE_URL = process.env.E2E_BASE_URL ?? 'http://backend-e2e:3011';
const NOT_INITIALIZED = 'TOTP_NOT_INITIALIZED';

describe('TOTP 대기 secret 만료 (e2e)', () => {
  let db: Client;

  beforeAll(async () => {
    db = createDbClient();
    await db.connect();
  });

  afterAll(async () => {
    await db.end();
  });

  async function startSetup(token: string): Promise<string> {
    const res = await setupTotp(BASE_URL, token, TEST_PASSWORD);
    expect(res.status).toBe(200);
    return secretFromSetup(res.body);
  }

  /** 설정 시작 시각을 `minutes` 분 앞으로 옮긴다. null 이면 시각을 지운다(규칙 전에 시작한 대기 secret). */
  async function backdateSetup(
    userId: string,
    minutes: number | null,
  ): Promise<void> {
    if (minutes === null) {
      await db.query(
        'UPDATE "user" SET two_factor_setup_started_at = NULL WHERE id = $1',
        [userId],
      );
      return;
    }
    await db.query(
      `UPDATE "user" SET two_factor_setup_started_at = now() - make_interval(mins => $2)
        WHERE id = $1`,
      [userId, minutes],
    );
  }

  it('설정 시작은 secret 과 시작 시각을 함께 쓰고 활성화 검증이 성공하면 시각을 비운다', async () => {
    const user = await registerAndLogin(
      BASE_URL,
      uniqueEmail('totp-exp-fresh'),
      db,
    );
    expect(
      (await readTwoFactor(db, user.userId)).two_factor_setup_started_at,
    ).toBeNull();

    const secret = await startSetup(user.accessToken);
    const pending = await readTwoFactor(db, user.userId);
    expect(pending.two_factor_secret).toBe(secret);
    expect(pending.two_factor_enabled).toBe(false);
    expect(pending.two_factor_setup_started_at).toBeInstanceOf(Date);

    const verify = await verifyTotp(
      BASE_URL,
      user.accessToken,
      generateSync({ secret }),
    );
    expect(verify.status).toBe(200);
    const enabled = await readTwoFactor(db, user.userId);
    expect(enabled.two_factor_enabled).toBe(true);
    expect(enabled.two_factor_secret).toBe(secret);
    expect(enabled.two_factor_setup_started_at).toBeNull();
  }, 60_000);

  it('설정 시작 뒤 9분이면 아직 켤 수 있다', async () => {
    const user = await registerAndLogin(
      BASE_URL,
      uniqueEmail('totp-exp-9m'),
      db,
    );
    const secret = await startSetup(user.accessToken);
    await backdateSetup(user.userId, 9);

    const verify = await verifyTotp(
      BASE_URL,
      user.accessToken,
      generateSync({ secret }),
    );
    expect(verify.status).toBe(200);
    expect((await readTwoFactor(db, user.userId)).two_factor_enabled).toBe(
      true,
    );
  }, 60_000);

  it.each([
    { name: '설정 시작 뒤 11분이 지난 대기 secret', minutes: 11 },
    { name: '설정 시작 시각이 없는 대기 secret', minutes: null },
  ])(
    '$name 은 맞는 코드여도 400 이고 secret 과 시각을 비운다. 설정을 다시 시작하면 켤 수 있다',
    async ({ minutes }) => {
      const user = await registerAndLogin(
        BASE_URL,
        uniqueEmail('totp-exp-stale'),
        db,
      );
      const secret = await startSetup(user.accessToken);
      await backdateSetup(user.userId, minutes);

      const expired = await verifyTotp(
        BASE_URL,
        user.accessToken,
        generateSync({ secret }),
      );
      expect(expired.status).toBe(400);
      expect(expired.body.error.code).toBe(NOT_INITIALIZED);
      expect(expired.body.data).toBeUndefined();
      expect(await readTwoFactor(db, user.userId)).toEqual({
        two_factor_enabled: false,
        two_factor_secret: null,
        two_factor_setup_started_at: null,
        totp_recovery_codes: null,
      });

      // 버린 secret 으로는 다시 시도해도 같은 400 이다.
      const again = await verifyTotp(
        BASE_URL,
        user.accessToken,
        generateSync({ secret }),
      );
      expect(again.status).toBe(400);
      expect(again.body.error.code).toBe(NOT_INITIALIZED);

      const newSecret = await startSetup(user.accessToken);
      const verify = await verifyTotp(
        BASE_URL,
        user.accessToken,
        generateSync({ secret: newSecret }),
      );
      expect(verify.status).toBe(200);
      expect((await readTwoFactor(db, user.userId)).two_factor_enabled).toBe(
        true,
      );
    },
    60_000,
  );
});
