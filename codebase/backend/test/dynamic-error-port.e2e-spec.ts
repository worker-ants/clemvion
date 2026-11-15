import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { randomUUID } from 'crypto';
import { Client } from 'pg';
import request from 'supertest';

import { createDbClient, uniqueEmail, uniqueName } from './helpers/db';
import { registerAndLogin, createTeamWorkspace } from './helpers/auth';

/**
 * e2e: 동적 에러 포트 (NERV Task CLE-T-K0Y546, REQ-NODEUI-012).
 *
 * 고정 `error` 포트가 없는 노드에 "에러 포트로 라우팅" 정책을 걸면 캔버스가 `error`
 * 포트를 그리고, 그 포트의 연결선은 `sourcePort: 'error'` 로 저장된다. 실제 실행
 * (save → execute → engine → BullMQ 워커)에서 노드가 성공하면 error 연결선을 열지
 * 않고, 실패하면 error 연결선만 연다.
 */

const BASE_URL = process.env.E2E_BASE_URL ?? 'http://backend-e2e:3011';
const TERMINAL = ['completed', 'failed', 'cancelled'];
const ROUTE = { errorHandling: { policy: 'route_to_error_port' } };

describe('Dynamic error port routing (e2e)', () => {
  let db: Client;
  let token: string;
  let workspaceId: string;

  beforeAll(async () => {
    db = createDbClient();
    await db.connect();
    const owner = await registerAndLogin(BASE_URL, uniqueEmail('dynerr'), db);
    token = owner.accessToken;
    workspaceId = await createTeamWorkspace(
      BASE_URL,
      token,
      uniqueName('DYNERR'),
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

  async function nodeStatuses(
    executionId: string,
  ): Promise<Map<string, string>> {
    const r = await db.query<{ node_id: string; status: string }>(
      `SELECT node_id, status FROM node_execution WHERE execution_id = $1`,
      [executionId],
    );
    return new Map(r.rows.map((row) => [row.node_id, row.status]));
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
    nodes: SaveNode[],
    edges: SaveEdge[],
  ): Promise<{ executionId: string; status: string }> {
    const created = await request(BASE_URL)
      .post('/api/workflows')
      .set(auth())
      .set('X-Workspace-Id', workspaceId)
      .send({ name: uniqueName('dynerr') });
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
  const transform = (
    id: string,
    label: string,
    extra: Record<string, unknown> = {},
  ): SaveNode => ({
    id,
    type: 'transform',
    category: 'data',
    label,
    config: {
      operations: [{ type: 'set_field', field: 'seen', value: label }],
      ...extra,
    },
  });

  it('opens only the normal edge when the routed node succeeds', async () => {
    const [startId, nodeId, nextId, handlerId] = Array.from({ length: 4 }, () =>
      randomUUID(),
    );
    const { executionId, status } = await saveAndRun(
      [
        trigger(startId),
        transform(nodeId, 'Routed', ROUTE),
        transform(nextId, 'Next'),
        transform(handlerId, 'Handler'),
      ],
      [
        [startId, 'out', nodeId, 'in'],
        [nodeId, 'out', nextId, 'in'],
        [nodeId, 'error', handlerId, 'in'],
      ],
    );

    expect(status).toBe('completed');
    const statuses = await nodeStatuses(executionId);
    expect(statuses.get(nodeId)).toBe('completed');
    expect(statuses.get(nextId)).toBe('completed');
    expect(statuses.has(handlerId)).toBe(false);
  }, 60_000);

  it('opens only the error edge when the routed node fails', async () => {
    const [startId, seedId, filterId, nextId, handlerId] = Array.from(
      { length: 5 },
      () => randomUUID(),
    );
    const { executionId, status } = await saveAndRun(
      [
        trigger(startId),
        // Filter 는 inputField 가 배열이 아닌 값을 가리키면 throw 한다.
        transform(seedId, 'Seed'),
        {
          id: filterId,
          type: 'filter',
          category: 'logic',
          label: 'Filter',
          config: {
            inputField: 'seen',
            conditions: [{ field: 'status', operator: 'eq', value: 'x' }],
            ...ROUTE,
          },
        },
        transform(nextId, 'Next'),
        transform(handlerId, 'Handler'),
      ],
      [
        [startId, 'out', seedId, 'in'],
        [seedId, 'out', filterId, 'in'],
        [filterId, 'match', nextId, 'in'],
        [filterId, 'error', handlerId, 'in'],
      ],
    );

    expect(status).toBe('completed');
    const statuses = await nodeStatuses(executionId);
    expect(statuses.get(filterId)).toBe('failed');
    expect(statuses.get(handlerId)).toBe('completed');
    expect(statuses.has(nextId)).toBe(false);
  }, 60_000);
});
