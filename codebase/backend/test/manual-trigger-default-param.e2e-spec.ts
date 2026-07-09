import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { randomUUID } from 'crypto';
import { Client } from 'pg';
import request from 'supertest';

import { createDbClient, uniqueEmail, uniqueName } from './helpers/db';
import { registerAndLogin, createTeamWorkspace } from './helpers/auth';

/**
 * e2e: spec/4-nodes/7-trigger/1-manual-trigger.md §4/§5.1 — Manual Trigger 의
 * `defaultValue` 가 실제 실행(save → execute → engine)에서 해석되어
 * 다운스트림 노드가 `$node["Start"].output.parameters.<name>` / `$params.<name>`
 * 표현식으로 값을 읽을 수 있는지. 이 경로에는 e2e 커버리지가 없었고, 파라미터가
 * 저장돼 있어도 트리거 노드를 `type='manual_trigger'` 로 조회하지 못하면
 * (category 누락 데이터) default 가 통째로 사라지던 회귀의 방어선이다.
 *
 * trigger-only 대신 trigger→transform 그래프를 쓴다: 단일 노드 워크플로우는
 * 실행이 너무 빨라 e2e 인프라의 stalled-redelivery 를 유발(재진입 경로에서
 * $input 미해소, documented limit)하므로, 다운스트림 노드로 표현식 해석을
 * 검증하는 편이 실제 사용 경로에 가깝고 안정적이다.
 */

const BASE_URL = process.env.E2E_BASE_URL ?? 'http://backend-e2e:3011';
const TERMINAL = ['completed', 'failed', 'cancelled'];

describe('Manual Trigger defaultValue (e2e)', () => {
  let db: Client;
  let token: string;
  let workspaceId: string;

  beforeAll(async () => {
    db = createDbClient();
    await db.connect();
    const owner = await registerAndLogin(
      BASE_URL,
      uniqueEmail('mtdefault'),
      db,
    );
    token = owner.accessToken;
    workspaceId = await createTeamWorkspace(
      BASE_URL,
      token,
      uniqueName('MTDEF'),
    );
  }, 60_000);

  afterAll(async () => {
    if (db) await db.end();
  });

  const auth = () => ({ Authorization: `Bearer ${token}` });

  async function poll(executionId: string): Promise<string> {
    const start = Date.now();
    let last = '';
    while (Date.now() - start < 15_000) {
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

  async function readTransformOutput(
    executionId: string,
    transformId: string,
  ): Promise<Record<string, unknown>> {
    const r = await db.query<{
      output_data: { output?: Record<string, unknown> };
    }>(
      `SELECT output_data FROM node_execution
         WHERE execution_id = $1 AND node_id = $2
         ORDER BY started_at DESC LIMIT 1`,
      [executionId, transformId],
    );
    expect(r.rows.length).toBe(1);
    return r.rows[0].output_data?.output ?? {};
  }

  // manual_trigger("Start", param region default 인천) → transform echoing the
  // resolved value via the exact expressions a user would write.
  async function setupGraph(): Promise<{
    workflowId: string;
    transformId: string;
  }> {
    const created = await request(BASE_URL)
      .post('/api/workflows')
      .set(auth())
      .set('X-Workspace-Id', workspaceId)
      .send({ name: uniqueName('mtdef-wf') });
    expect(created.status).toBe(201);
    const workflowId = created.body.data.id as string;

    const triggerId = randomUUID();
    const transformId = randomUUID();
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
            config: {
              parameters: [
                {
                  name: 'region',
                  type: 'string',
                  required: false,
                  defaultValue: '인천',
                },
              ],
            },
          },
          {
            id: transformId,
            type: 'transform',
            category: 'data',
            label: 'Echo',
            positionX: 240,
            positionY: 0,
            config: {
              operations: [
                {
                  type: 'set_field',
                  field: 'viaNode',
                  value: '{{$node["Start"].output.parameters.region}}',
                },
                {
                  type: 'set_field',
                  field: 'viaParams',
                  value: '{{$params.region}}',
                },
              ],
            },
          },
        ],
        edges: [
          {
            sourceNodeId: triggerId,
            sourcePort: 'out',
            targetNodeId: transformId,
            targetPort: 'in',
          },
        ],
      });
    expect([200, 201]).toContain(save.status);
    return { workflowId, transformId };
  }

  it('resolves defaultValue and exposes it to downstream $node / $params expressions', async () => {
    const { workflowId, transformId } = await setupGraph();

    const exec = await request(BASE_URL)
      .post(`/api/workflows/${workflowId}/execute`)
      .set(auth())
      .set('X-Workspace-Id', workspaceId)
      .send({});
    expect(exec.status).toBe(202);
    const executionId = exec.body.data.executionId as string;

    expect(await poll(executionId)).toBe('completed');
    const out = await readTransformOutput(executionId, transformId);
    expect(out.viaNode).toBe('인천');
    expect(out.viaParams).toBe('인천');
  }, 40_000);

  it('an explicit parameterValue overrides the default downstream', async () => {
    const { workflowId, transformId } = await setupGraph();

    const exec = await request(BASE_URL)
      .post(`/api/workflows/${workflowId}/execute`)
      .set(auth())
      .set('X-Workspace-Id', workspaceId)
      .send({ parameterValues: { region: '서울' } });
    expect(exec.status).toBe(202);
    const executionId = exec.body.data.executionId as string;

    expect(await poll(executionId)).toBe('completed');
    const out = await readTransformOutput(executionId, transformId);
    expect(out.viaNode).toBe('서울');
    expect(out.viaParams).toBe('서울');
  }, 40_000);

  it('rejects saving a malformed parameter definition (empty name) with 400', async () => {
    const created = await request(BASE_URL)
      .post('/api/workflows')
      .set(auth())
      .set('X-Workspace-Id', workspaceId)
      .send({ name: uniqueName('mtdef-bad') });
    const workflowId = created.body.data.id as string;

    const save = await request(BASE_URL)
      .post(`/api/workflows/${workflowId}/save`)
      .set(auth())
      .set('X-Workspace-Id', workspaceId)
      .send({
        nodes: [
          {
            id: randomUUID(),
            type: 'manual_trigger',
            category: 'trigger',
            label: 'Start',
            positionX: 0,
            positionY: 0,
            config: { parameters: [{ name: '', type: 'string' }] },
          },
        ],
        edges: [],
      });
    expect(save.status).toBe(400);
    expect(save.body.error?.code).toBe('INVALID_TRIGGER_PARAMETERS');
  }, 40_000);
});
