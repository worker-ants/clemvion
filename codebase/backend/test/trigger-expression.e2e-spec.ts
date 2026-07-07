import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { randomUUID } from 'node:crypto';
import { Client } from 'pg';
import request from 'supertest';

import { createDbClient, uniqueEmail, uniqueName } from './helpers/db';
import { registerAndLogin, createTeamWorkspace } from './helpers/auth';

/**
 * e2e: `$trigger` / `$env` 런타임 주입 — spec/5-system/5-expression-language.md §4.5.
 *
 * unit(expression-resolver.service.spec, trigger-data.util.spec)이 뷰 빌드·추출
 * 로직을 보장하는 것과 별개로, 본 e2e 는 **cross-stack 배선**을 검증한다:
 *   webhook HTTP 인입 → Execution.inputData(`__triggerSource='webhook'` + transport)
 *   영속 → BullMQ 워커 실행 → ExecutionContext.triggerData 주입 →
 *   하위 노드 config 표현식 `{{ $trigger.body.* }}` 해소.
 *
 * A. webhook body/method 가 하위 Transform 노드의 `set_field` value 표현식에서 해소돼
 *    node_execution.output_data 에 반영되는지 (positive).
 * B. manual 실행(transport 부재)에서 `$trigger`/`$env` 가 `{}` 로 graceful 하게 떨어져
 *    1-level 접근이 EXPR_REFERENCE_ERROR 없이 completed 에 도달하는지 (regression).
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

describe('$trigger / $env expression injection (e2e)', () => {
  let db: Client;
  let token: string;
  let workspaceId: string;

  beforeAll(async () => {
    db = createDbClient();
    await db.connect();
    const owner = await registerAndLogin(BASE_URL, uniqueEmail('trigexpr'), db);
    token = owner.accessToken;
    workspaceId = await createTeamWorkspace(
      BASE_URL,
      token,
      uniqueName('TRIGEXPR'),
    );
  }, 60_000);

  afterAll(async () => {
    if (db) await db.end();
  });

  const authHeader = () => ({ Authorization: `Bearer ${token}` });

  async function createWorkflow(): Promise<string> {
    const res = await request(BASE_URL)
      .post('/api/workflows')
      .set(authHeader())
      .set('X-Workspace-Id', workspaceId)
      .send({ name: uniqueName('trigexpr-wf') });
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
      .set(authHeader())
      .set('X-Workspace-Id', workspaceId)
      .send({ nodes, edges });
    expect([200, 201]).toContain(res.status);
  }

  async function createWebhookTrigger(
    workflowId: string,
    endpointPath: string,
  ): Promise<void> {
    const res = await request(BASE_URL)
      .post('/api/triggers')
      .set(authHeader())
      .set('X-Workspace-Id', workspaceId)
      .send({
        workflowId,
        type: 'webhook',
        name: uniqueName('trigexpr-hook'),
        endpointPath,
        isActive: true,
      });
    expect(res.status).toBe(201);
  }

  /** manual_trigger → transform(set_field ops) 2-노드 그래프를 구성한다. */
  function buildGraph(setFieldOps: Array<{ field: string; value: unknown }>): {
    nodes: CanvasNode[];
    edges: CanvasEdge[];
    transformId: string;
  } {
    const trigger: CanvasNode = {
      id: randomUUID(),
      type: MANUAL_TRIGGER_TYPE,
      category: 'trigger',
      label: 'Start',
      positionX: 0,
      positionY: 0,
    };
    const transform: CanvasNode = {
      id: randomUUID(),
      type: 'transform',
      category: 'data',
      label: 'Echo',
      positionX: 240,
      positionY: 0,
      config: {
        operations: setFieldOps.map((op) => ({ type: 'set_field', ...op })),
      },
    };
    return {
      nodes: [trigger, transform],
      edges: [
        {
          sourceNodeId: trigger.id,
          sourcePort: 'out',
          targetNodeId: transform.id,
          targetPort: 'in',
        },
      ],
      transformId: transform.id,
    };
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

  /**
   * Transform 핸들러의 `output` 서브객체를 조회한다. node_execution.output_data 는
   * NodeHandlerOutput 봉투 `{ meta, config, output }` 형태로 영속되므로, set_field 가
   * 반영된 실제 데이터는 `.output` 아래에 있다 (API 노출 형태와 무관한 durable 진실).
   */
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

  it('A. webhook transport(body/method)가 하위 Transform config 표현식에서 해소돼 output 에 반영', async () => {
    const workflowId = await createWorkflow();
    const { nodes, edges, transformId } = buildGraph([
      { field: 'echoedEvent', value: '{{ $trigger.body.event }}' },
      { field: 'echoedMethod', value: '{{ $trigger.method }}' },
    ]);
    await saveCanvas(workflowId, nodes, edges);

    const path = randomUUID(); // endpoint_path 는 v4 UUID 강제
    await createWebhookTrigger(workflowId, path);

    const res = await request(BASE_URL)
      .post(`/api/hooks/${path}`)
      .send({ event: 'push' });
    expect(res.status).toBe(202);
    const executionId = (res.body.data as { executionId: string }).executionId;
    expect(executionId).toBeDefined();

    const status = await poll(executionId, (s) =>
      TERMINAL_STATUSES.includes(s as never),
    );
    expect(status).toBe('completed');

    const output = await readTransformOutput(executionId, transformId);
    // $trigger.body.event → webhook JSON body 에서 해소
    expect(output.echoedEvent).toBe('push');
    // $trigger.method → HTTP 메서드
    expect(output.echoedMethod).toBe('POST');
  }, 30_000);

  it('B. manual 실행은 $trigger/$env 가 {} 로 graceful — 1-level 접근이 throw 없이 completed', async () => {
    const workflowId = await createWorkflow();
    // 1-level 접근만 사용: `$trigger.body`(→ null), `$env.KEY`(→ null). 최상위
    // `$trigger`/`$env` 가 {} 로 존재하므로 멤버 접근은 EXPR_REFERENCE_ERROR 를
    // 던지지 않는다 (spec §4.5 graceful 계약). 더 깊은 `$trigger.body.x` 는 엔진
    // 공통 규칙상 옵셔널 체이닝이 필요하므로 회귀 대상에서 제외.
    const { nodes, edges, transformId } = buildGraph([
      { field: 'triggerBody', value: '{{ $trigger.body }}' },
      { field: 'envVal', value: '{{ $env.NEVER_SET_ALLOWLIST_KEY }}' },
    ]);
    await saveCanvas(workflowId, nodes, edges);

    const exec = await request(BASE_URL)
      .post(`/api/workflows/${workflowId}/execute`)
      .set(authHeader())
      .set('X-Workspace-Id', workspaceId)
      .send({});
    expect(exec.status).toBe(202);
    const executionId = (exec.body.data as { executionId: string }).executionId;

    const status = await poll(executionId, (s) =>
      TERMINAL_STATUSES.includes(s as never),
    );
    // 핵심 회귀: 표현식이 throw 했다면 노드 에러로 failed 가 됐을 것.
    expect(status).toBe('completed');

    const output = await readTransformOutput(executionId, transformId);
    // 미설정 → null (transport/allowlist 부재의 graceful 표현).
    expect(output.triggerBody ?? null).toBeNull();
    expect(output.envVal ?? null).toBeNull();
  }, 30_000);
});
