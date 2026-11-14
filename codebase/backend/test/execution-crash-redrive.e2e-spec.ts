import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { randomUUID } from 'crypto';
import { sign } from 'jsonwebtoken';
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

// backend-e2e 의 JWT_SECRET(docker-compose.e2e.yml). interaction-token 을 backend 와
// 같은 키로 만들려고 쓴다. runner env 에 없으면 compose 값(테스트 전용, 공개됨)을 쓴다.
const JWT_SECRET =
  process.env.JWT_SECRET ?? 'clemvion-e2e-jwt-secret-do-not-use-in-prod-x9y8z7';

/** InteractionTokenService.issuePerExecution 과 같은 모양의 iext_* 토큰. */
function mintInteractionToken(executionId: string): string {
  const jwt = sign(
    { sub: executionId, aud: 'interaction', jti: randomUUID() },
    JWT_SECRET,
    { algorithm: 'HS256', expiresIn: 3600 },
  );
  return `iext_${jwt}`;
}

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
    expect(res.status).toBe(200);
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

  /** EIA submit_message — 멀티턴 AI 의 한 턴을 cold rehydration 으로 구동한다. */
  async function submitMessage(
    executionId: string,
    nodeId: string,
    message: string,
  ): Promise<void> {
    const res = await request(BASE_URL)
      .post(`/api/external/executions/${executionId}/interact`)
      .set('Authorization', `Bearer ${mintInteractionToken(executionId)}`)
      .send({ command: 'submit_message', nodeId, message });
    expect(res.status).toBe(202);
  }

  /** durable thread 에 그 사용자 메시지가 나타날 때까지(= 턴 처리 완료) 기다린다. */
  async function waitForUserTurn(
    executionId: string,
    expectedUserText: string,
    timeoutMs = 20_000,
  ): Promise<void> {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      const row = await db.query(
        `SELECT conversation_thread FROM execution WHERE id = $1`,
        [executionId],
      );
      const turns =
        (
          row.rows[0]?.conversation_thread as {
            turns?: Array<{ source: string; text: string }>;
          } | null
        )?.turns ?? [];
      if (
        turns.some((t) => t.source === 'ai_user' && t.text === expectedUserText)
      ) {
        return;
      }
      await new Promise((r) => setTimeout(r, 200));
    }
    throw new Error(
      `waitForUserTurn timed out — "${expectedUserText}" (execution=${executionId})`,
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

  /** 4196DR — 실행 · AI 노드 행 · thread 를 한 번에 읽는다. */
  async function readAiCrashState(executionId: string, aiNodeId: string) {
    const exec = await db.query(
      `SELECT status, error, finished_at, conversation_thread
         FROM execution WHERE id = $1`,
      [executionId],
    );
    const rows = await db.query(
      `SELECT id, status, error, output_data, finished_at
         FROM node_execution
        WHERE execution_id = $1 AND node_id = $2
        ORDER BY started_at ASC`,
      [executionId, aiNodeId],
    );
    return { exec: exec.rows[0], aiRows: rows.rows };
  }

  it('AI 재개 턴 LLM 호출 중 크래시(running + resumed 스냅샷)를 부팅 재구동이 거두고 실행이 running 에 머물지 않는다 (CLE-T-4196DR)', async () => {
    // 1. stub LLM(LLM_STUB_MODE=true) 모델 설정 — 응답을 `__e2e_delay_ms:<n>` 로
    //    늦춰 재개 턴의 LLM 호출 도중 상태를 실제로 만든다.
    const llmCreateRes = await request(BASE_URL)
      .post('/api/model-configs')
      .set(authHeader())
      .set('X-Workspace-Id', workspaceId)
      .send({
        kind: 'chat',
        provider: 'openai',
        name: uniqueName('redrive-ai-llm'),
        apiKey: 'stub-not-used',
        defaultModel: 'stub-model',
        defaultParams: {},
        isDefault: false,
      });
    expect(llmCreateRes.status).toBe(201);
    const llmConfigId = (llmCreateRes.body.data as { id: string }).id;

    // 2. trigger → ai_agent(multi_turn).
    const workflowId = await createWorkflow();
    const trigger: CanvasNode = {
      id: randomUUID(),
      type: MANUAL_TRIGGER_TYPE,
      category: 'trigger',
      label: 'Start',
      positionX: 0,
      positionY: 0,
    };
    const aiNode: CanvasNode = {
      id: randomUUID(),
      type: 'ai_agent',
      category: 'ai',
      label: 'Conversation',
      positionX: 240,
      positionY: 0,
      config: {
        mode: 'multi_turn',
        llmConfigId,
        systemPrompt: 'You are a helpful assistant.',
        maxTurns: 10,
      },
    };
    await saveCanvas(
      workflowId,
      [trigger, aiNode],
      [
        {
          sourceNodeId: trigger.id,
          sourcePort: 'out',
          targetNodeId: aiNode.id,
          targetPort: 'in',
        },
      ],
    );

    // 3. 실행 → 첫 사용자 메시지 대기로 park.
    const execRes = await request(BASE_URL)
      .post(`/api/workflows/${workflowId}/execute`)
      .set(authHeader())
      .set('X-Workspace-Id', workspaceId)
      .send({});
    expect(execRes.status).toBe(202);
    const executionId = (execRes.body.data as { executionId: string })
      .executionId;
    expect(
      await poll(
        executionId,
        (s) =>
          s === 'waiting_for_input' || TERMINAL_STATUSES.includes(s as never),
      ),
    ).toBe('waiting_for_input');

    // 4. 1턴은 정상으로 마친다(대화 기록이 있는 상태에서 크래시를 만든다).
    await submitMessage(executionId, aiNode.id, 'turn-one');
    await waitForUserTurn(executionId, 'turn-one');
    expect(
      await poll(
        executionId,
        (s) =>
          s === 'waiting_for_input' || TERMINAL_STATUSES.includes(s as never),
      ),
    ).toBe('waiting_for_input');
    const triggerCountBefore = await nodeExecRowCount(executionId, trigger.id);

    // 5. 2턴 — LLM 응답을 늦춰 두고 그 사이 행이 `running` + 재개 스냅샷이 되는
    //    순간을 DB 에서 잡는다. 이 값이 크래시 시점의 영속 상태다.
    await submitMessage(
      executionId,
      aiNode.id,
      '__e2e_delay_ms:5000 turn-two-crash',
    );
    let crashRow:
      { id: string; output_data: Record<string, unknown> } | undefined;
    let crashThread: unknown;
    const captureStart = Date.now();
    while (Date.now() - captureStart < 10_000) {
      const r = await db.query(
        `SELECT ne.id, ne.output_data, e.conversation_thread
           FROM node_execution ne JOIN execution e ON e.id = ne.execution_id
          WHERE ne.execution_id = $1 AND ne.node_id = $2
            AND ne.status = 'running'
            AND ne.output_data->>'status' = 'resumed'
          ORDER BY ne.started_at DESC LIMIT 1`,
        [executionId, aiNode.id],
      );
      if (r.rows[0]) {
        crashRow = {
          id: r.rows[0].id as string,
          output_data: r.rows[0].output_data as Record<string, unknown>,
        };
        crashThread = r.rows[0].conversation_thread;
        break;
      }
      await new Promise((res) => setTimeout(res, 50));
    }
    expect(crashRow).toBeDefined();
    expect(
      (crashRow!.output_data.meta as Record<string, unknown> | undefined)
        ?.interactionType,
    ).toBe('ai_conversation');
    expect(crashRow!.output_data._resumeCheckpoint).toBeDefined();

    // 지연된 턴이 끝나 다시 park 할 때까지 기다린다(실제 워커가 일을 마친 뒤에
    // 크래시 상태로 되감아야 재구동만 관측된다).
    await waitForUserTurn(executionId, '__e2e_delay_ms:5000 turn-two-crash');
    expect(
      await poll(
        executionId,
        (s) =>
          s === 'waiting_for_input' || TERMINAL_STATUSES.includes(s as never),
        20_000,
      ),
    ).toBe('waiting_for_input');
    const aiRowCountBefore = await nodeExecRowCount(executionId, aiNode.id);

    // 6. 크래시 합성 — 2턴 LLM 호출 도중 서버가 죽은 상태로 되감는다. AI 노드 행은
    //    잡아 둔 재개 스냅샷 + `running`, 실행은 30분 넘게 멈춘 `running`, thread
    //    는 크래시 시점 값이다.
    await db.query(
      `UPDATE node_execution
          SET status = 'running', output_data = $2::jsonb,
              finished_at = NULL, error = NULL
        WHERE id = $1`,
      [crashRow!.id, JSON.stringify(crashRow!.output_data)],
    );
    await db.query(
      `UPDATE execution
          SET status = 'running', finished_at = NULL, output_data = NULL,
              conversation_thread = $2::jsonb,
              started_at = NOW() - INTERVAL '31 minutes'
        WHERE id = $1`,
      [executionId, JSON.stringify(crashThread ?? null)],
    );

    // 7. 부팅 복구를 on-demand 로 돌린다.
    const recoverRes = await request(BASE_URL)
      .post(`/api/executions/_test/recover-stuck-executions`)
      .set(authHeader())
      .set('X-Workspace-Id', workspaceId)
      .send({});
    expect(recoverRes.status).toBe(202);

    // 8. 실행이 `running` 에 머물지 않는다. case B 재구동은 크래시 때 끝나지 않은
    //    AI 노드를 새 행으로 다시 실행하고(at-least-once) 그 노드가 다시 대기에
    //    들어가 park 한다(CLE-EXEC-RECOVERY 「재구동 절차」 6 · 「남은 행 마감」).
    //    재구동은 fire-and-forget 이라 상태가 바뀔 때까지 본다.
    const settled = await poll(
      executionId,
      (s) =>
        s === 'waiting_for_input' || TERMINAL_STATUSES.includes(s as never),
      20_000,
    );
    expect(settled).toBe('waiting_for_input');

    const state = await readAiCrashState(executionId, aiNode.id);
    expect(state.exec?.status).toBe('waiting_for_input');
    expect(state.exec?.finished_at).toBeNull();

    // 완료 노드(trigger)는 다시 실행하지 않는다.
    expect(await nodeExecRowCount(executionId, trigger.id)).toBe(
      triggerCountBefore,
    );

    // 크래시 때의 행은 `failed` 로 마감되고 다시 실행은 새 행이다.
    type AiRow = {
      id: string;
      status: string;
      error: { message?: string } | null;
      output_data: Record<string, unknown> | null;
      finished_at: Date | null;
    };
    const aiRows = state.aiRows as AiRow[];
    expect(aiRows).toHaveLength(aiRowCountBefore + 1);
    const oldRow = aiRows.find((r) => r.id === crashRow!.id);
    expect(oldRow?.status).toBe('failed');
    expect(oldRow?.error?.message).toContain('crash re-drive');
    expect(oldRow?.finished_at).not.toBeNull();

    // 재개 스냅샷이 노드의 최종 출력으로 남지 않는다. 끝나지 않은 행은 새 행
    // 하나이고 그 출력은 재개 스냅샷(`resumed`)이 아니라 대기 출력이다. 옛 행의
    // 출력에 남은 재개 스냅샷은 종결 행이라 두 대기 판정(CLE-EXEC-STATE 「AI 대화
    // 재개 턴」)이 대기로 보지 않는다.
    const openRows = aiRows.filter(
      (r) => !['completed', 'failed', 'cancelled'].includes(r.status),
    );
    expect(openRows).toHaveLength(1);
    expect(openRows[0].id).not.toBe(crashRow!.id);
    expect(openRows[0].status).toBe('waiting_for_input');
    expect(openRows[0].output_data?.status).toBe('waiting_for_input');

    // rehydrate 가 대화 기록(thread)을 되살린다.
    const turns =
      (
        state.exec?.conversation_thread as {
          turns?: Array<{ text: string }>;
        } | null
      )?.turns ?? [];
    expect(turns.map((t) => t.text)).toContain('turn-one');

    // 9. 다시 들어간 대기가 진짜 대기다. 새 메시지를 받아 한 턴을 돌고 다시 park 한다.
    await submitMessage(executionId, aiNode.id, 'turn-after-recovery');
    await waitForUserTurn(executionId, 'turn-after-recovery');
    expect(
      await poll(
        executionId,
        (s) =>
          s === 'waiting_for_input' || TERMINAL_STATUSES.includes(s as never),
      ),
    ).toBe('waiting_for_input');
  }, 120_000);

  /** CLE-T-CCEQEC — 크래시가 남긴 모양의 노드 실행 행을 직접 넣는다. */
  async function insertNodeRow(row: {
    executionId: string;
    nodeId: string;
    status: string;
    startedAgo: string;
    parentId?: string | null;
    inputData?: Record<string, unknown>;
  }): Promise<string> {
    const id = randomUUID();
    await db.query(
      `INSERT INTO node_execution
         (id, execution_id, node_id, status, started_at, input_data, parent_node_execution_id)
       VALUES ($1, $2, $3, $4, NOW() - $5::interval, $6::jsonb, $7)`,
      [
        id,
        row.executionId,
        row.nodeId,
        row.status,
        row.startedAgo,
        JSON.stringify(row.inputData ?? {}),
        row.parentId ?? null,
      ],
    );
    return id;
  }

  /**
   * CLE-T-EC9VFJ — `completed` 행 `length` 개를 부모 체인으로 잇는다. 첫 행의 부모는
   * `topParentId`(없으면 최상위 행)이고 마지막 행의 id 를 돌려준다.
   */
  async function insertChain(row: {
    executionId: string;
    nodeId: string;
    topParentId: string | null;
    length: number;
  }): Promise<string> {
    let parentId = row.topParentId;
    for (let i = 0; i < row.length; i += 1) {
      parentId = await insertNodeRow({
        executionId: row.executionId,
        nodeId: row.nodeId,
        status: 'completed',
        startedAgo: '40 minutes',
        parentId,
      });
    }
    if (parentId === null) throw new Error('insertChain: length must be > 0');
    return parentId;
  }

  it('종결된 실행 아래 30분 넘게 running 으로 남은 노드 실행 행을 부팅 스캔이 failed 로 닫고, 살아 있을 수 있는 행은 그대로 둔다 (CLE-T-CCEQEC · CLE-T-EC9VFJ)', async () => {
    // 1. trigger → Background(main → codeMain, background → codeBody). 실제 Background
    //    노드 행을 부모 체인의 조상으로 쓰려고 한 번씩 정상 실행한다.
    const workflowId = await createWorkflow();
    const trigger: CanvasNode = {
      id: randomUUID(),
      type: MANUAL_TRIGGER_TYPE,
      category: 'trigger',
      label: 'Start',
      positionX: 0,
      positionY: 0,
    };
    const bg: CanvasNode = {
      id: randomUUID(),
      type: 'background',
      category: 'logic',
      label: 'Bg',
      positionX: 240,
      positionY: 0,
    };
    const codeMain: CanvasNode = {
      id: randomUUID(),
      type: 'code',
      category: 'data',
      label: 'Main',
      positionX: 480,
      positionY: 0,
      config: { language: 'javascript', code: 'return { m: 1 };', timeout: 5 },
    };
    const codeBody: CanvasNode = {
      id: randomUUID(),
      type: 'code',
      category: 'data',
      label: 'Body',
      positionX: 480,
      positionY: 160,
      config: { language: 'javascript', code: 'return { b: 1 };', timeout: 5 },
    };
    await saveCanvas(
      workflowId,
      [trigger, bg, codeMain, codeBody],
      [
        {
          sourceNodeId: trigger.id,
          sourcePort: 'out',
          targetNodeId: bg.id,
          targetPort: 'in',
        },
        {
          sourceNodeId: bg.id,
          sourcePort: 'main',
          targetNodeId: codeMain.id,
          targetPort: 'in',
        },
        {
          sourceNodeId: bg.id,
          sourcePort: 'background',
          targetNodeId: codeBody.id,
          targetPort: 'in',
        },
      ],
    );

    async function runToEnd(): Promise<string> {
      const res = await request(BASE_URL)
        .post(`/api/workflows/${workflowId}/execute`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('X-Workspace-Id', workspaceId)
        .send({});
      expect(res.status).toBe(202);
      const id = (res.body.data as { executionId: string }).executionId;
      expect(
        await poll(id, (s) => TERMINAL_STATUSES.includes(s as never)),
      ).toBe('completed');
      // Background 본문은 실행이 끝난 뒤에도 돈다. 본문 행이 끝날 때까지 기다려 아래
      // 합성과 섞이지 않게 한다.
      const start = Date.now();
      while (Date.now() - start < 20_000) {
        const r = await db.query(
          `SELECT status FROM node_execution WHERE execution_id = $1 AND node_id = $2`,
          [id, codeBody.id],
        );
        if (r.rows[0]?.status === 'completed') return id;
        await new Promise((res2) => setTimeout(res2, 200));
      }
      throw new Error(`background body did not complete (execution=${id})`);
    }

    const failedExecId = await runToEnd();
    const cancelledExecId = await runToEnd();
    const waitingExecId = await runToEnd();

    const bgRow = await db.query(
      `SELECT id FROM node_execution WHERE execution_id = $1 AND node_id = $2`,
      [failedExecId, bg.id],
    );
    const bgRowId = bgRow.rows[0]?.id as string;
    expect(bgRowId).toBeDefined();

    // 2. 크래시가 남긴 상태를 합성한다.
    //    실행 상태: retry_last_turn 출처는 failed, 취소 출처는 cancelled. 비교군 하나는
    //    입력 대기(종결 아님)로 둔다.
    await db.query(`UPDATE execution SET status = 'failed' WHERE id = $1`, [
      failedExecId,
    ]);
    await db.query(`UPDATE execution SET status = 'cancelled' WHERE id = $1`, [
      cancelledExecId,
    ]);
    await db.query(
      `UPDATE execution SET status = 'waiting_for_input', finished_at = NULL WHERE id = $1`,
      [waitingExecId],
    );

    // 닫혀야 하는 행
    // 출처 1 · 2: retry_last_turn 2차 claim 이 _retryState 를 지운 뒤 버려졌거나
    // try 진입 전에 죽은 새 행.
    const retryClaimedRow = await insertNodeRow({
      executionId: failedExecId,
      nodeId: codeMain.id,
      status: 'running',
      startedAgo: '31 minutes',
    });
    // 재진입 작업을 잃어 _retryState 가 남은 새 행. 입력 내용과 관계없이 닫힌다.
    const retryUnclaimedRow = await insertNodeRow({
      executionId: failedExecId,
      nodeId: codeMain.id,
      status: 'running',
      startedAgo: '31 minutes',
      inputData: { _retryState: { turnCount: 1 } },
    });
    // 출처 3: 실행이 cancelled 로 커밋된 뒤 markNodeCancelled 전에 죽은 행.
    const cancelWindowRow = await insertNodeRow({
      executionId: cancelledExecId,
      nodeId: codeMain.id,
      status: 'running',
      startedAgo: '31 minutes',
    });
    // Background 가 아닌 부모(서브 워크플로우 · 컨테이너 자리) 아래 행도 닫힌다.
    const plainParent = await insertNodeRow({
      executionId: failedExecId,
      nodeId: codeMain.id,
      status: 'completed',
      startedAgo: '40 minutes',
    });
    const plainChildRow = await insertNodeRow({
      executionId: failedExecId,
      nodeId: codeMain.id,
      status: 'running',
      startedAgo: '31 minutes',
      parentId: plainParent,
    });
    // CLE-T-EC9VFJ: 조상이 깊이 한도(64)와 같은 64개이고 맨 위가 최상위 행이면 닫힌다.
    // 한도 경계에서 최상위 도달을 확인할 수 있다.
    const deepRootedRow = await insertNodeRow({
      executionId: failedExecId,
      nodeId: codeMain.id,
      status: 'running',
      startedAgo: '31 minutes',
      parentId: await insertChain({
        executionId: failedExecId,
        nodeId: codeMain.id,
        topParentId: null,
        length: 64,
      }),
    });

    // 그대로 둬야 하는 행
    // 30분이 안 된 행: 재시도 재진입 턴 · 취소 커밋 직후의 창.
    const freshRow = await insertNodeRow({
      executionId: failedExecId,
      nodeId: codeMain.id,
      status: 'running',
      startedAgo: '5 minutes',
    });
    // Background 본문 행: 부모가 Background 노드 행이다.
    const bodyRow = await insertNodeRow({
      executionId: failedExecId,
      nodeId: codeBody.id,
      status: 'running',
      startedAgo: '31 minutes',
      parentId: bgRowId,
    });
    // 본문 안 컨테이너 · 서브 워크플로우 아래 행: Background 가 두 단계 위에 있다.
    const bodyMid = await insertNodeRow({
      executionId: failedExecId,
      nodeId: codeBody.id,
      status: 'completed',
      startedAgo: '40 minutes',
      parentId: bgRowId,
    });
    const nestedBodyRow = await insertNodeRow({
      executionId: failedExecId,
      nodeId: codeBody.id,
      status: 'running',
      startedAgo: '31 minutes',
      parentId: bodyMid,
    });
    // CLE-T-EC9VFJ: Background 가 깊이 한도 바깥(65번째 조상)에 있는 본문 행. 한도 안에서
    // 최상위 행에 닿지 못한 후보는 Background 여부를 확인할 수 없으므로 닫지 않는다.
    const beyondDepthBodyRow = await insertNodeRow({
      executionId: failedExecId,
      nodeId: codeBody.id,
      status: 'running',
      startedAgo: '31 minutes',
      parentId: await insertChain({
        executionId: failedExecId,
        nodeId: codeBody.id,
        topParentId: bgRowId,
        length: 64,
      }),
    });
    // running 이 아닌 행.
    const waitingNodeRow = await insertNodeRow({
      executionId: failedExecId,
      nodeId: codeMain.id,
      status: 'waiting_for_input',
      startedAgo: '31 minutes',
    });
    // 종결되지 않은 실행 아래 행.
    const liveExecRow = await insertNodeRow({
      executionId: waitingExecId,
      nodeId: codeMain.id,
      status: 'running',
      startedAgo: '31 minutes',
    });

    // 3. 부팅 스캔(on-demand, NODE_ENV=test 게이팅). 엔드포인트가 스캔을 기다린 뒤 답한다.
    const recoverRes = await request(BASE_URL)
      .post(`/api/executions/_test/recover-stuck-executions`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('X-Workspace-Id', workspaceId)
      .send({});
    expect(recoverRes.status).toBe(202);

    const rows = await db.query(
      `SELECT id, status, error, finished_at FROM node_execution WHERE id = ANY($1::uuid[])`,
      [
        [
          retryClaimedRow,
          retryUnclaimedRow,
          cancelWindowRow,
          plainChildRow,
          deepRootedRow,
          freshRow,
          bodyRow,
          nestedBodyRow,
          beyondDepthBodyRow,
          waitingNodeRow,
          liveExecRow,
        ],
      ],
    );
    const byId = new Map(
      (
        rows.rows as Array<{
          id: string;
          status: string;
          error: { message?: string } | null;
          finished_at: Date | null;
        }>
      ).map((r) => [r.id, r]),
    );

    for (const closedId of [
      retryClaimedRow,
      retryUnclaimedRow,
      cancelWindowRow,
      plainChildRow,
      deepRootedRow,
    ]) {
      const r = byId.get(closedId);
      expect(r?.status).toBe('failed');
      expect(r?.error?.message).toContain('boot recovery scan');
      expect(r?.finished_at).not.toBeNull();
    }
    expect(byId.get(freshRow)?.status).toBe('running');
    expect(byId.get(bodyRow)?.status).toBe('running');
    expect(byId.get(nestedBodyRow)?.status).toBe('running');
    expect(byId.get(beyondDepthBodyRow)?.status).toBe('running');
    expect(byId.get(waitingNodeRow)?.status).toBe('waiting_for_input');
    expect(byId.get(liveExecRow)?.status).toBe('running');

    // 실행 상태는 바꾸지 않는다.
    const execs = await db.query(
      `SELECT id, status FROM execution WHERE id = ANY($1::uuid[])`,
      [[failedExecId, cancelledExecId, waitingExecId]],
    );
    const execStatus = new Map(
      (execs.rows as Array<{ id: string; status: string }>).map((r) => [
        r.id,
        r.status,
      ]),
    );
    expect(execStatus.get(failedExecId)).toBe('failed');
    expect(execStatus.get(cancelledExecId)).toBe('cancelled');
    expect(execStatus.get(waitingExecId)).toBe('waiting_for_input');

    // 입력 대기로 꾸민 실행은 끝내 둔다. 행이 없는 입력 대기 실행을 남기지 않는다.
    await db.query(`UPDATE execution SET status = 'cancelled' WHERE id = $1`, [
      waitingExecId,
    ]);
  }, 120_000);
});
