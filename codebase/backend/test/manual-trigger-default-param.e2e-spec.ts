import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { randomUUID } from 'crypto';
import { Client } from 'pg';
import request from 'supertest';

import { createDbClient, uniqueEmail, uniqueName } from './helpers/db';
import { registerAndLogin, createTeamWorkspace } from './helpers/auth';

/**
 * e2e: spec/4-nodes/7-trigger/1-manual-trigger.md §4/§5.1 — Manual Trigger 의
 * `defaultValue` 가 실제 실행(save → execute → engine)에서 해석되어 다운스트림
 * 노드가 `$node["Start"].output.parameters.<name>` / `$params.<name>` 표현식으로
 * 값을 읽을 수 있는지. 이 경로에는 e2e 커버리지가 없었다. 두 회귀를 방어한다:
 *
 * 1. **조회**: 파라미터가 저장돼 있어도 트리거를 `type='manual_trigger'` 로
 *    조회하지 못하면(category 누락 데이터) default 가 사라지던 것. 정상 실행
 *    경로(trigger→transform, expression 해석)로 검증.
 * 2. **재진입 durable input**: 크래시/stalled-redelivery re-drive 로 미완료 진입
 *    노드가 재실행될 때 `input:{}` 대신 durable `Execution.inputData` 를 받아야
 *    `output.parameters` 가 보존됨. `_test/simulate-execution-run-redelivery`
 *    훅으로 "트리거 실행 전 크래시" 를 결정적으로 합성해 검증(타이밍 비의존).
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

  async function readTriggerParams(
    executionId: string,
    triggerId: string,
  ): Promise<Record<string, unknown>> {
    const r = await db.query<{
      output_data: { output?: { parameters?: Record<string, unknown> } };
    }>(
      `SELECT output_data FROM node_execution
         WHERE execution_id = $1 AND node_id = $2
         ORDER BY started_at DESC LIMIT 1`,
      [executionId, triggerId],
    );
    expect(r.rows.length).toBe(1);
    return r.rows[0].output_data?.output?.parameters ?? {};
  }

  // manual_trigger("Start", param region default 인천) → transform echoing the
  // resolved value via the exact expressions a user would write.
  async function setupGraph(): Promise<{
    workflowId: string;
    triggerId: string;
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
    return { workflowId, triggerId, transformId };
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

  // Deterministic regression guard for the "진짜 핵심" fix: on re-entry (stalled
  // redelivery re-drive) an entry node that has NOT yet completed must still get
  // the durable Execution.inputData — before the fix it received `{}` and
  // produced output.parameters:{}. We synthesize a crash *before* the trigger
  // (delete its node_execution + set status=running) and drive the
  // NODE_ENV=test-gated redelivery hook, then assert the re-run trigger's
  // output.parameters survives (would be {} without the fix).
  it('re-drive of a not-yet-completed trigger preserves output.parameters (durable input)', async () => {
    const { workflowId, triggerId } = await setupGraph();

    const exec = await request(BASE_URL)
      .post(`/api/workflows/${workflowId}/execute`)
      .set(auth())
      .set('X-Workspace-Id', workspaceId)
      .send({});
    expect(exec.status).toBe(202);
    const executionId = exec.body.data.executionId as string;
    expect(await poll(executionId)).toBe('completed');
    expect(await readTriggerParams(executionId, triggerId)).toEqual({
      region: '인천',
    });

    // Rewind to "worker died before the entry trigger ran": drop the trigger's
    // execution trace and mark the Execution RUNNING so the redelivery hook's
    // RUNNING branch (§7.5 case B) re-drives it as an un-completed frontier.
    await db.query(
      `DELETE FROM node_execution WHERE execution_id = $1 AND node_id = $2`,
      [executionId, triggerId],
    );
    await db.query(
      `DELETE FROM execution_node_log WHERE execution_id = $1 AND node_id = $2`,
      [executionId, triggerId],
    );
    await db.query(
      `UPDATE execution SET status = 'running', finished_at = NULL, output_data = NULL WHERE id = $1`,
      [executionId],
    );

    const redeliver = await request(BASE_URL)
      .post(
        `/api/executions/${executionId}/_test/simulate-execution-run-redelivery`,
      )
      .set(auth())
      .set('X-Workspace-Id', workspaceId)
      .send({});
    expect(redeliver.status).toBe(202);

    // Poll for the re-driven trigger's NEW node_execution row and assert the
    // resolved default survived the re-entry (empty → {} would be the bug).
    const start = Date.now();
    let params: Record<string, unknown> | null = null;
    while (Date.now() - start < 20_000) {
      const r = await db.query<{
        output_data: { output?: { parameters?: Record<string, unknown> } };
      }>(
        `SELECT output_data FROM node_execution
           WHERE execution_id = $1 AND node_id = $2 AND output_data IS NOT NULL
           ORDER BY started_at DESC LIMIT 1`,
        [executionId, triggerId],
      );
      if (r.rows.length === 1) {
        params = r.rows[0].output_data?.output?.parameters ?? {};
        break;
      }
      await new Promise((res) => setTimeout(res, 200));
    }
    expect(params).toEqual({ region: '인천' });
  }, 45_000);

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
