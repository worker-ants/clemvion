import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { randomUUID } from 'crypto';
import { sign } from 'jsonwebtoken';
import { Client } from 'pg';
import request from 'supertest';

import { createDbClient, uniqueEmail, uniqueName } from './helpers/db';
import { registerAndLogin, createTeamWorkspace } from './helpers/auth';

/**
 * e2e: spec/5-system/4-execution-engine.md §4.x(park = 세그먼트 종료) · §7.5
 * (rehydration) — Phase B (PR-B1) park 즉시 해제 + slow-path 일원화 회귀 가드.
 *
 * 핵심 불변식(plan/in-progress/exec-park-durable-resume.md §Phase B):
 *   "park → worker kill → 무손실 재개". PR-B1 에서 form/button 단발 park 는
 *   `runExecution` 코루틴을 즉시 해제하므로(park=세그먼트 종료, bounded 메모리)
 *   **재개에 쓸 in-process resolver/context 가 존재하지 않는다**. 따라서 본 e2e
 *   에서 form 노드 park 후의 재개는 정의상 §7.5 rehydration(cold slow-path) —
 *   durable 영속된 `execution`(status=waiting_for_input) + `node_execution`
 *   (output_data) 행에서 context 를 재구성해 구동된다. 이는 "워커 프로세스가
 *   죽어 메모리가 소실된 뒤 다른 워커가 큐에서 재개" 시나리오와 동형이다 —
 *   in-memory 코루틴이 park 시점에 이미 해제됐으므로 단일 백엔드에서도 cold
 *   rehydration 경로가 그대로 실행된다.
 *
 * 검증: (1) park 시 execution/node_execution 이 durable WAITING 으로 영속,
 *       (2) REST `POST /executions/:id/continue` 재개가 cold rehydration 으로
 *           terminal(completed) 도달, (3) 재개된 form 노드 output 에 제출 데이터가
 *           무손실 반영(node_execution.output_data).
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

describe('Execution park → cold rehydration resume (e2e, PR-B1)', () => {
  let db: Client;
  let ownerToken: string;
  let workspaceId: string;

  beforeAll(async () => {
    db = createDbClient();
    await db.connect();
    const owner = await registerAndLogin(
      BASE_URL,
      uniqueEmail('parkresume'),
      db,
    );
    ownerToken = owner.accessToken;
    workspaceId = await createTeamWorkspace(
      BASE_URL,
      ownerToken,
      uniqueName('PARKRESUME'),
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
      .send({ name: uniqueName('parkresume-wf') });
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

  it('form park 는 durable WAITING 으로 영속되고, cold rehydration 재개가 무손실로 completed 한다', async () => {
    // 1. Manual Trigger → Form(text 필드 1개) 워크플로우.
    const workflowId = await createWorkflow();
    const trigger: CanvasNode = {
      id: randomUUID(),
      type: MANUAL_TRIGGER_TYPE,
      category: 'trigger',
      label: 'Start',
      positionX: 0,
      positionY: 0,
    };
    const form: CanvasNode = {
      id: randomUUID(),
      type: 'form',
      category: 'presentation',
      label: 'Approval Form',
      positionX: 240,
      positionY: 0,
      config: {
        title: 'Approval',
        fields: [{ name: 'note', type: 'text', label: 'Note' }],
      },
    };
    await saveCanvas(
      workflowId,
      [trigger, form],
      [
        {
          sourceNodeId: trigger.id,
          sourcePort: 'out',
          targetNodeId: form.id,
          targetPort: 'in',
        },
      ],
    );

    // 2. 실행 → form 노드에서 park (waiting_for_input).
    const execRes = await request(BASE_URL)
      .post(`/api/workflows/${workflowId}/execute`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('X-Workspace-Id', workspaceId)
      .send({});
    expect(execRes.status).toBe(202);
    const executionId = (execRes.body.data as { executionId: string })
      .executionId;
    expect(executionId).toBeDefined();

    const parkedStatus = await poll(
      executionId,
      (s) =>
        s === 'waiting_for_input' || TERMINAL_STATUSES.includes(s as never),
    );
    expect(parkedStatus).toBe('waiting_for_input');

    // 3. Durable 영속 확인 — park 시 코루틴이 해제됐으므로(bounded 메모리), 재개의
    //    유일한 출처는 아래 DB 행이다 (worker kill 후 cold rehydration 과 동형).
    const execRow = await db.query(
      `SELECT status, finished_at FROM execution WHERE id = $1`,
      [executionId],
    );
    expect(execRow.rows[0]?.status).toBe('waiting_for_input');
    expect(execRow.rows[0]?.finished_at).toBeNull();

    const waitingNode = await db.query(
      `SELECT id, status, output_data FROM node_execution
         WHERE execution_id = $1 AND node_id = $2
         ORDER BY started_at DESC LIMIT 1`,
      [executionId, form.id],
    );
    expect(waitingNode.rows[0]?.status).toBe('waiting_for_input');

    // 4. 재개 — REST continue. park-release 모델에서 이 재개는 §7.5 rehydration
    //    (cold slow-path)으로만 구동된다 (in-process resolver 부재).
    const continueRes = await request(BASE_URL)
      .post(`/api/executions/${executionId}/continue`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('X-Workspace-Id', workspaceId)
      .send({ formData: { note: 'hello-from-e2e' } });
    expect([200, 202]).toContain(continueRes.status);

    // 5. cold rehydration 으로 terminal 도달.
    const finalStatus = await poll(executionId, (s) =>
      TERMINAL_STATUSES.includes(s as never),
    );
    expect(finalStatus).toBe('completed');

    // 6. 무손실 — 재개된 form 노드가 completed + 제출 데이터가 output 에 반영.
    const completedNode = await db.query(
      `SELECT status, output_data FROM node_execution
         WHERE execution_id = $1 AND node_id = $2
         ORDER BY started_at DESC LIMIT 1`,
      [executionId, form.id],
    );
    expect(completedNode.rows[0]?.status).toBe('completed');
    expect(JSON.stringify(completedNode.rows[0]?.output_data ?? {})).toContain(
      'hello-from-e2e',
    );
  }, 60_000);
});

/**
 * e2e: spec/5-system/4-execution-engine.md §4.x (turn-park) · §7.5 (cold
 * rehydration) — PR-B2a 회귀 가드. **top-level multi-turn AI (`ai_agent`
 * `mode:'multi_turn'`) 의 turn-park → cold rehydration resume**.
 *
 * 핵심 불변식 (plan/in-progress/exec-park-durable-resume.md, PR-B2a):
 *   in-memory long-lived loop 를 폐기하고, AI 노드는 매 turn 마다 park
 *   (`waiting_for_input`, durable) 하면서 **코루틴을 해제**한다. 따라서 후속
 *   user turn 은 항상 §7.5 cold rehydration (`processAiResumeTurn`) 으로 재개
 *   된다 — worker-kill 없이도 매 turn 이 cold rehydration 경로를 그대로 exercise.
 *
 * 결정적 구동:
 *   - LLM 은 `LLM_STUB_MODE=true` (docker-compose.e2e.yml) 의 StubLlmClient 로
 *     intercept — 마지막 user 메시지를 `[stub] received: <msg>` 로 echo 하고
 *     **tool call 을 만들지 않으므로** 핸들러는 응답 emit 후 다시 park 한다.
 *   - turn 구동 entry point: EIA REST `POST /api/external/executions/:id/interact`
 *     (`submit_message` / `end_conversation`). 본 family 는 interaction-token
 *     (`iext_*` HS256 JWT, aud:'interaction', sub:executionId) 인증을 쓴다.
 *     운영에서는 emitAiWaitingForInput 가 토큰을 발급하지만, e2e 에서는 backend
 *     와 동일한 `JWT_SECRET` 으로 직접 mint 한다 (InteractionTokenService.
 *     issuePerExecution 과 동형 payload). WS `execution.submit_message` 는
 *     socket.io-client 의존성 부재로 제외, REST `/continue` 는 form_submitted
 *     sentinel 전용이라 multi-turn 메시지를 구동하지 않으므로 제외.
 *
 * 검증: (1) park 시 execution=waiting_for_input(durable) + node_execution WAITING
 *       + output_data._resumeCheckpoint 영속, (2) 매 user turn 이 cold
 *       rehydration 으로 재개되고 다시 park, (3) execution.conversation_thread
 *       JSONB 가 turn 들을 무손실 누적 (turn N 내용이 turn N+2 시점에도 잔존),
 *       (4) end_conversation 으로 노드·execution 이 terminal completed 도달 +
 *       thread 가 모든 turn 을 순서대로 보존.
 */
