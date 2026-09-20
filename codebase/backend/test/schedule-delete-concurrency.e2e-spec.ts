import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { Client } from 'pg';
import request from 'supertest';

import { createDbClient, uniqueEmail, uniqueName } from './helpers/db';
import { registerAndLogin, createTeamWorkspace } from './helpers/auth';
import { triggerConfigLockKey } from '../src/modules/triggers/trigger-config-lock';

/**
 * e2e: 동시 스케줄 DELETE — `trigger-/workflow-/workspace-delete-concurrency.e2e-spec.ts` 의 네 번째 짝.
 *
 * 보호 대상: 두 요청이 겹쳐도 **`schedule.deleted` 감사 행은 하나**이고, 진 쪽은 404 를 받는다.
 *
 * **판정 기준이 형제들과 다르다.** `schedule.trigger_id → trigger` 는 `onDelete: CASCADE` 라 **트리거를
 * 지우면 스케줄 행도 DB 가 함께 지운다**. 그래서 «스케줄 행을 몇 행 지웠나» 로 판정하면 이긴 쪽도 0행이라
 * 둘 다 404 가 된다 — 올바른 판별자는 **락 안에서 트리거를 실제로 지웠는가**(`m.delete(Trigger, …)` 의
 * `affected`)다. 이 테스트는 그 계약을 바깥에서 관측한다: 상태쌍과 감사 행 수.
 *
 * 겹침은 테스트가 만든다 — 스케줄 삭제도 **트리거 advisory key** 로 잠그므로 형제 PR 의 기법이 그대로 쓰인다.
 * 대기 상한(`TRIGGER_DELETE_LOCK_TIMEOUT_MS` 5초) 안에서 놓아야 «겹침» 이 «둘 다 타임아웃» 이 되지 않는다.
 *
 * 판별력: 고치기 전 코드는 **둘 다 204** 를 돌려주고 감사 행이 **2** 가 된다.
 */

const BASE_URL = process.env.E2E_BASE_URL ?? 'http://backend-e2e:3011';

describe('Schedule delete concurrency (e2e)', () => {
  let db: Client;
  /** 락을 쥐는 쪽 — 요청이 도는 동안 열려 있어야 하므로 별도 커넥션이다. */
  let locker: Client;
  let token: string;
  let workspaceId: string;
  let workflowId: string;

  beforeAll(async () => {
    db = createDbClient();
    await db.connect();
    locker = createDbClient();
    await locker.connect();
    const owner = await registerAndLogin(BASE_URL, uniqueEmail('scheddel'), db);
    token = owner.accessToken;
    workspaceId = await createTeamWorkspace(
      BASE_URL,
      token,
      uniqueName('SCHEDDEL'),
    );
    const wf = await request(BASE_URL)
      .post('/api/workflows')
      .set('Authorization', `Bearer ${token}`)
      .set('X-Workspace-Id', workspaceId)
      .send({ name: uniqueName('scheddel-wf') });
    expect(wf.status).toBe(201);
    workflowId = (wf.body.data as { id: string }).id;
  }, 60_000);

  afterAll(async () => {
    await locker.end();
    await db.end();
  });

  it('두 DELETE 가 겹쳐도 감사 행은 하나이고 진 쪽은 404 다', async () => {
    const create = await request(BASE_URL)
      .post('/api/schedules')
      .set('Authorization', `Bearer ${token}`)
      .set('X-Workspace-Id', workspaceId)
      .send({
        workflowId,
        name: uniqueName('scheddel-target'),
        // 이 창 동안 실제로 발화하지 않도록 드문 cron 을 쓴다(연 1회).
        cronExpression: '0 0 1 1 *',
        timezone: 'Asia/Seoul',
      });
    expect(create.status).toBe(201);
    const id = (create.body.data as { id: string }).id;

    // 스케줄 생성이 만든 트리거 — 삭제 경로가 그 id 로 advisory lock 을 잡는다.
    const triggerRow = await db.query<{ trigger_id: string }>(
      'SELECT trigger_id FROM schedule WHERE id = $1',
      [id],
    );
    const triggerId = triggerRow.rows[0].trigger_id;
    expect(triggerId).toBeTruthy();

    const fireDelete = () =>
      request(BASE_URL)
        .delete(`/api/schedules/${id}`)
        .set('Authorization', `Bearer ${token}`)
        .set('X-Workspace-Id', workspaceId)
        .then(
          (res) => res.status,
          () => -1,
        );

    let pending: Promise<number[]> | undefined;
    await locker.query('BEGIN');
    try {
      await locker.query('SELECT pg_advisory_xact_lock(hashtext($1))', [
        triggerConfigLockKey(triggerId),
      ]);

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

      // 하나는 지우고(204), 다른 하나는 이미 없다(404). 5초 상한에 걸렸다면 여기에 5xx 가 섞인다.
      expect(statuses).toEqual([204, 404]);
    } finally {
      await locker.query('ROLLBACK').catch(() => undefined);
      await pending?.catch(() => undefined);
    }

    const audits = await db.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM audit_log
        WHERE resource_type = 'schedule' AND resource_id = $1 AND action = 'schedule.deleted'`,
      [id],
    );
    expect(audits.rows[0].count).toBe('1');

    // CASCADE 가 실제로 스케줄 행을 지웠는지도 본다 — 이 사실이 «판정 기준» 선택의 근거다.
    const left = await db.query<{ count: string }>(
      'SELECT COUNT(*)::text AS count FROM schedule WHERE id = $1',
      [id],
    );
    expect(left.rows[0].count).toBe('0');
  }, 60_000);
});
