import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { Client } from 'pg';
import crypto from 'node:crypto';
import request from 'supertest';

import { createDbClient, uniqueEmail, uniqueName } from './helpers/db';
import { registerAndLogin, createTeamWorkspace } from './helpers/auth';

/**
 * e2e: 목록 다섯 곳의 `sort` 가 Object 내장 속성 이름이면 기본 정렬로 폴백한다 (CLE-T-FXJ9CF).
 *
 * `PaginationQueryDto.sort` 의 정규식 `^[a-zA-Z][a-zA-Z0-9_]*$` 는 `constructor` · `toString` · `valueOf` ·
 * `hasOwnProperty` 를 통과시킨다. 서비스가 허용 목록을 `allowed[sort] || 기본값` 으로 읽으면 이 값에서 Object
 * 내장 함수가 나와 폴백을 건너뛰고, 함수 소스 문자열이 ORDER BY 에 들어가 500 이 났다. 판정 규칙의 단위 테스트는
 * `src/common/utils/list-sort.spec.ts` 에 있다. 트리거 목록은 `trigger-list-sort.e2e-spec.ts` 가 따로 본다.
 *
 * ## 고정 데이터
 *
 * 새 팀 워크스페이스에 목록마다 행 둘(이전 · 이후)을 만들고 기본 정렬 컬럼의 시각을 DB 에서 정한다. 그래서
 * 폴백한 정렬이 기본 컬럼과 요청한 방향을 따르는지 순서로 확인할 수 있다. 감사 로그는 위 생성 요청이 남긴 행을
 * 쓰고 그 시각을 1분 간격으로 다시 정한다.
 *
 * | 목록 | 기본 정렬 컬럼 | 이전 | 이후 |
 * |---|---|---|---|
 * | audit-logs | created_at | 01-01 00:00 | 1분씩 뒤 |
 * | workflows | created_at | 01-01 | 01-02 |
 * | executions | started_at | 01-01 | 01-02 |
 * | notifications | created_at | 01-01 | 01-02 |
 * | schedules | created_at | 01-01 | 01-02 |
 */

const BASE_URL = process.env.E2E_BASE_URL ?? 'http://backend-e2e:3011';

/** DTO 정규식을 통과하는 Object.prototype 속성 이름. */
const BUILTIN_SORTS = ['constructor', 'toString', 'valueOf', 'hasOwnProperty'];

type Row = { id: string };

interface ListCase {
  name: string;
  path: () => string;
  /** 기본 정렬 컬럼 기준 오름차순(이전 → 이후) id. */
  ascIds: () => string[];
}

