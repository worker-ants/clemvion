import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { randomUUID } from 'crypto';
import { Client } from 'pg';
import request from 'supertest';

import { createDbClient, uniqueEmail, uniqueName } from './helpers/db';
import { registerAndLogin, createTeamWorkspace } from './helpers/auth';

/**
 * e2e: spec/5-system/4-execution-engine.md §4.x(park = 세그먼트 종료) · §7.5
 * (rehydration) — Phase B (PR-B1) park 즉시 해제 + slow-path 일원화 회귀 가드.
 *
 * 핵심 불변식(plan/in-progress/exec-park-durable-resume.md §Phase B):
 *   "park → worker kill → 무손실 재개". PR-B1 에서 form/button 단발 park 는
 *   `runExecution` 코루틴을 즉시 해제하므로(park=세그먼트 종료, bounded 메모리)
 *   **재개에 쓸 in-process resolver/context 가 존재하지 않는다**. 따라서 본 e2e
 *   에서 form 노드 park 후의 재개는 정의상 §7.5 rehydration(cold slow-path) —
 *   durable 영속된 `execution`(status=waiting_for_input) + `node_execution`
 *   (output_data) 행에서 context 를 재구성해 구동된다. 이는 "워커 프로세스가
 *   죽어 메모리가 소실된 뒤 다른 워커가 큐에서 재개" 시나리오와 동형이다 —
 *   in-memory 코루틴이 park 시점에 이미 해제됐으므로 단일 백엔드에서도 cold
 *   rehydration 경로가 그대로 실행된다.
 *
 * 검증: (1) park 시 execution/node_execution 이 durable WAITING 으로 영속,
 *       (2) REST `POST /executions/:id/continue` 재개가 cold rehydration 으로
 *           terminal(completed) 도달, (3) 재개된 form 노드 output 에 제출 데이터가
 *           무손실 반영(node_execution.output_data).
 */

const BASE_URL = process.env.E2E_BASE_URL ?? 'http://backend-e2e:3011';
const MANUAL_TRIGGER_TYPE = 'manual_trigger';

const TERMINAL_STATUSES = ['completed', 'failed', 'cancelled'] as const;

interface CanvasNode {
  id: string;
  type: string;
  category: string;
  label: string;
  positionX: number;
  positionY: number;
  config?: Record<string, unknown>;
}
interface CanvasEdge {
  sourceNodeId: string;
  sourcePort?: string;
  targetNodeId: string;
  targetPort?: string;
}

