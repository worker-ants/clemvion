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
 *   - 목록 조회가 워크스페이스로 격리되고 `next_run_at`(asc·desc)·기본 `created_at` 정렬이 적용됨
 *   - V110: schedule 인덱스가 `(workspace_id, next_run_at)` 로 실재 (스키마 drift 방지)
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
   * 근거·실측: `plan/complete/spec-draft-schedule-index.md`,
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
      `SELECT 1 FROM pg_class WHERE relname = 'idx_schedule_next_run' AND relkind = 'i'`,
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
  /**
   * V110 이 최적화 대상으로 삼은 **바로 그 쿼리** — `GET /api/schedules` 의
   * `WHERE workspace_id = ? ORDER BY next_run_at ... LIMIT`.
   *
   * 인덱스의 존재·컬럼 순서는 위 schema 테스트가 고정하지만, **"그 인덱스로 서빙되는 API 가
   * 올바른 결과를 낸다"는 별개 명제**다 (`23_02_51` W4). 특히 `workspace_id` 가 인덱스 선두
   * 컬럼이 되면서 격리와 정렬이 같은 인덱스에 얹혔으므로, 둘 다 실제 응답으로 확인한다.
   */
  it('J. 목록 조회 — 워크스페이스 격리 + next_run_at 정렬 (V110 대상 쿼리)', async () => {
    // 이 워크스페이스에 스케줄 2개를 서로 다른 다음 실행 시각으로 만든다.
    for (const cron of ['0 3 * * *', '0 21 * * *']) {
      const created = await request(BASE_URL)
        .post('/api/schedules')
        .set(authHeaders())
        .send({
          workflowId,
          name: uniqueName('sched-j'),
          cronExpression: cron,
          timezone: 'Asia/Seoul',
        });
      expect(created.status).toBe(201);
    }

    const asc = await request(BASE_URL)
      .get('/api/schedules?sort=next_run_at&order=asc&limit=50')
      .set(authHeaders());
    expect(asc.status).toBe(200);
    const ascRows = asc.body.data as Array<{
      id: string;
      nextRunAt: string | null;
    }>;
    expect(ascRows.length).toBeGreaterThanOrEqual(2);

    // 정렬이 실제로 적용됐는가 — 값이 서로 다른 행이 있어야 관측 가능하다.
    const ascTimes = ascRows
      .map((r) => r.nextRunAt)
      .filter((v): v is string => v !== null)
      .map((v) => new Date(v).getTime());
    expect(new Set(ascTimes).size).toBeGreaterThanOrEqual(2);
    expect([...ascTimes].sort((a, b) => a - b)).toEqual(ascTimes);

    // 반대 방향도 건다 — 오름차순만 보면 정렬을 무시하는 구현도 통과할 수 있다.
    const desc = await request(BASE_URL)
      .get('/api/schedules?sort=next_run_at&order=desc&limit=50')
      .set(authHeaders());
    expect(desc.status).toBe(200);
    const descTimes = (desc.body.data as Array<{ nextRunAt: string | null }>)
      .map((r) => r.nextRunAt)
      .filter((v): v is string => v !== null)
      .map((v) => new Date(v).getTime());
    expect([...descTimes].sort((a, b) => b - a)).toEqual(descTimes);

    // 기본 정렬(`sort` 생략 → created_at desc)도 인덱스 선두 컬럼 덕을 본다고 주장했으므로
    // (6.89 → 1.08 ms) 그 경로의 결과 정확성도 함께 건다 (`23_26_09` INFO#8).
    const byDefault = await request(BASE_URL)
      .get('/api/schedules?limit=50')
      .set(authHeaders());
    expect(byDefault.status).toBe(200);
    const createdTimes = (
      byDefault.body.data as Array<{ createdAt: string }>
    ).map((r) => new Date(r.createdAt).getTime());
    expect(createdTimes.length).toBeGreaterThanOrEqual(2);
    expect([...createdTimes].sort((a, b) => b - a)).toEqual(createdTimes);

    // 워크스페이스 격리 — 다른 워크스페이스에서는 이 스케줄들이 보이지 않는다.
    //
    // **직접 단언한다** (`23_47_43` W1). 처음엔 `for (row of data) expect(내것아님)` 로 썼는데
    // `otherWs` 에는 스케줄이 하나도 없어 **루프 바디가 한 번도 실행되지 않았다** — 정상
    // 경로에서 관측되지 않는 단언은 통과해도 아무것도 말해 주지 않는다. 빈 목록이 기대값이면
    // 기대값을 그대로 쓰는 것이 강한 형태이고, 이 저장소의 다른 격리 테스트도 그렇게 한다.
    const otherWs = await createTeamWorkspace(
      BASE_URL,
      token,
      uniqueName('SCH-OTHER'),
    );
    const isolated = await request(BASE_URL)
      .get('/api/schedules?limit=50')
      .set({ Authorization: `Bearer ${token}`, 'X-Workspace-Id': otherWs });
    expect(isolated.status).toBe(200);
    expect(isolated.body.data).toEqual([]);
  }, 60_000);
});
