import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { randomUUID } from 'crypto';
import { Client } from 'pg';
import request from 'supertest';

import { createDbClient, uniqueEmail, uniqueName } from './helpers/db';
import { registerAndLogin, createTeamWorkspace } from './helpers/auth';

/**
 * e2e: Background 본문 진입 노드가 받는 입력 (NERV Task CLE-T-TDAV1G).
 *
 * 실제 실행(save → execute → engine → BullMQ 워커)에서 본문 진입 노드가 실행 입력이 아니라
 * Background 노드가 받은 입력(바로 앞 노드의 출력)을 받는지 본다. 고치기 전에는 맨 바깥
 * 실행이 실행 입력을, 병렬 분기 루프가 Parallel 이 받은 입력을 본문에 넘겼다.
 * 컨테이너 본문 루프는 `container-nested-body.e2e-spec.ts` 가 본다.
 */

const BASE_URL = process.env.E2E_BASE_URL ?? 'http://backend-e2e:3011';
const TERMINAL = ['completed', 'failed', 'cancelled'];

describe('Background body entry input (e2e)', () => {
  let db: Client;
  let token: string;
  let workspaceId: string;

  beforeAll(async () => {
    db = createDbClient();
    await db.connect();
    const owner = await registerAndLogin(BASE_URL, uniqueEmail('bgentry'), db);
    token = owner.accessToken;
    workspaceId = await createTeamWorkspace(
      BASE_URL,
      token,
      uniqueName('BGENTRY'),
    );
  }, 60_000);

  afterAll(async () => {
    if (db) await db.end();
  });

  const auth = () => ({ Authorization: `Bearer ${token}` });

  async function poll(executionId: string): Promise<string> {
    const start = Date.now();
    let last = '';
    while (Date.now() - start < 20_000) {
      const res = await request(BASE_URL)
        .get(`/api/executions/${executionId}`)
        .set(auth())
        .set('X-Workspace-Id', workspaceId);
      if (res.status === 200) {
        last = (res.body.data as { status: string }).status;
        if (TERMINAL.includes(last)) return last;
      }
      await new Promise((r) => setTimeout(r, 200));
    }
    throw new Error(`poll timed out at status=${last}`);
  }

  // Background 본문은 메인 실행이 끝난 뒤에도 워커에서 돈다. 본문 노드가 끝날 때까지 기다린다.
  async function waitForOutput(
    executionId: string,
    nodeId: string,
  ): Promise<Record<string, unknown> | undefined> {
    const start = Date.now();
    while (Date.now() - start < 20_000) {
      const r = await db.query<{
        output_data: { output?: Record<string, unknown> };
      }>(
        `SELECT output_data FROM node_execution
           WHERE execution_id = $1 AND node_id = $2 AND status = 'completed'
           ORDER BY started_at DESC LIMIT 1`,
        [executionId, nodeId],
      );
      if (r.rows.length > 0) return r.rows[0].output_data?.output ?? {};
      await new Promise((r) => setTimeout(r, 200));
    }
    return undefined;
  }

  type SaveNode = {
    id: string;
    type: string;
    category: string;
    label: string;
    config: Record<string, unknown>;
  };
  type SaveEdge = [string, string, string, string];

  async function saveAndRun(
    prefix: string,
    nodes: SaveNode[],
    edges: SaveEdge[],
  ): Promise<{ executionId: string; status: string }> {
    const created = await request(BASE_URL)
      .post('/api/workflows')
      .set(auth())
      .set('X-Workspace-Id', workspaceId)
      .send({ name: uniqueName(prefix) });
    expect(created.status).toBe(201);
    const workflowId = created.body.data.id as string;

    const save = await request(BASE_URL)
      .post(`/api/workflows/${workflowId}/save`)
      .set(auth())
      .set('X-Workspace-Id', workspaceId)
      .send({
        nodes: nodes.map((n, i) => ({
          ...n,
          positionX: i * 200,
          positionY: 0,
        })),
        edges: edges.map(
          ([sourceNodeId, sourcePort, targetNodeId, targetPort]) => ({
            sourceNodeId,
            sourcePort,
            targetNodeId,
            targetPort,
          }),
        ),
      });
    expect(save.status).toBe(200);

    const exec = await request(BASE_URL)
      .post(`/api/workflows/${workflowId}/execute`)
      .set(auth())
      .set('X-Workspace-Id', workspaceId)
      .send({});
    expect(exec.status).toBe(202);
    const executionId = exec.body.data.executionId as string;
    return { executionId, status: await poll(executionId) };
  }

  const trigger = (id: string): SaveNode => ({
    id,
    type: 'manual_trigger',
    category: 'trigger',
    label: 'Start',
    config: {},
  });
  const code = (id: string, label: string, body: string): SaveNode => ({
    id,
    type: 'code',
    category: 'data',
    label,
    config: { language: 'javascript', code: body, timeout: 5 },
  });
  const background = (id: string): SaveNode => ({
    id,
    type: 'background',
    category: 'logic',
    label: 'Background',
    config: { notifyOnFailure: false, maxDurationMs: 30_000 },
  });
  // Transform 은 입력을 복사한 뒤 필드를 더하므로 출력에 받은 입력이 그대로 남는다.
  const transform = (id: string, label: string): SaveNode => ({
    id,
    type: 'transform',
    category: 'data',
    label,
    config: {
      operations: [{ type: 'set_field', field: 'seen', value: label }],
    },
  });

  it('feeds the Background node input, not the execution input, to the body entry node', async () => {
    const [startId, codeId, bgId, afterId, bgBodyId] = Array.from(
      { length: 5 },
      () => randomUUID(),
    );

    const { executionId, status } = await saveAndRun(
      'bgentry-top',
      [
        trigger(startId),
        code(codeId, 'Code', "return { marker: 'from-code' };"),
        background(bgId),
        transform(afterId, 'After'),
        transform(bgBodyId, 'BgBody'),
      ],
      [
        [startId, 'out', codeId, 'in'],
        [codeId, 'success', bgId, 'in'],
        [bgId, 'main', afterId, 'in'],
        [bgId, 'background', bgBodyId, 'in'],
      ],
    );

    expect(status).toBe('completed');
    const body = await waitForOutput(executionId, bgBodyId);
    expect(body).toEqual(
      expect.objectContaining({ marker: 'from-code', seen: 'BgBody' }),
    );
  }, 60_000);

  it('feeds the Background node input, not the Parallel input, inside a Parallel branch', async () => {
    const [startId, seedId, parId, branchCodeId, bgId, otherId, bgBodyId] =
      Array.from({ length: 7 }, () => randomUUID());

    const { executionId, status } = await saveAndRun(
      'bgentry-parallel',
      [
        trigger(startId),
        code(seedId, 'Seed', "return { marker: 'from-seed' };"),
        {
          id: parId,
          type: 'parallel',
          category: 'logic',
          label: 'Parallel',
          config: { branchCount: 2, waitAll: true },
        },
        code(branchCodeId, 'BranchCode', "return { marker: 'from-branch' };"),
        background(bgId),
        transform(otherId, 'Other'),
        transform(bgBodyId, 'BgBody'),
      ],
      [
        [startId, 'out', seedId, 'in'],
        [seedId, 'success', parId, 'in'],
        [parId, 'branch_0', branchCodeId, 'in'],
        [branchCodeId, 'success', bgId, 'in'],
        [bgId, 'background', bgBodyId, 'in'],
        [parId, 'branch_1', otherId, 'in'],
      ],
    );

    expect(status).toBe('completed');
    const body = await waitForOutput(executionId, bgBodyId);
    // 고치기 전에는 Parallel 이 받은 입력({ marker: 'from-seed' })이 들어갔다.
    expect(body).toEqual(
      expect.objectContaining({ marker: 'from-branch', seen: 'BgBody' }),
    );
  }, 60_000);
});