describe('Execution park → cold rehydration resume (e2e, PR-B1)', () => {
  let db: Client;
  let ownerToken: string;
  let workspaceId: string;

  beforeAll(async () => {
    db = createDbClient();
    await db.connect();
    const owner = await registerAndLogin(
      BASE_URL,
      uniqueEmail('parkresume'),
      db,
    );
    ownerToken = owner.accessToken;
    workspaceId = await createTeamWorkspace(
      BASE_URL,
      ownerToken,
      uniqueName('PARKRESUME'),
    );
  }, 60_000);

  afterAll(async () => {
    if (db) await db.end();
  });

  const authHeader = () => ({ Authorization: `Bearer ${ownerToken}` });

  async function createWorkflow(): Promise<string> {
    const res = await request(BASE_URL)
      .post('/api/workflows')
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('X-Workspace-Id', workspaceId)
      .send({ name: uniqueName('parkresume-wf') });
    expect(res.status).toBe(201);
    return res.body.data.id as string;
  }

  async function saveCanvas(
    id: string,
    nodes: CanvasNode[],
    edges: CanvasEdge[],
  ): Promise<void> {
    const res = await request(BASE_URL)
      .post(`/api/workflows/${id}/save`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('X-Workspace-Id', workspaceId)
      .send({ nodes, edges });
    expect([200, 201]).toContain(res.status);
  }

  async function poll(
    executionId: string,
    predicate: (status: string) => boolean,
    timeoutMs = 15_000,
    intervalMs = 200,
  ): Promise<string> {
    const start = Date.now();
    let last = '';
    while (Date.now() - start < timeoutMs) {
      const res = await request(BASE_URL)
        .get(`/api/executions/${executionId}`)
        .set(authHeader())
        .set('X-Workspace-Id', workspaceId);
      if (res.status === 200) {
        last = (res.body.data as { status: string }).status;
        if (predicate(last)) return last;
      }
      await new Promise((r) => setTimeout(r, intervalMs));
    }
    throw new Error(
      `poll timed out at status=${last} (execution=${executionId})`,
    );
  }

  it('form park 는 durable WAITING 으로 영속되고, cold rehydration 재개가 무손실로 completed 한다', async () => {
    // 1. Manual Trigger → Form(text 필드 1개) 워크플로우.
    const workflowId = await createWorkflow();
    const trigger: CanvasNode = {
      id: randomUUID(),
      type: MANUAL_TRIGGER_TYPE,
      category: 'trigger',
      label: 'Start',
      positionX: 0,
      positionY: 0,
    };
    const form: CanvasNode = {
      id: randomUUID(),
      type: 'form',
      category: 'presentation',
      label: 'Approval Form',
      positionX: 240,
      positionY: 0,
      config: {
        title: 'Approval',
        fields: [{ name: 'note', type: 'text', label: 'Note' }],
      },
    };
    await saveCanvas(
      workflowId,
      [trigger, form],
      [
        {
          sourceNodeId: trigger.id,
          sourcePort: 'out',
          targetNodeId: form.id,
          targetPort: 'in',
        },
      ],
    );

    // 2. 실행 → form 노드에서 park (waiting_for_input).
    const execRes = await request(BASE_URL)
      .post(`/api/workflows/${workflowId}/execute`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('X-Workspace-Id', workspaceId)
      .send({});
    expect(execRes.status).toBe(202);
    const executionId = (execRes.body.data as { executionId: string })
      .executionId;
    expect(executionId).toBeDefined();

    const parkedStatus = await poll(
      executionId,
      (s) =>
        s === 'waiting_for_input' || TERMINAL_STATUSES.includes(s as never),
    );
    expect(parkedStatus).toBe('waiting_for_input');

    // 3. Durable 영속 확인 — park 시 코루틴이 해제됐으므로(bounded 메모리), 재개의
    //    유일한 출처는 아래 DB 행이다 (worker kill 후 cold rehydration 과 동형).
    const execRow = await db.query(
      `SELECT status, finished_at FROM execution WHERE id = $1`,
      [executionId],
    );
    expect(execRow.rows[0]?.status).toBe('waiting_for_input');
    expect(execRow.rows[0]?.finished_at).toBeNull();

    const waitingNode = await db.query(
      `SELECT id, status, output_data FROM node_execution
         WHERE execution_id = $1 AND node_id = $2
         ORDER BY started_at DESC LIMIT 1`,
      [executionId, form.id],
    );
    expect(waitingNode.rows[0]?.status).toBe('waiting_for_input');

    // 4. 재개 — REST continue. park-release 모델에서 이 재개는 §7.5 rehydration
    //    (cold slow-path)으로만 구동된다 (in-process resolver 부재).
    const continueRes = await request(BASE_URL)
      .post(`/api/executions/${executionId}/continue`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('X-Workspace-Id', workspaceId)
      .send({ formData: { note: 'hello-from-e2e' } });
    expect([200, 202]).toContain(continueRes.status);

    // 5. cold rehydration 으로 terminal 도달.
    const finalStatus = await poll(executionId, (s) =>
      TERMINAL_STATUSES.includes(s as never),
    );
    expect(finalStatus).toBe('completed');

    // 6. 무손실 — 재개된 form 노드가 completed + 제출 데이터가 output 에 반영.
    const completedNode = await db.query(
      `SELECT status, output_data FROM node_execution
         WHERE execution_id = $1 AND node_id = $2
         ORDER BY started_at DESC LIMIT 1`,
      [executionId, form.id],
    );
    expect(completedNode.rows[0]?.status).toBe('completed');
    expect(JSON.stringify(completedNode.rows[0]?.output_data ?? {})).toContain(
      'hello-from-e2e',
    );
  }, 60_000);
});
