import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { randomUUID } from 'crypto';
import { Client } from 'pg';
import request from 'supertest';

import { createDbClient, uniqueEmail, uniqueName } from './helpers/db';
import { registerAndLogin, createTeamWorkspace } from './helpers/auth';

/**
 * e2e: 컨테이너 본문 안 컨테이너와 Background (NERV Task CLE-T-MR6ZH3).
 *
 * 실제 실행(save → execute → engine → BullMQ 워커)에서 두 가지를 본다.
 *
 * 1. **본문 안 ForEach 가 회차마다 자기 본문을 돈다**: 컨테이너 본문 루프가 안쪽
 *    컨테이너를 실행 경로로 넘기지 않아 안쪽 본문이 한 번도 돌지 않던 결함을 막는다.
 * 2. **본문 안 Background 가 회차마다 본문을 끝까지 실행한다**: 본문 루프가 Background
 *    본문을 큐에 넣지 않던 결함과, 워커가 맨 바깥 그래프만 만들어 컨테이너 소속 본문
 *    노드를 실행하지 못하던 결함을 함께 막는다.
 */

const BASE_URL = process.env.E2E_BASE_URL ?? 'http://backend-e2e:3011';
const TERMINAL = ['completed', 'failed', 'cancelled'];

describe('Nested container and Background inside a container body (e2e)', () => {
  let db: Client;
  let token: string;
  let workspaceId: string;

  beforeAll(async () => {
    db = createDbClient();
    await db.connect();
    const owner = await registerAndLogin(BASE_URL, uniqueEmail('ctrnest'), db);
    token = owner.accessToken;
    workspaceId = await createTeamWorkspace(
      BASE_URL,
      token,
      uniqueName('CTRNEST'),
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

  async function countRuns(
    executionId: string,
    nodeId: string,
  ): Promise<number> {
    const r = await db.query<{ n: string }>(
      `SELECT COUNT(*)::text AS n FROM node_execution
         WHERE execution_id = $1 AND node_id = $2 AND status = 'completed'`,
      [executionId, nodeId],
    );
    return Number(r.rows[0].n);
  }

  // Background 본문은 메인 실행이 끝난 뒤에도 워커에서 돈다. 기대 횟수에 닿을 때까지 기다린다.
  async function waitForRuns(
    executionId: string,
    nodeId: string,
    expected: number,
  ): Promise<number> {
    const start = Date.now();
    let n = 0;
    while (Date.now() - start < 20_000) {
      n = await countRuns(executionId, nodeId);
      if (n >= expected) return n;
      await new Promise((r) => setTimeout(r, 200));
    }
    return n;
  }

  async function readOutput(
    executionId: string,
    nodeId: string,
  ): Promise<Record<string, unknown>> {
    const r = await db.query<{
      output_data: { output?: Record<string, unknown> };
    }>(
      `SELECT output_data FROM node_execution
         WHERE execution_id = $1 AND node_id = $2
         ORDER BY started_at DESC LIMIT 1`,
      [executionId, nodeId],
    );
    expect(r.rows.length).toBe(1);
    return r.rows[0].output_data?.output ?? {};
  }

  type SaveNode = {
    id: string;
    type: string;
    category: string;
    label: string;
    containerId?: string;
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
          positionY: n.containerId ? 80 : 0,
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
  const code = (id: string, body: string): SaveNode => ({
    id,
    type: 'code',
    category: 'data',
    label: 'Code',
    config: { language: 'javascript', code: body, timeout: 5 },
  });
  const transform = (
    id: string,
    label: string,
    containerId?: string,
  ): SaveNode => ({
    id,
    type: 'transform',
    category: 'data',
    label,
    ...(containerId ? { containerId } : {}),
    config: {
      operations: [{ type: 'set_field', field: 'seen', value: label }],
    },
  });
  const foreach = (
    id: string,
    label: string,
    arrayField: string,
    containerId?: string,
  ): SaveNode => ({
    id,
    type: 'foreach',
    category: 'logic',
    label,
    ...(containerId ? { containerId } : {}),
    config: { arrayField, errorPolicy: 'stop' },
  });

  it('runs the inner ForEach body for every outer iteration', async () => {
    const [startId, codeId, outerId, innerId, leafId, collectId, echoId] =
      Array.from({ length: 7 }, () => randomUUID());

    const { executionId, status } = await saveAndRun(
      'ctrnest-foreach',
      [
        trigger(startId),
        code(
          codeId,
          'return { groups: [{ list: [{ v: 1 }, { v: 2 }] }, { list: [{ v: 3 }] }] };',
        ),
        foreach(outerId, 'Outer', '{{ $node["Code"].output.groups }}'),
        foreach(innerId, 'Inner', 'list', outerId),
        transform(leafId, 'Leaf', innerId),
        transform(collectId, 'Collect', outerId),
        // 컨테이너 출력은 다운스트림 식으로 읽는다(container-array-input-meta 와 같은 방식).
        {
          id: echoId,
          type: 'transform',
          category: 'data',
          label: 'Echo',
          config: {
            operations: [
              {
                type: 'set_field',
                field: 'count',
                value: '{{ $node["Outer"].output.count }}',
              },
            ],
          },
        },
      ],
      [
        [startId, 'out', codeId, 'in'],
        [codeId, 'success', outerId, 'in'],
        [outerId, 'body', innerId, 'in'],
        [innerId, 'body', leafId, 'in'],
        [leafId, 'out', innerId, 'emit'],
        [innerId, 'done', collectId, 'in'],
        [collectId, 'out', outerId, 'emit'],
        [outerId, 'done', echoId, 'in'],
      ],
    );

    expect(status).toBe('completed');
    // 안쪽 본문은 바깥 회차마다 그 회차의 항목 수만큼 돈다(2 + 1).
    expect(await countRuns(executionId, leafId)).toBe(3);
    expect(await countRuns(executionId, collectId)).toBe(2);
    const echo = await readOutput(executionId, echoId);
    expect(echo.count).toBe(2);
  }, 60_000);

  it('enqueues and runs a Background body for every ForEach iteration', async () => {
    const [startId, codeId, feId, bgId, afterId, bgBodyId, echoId] = Array.from(
      { length: 7 },
      () => randomUUID(),
    );

    const { executionId, status } = await saveAndRun(
      'ctrnest-background',
      [
        trigger(startId),
        code(codeId, 'return { items: [{ n: 1 }, { n: 2 }] };'),
        foreach(feId, 'Each', '{{ $node["Code"].output.items }}'),
        {
          id: bgId,
          type: 'background',
          category: 'logic',
          label: 'Background',
          containerId: feId,
          config: { notifyOnFailure: false, maxDurationMs: 30_000 },
        },
        transform(afterId, 'After', feId),
        // 에디터는 연결선 체인 규칙으로 Background 뒤 노드에도 같은 컨테이너 소속을 준다.
        // 본문 노드는 큐에 넣은 회차의 반복 변수를 식으로 읽는다(질문 01a1cd70 답 A).
        {
          id: bgBodyId,
          type: 'transform',
          category: 'data',
          label: 'BgBody',
          containerId: feId,
          config: {
            operations: [
              { type: 'set_field', field: 'seen', value: '{{ $item.n }}' },
            ],
          },
        },
        transform(echoId, 'Echo'),
      ],
      [
        [startId, 'out', codeId, 'in'],
        [codeId, 'success', feId, 'in'],
        [feId, 'body', bgId, 'in'],
        [bgId, 'main', afterId, 'in'],
        [bgId, 'background', bgBodyId, 'in'],
        [afterId, 'out', feId, 'emit'],
        [feId, 'done', echoId, 'in'],
      ],
    );

    expect(status).toBe('completed');
    expect(await countRuns(executionId, afterId)).toBe(2);
    // 회차마다 큐에 들어간 본문을 워커가 컨테이너 단계의 그래프로 실행한다.
    expect(await waitForRuns(executionId, bgBodyId, 2)).toBe(2);
    // 본문은 자기를 큐에 넣은 회차의 $item 을 읽는다. 두 작업의 실행 순서는 정해져
    // 있지 않아 정렬해서 본다.
    const seen = await db.query<{
      output_data: { output?: { seen?: unknown } };
    }>(
      `SELECT output_data FROM node_execution
         WHERE execution_id = $1 AND node_id = $2 AND status = 'completed'`,
      [executionId, bgBodyId],
    );
    expect(seen.rows.map((r) => r.output_data?.output?.seen).sort()).toEqual([
      1, 2,
    ]);
  }, 60_000);
});
