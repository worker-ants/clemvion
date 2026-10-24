import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { randomUUID } from 'crypto';
import { Client } from 'pg';
import request from 'supertest';

import { createDbClient, uniqueEmail, uniqueName } from './helpers/db';
import { registerAndLogin, createTeamWorkspace } from './helpers/auth';

/**
 * e2e: Map · ForEach 의 배열 입력과 완료 meta([Logic 노드 공통 「배열이 아닌 입력 처리」](CLE-NODE-LOGIC-COMMON#배열이-아닌-입력-처리)).
 *
 * 실제 실행(save → execute → engine → 표현식 해석)에서 두 가지를 본다.
 *
 * 1. **입력 배열을 그대로 돈다**: 컨테이너 핸들러가 입력 배열과 함께 `meta` 를
 *    돌려줘도 컨테이너가 그 배열을 돈다. 엔진의 flat 캐시가 meta 만 보고 출력을
 *    `{ data: [...] }` 로 감싸 구조화 캐시의 output 까지 바꾸던 회귀를 막는다.
 *    상류 Code 는 배열을 객체에 담아 돌려준다. Code 가 배열을 그대로 돌려주면
 *    `port: 'success'` 때문에 다운스트림이 `{ data: [...] }` 를 보는 별도 결함이 있어서다
 *    (레거시 `{ port, data }` 봉투, NERV Task CLE-T-T30D5S).
 * 2. **비배열 입력은 meta 로 알린다**: 배열 경로가 원시값 · 객체로 풀리면 바디를 돌지
 *    않고 `meta.fellBackToEmpty: true` 를 남긴다. 다운스트림은
 *    `$node["<컨테이너>"].meta.*` 로 읽는다.
 */

const BASE_URL = process.env.E2E_BASE_URL ?? 'http://backend-e2e:3011';
const TERMINAL = ['completed', 'failed', 'cancelled'];

type ContainerType = 'map' | 'foreach';

