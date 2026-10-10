import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { Client } from 'pg';
import request from 'supertest';

import { createDbClient, uniqueEmail } from './helpers/db';
import { registerAndLogin } from './helpers/auth';

/**
 * e2e: NERV CLE-ACCT-PROFILE 「테마」 · CLE-ACCT-DATA 의 `user.theme` 정의.
 *
 * `UpdateMeDto` 는 light · dark · system 을 받지만 DB CHECK 가 light · dark 만 허용해서
 * system 저장이 500 으로 끝났다(CLE-T-E7MF3Q). DTO 단위 테스트는 DB 제약을 보지 못하므로
 * PATCH 뒤 GET 으로 저장 값을 실 DB 에서 확인한다.
 */

const BASE_URL = process.env.E2E_BASE_URL ?? 'http://backend-e2e:3011';

describe('User theme (e2e)', () => {
  let db: Client;
  let accessToken: string;

  beforeAll(async () => {
    db = createDbClient();
    await db.connect();
    const user = await registerAndLogin(BASE_URL, uniqueEmail('theme'), db);
    accessToken = user.accessToken;
  }, 60_000);

  afterAll(async () => {
    await db.end();
  });

  it.each(['system', 'dark', 'light'])(
    'PATCH theme=%s → GET 이 같은 값을 돌려준다',
    async (theme) => {
      const patch = await request(BASE_URL)
        .patch('/api/users/me')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ theme });
      expect(patch.status).toBe(200);

      const me = await request(BASE_URL)
        .get('/api/users/me')
        .set('Authorization', `Bearer ${accessToken}`);
      expect(me.status).toBe(200);
      expect(me.body.data.theme).toBe(theme);
    },
  );

  it('허용 목록 밖 값은 400 이고 저장 값은 그대로다', async () => {
    await request(BASE_URL)
      .patch('/api/users/me')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ theme: 'system' })
      .expect(200);

    const bad = await request(BASE_URL)
      .patch('/api/users/me')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ theme: 'sepia' });
    expect(bad.status).toBe(400);

    const me = await request(BASE_URL)
      .get('/api/users/me')
      .set('Authorization', `Bearer ${accessToken}`);
    expect(me.body.data.theme).toBe('system');
  });
});
