import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { randomUUID } from 'node:crypto';
import { Client } from 'pg';
import request from 'supertest';

import { createDbClient, uniqueEmail, uniqueName } from './helpers/db';
import { registerAndLogin, createTeamWorkspace } from './helpers/auth';

/**
 * e2e: Background 본문 모니터링 API + WebSocket 채널 + 알림 attribution
 * (spec/4-nodes/1-logic/12-background.md §8).
 *
 * 검증 영역:
 *   1) V047 / V048 인덱스의 `pg_index.indisvalid = true` 운영 안전성
 *   2) Cross-workspace `GET /api/v1/executions/:id/background-runs/:bgid` → 404
 *   3) WS `background:run:<id>` 비-UUID / cross-workspace 구독 거부
 *      ⇒ socket.io-client 의존성 부재로 e2e 미커버. 동일 시나리오는
 *         `websocket.gateway.spec.ts` 의 unit test 4건이 이미 회귀 잠금
 *         (cross-workspace / non-UUID / DB error / success). 의존성 추가
 *         결정 시 본 spec 으로 이관.
 *   4) Background 본문 실패 시 `Notification.resourceType='background_run'` +
 *      `resourceId=backgroundRunId` 정확 attribution
 *
 * 실 BullMQ 워커가 떠 있는 e2e 인프라에서만 의미가 있다 (workflow-execution.e2e
 * 와 동일 전제).
 */

const BASE_URL = process.env.E2E_BASE_URL ?? 'http://backend-e2e:3011';
const TERMINAL_STATUSES = ['completed', 'failed', 'cancelled'] as const;

interface NodeExecutionRow {
  nodeId: string;
  outputData: Record<string, unknown> | null;
  status: string;
}