describe('Container array input and completion meta (e2e)', () => {
  let db: Client;
  let token: string;
  let workspaceId: string;

  beforeAll(async () => {
    db = createDbClient();
    await db.connect();
    const owner = await registerAndLogin(BASE_URL, uniqueEmail('ctrmeta'), db);
    token = owner.accessToken;
    workspaceId = await createTeamWorkspace(
      BASE_URL,
      token,
      uniqueName('CTRMETA'),
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

  async function countBodyRuns(
    executionId: string,
    bodyId: string,
  ): Promise<number> {
    const r = await db.query<{ n: string }>(
      `SELECT COUNT(*)::text AS n FROM node_execution
         WHERE execution_id = $1 AND node_id = $2`,
      [executionId, bodyId],
    );
    return Number(r.rows[0].n);
  }

  // Start → Code(return <codeBody>) → <컨테이너>(배열 경로) ⟲ Body → Echo
  // Echo 는 사용자가 쓸 표현식 그대로 컨테이너의 output · meta 를 옮겨 적는다.
  async function runGraph(
    type: ContainerType,
    codeBody: string,
    arrayExpr: string,
  ): Promise<{
    executionId: string;
    bodyId: string;
    echoId: string;
    status: string;
  }> {
    const created = await request(BASE_URL)
      .post('/api/workflows')
      .set(auth())
      .set('X-Workspace-Id', workspaceId)
      .send({ name: uniqueName(`ctrmeta-${type}`) });
    expect(created.status).toBe(201);
    const workflowId = created.body.data.id as string;

    const triggerId = randomUUID();
    const codeId = randomUUID();
    const ctrId = randomUUID();
    const bodyId = randomUUID();
    const echoId = randomUUID();
    const ctrLabel = type === 'map' ? 'Map' : 'ForEach';
    const collection = type === 'map' ? 'mapped' : 'items';

    const save = await request(BASE_URL)
      .post(`/api/workflows/${workflowId}/save`)
      .set(auth())
      .set('X-Workspace-Id', workspaceId)
      .send({
        nodes: [
          {
            id: triggerId,
            type: 'manual_trigger',
            category: 'trigger',
            label: 'Start',
            positionX: 0,
            positionY: 0,
            config: {},
          },
          {
            id: codeId,
            type: 'code',
            category: 'data',
            label: 'Code',
            positionX: 200,
            positionY: 0,
            config: { language: 'javascript', code: codeBody, timeout: 5 },
          },
          {
            id: ctrId,
            type,
            category: 'logic',
            label: ctrLabel,
            positionX: 400,
            positionY: 0,
            config:
              type === 'map'
                ? { inputField: arrayExpr, errorPolicy: 'stop' }
                : { arrayField: arrayExpr, errorPolicy: 'stop' },
          },
          {
            id: bodyId,
            type: 'transform',
            category: 'data',
            label: 'Body',
            positionX: 440,
            positionY: 80,
            containerId: ctrId,
            config: {
              operations: [{ type: 'set_field', field: 'seen', value: 'yes' }],
            },
          },
          {
            id: echoId,
            type: 'transform',
            category: 'data',
            label: 'Echo',
            positionX: 640,
            positionY: 0,
            config: {
              operations: [
                {
                  type: 'set_field',
                  field: 'fell',
                  value: `{{$node["${ctrLabel}"].meta.fellBackToEmpty}}`,
                },
                {
                  type: 'set_field',
                  field: 'iterations',
                  value: `{{$node["${ctrLabel}"].meta.iterations}}`,
                },
                {
                  type: 'set_field',
                  field: 'count',
                  value: `{{$node["${ctrLabel}"].output.count}}`,
                },
                {
                  type: 'set_field',
                  field: 'first',
                  value: `{{$node["${ctrLabel}"].output.${collection}[0]}}`,
                },
              ],
            },
          },
        ],
        edges: [
          {
            sourceNodeId: triggerId,
            sourcePort: 'out',
            targetNodeId: codeId,
            targetPort: 'in',
          },
          {
            // Code 노드의 출력 포트는 `success` 하나다(code.schema.ts).
            sourceNodeId: codeId,
            sourcePort: 'success',
            targetNodeId: ctrId,
            targetPort: 'in',
          },
          {
            sourceNodeId: ctrId,
            sourcePort: 'body',
            targetNodeId: bodyId,
            targetPort: 'in',
          },
          {
            sourceNodeId: bodyId,
            sourcePort: 'out',
            targetNodeId: ctrId,
            targetPort: 'emit',
          },
          {
            sourceNodeId: ctrId,
            sourcePort: 'done',
            targetNodeId: echoId,
            targetPort: 'in',
          },
        ],
      });
    expect(save.status).toBe(200);

    const exec = await request(BASE_URL)
      .post(`/api/workflows/${workflowId}/execute`)
      .set(auth())
      .set('X-Workspace-Id', workspaceId)
      .send({});
    expect(exec.status).toBe(202);
    const executionId = exec.body.data.executionId as string;
    const status = await poll(executionId);
    return { executionId, bodyId, echoId, status };
  }

  it.each<ContainerType>(['map', 'foreach'])(
    '%s iterates an upstream array and reports fellBackToEmpty=false',
    async (type) => {
      const { executionId, bodyId, echoId, status } = await runGraph(
        type,
        'return { items: [{ v: 1 }, { v: 2 }, { v: 3 }] };',
        '{{ $node["Code"].output.items }}',
      );
      expect(status).toBe('completed');
      expect(await countBodyRuns(executionId, bodyId)).toBe(3);
      const echo = await readOutput(executionId, echoId);
      expect(echo.fell).toBe(false);
      expect(echo.iterations).toBe(3);
      expect(echo.count).toBe(3);
      expect(echo.first).toEqual({ v: 1, seen: 'yes' });
    },
    60_000,
  );

  it.each<ContainerType>(['map', 'foreach'])(
    '%s skips the body for a non-array path and reports fellBackToEmpty=true',
    async (type) => {
      const { executionId, bodyId, echoId, status } = await runGraph(
        type,
        'return { items: 42 };',
        'items',
      );
      expect(status).toBe('completed');
      expect(await countBodyRuns(executionId, bodyId)).toBe(0);
      const echo = await readOutput(executionId, echoId);
      expect(echo.fell).toBe(true);
      expect(echo.iterations).toBe(0);
      expect(echo.count).toBe(0);
    },
    60_000,
  );
});
