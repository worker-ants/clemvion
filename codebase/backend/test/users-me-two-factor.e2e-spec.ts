import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { Client } from 'pg';
import request from 'supertest';

import { createDbClient, uniqueEmail } from './helpers/db';
import { registerAndLogin, TEST_PASSWORD } from './helpers/auth';
import { enableTotp, setupTotp } from './helpers/totp';
import {
  assertMatchesContract,
  contractForDto,
} from '../src/shared/testing/response-contract';
import { expectNoUserSecrets } from '../src/shared/testing/user-secret-absence';
import { UserProfileDto } from '../src/modules/users/dto/responses/user-response.dto';

/**
 * e2e: NERV CLE-ACCT-PROFILE REQ-PROFILE-027 (CLE-T-KTZ9YV).
 *
 * 보안 설정 화면은 `GET /api/users/me` 의 `twoFactorEnabled` 로 TOTP 설정 카드와 켜짐 카드(끄기 폼)를 고른다.
 * 이 값이 TOTP 켜기 · 끄기를 그대로 따르는지, 켜진 뒤에도 TOTP secret 과 복구 코드를 싣지 않는지를 실 DB 로 본다.
 */

const BASE_URL = process.env.E2E_BASE_URL ?? 'http://backend-e2e:3011';

function getMe(token: string) {
  return request(BASE_URL)
    .get('/api/users/me')
    .set('Authorization', `Bearer ${token}`);
}

describe('GET /api/users/me twoFactorEnabled (e2e)', () => {
  let db: Client;

  beforeAll(async () => {
    db = createDbClient();
    await db.connect();
  });

  afterAll(async () => {
    await db.end();
  });

  it('TOTP 켜기 · 끄기를 따르고 secret 은 싣지 않는다', async () => {
    const user = await registerAndLogin(BASE_URL, uniqueEmail('me-2fa'), db);

    const fresh = await getMe(user.accessToken);
    expect(fresh.status).toBe(200);
    expect(fresh.body.data.twoFactorEnabled).toBe(false);
    assertMatchesContract(
      fresh.body.data,
      await contractForDto(UserProfileDto),
    );

    // 설정만 시작하고 검증하지 않은 계정은 아직 꺼져 있다.
    const setup = await setupTotp(BASE_URL, user.accessToken, TEST_PASSWORD);
    expect(setup.status).toBe(200);
    expect((await getMe(user.accessToken)).body.data.twoFactorEnabled).toBe(
      false,
    );

    const { recoveryCodes } = await enableTotp(BASE_URL, user.accessToken);
    const enabled = await getMe(user.accessToken);
    expect(enabled.status).toBe(200);
    expect(enabled.body.data.twoFactorEnabled).toBe(true);
    expectNoUserSecrets(enabled.body);

    // 프로필 수정 응답도 같은 봉투라 켜짐 여부를 싣는다.
    const patched = await request(BASE_URL)
      .patch('/api/users/me')
      .set('Authorization', `Bearer ${user.accessToken}`)
      .send({ name: 'Two Factor' });
    expect(patched.status).toBe(200);
    expect(patched.body.data.twoFactorEnabled).toBe(true);
    expectNoUserSecrets(patched.body);

    const disable = await request(BASE_URL)
      .post('/api/auth/2fa/disable')
      .set('Authorization', `Bearer ${user.accessToken}`)
      .send({ password: TEST_PASSWORD, code: recoveryCodes[0] });
    expect(disable.status).toBe(200);
    expect((await getMe(user.accessToken)).body.data.twoFactorEnabled).toBe(
      false,
    );
  }, 60_000);
});
