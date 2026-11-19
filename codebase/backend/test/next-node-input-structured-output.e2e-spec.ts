import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { randomUUID } from 'crypto';
import { Client } from 'pg';
import request from 'supertest';

import { createDbClient, uniqueEmail, uniqueName } from './helpers/db';
import { registerAndLogin, createTeamWorkspace } from './helpers/auth';

/**
 * e2e: 다음 노드 `$input` 은 앞 노드의 핸들러 `output` 이다 (NERV Task CLE-T-ZJR3AF).
 *
 * 실제 실행(save → execute → engine)에서 포트와 함께 나온 객체 출력 안에 `data` 키가 있어도
 * 다음 노드가 그 객체를 그대로 받는지 본다. 예전에는 엔진 flat 캐시에서 `data` 안의 키를
 * 펼치고 `status` 를 뗀 값을 받았다(CLE-NODE-OUTPUT Principle 0 7번, 질문 답 A).
 */

const BASE_URL = process.env.E2E_BASE_URL ?? 'http://backend-e2e:3011';
const TERMINAL = ['completed', 'failed', 'cancelled'];

describe('Next node input reads the handler output (e2e)', () => {
  let db: Client;
  let token: string;
  let workspaceId: string;

  beforeAll(async () => {
    db = createDbClient();
    await db.connect();
    const owner = await registerAndLogin(BASE_URL, uniqueEmail('nextin'), db);
    token = owner.accessToken;
    workspaceId = await createTeamWorkspace(
      BASE_URL,
      token,
      uniqueName('NEXTIN'),
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

  it('passes an object output with a port and a data key to the next node as is', async () => {
    const [startId, codeId, afterId] = Array.from({ length: 3 }, () =>
      randomUUID(),
    );

    const created = await request(BASE_URL)
      .post('/api/workflows')
      .set(auth())
      .set('X-Workspace-Id', workspaceId)
      .send({ name: uniqueName('nextin') });
    expect(created.status).toBe(201);
    const workflowId = created.body.data.id as string;

    const save = await request(BASE_URL)
      .post(`/api/workflows/${workflowId}/save`)
      .set(auth())
      .set('X-Workspace-Id', workspaceId)
      .send({
        nodes: [
          {
            id: startId,
            type: 'manual_trigger',
            category: 'trigger',
            label: 'Start',
            config: {},
          },
          {
            id: codeId,
            type: 'code',
            category: 'data',
            label: 'Code',
            config: {
              language: 'javascript',
              code: 'return { status: 200, data: { a: 1 } };',
              timeout: 5,
            },
          },
          // Transform 은 입력을 복사한 뒤 필드를 더하므로 출력에 받은 입력이 그대로 남는다.
          {
            id: afterId,
            type: 'transform',
            category: 'data',
            label: 'After',
            config: {
              operations: [
                {
                  type: 'set_field',
                  field: 'fromNode',
                  value: '{{ $node["Code"].output.data.a }}',
                },
              ],
            },
          },
        ].map((n, i) => ({ ...n, positionX: i * 200, positionY: 0 })),
        edges: [
          {
            sourceNodeId: startId,
            sourcePort: 'out',
            targetNodeId: codeId,
            targetPort: 'in',
          },
          {
            sourceNodeId: codeId,
            sourcePort: 'success',
            targetNodeId: afterId,
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
    expect(await poll(executionId)).toBe('completed');

    const r = await db.query<{
      output_data: { output?: Record<string, unknown> };
    }>(
      `SELECT output_data FROM node_execution
         WHERE execution_id = $1 AND node_id = $2 AND status = 'completed'`,
      [executionId, afterId],
    );
    expect(r.rows).toHaveLength(1);
    // `$input` 은 Code 의 output 그대로다. `data` 를 펼치지 않고 `status` 도 남는다.
    const after = r.rows[0].output_data.output ?? {};
    expect(after).toEqual({
      status: 200,
      data: { a: 1 },
      fromNode: expect.anything(),
    });
    expect(String(after.fromNode)).toBe('1');
  }, 60_000);
});
