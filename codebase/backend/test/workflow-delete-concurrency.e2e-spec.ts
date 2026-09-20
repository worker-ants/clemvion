import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { Client } from 'pg';
import request from 'supertest';

import { createDbClient, uniqueEmail, uniqueName } from './helpers/db';
import { registerAndLogin, createTeamWorkspace } from './helpers/auth';

/**
 * e2e: 동시 워크플로 DELETE — spec/2-navigation/1-workflow-list.md §2.6, 트리거 목록 §4.4 대칭.
 *
 * 보호 대상: 두 요청이 겹쳐도 **`workflow.deleted` 감사 행은 하나**이고, 진 쪽은 404 를 받는다.
 * `remove()` 는 잠금 없는 선조회로 시작하므로 둘 다 통과할 수 있고, 먼저 커밋한 쪽이 행을 지운 뒤
 * 두 번째가 «없는 것을 지운 척» 하면 감사가 두 번 남는다(`manager.remove` 는 0행이어도 던지지 않는다).
 *
 * **겹침을 우연에 맡기지 않는다** — 테스트가 그 워크플로 행의 락을 직접 쥔다(`SELECT … FOR UPDATE`,
 * 자기 커넥션). 두 요청 모두 선조회를 통과한 뒤 트랜잭션 안에서 멈추고, COMMIT 으로 함께 풀린다.
 * 같은 기법: `plan/complete/rotate-lost-update.md` · `plan/complete/trigger-config-lost-update.md` §C.
 *
 * 판별력: 고치기 전 코드는 **둘 다 204** 를 돌려주고 감사 행이 **2** 가 된다.
 */

const BASE_URL = process.env.E2E_BASE_URL ?? 'http://backend-e2e:3011';

describe('Workflow delete concurrency (e2e)', () => {
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
    const owner = await registerAndLogin(BASE_URL, uniqueEmail('wfdel'), db);
    token = owner.accessToken;
    workspaceId = await createTeamWorkspace(
      BASE_URL,
      token,
      uniqueName('WFDEL'),
    );
  }, 60_000);

  afterAll(async () => {
    await locker.end();
    await db.end();
  });

  it('두 DELETE 가 겹쳐도 감사 행은 하나이고 진 쪽은 404 다', async () => {
    const create = await request(BASE_URL)
      .post('/api/workflows')
      .set('Authorization', `Bearer ${token}`)
      .set('X-Workspace-Id', workspaceId)
      .send({ name: uniqueName('wf-concurrent-del') });
    expect(create.status).toBe(201);
    const id = (create.body.data as { id: string }).id;

    const fireDelete = () =>
      request(BASE_URL)
        .delete(`/api/workflows/${id}`)
        .set('Authorization', `Bearer ${token}`)
        .set('X-Workspace-Id', workspaceId)
        .then(
          (res) => res.status,
          () => -1,
        );

    let pending: Promise<number[]> | undefined;
    await locker.query('BEGIN');
    try {
      await locker.query('SELECT id FROM workflow WHERE id = $1 FOR UPDATE', [
        id,
      ]);

      // 둘 다 잠금 없는 선조회를 통과한 뒤 트랜잭션 안에서 이 락을 기다린다.
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
        WHERE resource_type = 'workflow' AND resource_id = $1 AND action = 'workflow.deleted'`,
      [id],
    );
    expect(audits.rows[0].count).toBe('1');
  }, 60_000);
});
