import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { randomUUID } from 'crypto';
import { Client } from 'pg';
import request from 'supertest';

import { createDbClient, uniqueEmail, uniqueName } from './helpers/db';
import { registerAndLogin, createTeamWorkspace } from './helpers/auth';

/**
 * e2e: spec/5-system/4-execution-engine.md §8 (PR2b — 동시성 cap admission gate).
 *
 * admission gate 의 원자 cap 검증·delayed 재큐·5분 queue-wait cancel 은 multi-actor
 * (동시 running Execution)·타이밍 의존이라 유닛 mock 으로 실증 불가 → e2e 로 검증한다.
 *
 * 시나리오(per-workflow cap=1):
 *  (1) 같은 workflow 에 running Execution 을 1개 심어(DB) cap 슬롯을 소비한 상태에서
 *      새 실행을 시작 → admission 이 cap 초과로 deferred → 새 실행은 `pending` 유지.
 *  (2-A) blocker 를 completed 로 풀면 → 재큐 tick 에 admitted → 새 실행 completed.
 *  (2-B) blocker 를 유지하면 → 큐 대기(EXECUTION_QUEUE_WAIT_TIMEOUT_MS, e2e 8초) 초과 →
 *        새 실행 cancelled + error.code='EXECUTION_QUEUE_WAIT_TIMEOUT'.
 *
 * docker-compose.e2e.yml 에서 EXECUTION_QUEUE_WAIT_TIMEOUT_MS=8000 으로 단축(기본 5분).
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
describe('동시성 cap admission gate (e2e, PR2b §8)', () => {
  let db: Client;
  let ownerToken: string;
  let workspaceId: string;

  beforeAll(async () => {
    db = createDbClient();
    await db.connect();
    const owner = await registerAndLogin(BASE_URL, uniqueEmail('cap'), db);
    ownerToken = owner.accessToken;
    workspaceId = await createTeamWorkspace(
      BASE_URL,
      ownerToken,
      uniqueName('CAP'),
    );
  }, 60_000);

  afterAll(async () => {
    if (db) await db.end();
  });

  const authHeader = () => ({ Authorization: `Bearer ${ownerToken}` });

  async function createCapWorkflow(): Promise<string> {
    const res = await request(BASE_URL)
      .post('/api/workflows')
      .set(authHeader())
      .set('X-Workspace-Id', workspaceId)
      .send({ name: uniqueName('cap-wf') });
    expect(res.status).toBe(201);
    const workflowId = res.body.data.id as string;

    const trigger: CanvasNode = {
      id: randomUUID(),
      type: MANUAL_TRIGGER_TYPE,
      category: 'trigger',
      label: 'Start',
      positionX: 0,
      positionY: 0,
    };
    const code: CanvasNode = {
      id: randomUUID(),
      type: 'code',
      category: 'data',
      label: 'Run',
      positionX: 240,
      positionY: 0,
      config: {
        language: 'javascript',
        code: 'return { ok: true };',
        timeout: 5,
      },
    };
    const save = await request(BASE_URL)
      .post(`/api/workflows/${workflowId}/save`)
      .set(authHeader())
      .set('X-Workspace-Id', workspaceId)
      .send({
        nodes: [trigger, code],
        edges: [
          {
            sourceNodeId: trigger.id,
            sourcePort: 'out',
            targetNodeId: code.id,
            targetPort: 'in',
          },
        ],
      });
    expect([200, 201]).toContain(save.status);

    // per-workflow cap=1 (DB 직접 — settings write API 는 별도 테스트 범위).
    await db.query(
      `UPDATE workflow SET settings = '{"maxConcurrentExecutions":1}'::jsonb WHERE id = $1`,
      [workflowId],
    );
    return workflowId;
  }

  // cap 슬롯을 소비할 running Execution 을 DB 에 직접 심는다(blocker).
  async function insertRunningBlocker(workflowId: string): Promise<string> {
    const id = randomUUID();
    await db.query(
      `INSERT INTO execution (id, workflow_id, status, started_at, queued_at)
       VALUES ($1, $2, 'running', NOW(), NOW())`,
      [id, workflowId],
    );
    return id;
  }

  async function execute(workflowId: string): Promise<string> {
    const res = await request(BASE_URL)
      .post(`/api/workflows/${workflowId}/execute`)
      .set(authHeader())
      .set('X-Workspace-Id', workspaceId)
      .send({});
    expect(res.status).toBe(202);
    return (res.body.data as { executionId: string }).executionId;
  }

  async function getStatus(executionId: string): Promise<string> {
    const res = await request(BASE_URL)
      .get(`/api/executions/${executionId}`)
      .set(authHeader())
      .set('X-Workspace-Id', workspaceId);
    return res.status === 200
      ? (res.body.data as { status: string }).status
      : '';
  }

  async function poll(
    executionId: string,
    predicate: (s: string) => boolean,
    timeoutMs = 20_000,
  ): Promise<string> {
    const start = Date.now();
    let last = '';
    while (Date.now() - start < timeoutMs) {
      last = await getStatus(executionId);
      if (predicate(last)) return last;
      await new Promise((r) => setTimeout(r, 200));
    }
    throw new Error(`poll timed out at status=${last} (exec=${executionId})`);
  }

  it('cap 초과 → pending 대기 → 슬롯 해제 시 admitted (재큐)', async () => {
    const workflowId = await createCapWorkflow();
    const blocker = await insertRunningBlocker(workflowId);

    // cap(1) 이 blocker 로 소진된 상태에서 실행 → admission deferred → pending.
    const execId = await execute(workflowId);

    // 잠시 대기해도 running/terminal 로 넘어가지 않고 pending 유지(admission 차단).
    await new Promise((r) => setTimeout(r, 1500));
    expect(await getStatus(execId)).toBe('pending');

    // 슬롯 해제 → 재큐 tick 에 admitted → 정상 완료.
    await db.query(
      `UPDATE execution SET status = 'completed', finished_at = NOW() WHERE id = $1`,
      [blocker],
    );
    const done = await poll(
      execId,
      (s) => TERMINAL_STATUSES.includes(s as never),
      20_000,
    );
    expect(done).toBe('completed');
  }, 40_000);

  it('cap 초과 지속 → 큐 대기 초과 시 cancelled + EXECUTION_QUEUE_WAIT_TIMEOUT', async () => {
    const workflowId = await createCapWorkflow();
    await insertRunningBlocker(workflowId); // 계속 running 유지(해제 안 함)

    const execId = await execute(workflowId);

    // EXECUTION_QUEUE_WAIT_TIMEOUT_MS(e2e 8초) 초과 → cancelled.
    const final = await poll(execId, (s) => s === 'cancelled', 20_000);
    expect(final).toBe('cancelled');

    const row = await db.query(`SELECT error FROM execution WHERE id = $1`, [
      execId,
    ]);
    expect(JSON.stringify(row.rows[0]?.error ?? {})).toContain(
      'EXECUTION_QUEUE_WAIT_TIMEOUT',
    );
  }, 40_000);
});
