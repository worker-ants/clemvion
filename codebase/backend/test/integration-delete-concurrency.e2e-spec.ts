import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { Client } from 'pg';
import request from 'supertest';

import { createDbClient, uniqueEmail, uniqueName } from './helpers/db';
import { registerAndLogin, createTeamWorkspace } from './helpers/auth';

/**
 * e2e: 동시 통합 DELETE — 이 결함 클래스의 다섯 번째 짝
 * (`workflow-`/`workspace-`/`trigger-`/`schedule-delete-concurrency.e2e-spec.ts`).
 *
 * 보호 대상: 두 요청이 겹쳐도 **`integration.deleted` 감사 행은 하나**이고, 진 쪽은 404 를 받는다.
 *
 * **이 경로엔 락이 없다.** 형제들은 행 락(`pessimistic_write`)이나 advisory lock 을 잡지만
 * `IntegrationsService.remove()` 는 무락 `findOne` → 사용처 검사 → `remove(entity)` 뿐이다. 그래서 처방도
 * 락이 아니라 **단일 원자적 `DELETE` 의 `affected`** 이고, 이 테스트는 그 계약을 바깥에서 관측한다.
 *
 * 겹침은 테스트가 만든다 — advisory key 가 없으므로 **통합 행 자체를 `SELECT … FOR UPDATE` 로** 쥔다.
 * 두 요청 모두 무락 조회와 사용처 검사를 통과한 뒤 `DELETE` 에서 멈추고, COMMIT 으로 함께 풀린다.
 *
 * 판별력: 고치기 전 코드는 **둘 다 204** 를 돌려주고 감사 행이 **2** 가 된다.
 */

const BASE_URL = process.env.E2E_BASE_URL ?? 'http://backend-e2e:3011';

describe('Integration delete concurrency (e2e)', () => {
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
    const owner = await registerAndLogin(BASE_URL, uniqueEmail('intdel'), db);
    token = owner.accessToken;
    workspaceId = await createTeamWorkspace(
      BASE_URL,
      token,
      uniqueName('INTDEL'),
    );
  }, 60_000);

  afterAll(async () => {
    await locker.end();
    await db.end();
  });

  it('두 DELETE 가 겹쳐도 감사 행은 하나이고 진 쪽은 404 다', async () => {
    // 어떤 노드도 참조하지 않는 통합 — 사용처 검사(`INTEGRATION_IN_USE`)를 통과해야 삭제까지 간다.
    const create = await request(BASE_URL)
      .post('/api/integrations')
      .set('Authorization', `Bearer ${token}`)
      .set('X-Workspace-Id', workspaceId)
      .send({
        serviceType: 'http',
        name: uniqueName('intdel-target'),
        authType: 'bearer_token',
        credentials: { token: 'e2e-intdel-token' },
        scope: 'personal',
      });
    expect(create.status).toBe(201);
    const id = (create.body.data as { id: string }).id;

    const fireDelete = () =>
      request(BASE_URL)
        .delete(`/api/integrations/${id}`)
        .set('Authorization', `Bearer ${token}`)
        .set('X-Workspace-Id', workspaceId)
        .then(
          (res) => res.status,
          () => -1,
        );

    let pending: Promise<number[]> | undefined;
    await locker.query('BEGIN');
    try {
      await locker.query(
        'SELECT id FROM integration WHERE id = $1 FOR UPDATE',
        [id],
      );

      // 둘 다 무락 조회·사용처 검사를 통과한 뒤 DELETE 에서 이 락을 기다린다.
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
      const statuses = (await pending).sort((a, b) => a - b);

      // 하나는 지우고(204), 다른 하나는 이미 없다(404).
      expect(statuses).toEqual([204, 404]);
    } finally {
      await locker.query('ROLLBACK').catch(() => undefined);
      await pending?.catch(() => undefined);
    }

    const audits = await db.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM audit_log
        WHERE resource_type = 'integration' AND resource_id = $1
          AND action = 'integration.deleted'`,
      [id],
    );
    expect(audits.rows[0].count).toBe('1');
  }, 60_000);
});