async function pollExecution(
  executionId: string,
  authHeader: { Authorization: string },
  workspaceId: string,
  timeoutMs = 15_000,
  intervalMs = 200,
): Promise<{ status: string; nodeExecutions: NodeExecutionRow[] }> {
  const start = Date.now();
  let last: { status: string; nodeExecutions: NodeExecutionRow[] } | null =
    null;
  while (Date.now() - start < timeoutMs) {
    const res = await request(BASE_URL)
      .get(`/api/executions/${executionId}`)
      .set(authHeader)
      .set('X-Workspace-Id', workspaceId);
    if (res.status === 200) {
      const data = res.body.data as {
        status: string;
        nodeExecutions: NodeExecutionRow[];
      };
      last = { status: data.status, nodeExecutions: data.nodeExecutions };
      if (
        TERMINAL_STATUSES.includes(
          data.status as (typeof TERMINAL_STATUSES)[number],
        )
      ) {
        return last;
      }
    }
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  throw new Error(
    `pollExecution timed out at status=${last?.status}. last=${JSON.stringify(last)}`,
  );
}

describe('Background body monitoring (e2e)', () => {
  let db: Client;
  let owner: { accessToken: string };
  let workspaceId: string;
  let intruder: { accessToken: string };
  let intruderWorkspaceId: string;

  beforeAll(async () => {
    db = createDbClient();
    await db.connect();

    owner = await registerAndLogin(BASE_URL, uniqueEmail('bgmon-own'), db);
    workspaceId = await createTeamWorkspace(
      BASE_URL,
      owner.accessToken,
      uniqueName('BGMON'),
    );

    intruder = await registerAndLogin(BASE_URL, uniqueEmail('bgmon-x'), db);
    intruderWorkspaceId = await createTeamWorkspace(
      BASE_URL,
      intruder.accessToken,
      uniqueName('BGMON-X'),
    );
  }, 60_000);

  afterAll(async () => {
    await db.end();
  });

  // -------------------------------------------------------------------------
  // 1) Migration validity — V047 / V048 인덱스 운영 안전성
  // -------------------------------------------------------------------------

  it('V047 / V048 인덱스가 모두 `pg_index.indisvalid = true` 로 적용된다', async () => {
    const result = await db.query<{
      indexrelname: string;
      indisvalid: boolean;
    }>(
      `SELECT i.indexrelid::regclass::text AS indexrelname, i.indisvalid
         FROM pg_index i
        WHERE i.indexrelid::regclass::text IN (
          'idx_node_execution_background_run_id',
          'idx_node_execution_parent_started_id'
        )`,
    );
    expect(result.rows).toHaveLength(2);
    for (const row of result.rows) {
      // CONCURRENTLY 가 실패하면 invalid 상태로 잔류한다 (orchestrator I-8).
      // 운영 안전 invariant — 색인 leak 방지.
      expect(row.indisvalid).toBe(true);
    }
  });

  // -------------------------------------------------------------------------
  // 헬퍼 — Background + Code 본문이 실패하는 워크플로우 setup
  // -------------------------------------------------------------------------

  async function createBackgroundFailingWorkflow(): Promise<string> {
    // 1) workflow 생성 — workflowsService.create 가 Manual Trigger 1개를
    //    자동으로 함께 만든다 ("정확히 하나" invariant).
    const createRes = await request(BASE_URL)
      .post('/api/workflows')
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .set('X-Workspace-Id', workspaceId)
      .send({ name: uniqueName('bg-fail-wf') });
    expect(createRes.status).toBe(201);
    const workflowId = createRes.body.data.id as string;

    // 자동 생성된 Manual Trigger 의 ID/라벨을 그대로 reuse — 다른 UUID 로
    // 새 trigger 를 submit 하면 syncNodes 가 DELETE→INSERT 순으로 처리하다가
    // UNIQUE(workflow_id, label) 위반 (Postgres 즉시 검증) 으로 409 가 발생할 수
    // 있다. 기존 row 를 UPDATE 경로로 흡수시켜 회피.
    const triggerRows = await db.query<{ id: string; label: string }>(
      `SELECT id, label FROM node WHERE workflow_id = $1 AND type = 'manual_trigger'`,
      [workflowId],
    );
    expect(triggerRows.rows).toHaveLength(1);
    const trigger = triggerRows.rows[0];

    // 2) saveCanvas — 기존 trigger 재사용 + Background → Code (throw).
    // Edge UNIQUE 제약이 (source, sourcePort, target, targetPort) 전역
    // 스코프라 노드 UUID 가 테스트 간 충돌하면 RESOURCE_CONFLICT 가 발생.
    // 매 호출마다 fresh UUID 발급으로 격리.
    const bgId = randomUUID();
    const codeId = randomUUID();
    const save = await request(BASE_URL)
      .post(`/api/workflows/${workflowId}/save`)
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .set('X-Workspace-Id', workspaceId)
      .send({
        nodes: [
          {
            id: trigger.id,
            type: 'manual_trigger',
            category: 'trigger',
            label: trigger.label,
            positionX: 0,
            positionY: 0,
            config: {},
          },
          {
            id: bgId,
            type: 'background',
            category: 'logic',
            label: 'Background',
            positionX: 200,
            positionY: 0,
            config: {
              notes: 'e2e: notify on failure',
              notifyOnFailure: true,
              maxDurationMs: 30_000,
            },
          },
          {
            id: codeId,
            type: 'code',
            category: 'data',
            label: 'Failing Body',
            positionX: 400,
            positionY: 100,
            config: {
              language: 'javascript',
              // 의도적 syntax error — Code 노드의 runtime throw 는 handler
              // 가 자체 catch 후 `error` port 로 라우팅(graceful)하므로
              // executeBackgroundSubgraph 가 reject 하지 않는다. validate()
              // 단계의 syntax error 는 executeNode 가 `INVALID_NODE_CONFIG`
              // 로 throw 해 호출 체인으로 전파 → dispatchFailureNotification
              // 까지 도달.
              code: 'this is { not valid javascript',
              timeout: 5,
            },
          },
        ],
        edges: [
          {
            sourceNodeId: trigger.id,
            sourcePort: 'out',
            targetNodeId: bgId,
            targetPort: 'in',
          },
          {
            sourceNodeId: bgId,
            sourcePort: 'background',
            targetNodeId: codeId,
            targetPort: 'in',
          },
        ],
      });
    if (save.status !== 201) {
      throw new Error(
        `saveCanvas failed: ${save.status} ${JSON.stringify(save.body)}`,
      );
    }
    return workflowId;
  }

  async function executeAndGetBackgroundRunId(workflowId: string): Promise<{
    executionId: string;
    backgroundRunId: string;
  }> {
    const exec = await request(BASE_URL)
      .post(`/api/workflows/${workflowId}/execute`)
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .set('X-Workspace-Id', workspaceId)
      .send({});
    expect(exec.status).toBe(202);
    const executionId = (exec.body.data as { executionId: string }).executionId;

    // 메인 흐름은 Background pass-through 라 빠르게 terminal 도달.
    const detail = await pollExecution(
      executionId,
      { Authorization: `Bearer ${owner.accessToken}` },
      workspaceId,
    );

    const bgNode = detail.nodeExecutions.find(
      (ne) =>
        ne.outputData != null &&
        typeof ne.outputData === 'object' &&
        ne.outputData['meta'] != null &&
        typeof (ne.outputData['meta'] as Record<string, unknown>)[
          'backgroundRunId'
        ] === 'string',
    );
    expect(bgNode).toBeDefined();
    const meta = bgNode!.outputData!['meta'] as { backgroundRunId: string };
    return { executionId, backgroundRunId: meta.backgroundRunId };
  }

  // -------------------------------------------------------------------------
  // 2) Cross-workspace IDOR 차단
  // -------------------------------------------------------------------------

  it('cross-workspace GET → 404 (워크스페이스 mismatch 시 ID enumeration 차단)', async () => {
    const workflowId = await createBackgroundFailingWorkflow();
    const { executionId, backgroundRunId } =
      await executeAndGetBackgroundRunId(workflowId);

    // 같은 워크스페이스 owner: 200 응답으로 baseline 확보.
    const ownOk = await request(BASE_URL)
      .get(`/api/executions/${executionId}/background-runs/${backgroundRunId}`)
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .set('X-Workspace-Id', workspaceId);
    if (ownOk.status !== 200) {
      // 진단용 로그 — CI 실패 분석 가속.

      console.error('ownOk failed', {
        status: ownOk.status,
        body: ownOk.body,
        executionId,
        backgroundRunId,
        workspaceId,
      });
    }
    expect(ownOk.status).toBe(200);
    expect(ownOk.body.data.backgroundRunId).toBe(backgroundRunId);

    // 다른 워크스페이스 사용자: workspace mismatch → 404 (Forbidden 으로 leak 금지).
    const intruderRes = await request(BASE_URL)
      .get(`/api/executions/${executionId}/background-runs/${backgroundRunId}`)
      .set('Authorization', `Bearer ${intruder.accessToken}`)
      .set('X-Workspace-Id', intruderWorkspaceId);
    expect(intruderRes.status).toBe(404);
  }, 30_000);

  // -------------------------------------------------------------------------
  // 4) 본문 실패 시 알림 attribution
  // -------------------------------------------------------------------------

  it('본문 실패 → Notification 이 resourceType=`background_run` + resourceId=backgroundRunId 로 생성된다', async () => {
    const workflowId = await createBackgroundFailingWorkflow();
    const { executionId, backgroundRunId } =
      await executeAndGetBackgroundRunId(workflowId);

    // BullMQ worker 가 본문을 처리하고 dispatchFailureNotification 까지 도달
    // 하는 데 메인 실행 종료 후 추가 시간이 필요. 최대 15초 폴링.
    const deadline = Date.now() + 15_000;
    let rows: Array<{
      type: string;
      resource_type: string | null;
      resource_id: string | null;
    }> = [];
    while (Date.now() < deadline) {
      const res = await db.query<{
        type: string;
        resource_type: string | null;
        resource_id: string | null;
      }>(
        `SELECT type, resource_type, resource_id
           FROM notification
          WHERE resource_type = 'background_run' AND resource_id = $1`,
        [backgroundRunId],
      );
      if (res.rows.length > 0) {
        rows = res.rows;
        break;
      }
      await new Promise((r) => setTimeout(r, 250));
    }

    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) {
      expect(row.type).toBe('background_failed');
      expect(row.resource_type).toBe('background_run');
      expect(row.resource_id).toBe(backgroundRunId);
    }

    // 본문 모니터링 API 의 `notifications` 필드에도 동일 row 가 노출되어야 한다.
    const apiRes = await request(BASE_URL)
      .get(`/api/executions/${executionId}/background-runs/${backgroundRunId}`)
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .set('X-Workspace-Id', workspaceId);
    expect(apiRes.status).toBe(200);
    const notifications = apiRes.body.data.notifications as Array<{
      type: string;
    }>;
    expect(notifications.length).toBeGreaterThan(0);
    expect(notifications[0].type).toBe('background_failed');
  }, 45_000);
});
