import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { randomUUID } from 'node:crypto';
import { Client } from 'pg';
import request from 'supertest';

import { createDbClient, uniqueEmail, uniqueName } from './helpers/db';
import { registerAndLogin, createTeamWorkspace } from './helpers/auth';
import type { RegisteredUser } from './helpers/auth';

/**
 * e2e: `execution_failed` 알림 발사 경계 (spec/data-flow/8-notifications.md §1.1,
 * spec/data-flow/3-execution.md §143 격리 원칙).
 *
 * 검증 영역 (지금까지 execution-engine.service.spec.ts unit 화이트박스만 존재하던 것을
 * 실 BullMQ + Postgres 인프라에서 통합 검증):
 *   1) top-level 실행 실패 → `execution_failed` 알림이 **정확히 top-level 에 대해서만** 발사되고
 *      딥링크 계약(resource_type='workflow' / resource_id=workflow.id, `_layout.md §3.1`)을 따른다.
 *   2) Background 본문 실패(메인 실행은 격리되어 완료)는 `background_failed` 만 발사하고
 *      `execution_failed` 는 **발사하지 않는다** (background body/sub-workflow 하위 실행 제외 —
 *      `!parentExecutionId` 게이트로 중복 회피).
 *
 * 실 BullMQ 워커가 떠 있는 e2e 인프라에서만 의미가 있다.
 */

const BASE_URL = process.env.E2E_BASE_URL ?? 'http://backend-e2e:3011';
const TERMINAL_STATUSES = ['completed', 'failed', 'cancelled'] as const;

