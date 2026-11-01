import { Client } from 'pg';
import request from 'supertest';
import { generateSync } from 'otplib';

import { TEST_PASSWORD } from './auth';

/**
 * 백엔드 TOTP(2단계 인증) e2e 공용 헬퍼. 설정 시작 → 활성화 검증을 실제 API 로 거치고 DB 의 2FA 상태를 읽는다.
 */

export interface TwoFactorRow {
  two_factor_enabled: boolean;
  two_factor_secret: string | null;
  totp_recovery_codes: string[] | null;
}

export async function readTwoFactor(
  db: Client,
  userId: string,
): Promise<TwoFactorRow> {
  const { rows } = await db.query<TwoFactorRow>(
    'SELECT two_factor_enabled, two_factor_secret, totp_recovery_codes FROM "user" WHERE id = $1',
    [userId],
  );
  return rows[0];
}

/** 설정 시작은 계정 비밀번호를 다시 받는다(CLE-T-94FTMV). */
export function setupTotp(baseUrl: string, token: string, password: string) {
  return request(baseUrl)
    .post('/api/auth/2fa/setup')
    .set('Authorization', `Bearer ${token}`)
    .send({ password });
}

export function verifyTotp(baseUrl: string, token: string, code: string) {
  return request(baseUrl)
    .post('/api/auth/2fa/verify')
    .set('Authorization', `Bearer ${token}`)
    .send({ code });
}

/** setup 응답의 otpauth URL 에서 secret 을 꺼낸다. */
export function secretFromSetup(setupBody: {
  data: { otpauthUrl: string };
}): string {
  const otpauthUrl = setupBody.data.otpauthUrl;
  const secret = new URL(otpauthUrl).searchParams.get('secret');
  if (!secret) throw new Error(`otpauth URL 에 secret 이 없다: ${otpauthUrl}`);
  return secret;
}

/** setup → verify 로 TOTP 를 켜고 secret 과 복구 코드(평문)를 돌려준다. 계정 비밀번호는 `registerAndLogin` 의 것이다. */
export async function enableTotp(
  baseUrl: string,
  token: string,
): Promise<{ secret: string; recoveryCodes: string[] }> {
  const setup = await setupTotp(baseUrl, token, TEST_PASSWORD);
  if (setup.status !== 200)
    throw new Error(`2fa/setup 이 ${setup.status} 를 돌려줬다`);
  const secret = secretFromSetup(setup.body);

  const verify = await verifyTotp(baseUrl, token, generateSync({ secret }));
  if (verify.status !== 200)
    throw new Error(`2fa/verify 가 ${verify.status} 를 돌려줬다`);
  return { secret, recoveryCodes: verify.body.data.recoveryCodes };
}