describe('목록 sort 의 Object 내장 이름 폴백 (e2e)', () => {
  let db: Client;
  let token: string;
  let userId: string;
  let workspaceId: string;
  let workflowOld: string;
  let workflowNew: string;
  let executionOld: string;
  let executionNew: string;
  let notificationOld: string;
  let notificationNew: string;
  let scheduleOld: string;
  let scheduleNew: string;
  let auditAscIds: string[] = [];

  function authed(req: request.Test): request.Test {
    return req
      .set('Authorization', `Bearer ${token}`)
      .set('X-Workspace-Id', workspaceId);
  }

  const LISTS: ListCase[] = [
    {
      name: 'GET /api/audit-logs',
      path: () => '/api/audit-logs',
      ascIds: () => auditAscIds,
    },
    {
      name: 'GET /api/workflows',
      path: () => '/api/workflows',
      ascIds: () => [workflowOld, workflowNew],
    },
    {
      name: 'GET /api/executions/workflow/:workflowId',
      path: () => `/api/executions/workflow/${workflowOld}`,
      ascIds: () => [executionOld, executionNew],
    },
    {
      name: 'GET /api/notifications',
      path: () => '/api/notifications',
      ascIds: () => [notificationOld, notificationNew],
    },
    {
      name: 'GET /api/schedules',
      path: () => '/api/schedules',
      ascIds: () => [scheduleOld, scheduleNew],
    },
  ];

  /** 고정 데이터 id 만 남겨 응답 순서대로 돌려준다. 상태가 200 이 아니면 본문과 함께 실패한다. */
  async function listIds(list: ListCase, query: string): Promise<string[]> {
    const res = await authed(request(BASE_URL).get(`${list.path()}?${query}`));
    expect({
      status: res.status,
      body: res.status === 200 ? null : res.body,
    }).toEqual({ status: 200, body: null });
    const seeded = list.ascIds();
    return (res.body.data as Row[])
      .map((r) => r.id)
      .filter((id) => seeded.includes(id));
  }

  beforeAll(async () => {
    db = createDbClient();
    await db.connect();
    const owner = await registerAndLogin(BASE_URL, uniqueEmail('lsort'), db);
    token = owner.accessToken;
    userId = owner.userId;
    workspaceId = await createTeamWorkspace(
      BASE_URL,
      token,
      uniqueName('LSORT'),
    );

    async function createWorkflow(): Promise<string> {
      const res = await authed(request(BASE_URL).post('/api/workflows')).send({
        name: uniqueName('lsort-wf'),
      });
      expect(res.status).toBe(201);
      return res.body.data.id as string;
    }
    workflowOld = await createWorkflow();
    workflowNew = await createWorkflow();

    async function createManualTrigger(): Promise<string> {
      const res = await authed(request(BASE_URL).post('/api/triggers')).send({
        workflowId: workflowOld,
        type: 'manual',
        name: uniqueName('lsort-trg'),
      });
      expect(res.status).toBe(201);
      return res.body.data.id as string;
    }
    const triggerOld = await createManualTrigger();
    const triggerNew = await createManualTrigger();

    await db.query(`UPDATE workflow SET created_at = $2 WHERE id = $1`, [
      workflowOld,
      '2026-01-01T00:00:00Z',
    ]);
    await db.query(`UPDATE workflow SET created_at = $2 WHERE id = $1`, [
      workflowNew,
      '2026-01-02T00:00:00Z',
    ]);

    executionOld = crypto.randomUUID();
    executionNew = crypto.randomUUID();
    for (const [id, startedAt] of [
      [executionOld, '2026-01-01T00:00:00Z'],
      [executionNew, '2026-01-02T00:00:00Z'],
    ]) {
      await db.query(
        `INSERT INTO execution (id, workflow_id, status, started_at, finished_at)
         VALUES ($1, $2, 'completed', $3, $3)`,
        [id, workflowOld, startedAt],
      );
    }

    // title (varchar) 와 message (text) 의 타입이 달라 같은 param 을 양쪽에 쓰지 않는다.
    async function seedNotification(createdAt: string): Promise<string> {
      const title = uniqueName('lsort-n');
      const ins = await db.query<{ id: string }>(
        `INSERT INTO notification (workspace_id, user_id, type, title, message, is_read, channel, created_at)
         VALUES ($1, $2, 'execution_failed', $3, $4, false, 'in_app', $5)
         RETURNING id`,
        [workspaceId, userId, title, title, createdAt],
      );
      return ins.rows[0].id;
    }
    notificationOld = await seedNotification('2026-01-01T00:00:00Z');
    notificationNew = await seedNotification('2026-01-02T00:00:00Z');

    // 스케줄러가 집어 가지 않도록 비활성으로 넣는다. 목록은 is_active 로 거르지 않는다.
    async function seedSchedule(
      triggerId: string,
      createdAt: string,
    ): Promise<string> {
      const id = crypto.randomUUID();
      await db.query(
        `INSERT INTO schedule (id, workspace_id, trigger_id, cron_expression, is_active, created_at)
         VALUES ($1, $2, $3, '0 * * * *', false, $4)`,
        [id, workspaceId, triggerId, createdAt],
      );
      return id;
    }
    scheduleOld = await seedSchedule(triggerOld, '2026-01-01T00:00:00Z');
    scheduleNew = await seedSchedule(triggerNew, '2026-01-02T00:00:00Z');

    // 워크플로 · 트리거 생성이 감사 행을 남긴다. 한 요청이 여러 행을 같은 now() 로 남길 수 있어서
    // 시각을 1분 간격으로 다시 정해 동순위를 없앤다. 감사 목록은 created_at 만으로 정렬한다.
    const audit = await db.query<{ id: string }>(
      `SELECT id FROM audit_log WHERE workspace_id = $1 ORDER BY id`,
      [workspaceId],
    );
    auditAscIds = audit.rows.map((r) => r.id);
    expect(auditAscIds.length).toBeGreaterThanOrEqual(2);
    for (const [i, id] of auditAscIds.entries()) {
      await db.query(
        `UPDATE audit_log
            SET created_at = TIMESTAMPTZ '2026-01-01T00:00:00Z' + make_interval(mins => $2)
          WHERE id = $1`,
        [id, i],
      );
    }
  });

  afterAll(async () => {
    // 워크스페이스를 지우면 워크플로 · 트리거 · 실행 · 스케줄 · 알림 · 감사 행이 함께 지워진다.
    await db
      .query('DELETE FROM workspace WHERE id = $1', [workspaceId])
      .catch(() => undefined);
    await db.end();
  });

  describe.each(LISTS)('$name', (list) => {
    it('sort 가 없으면 기본 정렬 컬럼 DESC 다 (전제)', async () => {
      expect(await listIds(list, 'limit=100')).toEqual(
        [...list.ascIds()].reverse(),
      );
    });

    it.each(BUILTIN_SORTS)(
      'sort=%s 는 200 이고 기본 정렬 컬럼으로 폴백하며 방향은 지킨다',
      async (sort) => {
        expect(await listIds(list, `sort=${sort}&limit=100`)).toEqual(
          [...list.ascIds()].reverse(),
        );
        expect(await listIds(list, `sort=${sort}&order=asc&limit=100`)).toEqual(
          list.ascIds(),
        );
      },
    );

    /** 선두 밑줄은 DTO 정규식이 먼저 거른다. 서비스의 판정은 내부 호출자를 위한 다층 방어다. */
    it('sort=__proto__ 는 DTO 정규식에서 400 이다', async () => {
      const res = await authed(
        request(BASE_URL).get(`${list.path()}?sort=__proto__`),
      );
      expect(res.status).toBe(400);
    });
  });
});