describe('Top-level multi-turn AI turn-park → cold rehydration resume (e2e, PR-B2a)', () => {
  let db: Client;
  let ownerToken: string;
  let workspaceId: string;

  // backend-e2e 의 JWT_SECRET (docker-compose.e2e.yml) — interaction-token 을
  // backend 와 동일 키로 mint 하기 위함. runner env 에 미주입이면 compose 값으로
  // fallback (테스트 전용 시크릿, repo 에 공개됨).
  const JWT_SECRET =
    process.env.JWT_SECRET ?? 'clemvion-e2e-jwt-secret-do-not-use-in-prod-x9y8z7';

  beforeAll(async () => {
    db = createDbClient();
    await db.connect();
    const owner = await registerAndLogin(BASE_URL, uniqueEmail('aiturnpark'), db);
    ownerToken = owner.accessToken;
    workspaceId = await createTeamWorkspace(
      BASE_URL,
      ownerToken,
      uniqueName('AITURNPARK'),
    );
  }, 60_000);

  afterAll(async () => {
    if (db) await db.end();
  });

  const authHeader = () => ({ Authorization: `Bearer ${ownerToken}` });

  /** InteractionTokenService.issuePerExecution 과 동형의 iext_* 토큰을 직접 mint. */
  function mintInteractionToken(executionId: string): string {
    const jwt = sign(
      { sub: executionId, aud: 'interaction', jti: randomUUID() },
      JWT_SECRET,
      { algorithm: 'HS256', expiresIn: 3600 },
    );
    return `iext_${jwt}`;
  }

  async function createWorkflow(): Promise<string> {
    const res = await request(BASE_URL)
      .post('/api/workflows')
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('X-Workspace-Id', workspaceId)
      .send({ name: uniqueName('aiturnpark-wf') });
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

  /** execution.conversation_thread JSONB 를 DB 에서 직접 읽는다. */
  async function readThread(executionId: string): Promise<{
    turns: Array<{ seq: number; source: string; text: string; nodeId: string }>;
  } | null> {
    const row = await db.query(
      `SELECT conversation_thread FROM execution WHERE id = $1`,
      [executionId],
    );
    return (row.rows[0]?.conversation_thread ?? null) as {
      turns: Array<{
        seq: number;
        source: string;
        text: string;
        nodeId: string;
      }>;
    } | null;
  }

  /** EIA submit_message — cold rehydration 으로 한 turn 을 구동. */
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
    // TransformInterceptor 가 `{ data: InteractAckDto }` 로 wrap.
    expect((res.body as { data?: { accepted?: boolean } }).data?.accepted).toBe(
      true,
    );
  }

  /**
   * submit_message 는 비동기 dispatch — execution 은 resume 처리 동안 잠시 running
   * 으로 갔다가 다시 waiting_for_input 으로 re-park 한다. 그러나 submit 직후엔
   * 아직 이전 park 의 waiting 상태가 남아 status 만으로는 turn 처리 완료를 판별할
   * 수 없다. 따라서 durable `conversation_thread` 에 해당 user 메시지 turn 이
   * 나타날 때까지 polling 해 turn 처리(= cold rehydration 1회) 완료를 확정한다.
   */
  async function waitForUserTurn(
    executionId: string,
    expectedUserText: string,
    timeoutMs = 20_000,
    intervalMs = 200,
  ): Promise<void> {
    const start = Date.now();
    let seen: string[] = [];
    while (Date.now() - start < timeoutMs) {
      const thread = await readThread(executionId);
      const userTexts = (thread?.turns ?? [])
        .filter((t) => t.source === 'ai_user')
        .map((t) => t.text);
      seen = userTexts;
      if (userTexts.includes(expectedUserText)) return;
      await new Promise((r) => setTimeout(r, intervalMs));
    }
    throw new Error(
      `waitForUserTurn timed out — expected ai_user turn "${expectedUserText}" not found. seen=${JSON.stringify(seen)} (execution=${executionId})`,
    );
  }

  it('multi-turn AI 는 매 turn park(durable)·cold-rehydration 재개하며 thread 를 무손실 누적하고 end_conversation 으로 completed 한다', async () => {
    // 1. LLM config 준비. LLM_STUB_MODE=true 에서는 `LlmService.createClient` 가
    //    복호화 이전에 StubLlmClient 를 반환하므로 (apiKey 는 실제로 사용되지 않음)
    //    config 행만 존재하면 충분하다. e2e 의 ENCRYPTION_KEY 는 SecretResolver
    //    (utf8 32B) 기준으로 세팅돼 있어 crypto.util.encrypt (hex 64자=32B 기대)
    //    와 길이가 어긋나 `POST /api/llm-configs` 가 500 (Invalid key length) 을
    //    낸다 — 이는 본 turn-park 기능과 무관한 e2e 환경 키 포맷 불일치다. 따라서
    //    암호화 경로를 우회해 행을 DB 에 직접 insert 한다 (stub 이 키를 읽지 않음).
    const llmConfigId = randomUUID();
    await db.query(
      `INSERT INTO llm_config
         (id, workspace_id, provider, name, api_key, default_model, default_params, is_default)
       VALUES ($1, $2, 'openai', $3, 'stub-not-used', 'stub-model', '{}'::jsonb, false)`,
      [llmConfigId, workspaceId, uniqueName('aiturnpark-llm')],
    );
    expect(llmConfigId).toBeDefined();

    // 2. manual_trigger → ai_agent(multi_turn) 워크플로우.
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

    // 3. 실행 → AI 노드가 첫 user 메시지를 기다리며 park.
    const execRes = await request(BASE_URL)
      .post(`/api/workflows/${workflowId}/execute`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('X-Workspace-Id', workspaceId)
      .send({});
    expect(execRes.status).toBe(202);
    const executionId = (execRes.body.data as { executionId: string })
      .executionId;
    expect(executionId).toBeDefined();

    const parkedStatus = await poll(
      executionId,
      (s) =>
        s === 'waiting_for_input' || TERMINAL_STATUSES.includes(s as never),
    );
    expect(parkedStatus).toBe('waiting_for_input');

    // 4. Durable 영속 확인 — execution WAITING + node_execution WAITING +
    //    output_data._resumeCheckpoint 존재 (turn-park 가 checkpoint 영속).
    const execRow = await db.query(
      `SELECT status, finished_at FROM execution WHERE id = $1`,
      [executionId],
    );
    expect(execRow.rows[0]?.status).toBe('waiting_for_input');
    expect(execRow.rows[0]?.finished_at).toBeNull();

    const waitingNode = await db.query(
      `SELECT status, output_data FROM node_execution
         WHERE execution_id = $1 AND node_id = $2
         ORDER BY started_at DESC LIMIT 1`,
      [executionId, aiNode.id],
    );
    expect(waitingNode.rows[0]?.status).toBe('waiting_for_input');
    const initialOutput = (waitingNode.rows[0]?.output_data ?? {}) as Record<
      string,
      unknown
    >;
    expect(initialOutput._resumeCheckpoint).toBeDefined();
    expect(typeof initialOutput._resumeCheckpoint).toBe('object');

    // 5. Turn 1 — submit_message via EIA (cold rehydration). stub 이 echo 응답
    //    후 핸들러는 다시 park (다음 turn 입력 대기). turn 처리 완료는 durable
    //    thread 에 user turn 이 나타나는 것으로 확정한다 (status-only poll 은
    //    이전 park 의 waiting 을 stale 하게 볼 수 있음).
    await submitMessage(executionId, aiNode.id, 'turn-one-question');
    await waitForUserTurn(executionId, 'turn-one-question');

    // turn-park 재park 도 durable WAITING 이어야 한다 (다음 cold rehydration 대비).
    const afterTurn1 = await poll(
      executionId,
      (s) =>
        s === 'waiting_for_input' || TERMINAL_STATUSES.includes(s as never),
    );
    expect(afterTurn1).toBe('waiting_for_input');
    const reparkRow1 = await db.query(
      `SELECT status, finished_at FROM execution WHERE id = $1`,
      [executionId],
    );
    expect(reparkRow1.rows[0]?.status).toBe('waiting_for_input');
    expect(reparkRow1.rows[0]?.finished_at).toBeNull();
    // re-park 후에도 node_execution 이 WAITING + checkpoint 영속 (다음 cold
    // rehydration 의 유일한 재구성 출처).
    const reparkNode1 = await db.query(
      `SELECT status, output_data FROM node_execution
         WHERE execution_id = $1 AND node_id = $2
         ORDER BY started_at DESC LIMIT 1`,
      [executionId, aiNode.id],
    );
    expect(reparkNode1.rows[0]?.status).toBe('waiting_for_input');
    expect(
      (reparkNode1.rows[0]?.output_data as Record<string, unknown>)
        ._resumeCheckpoint,
    ).toBeDefined();

    // thread 무손실 — turn 1 의 user 메시지 + assistant(stub echo) 가 누적.
    const thread1 = await readThread(executionId);
    expect(thread1).not.toBeNull();
    const turns1 = thread1!.turns;
    const userTexts1 = turns1
      .filter((t) => t.source === 'ai_user')
      .map((t) => t.text);
    const asstTexts1 = turns1
      .filter((t) => t.source === 'ai_assistant')
      .map((t) => t.text);
    expect(userTexts1).toContain('turn-one-question');
    expect(asstTexts1).toContain('[stub] received: turn-one-question');

    // 6. Turn 2 — 다시 cold rehydration. turn 1 내용이 잔존해야 무손실 (durable
    //    thread across cold rehydrations).
    await submitMessage(executionId, aiNode.id, 'turn-two-followup');
    await waitForUserTurn(executionId, 'turn-two-followup');
    const afterTurn2 = await poll(
      executionId,
      (s) =>
        s === 'waiting_for_input' || TERMINAL_STATUSES.includes(s as never),
    );
    expect(afterTurn2).toBe('waiting_for_input');

    const thread2 = await readThread(executionId);
    expect(thread2).not.toBeNull();
    const turns2 = thread2!.turns;
    const userTexts2 = turns2
      .filter((t) => t.source === 'ai_user')
      .map((t) => t.text);
    const asstTexts2 = turns2
      .filter((t) => t.source === 'ai_assistant')
      .map((t) => t.text);
    // turn 1 (N) 내용이 turn 2 (N+1) park 시점에도 잔존 → cold rehydration 무손실.
    expect(userTexts2).toContain('turn-one-question');
    expect(asstTexts2).toContain('[stub] received: turn-one-question');
    // turn 2 신규 내용 누적.
    expect(userTexts2).toContain('turn-two-followup');
    expect(asstTexts2).toContain('[stub] received: turn-two-followup');
    // 누적이지 덮어쓰기가 아님 — 두 user turn 모두 존재.
    expect(userTexts2.length).toBeGreaterThanOrEqual(2);

    // seq 단조 증가(시간순) — turn 들이 순서대로 누적됐는지.
    const seqs = turns2.map((t) => t.seq);
    for (let i = 1; i < seqs.length; i++) {
      expect(seqs[i]).toBeGreaterThan(seqs[i - 1]);
    }

    // 7. end_conversation → 노드·execution terminal completed.
    const endRes = await request(BASE_URL)
      .post(`/api/external/executions/${executionId}/interact`)
      .set('Authorization', `Bearer ${mintInteractionToken(executionId)}`)
      .send({ command: 'end_conversation', nodeId: aiNode.id });
    expect(endRes.status).toBe(202);

    const finalStatus = await poll(executionId, (s) =>
      TERMINAL_STATUSES.includes(s as never),
    );
    expect(finalStatus).toBe('completed');

    const finalNode = await db.query(
      `SELECT status FROM node_execution
         WHERE execution_id = $1 AND node_id = $2
         ORDER BY started_at DESC LIMIT 1`,
      [executionId, aiNode.id],
    );
    expect(finalNode.rows[0]?.status).toBe('completed');

    // 8. 최종 thread — 모든 turn 이 순서대로 무손실 보존.
    const finalThread = await readThread(executionId);
    expect(finalThread).not.toBeNull();
    const finalUserTexts = finalThread!.turns
      .filter((t) => t.source === 'ai_user')
      .map((t) => t.text);
    const finalAsstTexts = finalThread!.turns
      .filter((t) => t.source === 'ai_assistant')
      .map((t) => t.text);
    expect(finalUserTexts).toEqual([
      'turn-one-question',
      'turn-two-followup',
    ]);
    expect(finalAsstTexts).toEqual([
      '[stub] received: turn-one-question',
      '[stub] received: turn-two-followup',
    ]);
  }, 90_000);
});