async function pollExecutionStatus(
  executionId: string,
  authHeader: { Authorization: string },
  workspaceId: string,
  timeoutMs = 20_000,
  intervalMs = 200,
): Promise<string> {
  const start = Date.now();
  let lastStatus = 'unknown';
  while (Date.now() - start < timeoutMs) {
    const res = await request(BASE_URL)
      .get(`/api/executions/${executionId}`)
      .set(authHeader)
      .set('X-Workspace-Id', workspaceId);
    if (res.status === 200) {
      lastStatus = (res.body.data as { status: string }).status;
      if (
        TERMINAL_STATUSES.includes(
          lastStatus as (typeof TERMINAL_STATUSES)[number],
        )
      ) {
        return lastStatus;
      }
    }
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  throw new Error(`pollExecutionStatus timed out at status=${lastStatus}`);
}

describe('execution_failed notification firing (e2e)', () => {
  let db: Client;
  let owner: RegisteredUser;
  let workspaceId: string;

  beforeAll(async () => {
    db = createDbClient();
    await db.connect();
    owner = await registerAndLogin(BASE_URL, uniqueEmail('execfail-own'), db);
    workspaceId = await createTeamWorkspace(
      BASE_URL,
      owner.accessToken,
      uniqueName('EXECFAIL'),
    );
  }, 60_000);

  afterAll(async () => {
    await db.end();
  });

  // 자동 생성 Manual Trigger 를 reuse 하는 fresh workflow 를 만든다.
  async function createWorkflow(): Promise<{
    workflowId: string;
    trigger: { id: string; label: string };
  }> {
    const createRes = await request(BASE_URL)
      .post('/api/workflows')
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .set('X-Workspace-Id', workspaceId)
      .send({ name: uniqueName('execfail-wf') });
    expect(createRes.status).toBe(201);
    const workflowId = createRes.body.data.id as string;
    const triggerRows = await db.query<{ id: string; label: string }>(
      `SELECT id, label FROM node WHERE workflow_id = $1 AND type = 'manual_trigger'`,
      [workflowId],
    );
    expect(triggerRows.rows).toHaveLength(1);
    return { workflowId, trigger: triggerRows.rows[0] };
  }

  const triggerNode = (trigger: { id: string; label: string }) => ({
    id: trigger.id,
    type: 'manual_trigger',
    category: 'trigger',
    label: trigger.label,
    positionX: 0,
    positionY: 0,
    config: {},
  });

  // 의도적 syntax error — Code 노드 validate() 가 INVALID_NODE_CONFIG 로 throw.
  const failingCodeNode = (id: string, label: string) => ({
    id,
    type: 'code',
    category: 'data',
    label,
    positionX: 400,
    positionY: 0,
    config: {
      language: 'javascript',
      code: 'this is { not valid javascript',
      timeout: 5,
    },
  });

  async function saveCanvas(
    workflowId: string,
    nodes: unknown[],
    edges: unknown[],
  ): Promise<void> {
    const save = await request(BASE_URL)
      .post(`/api/workflows/${workflowId}/save`)
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .set('X-Workspace-Id', workspaceId)
      .send({ nodes, edges });
    if (save.status !== 201) {
      throw new Error(
        `saveCanvas failed: ${save.status} ${JSON.stringify(save.body)}`,
      );
    }
  }

  async function execute(workflowId: string): Promise<string> {
    const exec = await request(BASE_URL)
      .post(`/api/workflows/${workflowId}/execute`)
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .set('X-Workspace-Id', workspaceId)
      .send({});
    expect(exec.status).toBe(202);
    return (exec.body.data as { executionId: string }).executionId;
  }

  async function pollNotifications(
    type: string,
    resourceId: string,
    timeoutMs = 15_000,
  ): Promise<
    Array<{
      user_id: string;
      resource_type: string | null;
      resource_id: string | null;
      background_run_id: string | null;
      channel: string;
    }>
  > {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      const res = await db.query<{
        user_id: string;
        resource_type: string | null;
        resource_id: string | null;
        background_run_id: string | null;
        channel: string;
      }>(
        `SELECT user_id, resource_type, resource_id, background_run_id, channel
           FROM notification
          WHERE workspace_id = $1 AND type = $2 AND resource_id = $3`,
        [workspaceId, type, resourceId],
      );
      if (res.rows.length > 0) return res.rows;
      await new Promise((r) => setTimeout(r, 250));
    }
    return [];
  }

  // -------------------------------------------------------------------------
  // 1) top-level 실행 실패 → execution_failed 발사 (딥링크=workflow)
  // -------------------------------------------------------------------------

  it('top-level 실행 실패 → execution_failed 가 resource=workflow 로 정확히 발사된다', async () => {
    const { workflowId, trigger } = await createWorkflow();
    const codeId = randomUUID();
    // manual_trigger → code(syntax error): 메인 경로 노드 실패가 top-level 실행을 FAILED 로.
    await saveCanvas(
      workflowId,
      [triggerNode(trigger), failingCodeNode(codeId, 'Failing Main')],
      [
        {
          sourceNodeId: trigger.id,
          sourcePort: 'out',
          targetNodeId: codeId,
          targetPort: 'in',
        },
      ],
    );

    const executionId = await execute(workflowId);
    const status = await pollExecutionStatus(
      executionId,
      { Authorization: `Bearer ${owner.accessToken}` },
      workspaceId,
    );
    expect(status).toBe('failed');

    const rows = await pollNotifications('execution_failed', workflowId);
    // owner==executor 이므로 dedup 되어 정확히 1건.
    expect(rows).toHaveLength(1);
    expect(rows[0].resource_type).toBe('workflow');
    expect(rows[0].resource_id).toBe(workflowId);
    expect(rows[0].user_id).toBe(owner.userId);
    // §5.1: 워크플로우 실행 실패 = 인앱 + 이메일.
    expect(rows[0].channel).toBe('both');
    // execution 단위 딥링크 미지원 — resource_id 는 절대 executionId 가 아니다.
    expect(rows[0].resource_id).not.toBe(executionId);
  }, 60_000);

  // -------------------------------------------------------------------------
  // 2) Background 본문 실패 → background_failed 만, execution_failed 미발사
  // -------------------------------------------------------------------------

  it('Background 본문 실패는 background_failed 만 발사하고 execution_failed 는 발사하지 않는다', async () => {
    const { workflowId, trigger } = await createWorkflow();
    const bgId = randomUUID();
    const codeId = randomUUID();
    // manual_trigger → background → code(syntax error, 본문). 메인 실행은 격리되어 완료.
    await saveCanvas(
      workflowId,
      [
        triggerNode(trigger),
        {
          id: bgId,
          type: 'background',
          category: 'logic',
          label: 'Background',
          positionX: 200,
          positionY: 0,
          config: { notifyOnFailure: true, maxDurationMs: 30_000 },
        },
        { ...failingCodeNode(codeId, 'Failing Body'), positionY: 100 },
      ],
      [
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
    );

    const executionId = await execute(workflowId);
    // 메인 흐름은 Background pass-through 라 completed 로 종결 (본문 실패는 격리).
    const status = await pollExecutionStatus(
      executionId,
      { Authorization: `Bearer ${owner.accessToken}` },
      workspaceId,
    );
    expect(status).toBe('completed');

    // background_failed 가 발사될 때까지 대기 — 이 시점이면 본문 실패 처리가 끝난 상태.
    const bgRows = await pollNotifications('background_failed', workflowId);
    expect(bgRows.length).toBeGreaterThan(0);
    expect(bgRows[0].resource_type).toBe('workflow');
    expect(bgRows[0].resource_id).toBe(workflowId);
    expect(bgRows[0].background_run_id).not.toBeNull();

    // 핵심 단언: 같은 workflow 에 대해 execution_failed 는 0건 (중복 발사 회피).
    const execRows = await db.query(
      `SELECT id FROM notification
        WHERE workspace_id = $1 AND type = 'execution_failed' AND resource_id = $2`,
      [workspaceId, workflowId],
    );
    expect(execRows.rows).toHaveLength(0);
  }, 60_000);
});
