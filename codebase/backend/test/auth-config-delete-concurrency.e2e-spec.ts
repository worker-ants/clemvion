import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { Client } from 'pg';
import request from 'supertest';

import { createDbClient, uniqueEmail, uniqueName } from './helpers/db';
import { registerAndLogin, createTeamWorkspace } from './helpers/auth';

/**
 * e2e: 동시 인증 설정 DELETE — 이 결함 클래스의 일곱 번째 짝
 * (`workflow-`/`workspace-`/`trigger-`/`schedule-`/`integration-delete-concurrency` ·
 * `member-remove-concurrency`).
 *
 * 보호 대상: 두 요청이 겹쳐도 **`auth_config.delete` 감사 행은 하나**이고, 진 쪽은 404 를 받는다.
 *
 * 처방은 통합 경로(#1372)와 같다 — 이 경로에도 잠글 것이 없어(advisory lock 도 행 락도 없다)
 * 락을 새로 들이지 않고 **단일 원자적 `DELETE` 의 `affected`** 를 판별자로 쓴다.
 *
 * 착수 전 실측으로 «형제와 같은 형태» 를 확인했다 — 직전 PR 에서 형제 패턴을 베꼈다가 틀렸다:
 * 이 라우트는 `@HttpCode(HttpStatus.NO_CONTENT)` 라 성공이 **204** 이고(`workspaces` 컨트롤러와
 * 달리 `{ok:true}` 를 쓰지 않는다), 404 코드는 `findById` 와 같은 `RESOURCE_NOT_FOUND` 여야 한다
 * — 진 쪽이 다른 코드를 받으면 «없어서 404» 와 «져서 404» 가 갈라져 버린다.
 *
 * 겹침은 테스트가 만든다 — `auth_config` 행 자체를 `SELECT … FOR UPDATE` 로 쥔다.
 *
 * 판별력: 고치기 전 코드는 **둘 다 204** 를 돌려주고 감사 행이 **2** 가 된다.
 */

const BASE_URL = process.env.E2E_BASE_URL ?? 'http://backend-e2e:3011';

describe('Auth config delete concurrency (e2e)', () => {
  let db: Client;
  /** 락을 쥐는 쪽 — 요청이 도는 동안 열려 있어야 하므로 별도 커넥션이다. */
  let locker: Client;
  let token: string;
  let workspaceId: string;

  beforeAll(async () => {
    db = createDbClient();
    await db.connect();
    locker = createDbClient();
    await locker.connect();
    const owner = await registerAndLogin(BASE_URL, uniqueEmail('acdel'), db);
    token = owner.accessToken;
    workspaceId = await createTeamWorkspace(
      BASE_URL,
      token,
      uniqueName('ACDEL'),
    );
  }, 60_000);

  afterAll(async () => {
    await locker.end();
    await db.end();
  });

  it('두 DELETE 가 겹쳐도 감사 행은 하나이고 진 쪽은 404 다', async () => {
    const create = await request(BASE_URL)
      .post('/api/auth-configs')
      .set('Authorization', `Bearer ${token}`)
      .set('X-Workspace-Id', workspaceId)
      .send({ name: uniqueName('acdel-target'), type: 'api_key', config: {} });
    expect(create.status).toBe(201);
    const id = (create.body.data as { id: string }).id;

    const fireDelete = () =>
      request(BASE_URL)
        .delete(`/api/auth-configs/${id}`)
        .set('Authorization', `Bearer ${token}`)
        .set('X-Workspace-Id', workspaceId)
        .then(
          (res) => ({ status: res.status, code: res.body?.error?.code }),
          () => ({ status: -1, code: undefined as string | undefined }),
        );

    let pending: Promise<{ status: number; code?: string }[]> | undefined;
    await locker.query('BEGIN');
    try {
      await locker.query('SELECT id FROM auth_config WHERE id = $1 FOR UPDATE', [
        id,
      ]);

      // 둘 다 무락 `findById` 를 통과한 뒤 DELETE 에서 이 락을 기다린다.
      pending = Promise.all([fireDelete(), fireDelete()]);

      // 공허성 가드 — 락을 놓기 **전에** 둘 다 아직 끝나지 않았음을 관측한다. 먼저 끝났다면 이
      // fixture 는 겹침을 만들지 못한 것이고, 아래 단언은 고치기 전 코드도 통과시킨다.
      const raced = await Promise.race([
        pending.then(() => 'settled' as const),
        new Promise<'pending'>((resolve) =>
          setTimeout(() => resolve('pending'), 1_500),
        ),
      ]);
      expect(raced).toBe('pending');

      await locker.query('COMMIT');
      const results = (await pending).sort((a, b) => a.status - b.status);

      // 하나는 지우고(204), 다른 하나는 이미 없다(404 RESOURCE_NOT_FOUND).
      expect(results.map((r) => r.status)).toEqual([204, 404]);
      expect(results[1].code).toBe('RESOURCE_NOT_FOUND');
    } finally {
      await locker.query('ROLLBACK').catch(() => undefined);
      await pending?.catch(() => undefined);
    }

    const audits = await db.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM audit_log
        WHERE resource_id = $1 AND action = 'auth_config.delete'`,
      [id],
    );
    expect(audits.rows[0].count).toBe('1');
  }, 60_000);
});
