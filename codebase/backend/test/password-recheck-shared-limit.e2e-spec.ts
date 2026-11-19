import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { Client } from 'pg';
import request from 'supertest';

import { createDbClient, uniqueEmail } from './helpers/db';
import { registerAndLogin, TEST_PASSWORD } from './helpers/auth';
import { readTwoFactor, setupTotp } from './helpers/totp';

/**
 * e2e: 비밀번호 재확인 실패의 사용자 단위 한도(NERV Task `CLE-T-CJ7HB1`, [요청 빈도 제한](CLE-API-CONV-RATE)).
 *
 * 라우트별 한도(분당 10회)는 라우트마다 따로 센다. 틀린 비밀번호는 그와 별개로 사용자 하나에 묶어 센다. 서로 다른 재확인
 * 라우트에서 틀린 횟수를 합쳐 한도에 닿으면 맞는 비밀번호라도 대조하지 않고 429 `RATE_LIMITED` 로 답하는지 실제 Redis 로 본다.
 * 각 라우트에는 라우트별 한도보다 적게 보내서 라우트별 한도가 낸 429 와 섞이지 않게 한다.
 */

const BASE_URL = process.env.E2E_BASE_URL ?? 'http://backend-e2e:3011';
const WRONG_PASSWORD = 'Wrong!Passw0rd';
const FAILURE_LIMIT = 10;

function disableTotp(token: string, password: string) {
  return request(BASE_URL)
    .post('/api/auth/2fa/disable')
    .set('Authorization', `Bearer ${token}`)
    .send({ password, code: '000000' });
}

describe('비밀번호 재확인 실패의 사용자 단위 한도 (e2e)', () => {
  let db: Client;

  beforeAll(async () => {
    db = createDbClient();
    await db.connect();
  });

  afterAll(async () => {
    await db.end();
  });

  it('두 라우트에서 틀린 횟수를 합쳐 한도에 닿으면 맞는 비밀번호도 429 다', async () => {
    const user = await registerAndLogin(
      BASE_URL,
      uniqueEmail('pw-recheck-shared'),
      db,
    );
    const other = await registerAndLogin(
      BASE_URL,
      uniqueEmail('pw-recheck-other'),
      db,
    );

    for (let i = 0; i < FAILURE_LIMIT / 2; i += 1) {
      const setup = await setupTotp(BASE_URL, user.accessToken, WRONG_PASSWORD);
      expect(setup.status).toBe(401);
      expect(setup.body.error.code).toBe('PASSWORD_INVALID');

      const disable = await disableTotp(user.accessToken, WRONG_PASSWORD);
      expect(disable.status).toBe(401);
      expect(disable.body.error.code).toBe('PASSWORD_INVALID');
    }

    // setup 라우트에는 여섯 번째 요청이라 라우트별 한도(10회)에는 닿지 않는다. 막은 것은 사용자 단위 카운터다.
    const blocked = await setupTotp(BASE_URL, user.accessToken, TEST_PASSWORD);
    expect(blocked.status).toBe(429);
    expect(blocked.body.error.code).toBe('RATE_LIMITED');
    expect(blocked.body.error.message).toContain('비밀번호를 너무 많이');
    // 대조하지 않았으므로 secret 도 만들지 않았다.
    expect((await readTwoFactor(db, user.userId)).two_factor_secret).toBeNull();

    // 다른 사용자의 카운터와는 섞이지 않는다.
    const otherWrong = await setupTotp(
      BASE_URL,
      other.accessToken,
      WRONG_PASSWORD,
    );
    expect(otherWrong.status).toBe(401);
    expect(otherWrong.body.error.code).toBe('PASSWORD_INVALID');
  }, 120_000);
});
