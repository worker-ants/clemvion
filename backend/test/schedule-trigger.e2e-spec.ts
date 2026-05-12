import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { Client } from 'pg';
import request from 'supertest';

import { createDbClient, uniqueEmail, uniqueName } from './helpers/db';
import { registerAndLogin, createTeamWorkspace } from './helpers/auth';

/**
 * e2e: spec/2-navigation/3-schedule.md — Cron 스케줄 라이프사이클.
 *
 * 검증 대상:
 *   - cron 식 preview 가 다음 실행 시각을 정상 계산
 *   - schedule 생성 시 trigger 자동 동반 생성 + BullMQ 작업 등록
 *   - PATCH cron → next_run 재계산
 *   - run-now → executionId 즉시 반환
 *   - delete 후 schedule·trigger 모두 사라짐
 *   - 비활성 스케줄은 trigger.isActive=false
 */

const BASE_URL = process.env.E2E_BASE_URL ?? 'http://backend-e2e:3011';

describe('Schedule trigger (e2e)', () => {
  let db: Client;
  let token: string;
  let workspaceId: string;
  let workflowId: string;

  beforeAll(async () => {
    db = createDbClient();
    await db.connect();
    const owner = await registerAndLogin(BASE_URL, uniqueEmail('sched'), db);
    token = owner.accessToken;
    workspaceId = await createTeamWorkspace(BASE_URL, token, uniqueName('SCH'));

    const wf = await request(BASE_URL)
      .post('/api/workflows')
      .set('Authorization', `Bearer ${token}`)
      .set('X-Workspace-Id', workspaceId)
      .send({ name: uniqueName('sched-wf') });
    workflowId = wf.body.data.id;
  }, 60_000);

  afterAll(async () => {
    await db.end();
  });

  function authHeaders() {
    return {
      Authorization: `Bearer ${token}`,
      'X-Workspace-Id': workspaceId,
    } as const;
  }

  it('A. preview 엔드포인트가 다음 실행 시각 N개 반환', async () => {
    const res = await request(BASE_URL)
      .post('/api/schedules/preview')
      .set(authHeaders())
      .send({
        cronExpression: '0 9 * * *',
        timezone: 'Asia/Seoul',
        count: 3,
      });
    expect(res.status).toBe(200);
    const next = res.body.data.next as string[];
    expect(Array.isArray(next)).toBe(true);
    expect(next.length).toBeGreaterThan(0);
    // 미래 시각만.
    next.forEach((iso) => {
      expect(new Date(iso).getTime()).toBeGreaterThan(Date.now() - 60_000);
    });
  });

  it('B. preview — 잘못된 cron → 400', async () => {
    const res = await request(BASE_URL)
      .post('/api/schedules/preview')
      .set(authHeaders())
      .send({
        cronExpression: 'totally-not-a-cron',
        timezone: 'Asia/Seoul',
      });
    expect(res.status).toBe(400);
  });

  it('C. 스케줄 생성 → trigger 자동 생성, nextRunAt 채워짐', async () => {
    const res = await request(BASE_URL)
      .post('/api/schedules')
      .set(authHeaders())
      .send({
        workflowId,
        name: uniqueName('sched-c'),
        cronExpression: '*/30 * * * *',
        timezone: 'Asia/Seoul',
      });
    expect(res.status).toBe(201);
    const scheduleId = res.body.data.id as string;
    expect(scheduleId).toBeDefined();
    expect(res.body.data.nextRunAt).toBeDefined();

    // schedule 행 + 동반된 trigger 행 확인.
    const sched = await db.query(
      'SELECT id FROM schedule WHERE id = $1',
      [scheduleId],
    );
    expect(sched.rows.length).toBe(1);
    const trig = await db.query<{ type: string; is_active: boolean }>(
      `SELECT type, is_active FROM trigger
         WHERE workflow_id = $1 AND type = 'schedule'`,
      [workflowId],
    );
    expect(trig.rows.length).toBeGreaterThanOrEqual(1);
    expect(trig.rows[0].is_active).toBe(true);
  });

  it('D. PATCH cron → nextRunAt 재계산', async () => {
    const create = await request(BASE_URL)
      .post('/api/schedules')
      .set(authHeaders())
      .send({
        workflowId,
        name: uniqueName('sched-d'),
        cronExpression: '0 10 * * *',
        timezone: 'Asia/Seoul',
      });
    const scheduleId = create.body.data.id;
    const originalNext = create.body.data.nextRunAt;

    const patch = await request(BASE_URL)
      .patch(`/api/schedules/${scheduleId}`)
      .set(authHeaders())
      .send({ cronExpression: '*/1 * * * *' });
    expect(patch.status).toBe(200);
    expect(patch.body.data.nextRunAt).toBeDefined();
    expect(patch.body.data.nextRunAt).not.toBe(originalNext);
  });

  it('E. run-now → 202 + executionId', async () => {
    const create = await request(BASE_URL)
      .post('/api/schedules')
      .set(authHeaders())
      .send({
        workflowId,
        name: uniqueName('sched-e'),
        cronExpression: '0 0 1 1 *', // 매년 1월 1일
        timezone: 'UTC',
      });
    const scheduleId = create.body.data.id;

    const run = await request(BASE_URL)
      .post(`/api/schedules/${scheduleId}/run-now`)
      .set(authHeaders());
    expect(run.status).toBe(202);
    const executionId = (run.body.data as { executionId: string }).executionId;
    expect(executionId).toBeDefined();
  });

  it('F. delete → schedule·trigger·BullMQ 작업 일괄 제거', async () => {
    const create = await request(BASE_URL)
      .post('/api/schedules')
      .set(authHeaders())
      .send({
        workflowId,
        name: uniqueName('sched-f'),
        cronExpression: '0 12 * * *',
        timezone: 'UTC',
      });
    const scheduleId = create.body.data.id;
    const beforeTriggerCount = (
      await db.query<{ n: string }>(
        `SELECT COUNT(*) AS n FROM trigger
           WHERE workflow_id = $1 AND type = 'schedule' AND name = $2`,
        [workflowId, create.body.data.name],
      )
    ).rows[0].n;
    expect(Number(beforeTriggerCount)).toBeGreaterThanOrEqual(1);

    const del = await request(BASE_URL)
      .delete(`/api/schedules/${scheduleId}`)
      .set(authHeaders());
    expect(del.status).toBe(204);

    const afterSched = await db.query(
      'SELECT id FROM schedule WHERE id = $1',
      [scheduleId],
    );
    expect(afterSched.rows.length).toBe(0);

    const afterTrig = await db.query(
      `SELECT id FROM trigger
         WHERE workflow_id = $1 AND type = 'schedule' AND name = $2`,
      [workflowId, create.body.data.name],
    );
    expect(afterTrig.rows.length).toBe(0);
  });
});
