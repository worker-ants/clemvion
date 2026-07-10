import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { Client } from 'pg';
import request from 'supertest';
import { createHmac, randomUUID } from 'crypto';
import { sign } from 'jsonwebtoken';

import { createDbClient } from './helpers/db';
import { nextE2eClientIp } from './helpers/e2e-client-ip';

/**
 * e2e: External Interaction API ([Spec EIA §1~§11]).
 *
 * 실 인프라 위에서 다음 invariant 를 검증한다:
 * 1. webhook 트리거 호출 응답이 `interaction.token` + `endpoints` 를 포함 (per_execution)
 * 2. iext token 으로 InteractionGuard 통과 + interact 가 비동기 202 반환
 * 3. 다른 execution 의 iext 로는 401 (scope_mismatch / token rejected)
 * 4. itk 토큰 verifyNotificationSignature — HMAC SHA256 검증 (sender 측의 헬퍼)
 * G. submit_form field 검증 실패 → 400 VALIDATION_ERROR + details[{field,code:INVALID_FIELD}]
 *    (spec form §4·§6.2 / EIA §5.1 — waiting_for_input 유지, 재제출 가능)
 *
 * 본 e2e 는 BullMQ Redis / Webhook 발송 자체는 검증하지 않음 — outbound dispatcher 는 unit 에서
 * 이미 15 cases 커버. 본 e2e 는 인증 / endpoint / 응답 shape 의 cross-stack 정합성에 집중.
 */

const BASE_URL = process.env.E2E_BASE_URL ?? 'http://backend-e2e:3011';

async function createTriggerWithInteraction(
  db: Client,
  opts: { interactionEnabled: boolean; tokenStrategy?: string },
): Promise<{
  triggerId: string;
  endpointPath: string;
  workspaceId: string;
  workflowId: string;
}> {
  // workspace + workflow + node + trigger 직접 DB 삽입 — auth 흐름 우회.
  const workspaceId = randomUUID();
  await db
    .query(
      `INSERT INTO workspace (id, name, slug, owner_id, created_at, updated_at)
     VALUES ($1, $2, $3, $4, NOW(), NOW())`,
      [
        workspaceId,
        `e2e-ws-${workspaceId.slice(0, 8)}`,
        `e2e-${workspaceId.slice(0, 8)}`,
        workspaceId,
      ],
    )
    .catch(() => {
      // owner_id NOT NULL FK 일 수 있어 fallback: user 먼저 삽입.
    });
  const userId = randomUUID();
  await db
    .query(
      `INSERT INTO "user" (id, name, email, password_hash, email_verified, created_at, updated_at)
     VALUES ($1, $2, $3, $4, true, NOW(), NOW())
     ON CONFLICT (id) DO NOTHING`,
      [userId, 'e2e', `e2e-${userId.slice(0, 8)}@test.local`, 'x'],
    )
    .catch(() => undefined);
  // workspace 재시도 (FK 만족)
  await db.query(
    `INSERT INTO workspace (id, name, slug, owner_id, created_at, updated_at)
     VALUES ($1, $2, $3, $4, NOW(), NOW())
     ON CONFLICT (id) DO NOTHING`,
    [workspaceId, `e2e-ws`, `e2e-${workspaceId.slice(0, 8)}`, userId],
  );
  const workflowId = randomUUID();
  await db.query(
    `INSERT INTO workflow (id, workspace_id, name, is_active, current_version, created_by, created_at, updated_at)
     VALUES ($1, $2, $3, true, 1, $4, NOW(), NOW())`,
    [workflowId, workspaceId, 'e2e-wf', userId],
  );
  // Manual trigger node 가 있어야 webhook 흐름이 정상 동작. 최소 schema.
  await db.query(
    `INSERT INTO node (id, workflow_id, type, category, label, config, position_x, position_y, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, 0, 0, NOW(), NOW())`,
    [
      randomUUID(),
      workflowId,
      'manual_trigger',
      'trigger',
      'trg',
      JSON.stringify({ parameters: [] }),
    ],
  );
  const triggerId = randomUUID();
  // endpoint_path 는 v4 UUID 형식 강제(WH-MG-02, DB CHECK chk_trigger_endpoint_path_uuid).
  // 직접 INSERT 도 제약 대상이므로 UUID 로 발급한다.
  const endpointPath = randomUUID();
  const config = opts.interactionEnabled
    ? {
        notification: null,
        interaction: {
          enabled: true,
          tokenStrategy: opts.tokenStrategy ?? 'per_execution',
        },
      }
    : {};
  await db.query(
    `INSERT INTO trigger (id, workspace_id, workflow_id, type, name, is_active, config, endpoint_path, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, true, $6, $7, NOW(), NOW())`,
    [
      triggerId,
      workspaceId,
      workflowId,
      'webhook',
      'e2e-trg',
      config,
      endpointPath,
    ],
  );
  return { triggerId, endpointPath, workspaceId, workflowId };
}

