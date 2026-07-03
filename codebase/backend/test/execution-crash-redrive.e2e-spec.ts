import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { randomUUID } from 'crypto';
import { Client } from 'pg';
import request from 'supertest';

import { createDbClient, uniqueEmail, uniqueName } from './helpers/db';
import { registerAndLogin, createTeamWorkspace } from './helpers/auth';

/**
 * e2e: spec/5-system/4-execution-engine.md §7.1 / §7.2 point 3 / §7.5 case B (PR3,
 * 2026-07-04) — 크래시/재시작 RUNNING 세그먼트 제어된 re-drive.
 *
 * 시나리오: 워커가 노드 dispatch 중간에 죽어 Execution 이 stale RUNNING 으로 남은
 * 상태를 재현한다 — 정상 실행으로 완료 prefix(trigger·codeA)를 실제로 만든 뒤,
 * frontier(codeB) 노드를 삭제하고 Execution 을 `running` + `started_at`=31분 전으로
 * 되감아 "codeA 완료 후 codeB 직전 크래시" 를 합성한다. 그 다음 부팅 recovery 를
 * on-demand 트리거(§NODE_ENV=test 게이팅)하면 `recoverStuckExecutions` 가 stale
 * RUNNING 을 원자 re-claim(§7.5 case B) 후 rehydration 으로 재구동한다.
 *
 * 검증: (1) 재구동이 frontier(codeB)를 실행해 무손실 completed 도달,
 *       (2) 완료 노드(trigger·codeA)는 **재실행되지 않음**(node_execution row 수 불변,
 *           §7.2c/§7.3 exactly-once), (3) FAILED(WORKER_HEARTBEAT_TIMEOUT)로 마킹되지
 *           않고 재구동됨(옛 fail-only 회귀 가드).
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

describe('Crash/restart RUNNING 세그먼트 제어된 re-drive (e2e, PR3 §7.5 case B)', () => {
  let db: Client;
  let ownerToken: string;
  let workspaceId: string;

  beforeAll(async () => {
    db = createDbClient();
    await db.connect();
    const owner = await registerAndLogin(BASE_URL, uniqueEmail('redrive'), db);
    ownerToken = owner.accessToken;
    workspaceId = await createTeamWorkspace(
      BASE_URL,
      ownerToken,
      uniqueName('REDRIVE'),
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
      .send({ name: uniqueName('redrive-wf') });
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
    timeoutMs = 20_000,
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

  async function nodeExecRowCount(
    executionId: string,
    nodeId: string,
  ): Promise<number> {
    const r = await db.query(
      `SELECT COUNT(*)::int AS c FROM node_execution
         WHERE execution_id = $1 AND node_id = $2`,
      [executionId, nodeId],
    );
    return (r.rows[0]?.c as number) ?? 0;
  }

  it('stale RUNNING(codeA 완료 후 codeB 직전 크래시)을 re-claim → 재구동해 무손실 completed 하고 완료 노드는 재실행하지 않는다', async () => {
    // 1. trigger → codeA → codeB (둘 다 non-blocking code 노드, 항상 완료).
    const workflowId = await createWorkflow();
    const trigger: CanvasNode = {
      id: randomUUID(),
      type: MANUAL_TRIGGER_TYPE,
      category: 'trigger',
      label: 'Start',
      positionX: 0,
      positionY: 0,
    };
    const codeA: CanvasNode = {
      id: randomUUID(),
      type: 'code',
      category: 'data',
      label: 'Prefix',
      positionX: 240,
      positionY: 0,
      config: {
        language: 'javascript',
        code: 'return { stage: "A" };',
        timeout: 5,
      },
    };
    const code: CanvasNode = {
      id: randomUUID(),
      type: 'code',
      category: 'data',
      label: 'Frontier',
      positionX: 480,
      positionY: 0,
      config: {
        language: 'javascript',
        code: 'return { redriven: true };',
        timeout: 5,
      },
    };
    await saveCanvas(
      workflowId,
      [trigger, codeA, code],
      [
        // manual_trigger 는 'out', code 노드는 성공 시 'success' 포트로 출력한다.
        {
          sourceNodeId: trigger.id,
          sourcePort: 'out',
          targetNodeId: codeA.id,
          targetPort: 'in',
        },
        {
          sourceNodeId: codeA.id,
          sourcePort: 'success',
          targetNodeId: code.id,
          targetPort: 'in',
        },
      ],
    );

    // 2. 정상 실행 → trigger·codeA·codeB 전부 completed. 이로써 실제 완료 row +
    //    execution_node_log 가 생긴다 (code 노드는 park 없이 즉시 완료).
    const execRes = await request(BASE_URL)
      .post(`/api/workflows/${workflowId}/execute`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('X-Workspace-Id', workspaceId)
      .send({});
    expect(execRes.status).toBe(202);
    const executionId = (execRes.body.data as { executionId: string })
      .executionId;

    const doneStatus = await poll(executionId, (s) =>
      TERMINAL_STATUSES.includes(s as never),
    );
    expect(doneStatus).toBe('completed');

    // 완료 prefix row 수 스냅샷(재실행 검증 기준선).
    const triggerCountBefore = await nodeExecRowCount(executionId, trigger.id);
    const codeACountBefore = await nodeExecRowCount(executionId, codeA.id);
    expect(codeACountBefore).toBeGreaterThanOrEqual(1);
    // 전제 확인 — 원 실행에서 frontier(codeB)가 실제로 실행됐다.
    expect(await nodeExecRowCount(executionId, code.id)).toBeGreaterThanOrEqual(
      1,
    );

    // 3. 크래시 합성 — "codeA 완료 후 codeB dispatch 직전 워커 사망" 상태로 되감는다:
    //    frontier(codeB) 실행 흔적 삭제 + Execution 을 stale RUNNING 으로.
    await db.query(
      `DELETE FROM node_execution WHERE execution_id = $1 AND node_id = $2`,
      [executionId, code.id],
    );
    await db.query(
      `DELETE FROM execution_node_log WHERE execution_id = $1 AND node_id = $2`,
      [executionId, code.id],
    );
    await db.query(
      `UPDATE execution
         SET status = 'running',
             finished_at = NULL,
             output_data = NULL,
             started_at = NOW() - INTERVAL '31 minutes'
       WHERE id = $1`,
      [executionId],
    );

    // rewind 가 커밋됐는지 확인(recover 가 running 대상을 봐야 함).
    const afterRewind = await db.query(
      `SELECT status FROM execution WHERE id = $1`,
      [executionId],
    );
    expect(afterRewind.rows[0]?.status).toBe('running');

    // 4. 부팅 recovery on-demand 트리거(§NODE_ENV=test 게이팅). recoverStuckExecutions
    //    가 stale RUNNING 을 started_at 원자 re-claim 후 §7.5 case B 로 재구동한다.
    const recoverRes = await request(BASE_URL)
      .post(`/api/executions/_test/recover-stuck-executions`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('X-Workspace-Id', workspaceId)
      .send({});
    expect(recoverRes.status).toBe(202);

    // 5. 재구동으로 frontier(codeB)가 실행돼 **새** completed row 가 생기는 것을
    //    직접 폴링한다. Execution status='completed' 는 원 실행·재구동 양쪽에서
    //    나타나 모호하므로(재구동은 fire-and-forget) 판정 신호로 쓰지 않는다 —
    //    codeB 는 step 3 에서 삭제됐으니 완료 row 의 출현이 곧 재구동의 무손실
    //    dispatch 증거다.
    let codeRow: { status?: string; output_data?: unknown } | undefined;
    const redriveStart = Date.now();
    while (Date.now() - redriveStart < 20_000) {
      const r = await db.query(
        `SELECT status, output_data FROM node_execution
           WHERE execution_id = $1 AND node_id = $2
           ORDER BY started_at DESC LIMIT 1`,
        [executionId, code.id],
      );
      if (r.rows[0]?.status === 'completed') {
        codeRow = r.rows[0] as { status?: string; output_data?: unknown };
        break;
      }
      await new Promise((res) => setTimeout(res, 200));
    }
    // 6. frontier(codeB)가 재구동에서 실행돼 completed + 제출/출력 무손실.
    expect(codeRow?.status).toBe('completed');
    expect(JSON.stringify(codeRow?.output_data ?? {})).toContain('redriven');

    // 재구동 종결 후 Execution 도 completed 로 마감.
    const finalStatus = await poll(executionId, (s) =>
      TERMINAL_STATUSES.includes(s as never),
    );
    expect(finalStatus).toBe('completed');

    // 7. §7.2c/§7.3 exactly-once — 완료 노드(trigger·codeA)는 재실행되지 않았다
    //    (row 수 불변). skipExecutedNodes 가드 회귀 게이트.
    expect(await nodeExecRowCount(executionId, trigger.id)).toBe(
      triggerCountBefore,
    );
    expect(await nodeExecRowCount(executionId, codeA.id)).toBe(
      codeACountBefore,
    );

    // 8. 옛 fail-only 회귀 가드 — re-claim 대상이 FAILED 로 마킹되지 않았다.
    const execRow = await db.query(
      `SELECT status, error FROM execution WHERE id = $1`,
      [executionId],
    );
    expect(execRow.rows[0]?.status).toBe('completed');
    expect(JSON.stringify(execRow.rows[0]?.error ?? {})).not.toContain(
      'WORKER_HEARTBEAT_TIMEOUT',
    );
  }, 90_000);
});
