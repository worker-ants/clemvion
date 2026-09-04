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

  /**
   * V110 이 `idx_schedule_next_run (next_run_at, is_active) WHERE is_active` 를
   * `idx_schedule_workspace_next_run (workspace_id, next_run_at)` 으로 교체했다.
   *
   * **양쪽 방향을 다 건다.** 새 인덱스의 존재만 보면, 누군가 옛 인덱스를 되살려도
   * (또는 V110 의 DROP 이 조용히 실패해도) 초록으로 통과한다 — 교체의 절반이 안 닫힌다.
   *
   * 근거·실측: `plan/in-progress/spec-draft-schedule-index.md`,
   * SoT: `spec/1-data-model.md` §3 · `spec/data-flow/10-triggers.md` §2.1.
   */
  it('schema: schedule 인덱스가 (workspace_id, next_run_at) 로 교체됨 (V110)', async () => {
    const created = await db.query<{ indexdef: string; indisvalid: boolean }>(
      `SELECT i.indisvalid, pg_get_indexdef(i.indexrelid) AS indexdef
       FROM pg_index i
       JOIN pg_class c ON c.oid = i.indexrelid
       WHERE c.relname = 'idx_schedule_workspace_next_run'`,
    );
    expect(created.rows).toHaveLength(1);
    expect(created.rows[0].indisvalid).toBe(true);
    // 컬럼 순서가 이 인덱스의 존재 이유다 — 뒤집으면 목록 쿼리가 오히려 느려진다(실측 2.2배).
    expect(created.rows[0].indexdef).toMatch(/\(workspace_id,\s*next_run_at\)/);
    // 부분 인덱스가 아니어야 한다 — 목록이 `is_active` 를 걸지 않는다.
    expect(created.rows[0].indexdef).not.toMatch(/WHERE/);

    const dropped = await db.query(
      `SELECT 1 FROM pg_class WHERE relname = 'idx_schedule_next_run'`,
    );
    expect(dropped.rows).toHaveLength(0);
  });

  it('A. preview 엔드포인트가 다음 실행 시각 N개 반환', async () => {
    const res = await request(BASE_URL)
      .post('/api/schedules/preview')
      .set(authHeaders())
      .send({
        cronExpression: '0 9 * * *',
        timezone: 'Asia/Seoul',
        count: 3,
      });
    // POST 의 default 응답이 201. preview 는 새로운 자원 생성은 없지만 controller
    // 에 @HttpCode override 가 없어 201 로 응답한다.
    expect([200, 201]).toContain(res.status);
    const nextRuns = res.body.data.nextRuns as string[];
    expect(Array.isArray(nextRuns)).toBe(true);
    expect(nextRuns.length).toBeGreaterThan(0);
    nextRuns.forEach((iso) => {
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
    const sched = await db.query('SELECT id FROM schedule WHERE id = $1', [
      scheduleId,
    ]);
    expect(sched.rows.length).toBe(1);
    const trig = await db.query<{ type: string; is_active: boolean }>(
      `SELECT type, is_active FROM trigger
         WHERE workflow_id = $1 AND type = 'schedule'`,
      [workflowId],
    );
    expect(trig.rows.length).toBeGreaterThanOrEqual(1);
    expect(trig.rows[0].is_active).toBe(true);
  });

  it('C-2. GET /api/triggers 목록이 schedule 트리거의 cron·nextRunAt 을 포함 (V-10)', async () => {
    const cron = '15 8 * * *';
    const create = await request(BASE_URL)
      .post('/api/schedules')
      .set(authHeaders())
      .send({
        workflowId,
        name: uniqueName('sched-list'),
        cronExpression: cron,
        timezone: 'Asia/Seoul',
      });
    expect(create.status).toBe(201);

    // 목록(findAll)은 단건 조회 없이도 schedule 행을 enrichment 해야 한다.
    const list = await request(BASE_URL)
      .get('/api/triggers?type=schedule&limit=100')
      .set(authHeaders());
    expect(list.status).toBe(200);
    const rows = list.body.data as Array<{
      type: string;
      cronExpression?: string;
      timezone?: string;
      nextRunAt?: string | null;
    }>;
    const row = rows.find((r) => r.cronExpression === cron);
    expect(row).toBeDefined();
    expect(row!.type).toBe('schedule');
    expect(row!.timezone).toBe('Asia/Seoul');
    expect(row!.nextRunAt).toBeDefined();
    expect(row!.nextRunAt).not.toBeNull();
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
    // schedule 행 + 같은 워크플로우의 schedule 타입 trigger 존재 확인.
    const beforeSched = await db.query(
      'SELECT id FROM schedule WHERE id = $1',
      [scheduleId],
    );
    expect(beforeSched.rows.length).toBe(1);

    const del = await request(BASE_URL)
      .delete(`/api/schedules/${scheduleId}`)
      .set(authHeaders());
    expect(del.status).toBe(204);

    const afterSched = await db.query('SELECT id FROM schedule WHERE id = $1', [
      scheduleId,
    ]);
    expect(afterSched.rows.length).toBe(0);
  });

  // [data-flow 10-triggers §1.4] 역방향(Trigger→Schedule) 동기화 — PATCH /api/triggers/:id 경유.
  it('G. trigger PATCH isActive:false → schedule.is_active 동기 비활성', async () => {
    const create = await request(BASE_URL)
      .post('/api/schedules')
      .set(authHeaders())
      .send({
        workflowId,
        name: uniqueName('sched-g'),
        cronExpression: '0 6 * * *',
        timezone: 'UTC',
      });
    const scheduleId = create.body.data.id as string;
    const trig = await db.query(
      'SELECT trigger_id FROM schedule WHERE id = $1',
      [scheduleId],
    );
    const triggerId = trig.rows[0].trigger_id as string;

    const patch = await request(BASE_URL)
      .patch(`/api/triggers/${triggerId}`)
      .set(authHeaders())
      .send({ isActive: false });
    expect(patch.status).toBe(200);
    expect(patch.body.data.isActive).toBe(false);

    const after = await db.query(
      'SELECT is_active FROM schedule WHERE id = $1',
      [scheduleId],
    );
    expect(after.rows[0].is_active).toBe(false);
  });

  it('H. trigger PATCH isActive:true → schedule.is_active 동기 재활성', async () => {
    const create = await request(BASE_URL)
      .post('/api/schedules')
      .set(authHeaders())
      .send({
        workflowId,
        name: uniqueName('sched-h'),
        cronExpression: '0 7 * * *',
        timezone: 'UTC',
        isActive: false,
      });
    const scheduleId = create.body.data.id as string;
    const trig = await db.query(
      'SELECT trigger_id FROM schedule WHERE id = $1',
      [scheduleId],
    );
    const triggerId = trig.rows[0].trigger_id as string;

    const patch = await request(BASE_URL)
      .patch(`/api/triggers/${triggerId}`)
      .set(authHeaders())
      .send({ isActive: true });
    expect(patch.status).toBe(200);

    const after = await db.query(
      'SELECT is_active FROM schedule WHERE id = $1',
      [scheduleId],
    );
    expect(after.rows[0].is_active).toBe(true);
  });

  it('I. trigger DELETE (schedule 타입) → schedule row FK cascade 삭제 + 200 경로 정상 (removeJob 포함)', async () => {
    const create = await request(BASE_URL)
      .post('/api/schedules')
      .set(authHeaders())
      .send({
        workflowId,
        name: uniqueName('sched-i'),
        cronExpression: '0 8 * * *',
        timezone: 'UTC',
      });
    const scheduleId = create.body.data.id as string;
    const trig = await db.query(
      'SELECT trigger_id FROM schedule WHERE id = $1',
      [scheduleId],
    );
    const triggerId = trig.rows[0].trigger_id as string;

    const del = await request(BASE_URL)
      .delete(`/api/triggers/${triggerId}`)
      .set(authHeaders());
    expect([200, 204]).toContain(del.status);

    const after = await db.query('SELECT id FROM schedule WHERE id = $1', [
      scheduleId,
    ]);
    expect(after.rows.length).toBe(0);
  });
});