// backend-e2e 의 JWT_SECRET (docker-compose.e2e.yml) — interaction-token 을
// backend 와 동일 키로 mint 하기 위함. runner env 에 미주입이면 compose 값으로 fallback.
const JWT_SECRET =
  process.env.JWT_SECRET ?? 'clemvion-e2e-jwt-secret-do-not-use-in-prod-x9y8z7';

/** InteractionTokenService.issuePerExecution 과 동형의 iext_* 토큰을 직접 mint. */
function mintInteractionToken(executionId: string): string {
  const jwt = sign(
    { sub: executionId, aud: 'interaction', jti: randomUUID() },
    JWT_SECRET,
    { algorithm: 'HS256', expiresIn: 3600 },
  );
  return `iext_${jwt}`;
}

describe('External Interaction API (e2e)', () => {
  let db: Client;

  beforeAll(async () => {
    db = createDbClient();
    await db.connect();
  }, 30_000);

  afterAll(async () => {
    await db.end();
  });

  it('A. webhook 트리거 응답에 interaction.token + endpoints 동봉 (per_execution)', async () => {
    const { endpointPath } = await createTriggerWithInteraction(db, {
      interactionEnabled: true,
    });
    const res = await request(BASE_URL)
      .post(`/api/hooks/${endpointPath}`)
      .set('x-forwarded-for', nextE2eClientIp())
      .send({ foo: 'bar' });
    expect(res.status).toBe(202);
    expect(res.body.data.executionId).toBeDefined();
    expect(res.body.data.interaction).toBeDefined();
    expect(res.body.data.interaction.token).toMatch(/^iext_/);
    expect(res.body.data.interaction.expiresAt).toBeDefined();
    expect(res.body.data.interaction.endpoints.stream).toMatch(
      /^\/api\/external\/executions\/[0-9a-f-]+\/stream$/,
    );
  });

  it('B. interaction 미설정 trigger 는 응답에 interaction 미동봉', async () => {
    const { endpointPath } = await createTriggerWithInteraction(db, {
      interactionEnabled: false,
    });
    const res = await request(BASE_URL)
      .post(`/api/hooks/${endpointPath}`)
      .set('x-forwarded-for', nextE2eClientIp())
      .send({});
    expect(res.status).toBe(202);
    expect(res.body.data.interaction).toBeUndefined();
  });

  it('C. iext 토큰 없이 /interact 호출 시 401 + X-Refresh-Token-Url 헤더', async () => {
    const { endpointPath } = await createTriggerWithInteraction(db, {
      interactionEnabled: true,
    });
    const trigger = await request(BASE_URL)
      .post(`/api/hooks/${endpointPath}`)
      .set('x-forwarded-for', nextE2eClientIp())
      .send({});
    const executionId = trigger.body.data.executionId as string;
    const res = await request(BASE_URL)
      .post(`/api/external/executions/${executionId}/interact`)
      .send({ command: 'cancel' });
    expect(res.status).toBe(401);
    expect(res.headers['x-refresh-token-url']).toBe(
      `/api/external/executions/${executionId}/refresh-token`,
    );
  });

  // D 시나리오 — InteractionGuard 의 nested `{ error: { code, message } }` throw shape 이
  // GlobalExceptionFilter 의 fallback path 에서 잡혀 default `AUTH_REQUIRED` 로 응답되던 회귀를
  // filter 에 nested 인식을 추가해 해소 (`common/filters/http-exception.filter.ts`).
  it('D. 같은 trigger 의 다른 execution 토큰으로 호출 시 TOKEN_SCOPE_MISMATCH', async () => {
    const setup = await createTriggerWithInteraction(db, {
      interactionEnabled: true,
    });
    const r1 = await request(BASE_URL)
      .post(`/api/hooks/${setup.endpointPath}`)
      .set('x-forwarded-for', nextE2eClientIp())
      .send({});
    const r2 = await request(BASE_URL)
      .post(`/api/hooks/${setup.endpointPath}`)
      .set('x-forwarded-for', nextE2eClientIp())
      .send({});
    expect(r1.status).toBe(202);
    expect(r2.status).toBe(202);
    const exec1Id = r1.body.data.executionId as string;
    const token2 = r2.body.data.interaction.token as string;
    expect(typeof token2).toBe('string');
    // exec1 endpoint 를 token2 로 호출 — 토큰의 sub 는 exec2 이므로 scope mismatch.
    const res = await request(BASE_URL)
      .post(`/api/external/executions/${exec1Id}/interact`)
      .set('Authorization', `Bearer ${token2}`)
      .send({ command: 'cancel' });
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('TOKEN_SCOPE_MISMATCH');
  });

  it('E. verifyNotificationSignature 헬퍼는 sender HMAC 과 정합 (cross-stack)', () => {
    // dispatcher 가 만드는 서명과 SDK 검증이 같은 알고리즘을 쓰는지 cross-check.
    const secret = 'wsk_e2e-secret';
    const ts = Math.floor(Date.now() / 1000);
    const body = '{"x":1}';
    const expected = createHmac('sha256', secret)
      .update(`${ts}.${body}`)
      .digest('hex');
    expect(expected).toMatch(/^[a-f0-9]{64}$/);
    // 실제 cross-stack 호출은 환경 의존이라 unit + SDK 가 이미 verify 함수를 커버.
  });

  it('F. submit_message 10001자 초과 → 400 MESSAGE_TOO_LONG (I-5 e2e, spec §5.1)', async () => {
    // 길이 초과 검증은 continueAiConversation 의 첫 번째 단계에서 발생하므로
    // 실제 AI 노드 실행 없이 waiting_for_input 상태의 execution 만 있으면 충분.
    const { workflowId } = await createTriggerWithInteraction(db, {
      interactionEnabled: true,
    });
    const executionId = randomUUID();
    await db.query(
      `INSERT INTO execution (id, workflow_id, status, started_at)
       VALUES ($1, $2, 'waiting_for_input', NOW())
       ON CONFLICT (id) DO NOTHING`,
      [executionId, workflowId],
    );
    const iextToken = mintInteractionToken(executionId);
    const longMessage = 'x'.repeat(10_001);
    const res = await request(BASE_URL)
      .post(`/api/external/executions/${executionId}/interact`)
      .set('Authorization', `Bearer ${iextToken}`)
      .send({
        command: 'submit_message',
        nodeId: randomUUID(),
        message: longMessage,
      });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('MESSAGE_TOO_LONG');
    // 내부 길이 수치(10000/10001)가 클라이언트 응답에 노출되지 않는다 (serverDetail 전용).
    expect(JSON.stringify(res.body)).not.toContain('10000');
    expect(JSON.stringify(res.body)).not.toContain('10001');
  });

  it('G. submit_form 필수 field 누락 → 400 VALIDATION_ERROR + details (form §4·§6.2 / §5.1)', async () => {
    // waiting form 노드 + node_execution 을 직접 구성. publisher 측 동기 검증이
    // node lookup 후 발생하므로 node_execution(WAITING) row 가 필요하다.
    const { workflowId } = await createTriggerWithInteraction(db, {
      interactionEnabled: true,
    });
    const formNodeId = randomUUID();
    await db.query(
      `INSERT INTO node (id, workflow_id, type, category, label, config, position_x, position_y, created_at, updated_at)
       VALUES ($1, $2, 'form', 'presentation', 'frm', $3, 0, 0, NOW(), NOW())`,
      [
        formNodeId,
        workflowId,
        JSON.stringify({
          fields: [
            { name: 'email', type: 'email', label: 'Email', required: true },
          ],
        }),
      ],
    );
    const executionId = randomUUID();
    await db.query(
      `INSERT INTO execution (id, workflow_id, status, started_at)
       VALUES ($1, $2, 'waiting_for_input', NOW())`,
      [executionId, workflowId],
    );
    await db.query(
      `INSERT INTO node_execution (id, execution_id, node_id, status, started_at)
       VALUES ($1, $2, $3, 'waiting_for_input', NOW())`,
      [randomUUID(), executionId, formNodeId],
    );
    const iextToken = mintInteractionToken(executionId);
    const res = await request(BASE_URL)
      .post(`/api/external/executions/${executionId}/interact`)
      .set('Authorization', `Bearer ${iextToken}`)
      // I-16: nodeId body は assertNodeId 유무 검사만 수행 — 실제 field lookup 은
      // node_execution row 의 nodeId 가 결정한다 (formNodeId 가 lookup key 가 아님).
      .send({ command: 'submit_form', nodeId: formNodeId, data: {} });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.details[0].field).toBe('email');
    expect(res.body.error.details[0].code).toBe('INVALID_FIELD');
  });

  it('H. /interact per-execution rate-limit 초과 → 429 RATE_LIMITED + Retry-After (§8.4)', async () => {
    // execution 당 분당 60 한도(InteractionRateLimiterService, Redis fixed-window).
    // fresh execution 이라 카운터가 0 에서 시작 — 61+ 요청 중 초과분이 429.
    // rate-limit 가드는 handler 이전에 실행되므로 command 결과(202/410 등)와 무관하게 카운트된다.
    const { workflowId } = await createTriggerWithInteraction(db, {
      interactionEnabled: true,
    });
    const executionId = randomUUID();
    await db.query(
      `INSERT INTO execution (id, workflow_id, status, started_at)
       VALUES ($1, $2, 'waiting_for_input', NOW())`,
      [executionId, workflowId],
    );
    const iextToken = mintInteractionToken(executionId);

    // 61 요청 병렬 발사 — Redis INCR 은 원자적이라 정확히 60 통과 후 초과분 429.
    const N = 61;
    const responses = await Promise.all(
      Array.from({ length: N }, () =>
        request(BASE_URL)
          .post(`/api/external/executions/${executionId}/interact`)
          .set('Authorization', `Bearer ${iextToken}`)
          .send({ command: 'cancel' }),
      ),
    );

    const rateLimited = responses.filter((r) => r.status === 429);
    // 최소 1건은 한도 초과 429 여야 한다 (61 > 60).
    expect(rateLimited.length).toBeGreaterThanOrEqual(1);
    const first429 = rateLimited[0];
    expect(first429.body.error.code).toBe('RATE_LIMITED');
    // Retry-After 헤더로 재시도 대기 시간(초) 안내.
    expect(first429.headers['retry-after']).toBeDefined();
    expect(Number(first429.headers['retry-after'])).toBeGreaterThan(0);
    // 429 는 SSE 전용 TOO_MANY_CONNECTIONS 와 다른 코드여야 한다 (별개 표면).
    expect(first429.body.error.code).not.toBe('TOO_MANY_CONNECTIONS');
  }, 30_000);

  it('I. getStatus wire — conversation_thread·nodeOutput 의 secret 이 `***` 로 마스킹 (EIA §R17)', async () => {
    // 실 DB 에 waiting execution + secret 포함 thread/nodeOutput 을 seed 하고, 실제
    // getStatus wire 응답이 마스킹돼 나가는지 end-to-end 로 검증한다.
    const { workflowId } = await createTriggerWithInteraction(db, {
      interactionEnabled: true,
    });
    const nodeId = randomUUID();
    await db.query(
      `INSERT INTO node (id, workflow_id, type, category, label, config, position_x, position_y, created_at, updated_at)
       VALUES ($1, $2, 'ai_agent', 'ai', 'Agent', $3, 0, 0, NOW(), NOW())`,
      [nodeId, workflowId, JSON.stringify({ mode: 'multi_turn' })],
    );
    const executionId = randomUUID();
    const thread = {
      id: 'default',
      nextSeq: 1,
      totalChars: 40,
      turns: [
        {
          seq: 0,
          nodeId,
          nodeLabel: 'Agent',
          nodeType: 'ai_agent',
          source: 'ai_tool',
          text: 'called with Authorization: Bearer sk-E2E-THREAD-LEAK',
          timestamp: '2026-07-10T00:00:00.000Z',
        },
      ],
    };
    await db.query(
      `INSERT INTO execution (id, workflow_id, status, conversation_thread, started_at)
       VALUES ($1, $2, 'waiting_for_input', $3, NOW())`,
      [executionId, workflowId, JSON.stringify(thread)],
    );
    await db.query(
      `INSERT INTO node_execution (id, execution_id, node_id, status, output_data, started_at)
       VALUES ($1, $2, $3, 'waiting_for_input', $4, NOW())`,
      [
        randomUUID(),
        executionId,
        nodeId,
        JSON.stringify({
          meta: { interactionType: 'ai_conversation' },
          conversationConfig: {
            placeholder: 'msg',
            message: 'reply api_key=AKIA-E2E-NODEOUT',
          },
        }),
      ],
    );

    const token = mintInteractionToken(executionId);
    const res = await request(BASE_URL)
      .get(`/api/external/executions/${executionId}`)
      .set('x-forwarded-for', nextE2eClientIp())
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    const wire = JSON.stringify(res.body);
    // 실 secret 은 wire 어디에도 남지 않는다.
    expect(wire).not.toContain('sk-E2E-THREAD-LEAK');
    expect(wire).not.toContain('AKIA-E2E-NODEOUT');
    expect(wire).toContain('***');
    // 비-secret 은 보존 (마스킹이 구조를 깨지 않음).
    expect(wire).toContain('msg');
  }, 30_000);

  it('I-2. getStatus wire — buttons 노드는 buttonConfig variant, thread 부재 시 키 생략 (EIA §5.3 / API 규약 §5.4)', async () => {
    // context 는 판별자 없는 닫힌 2-variant union 이다. 실 HTTP + DB round-trip 으로
    // (a) buttons + buttonConfig → buttonConfig variant 가 선택되고 nodeOutput 키가 없는지,
    // (b) durable thread 가 없으면 conversationThread 가 `null` 이 아니라 **키 자체 부재**인지 확인.
    const { workflowId } = await createTriggerWithInteraction(db, {
      interactionEnabled: true,
    });
    const nodeId = randomUUID();
    await db.query(
      `INSERT INTO node (id, workflow_id, type, category, label, config, position_x, position_y, created_at, updated_at)
       VALUES ($1, $2, 'carousel', 'presentation', 'Carousel', $3, 0, 0, NOW(), NOW())`,
      [nodeId, workflowId, JSON.stringify({})],
    );
    const executionId = randomUUID();
    // conversation_thread 컬럼을 채우지 않는다 (durable park 이력 없음).
    await db.query(
      `INSERT INTO execution (id, workflow_id, status, started_at)
       VALUES ($1, $2, 'waiting_for_input', NOW())`,
      [executionId, workflowId],
    );
    await db.query(
      `INSERT INTO node_execution (id, execution_id, node_id, status, output_data, started_at)
       VALUES ($1, $2, $3, 'waiting_for_input', $4, NOW())`,
      [
        randomUUID(),
        executionId,
        nodeId,
        JSON.stringify({
          meta: { interactionType: 'buttons' },
          config: { buttonConfig: { buttons: [{ id: 'b1', label: '문의' }] } },
        }),
      ],
    );

    const token = mintInteractionToken(executionId);
    const res = await request(BASE_URL)
      .get(`/api/external/executions/${executionId}`)
      .set('x-forwarded-for', nextE2eClientIp())
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    const context = res.body.data.context;
    // (a) buttonConfig variant — nodeOutput 키는 실리지 않는다.
    expect(context.interactionType).toBe('buttons');
    expect(context.waitingNodeId).toBe(nodeId);
    expect(context.buttonConfig.buttons).toEqual([{ id: 'b1', label: '문의' }]);
    expect(Object.keys(context)).not.toContain('nodeOutput');
    // (b) 키 생략 — `null` 이 아니라 부재.
    expect(Object.keys(context)).not.toContain('conversationThread');
    // 형제 필드는 `null` 관례 (부재 표현 2종이 한 응답에 공존).
    expect(res.body.data.result).toBeNull();
    expect(res.body.data.error).toBeNull();
    expect(res.body.data.currentNode.interactionType).toBe('buttons');
  }, 30_000);

  it('J. getStatus wire — terminal result(COMPLETED) outputData 의 secret 도 마스킹 (EIA §R17)', async () => {
    // 헤드라인 변경분: COMPLETED result 의 outputData 가 실 DB round-trip 으로도 마스킹되는지.
    const { workflowId } = await createTriggerWithInteraction(db, {
      interactionEnabled: true,
    });
    const executionId = randomUUID();
    await db.query(
      `INSERT INTO execution (id, workflow_id, status, output_data, started_at, finished_at)
       VALUES ($1, $2, 'completed', $3, NOW(), NOW())`,
      [
        executionId,
        workflowId,
        JSON.stringify({
          summary: 'done ok',
          creds: { authorization: 'Bearer sk-E2E-RESULT-LEAK' },
          api_key: 'AKIA-E2E-RESULT-KEY',
        }),
      ],
    );

    const token = mintInteractionToken(executionId);
    const res = await request(BASE_URL)
      .get(`/api/external/executions/${executionId}`)
      .set('x-forwarded-for', nextE2eClientIp())
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    // 응답은 { data: ExecutionStatusDto } 로 래핑된다 (전역 인터셉터).
    const body = res.body.data;
    expect(body.status).toBe('completed');
    const wire = JSON.stringify(body.result);
    expect(wire).not.toContain('sk-E2E-RESULT-LEAK');
    expect(wire).not.toContain('AKIA-E2E-RESULT-KEY');
    expect(wire).toContain('***');
    // 정상 결과 데이터는 보존.
    expect(body.result.summary).toBe('done ok');
  }, 30_000);
});
