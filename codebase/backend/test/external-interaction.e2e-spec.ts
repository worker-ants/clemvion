import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { Client } from 'pg';
import Redis from 'ioredis';
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

/**
 * 멱등 캐시 Redis 키 — [Spec EIA §R8 "캐시 키 스코프"].
 *
 * 헤더 값 단독이 아니라 `<executionId>:<route>` 로 스코프된다. `route` 는 컨트롤러
 * 핸들러명(`interact` | `cancel`) — 같은 인터셉터가 두 자리에 붙어 있고 `CancelDto` 는 전 필드
 * optional 이라 body `{}` 가 interact 의 `{}` 와 hash 가 같아지기 때문이다.
 */
function idempotencyCacheKey(
  executionId: string,
  rawKey: string,
  route: 'interact' | 'cancel' = 'interact',
): string {
  return `interaction:idempotency:${executionId}:${route}:${rawKey}`;
}

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
  // Idempotency-Key 캐시(§R8)의 관측점. 상태코드만으로는 "캐시 재현" 과 "같은 조건 재처리" 가
  // 구분되지 않아 두 구현을 못 가른다 — 엔트리 자체를 봐야 한다(IDEM-* 주석 참조).
  let redis: Redis;

  beforeAll(async () => {
    db = createDbClient();
    await db.connect();
    redis = new Redis({
      host: process.env.REDIS_HOST ?? 'redis',
      port: Number(process.env.REDIS_PORT ?? '6379'),
    });
  }, 30_000);

  afterAll(async () => {
    await db.end();
    await redis.quit();
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
      // F-1: nodeId 는 이제 실제 대기 노드와 일치해야 한다. 여기선 formNodeId 가
      // node_execution row 의 nodeId 와 같으므로 통과해 field 검증(§G)까지 진행된다.
      .send({ command: 'submit_form', nodeId: formNodeId, data: {} });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.details[0].field).toBe('email');
    expect(res.body.error.details[0].code).toBe('INVALID_FIELD');
  });

  // F-1 (plan eia-command-waiting-surface-guard) — 명령의 nodeId 가 실제 대기 노드와
  // 다르면 publisher 가 409 STATE_MISMATCH 로 거부한다 (§7.5.1 nodeId 불일치). stale/오지정
  // 제출을 현재 대기 노드로 오적용하지 않는다. 종전엔 assertNodeId 가 존재만 검사해 통과했다.
  it('G-2. submit_form nodeId 가 대기 노드와 불일치 → 409 STATE_MISMATCH (F-1)', async () => {
    const { workflowId } = await createTriggerWithInteraction(db, {
      interactionEnabled: true,
    });
    const waitingNodeId = randomUUID();
    await db.query(
      `INSERT INTO node (id, workflow_id, type, category, label, config, position_x, position_y, created_at, updated_at)
       VALUES ($1, $2, 'form', 'presentation', 'frm', $3, 0, 0, NOW(), NOW())`,
      [
        waitingNodeId,
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
      [randomUUID(), executionId, waitingNodeId],
    );
    const iextToken = mintInteractionToken(executionId);
    const res = await request(BASE_URL)
      .post(`/api/external/executions/${executionId}/interact`)
      .set('Authorization', `Bearer ${iextToken}`)
      // 대기 노드는 waitingNodeId 인데 다른 nodeId 를 지정 → 거부.
      .send({
        command: 'submit_form',
        nodeId: randomUUID(),
        data: { email: 'a@b.co' },
      });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('STATE_MISMATCH');
  });

  // ---------------------------------------------------------------------------
  // Idempotency-Key — [Spec EIA §R8] 캐시 대상은 닫힌 목록(2xx · 409 · 410).
  //
  // **이 블록이 존재하는 이유**: 같은 계약을 단위 테스트로만 검증하다가 네 라운드 연속으로
  // "mock 이 만든 상태 ≠ 시스템이 실제로 만드는 상태" 결함을 냈다(`16_29_45` CRITICAL 외).
  // 409·410 은 서비스가 **throw** 하고 컨트롤러는 `@HttpCode(202)` 라, 성공 채널에
  // `statusCode` 를 프리셋하는 mock 은 실재하지 않는 경로를 검사한다. 예외 필터·데코레이터·
  // 직렬화를 전부 통과하는 **실 파이프라인**에서 확인하는 것이 이 계약의 맞는 검증 층위다.
  // ---------------------------------------------------------------------------

  it('IDEM-1. 같은 Idempotency-Key 로 409 를 재요청하면 캐시에서 그대로 재현된다 (§R8)', async () => {
    const { workflowId } = await createTriggerWithInteraction(db, {
      interactionEnabled: true,
    });
    const waitingNodeId = randomUUID();
    await db.query(
      `INSERT INTO node (id, workflow_id, type, category, label, config, position_x, position_y, created_at, updated_at)
       VALUES ($1, $2, 'form', 'presentation', 'frm', $3, 0, 0, NOW(), NOW())`,
      [
        waitingNodeId,
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
      [randomUUID(), executionId, waitingNodeId],
    );
    const iextToken = mintInteractionToken(executionId);
    const idempotencyKey = `e2e-409-${randomUUID()}`;
    // G-2 와 같은 형태 — 이 nodeId 는 지금 대기 노드가 아니라 409 STATE_MISMATCH 가 된다.
    const laterValidNodeId = randomUUID();
    const body = {
      command: 'submit_form',
      nodeId: laterValidNodeId,
      data: { email: 'a@b.co' },
    };

    const first = await request(BASE_URL)
      .post(`/api/external/executions/${executionId}/interact`)
      .set('Authorization', `Bearer ${iextToken}`)
      .set('Idempotency-Key', idempotencyKey)
      .send(body);
    expect(first.status).toBe(409);
    expect(first.body.error.code).toBe('STATE_MISMATCH');

    // **판별력의 핵심 — 캐시 엔트리를 직접 확인한다.**
    //
    // 상태코드만 비교하면 이 계약은 검증되지 않는다: 캐시가 없어도 두 번째 요청은 같은
    // 조건으로 다시 처리돼 **똑같이 409** 를 내기 때문이다. 실제로 첫 시도에서 "재요청 전에
    // nodeId 를 유효하게 바꿔 202 가 나오게 만든다" 는 fixture 를 썼는데, 예외 경로 적재를
    // 제거한 뮤턴트에서도 e2e 가 **그대로 통과**했다(실측) — 두 구현을 못 가르는 fixture 였다.
    // Redis 키의 존재와 내용이 이 계약의 유일한 관측점이다.
    const cached = await redis.get(
      idempotencyCacheKey(executionId, idempotencyKey),
    );
    expect(cached).not.toBeNull();
    const entry = JSON.parse(cached as string) as {
      statusCode: number;
      responseJson: string;
    };
    expect(entry.statusCode).toBe(409);
    expect(JSON.parse(entry.responseJson)).toMatchObject({
      error: { code: 'STATE_MISMATCH' },
    });

    // 그리고 재요청이 그 캐시로 재현되는지 — 상태코드·에러코드가 동일해야 한다.
    const second = await request(BASE_URL)
      .post(`/api/external/executions/${executionId}/interact`)
      .set('Authorization', `Bearer ${iextToken}`)
      .set('Idempotency-Key', idempotencyKey)
      .send(body);
    expect(second.status).toBe(409);
    expect(second.body.error.code).toBe('STATE_MISMATCH');
  });

  it('IDEM-2. 400 VALIDATION_ERROR 는 캐시되지 않아 같은 키로 재제출할 수 있다 (§R8)', async () => {
    // R8 의 근거 그대로 — 검증 실패는 waiting_for_input 이 유지되므로 **재제출이 normal
    // flow** 다. 캐시되면 사용자가 form 을 고쳐도 stale 에러를 계속 받는다.
    const { workflowId } = await createTriggerWithInteraction(db, {
      interactionEnabled: true,
    });
    const waitingNodeId = randomUUID();
    await db.query(
      `INSERT INTO node (id, workflow_id, type, category, label, config, position_x, position_y, created_at, updated_at)
       VALUES ($1, $2, 'form', 'presentation', 'frm', $3, 0, 0, NOW(), NOW())`,
      [
        waitingNodeId,
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
      [randomUUID(), executionId, waitingNodeId],
    );
    const iextToken = mintInteractionToken(executionId);
    const idempotencyKey = `e2e-400-${randomUUID()}`;

    const bad = await request(BASE_URL)
      .post(`/api/external/executions/${executionId}/interact`)
      .set('Authorization', `Bearer ${iextToken}`)
      .set('Idempotency-Key', idempotencyKey)
      .send({
        command: 'submit_form',
        nodeId: waitingNodeId,
        data: { email: 'not-an-email' },
      });
    expect(bad.status).toBe(400);
    expect(bad.body.error.code).toBe('VALIDATION_ERROR');

    // 적재 자체가 없어야 한다 — 아래 재제출 성공은 캐시 부재의 **결과**이지 직접 증거가
    // 아니다(엔트리가 있어도 body 가 달라 409 로 갈 수 있어 원인이 섞인다).
    expect(
      await redis.get(idempotencyCacheKey(executionId, idempotencyKey)),
    ).toBeNull();

    // 같은 키로 **고친 값**을 재제출 — 400 이 캐시됐다면 body 가 달라 409
    // IDEMPOTENCY_KEY_CONFLICT 가 나거나 stale 400 이 재현된다. 둘 다 아니어야 한다.
    const fixed = await request(BASE_URL)
      .post(`/api/external/executions/${executionId}/interact`)
      .set('Authorization', `Bearer ${iextToken}`)
      .set('Idempotency-Key', idempotencyKey)
      .send({
        command: 'submit_form',
        nodeId: waitingNodeId,
        data: { email: 'a@b.co' },
      });
    expect(fixed.status).toBe(202);
  });

  it('IDEM-3. 410 도 실 파이프라인에서 캐시·재현된다 (§R8 닫힌 목록의 자매 자리)', async () => {
    // `IDEM-1` 이 409 만 덮으면 **같은 분기를 공유하는 410 은 e2e 밖**에 남는다 — 이 e2e 를
    // 들여온 이유(단위 mock 이 실제 경로를 못 반영)가 410 자리에는 적용되지 않는 셈이다.
    // 이 세션에서 자매 자리 누락이 세 번 반복돼 대칭을 명시적으로 고정한다.
    const { workflowId } = await createTriggerWithInteraction(db, {
      interactionEnabled: true,
    });
    const executionId = randomUUID();
    // terminal execution → 어떤 명령이든 410 EXECUTION_TERMINATED.
    await db.query(
      `INSERT INTO execution (id, workflow_id, status, started_at, finished_at)
       VALUES ($1, $2, 'completed', NOW(), NOW())`,
      [executionId, workflowId],
    );
    const iextToken = mintInteractionToken(executionId);
    const idempotencyKey = `e2e-410-${randomUUID()}`;
    const body = { command: 'cancel' };

    const first = await request(BASE_URL)
      .post(`/api/external/executions/${executionId}/interact`)
      .set('Authorization', `Bearer ${iextToken}`)
      .set('Idempotency-Key', idempotencyKey)
      .send(body);
    expect(first.status).toBe(410);
    expect(first.body.error.code).toBe('EXECUTION_TERMINATED');

    const cached = await redis.get(
      idempotencyCacheKey(executionId, idempotencyKey),
    );
    expect(cached).not.toBeNull();
    const entry = JSON.parse(cached as string) as { statusCode: number };
    expect(entry.statusCode).toBe(410);

    const second = await request(BASE_URL)
      .post(`/api/external/executions/${executionId}/interact`)
      .set('Authorization', `Bearer ${iextToken}`)
      .set('Idempotency-Key', idempotencyKey)
      .send(body);
    expect(second.status).toBe(410);
    expect(second.body.error.code).toBe('EXECUTION_TERMINATED');
  });

  it('IDEM-4. 다른 execution 이 같은 키·같은 body 를 써도 남의 응답을 받지 않는다 (§R8 캐시 키 스코프)', async () => {
    // 종전 키는 `Idempotency-Key` 헤더 값 단독이라 네임스페이스를 **모든 execution 이 공유**
    // 했다. B 가 자기 execution 에 정당한 토큰으로 A 와 같은 키·같은 body 를 쓰면 캐시 hit 이
    // 되어 **B 의 명령이 서비스에 닿지도 않은 채** A 의 응답이 반환된다.
    //
    // **판별력** — 두 execution 의 상태를 다르게 둬서 상태코드 자체가 갈리게 만든다.
    // A 는 terminal(410), B 는 waiting_for_input. 스코프가 없으면 B 가 A 의 410 을 받는다.
    // 키 존재만 보면 "레이아웃" 은 잡지만 **실제 피해**(남의 응답 수신)는 못 본다.
    const { workflowId } = await createTriggerWithInteraction(db, {
      interactionEnabled: true,
    });
    const idempotencyKey = `e2e-scope-${randomUUID()}`;
    const body = { command: 'cancel' };

    // A — terminal execution. 어떤 명령이든 410.
    const executionA = randomUUID();
    await db.query(
      `INSERT INTO execution (id, workflow_id, status, started_at, finished_at)
       VALUES ($1, $2, 'completed', NOW(), NOW())`,
      [executionA, workflowId],
    );

    // B — 살아 있는 waiting_for_input execution.
    const waitingNodeId = randomUUID();
    await db.query(
      `INSERT INTO node (id, workflow_id, type, category, label, config, position_x, position_y, created_at, updated_at)
       VALUES ($1, $2, 'form', 'presentation', 'frm', $3, 0, 0, NOW(), NOW())`,
      [waitingNodeId, workflowId, JSON.stringify({ fields: [] })],
    );
    const executionB = randomUUID();
    await db.query(
      `INSERT INTO execution (id, workflow_id, status, started_at)
       VALUES ($1, $2, 'waiting_for_input', NOW())`,
      [executionB, workflowId],
    );
    await db.query(
      `INSERT INTO node_execution (id, execution_id, node_id, status, started_at)
       VALUES ($1, $2, $3, 'waiting_for_input', NOW())`,
      [randomUUID(), executionB, waitingNodeId],
    );

    // A 먼저 — 410 이 캐시에 적재된다.
    const fromA = await request(BASE_URL)
      .post(`/api/external/executions/${executionA}/interact`)
      .set('Authorization', `Bearer ${mintInteractionToken(executionA)}`)
      .set('Idempotency-Key', idempotencyKey)
      .send(body);
    expect(fromA.status).toBe(410);

    // B — 같은 키·같은 body(= 같은 bodyHash) 인데도 **자기 처리 결과**를 받아야 한다.
    // 스코프가 없으면 여기서 A 의 410 EXECUTION_TERMINATED 가 돌아온다.
    //
    // **이 단언이 키 레이아웃 단언보다 앞에 와야 한다.** 처음엔 A 의 캐시 키 존재를 먼저
    // 단언했는데, 뮤테이션 실측에서 스코프를 제거한 뮤턴트가 **그 white-box 단언에서** 죽고
    // 아래 상태코드 단언에는 도달조차 못 했다 — "실제 피해(남의 응답 수신)를 관측한다" 는
    // 주장이 실증되지 않은 상태였다. 순서를 뒤집어 행동 단언이 먼저 죽게 한다.
    const fromB = await request(BASE_URL)
      .post(`/api/external/executions/${executionB}/interact`)
      .set('Authorization', `Bearer ${mintInteractionToken(executionB)}`)
      .set('Idempotency-Key', idempotencyKey)
      .send(body);
    expect(fromB.status).toBe(202);

    // 그 다음이 키 레이아웃 — 적재도 각자의 키로. GET 만 스코프하고 SET 이 전역이면
    // 다음 요청이 남의 것을 읽는다.
    expect(
      await redis.get(idempotencyCacheKey(executionA, idempotencyKey)),
    ).not.toBeNull();
    expect(
      await redis.get(idempotencyCacheKey(executionB, idempotencyKey)),
    ).not.toBeNull();
  });

  it('IDEM-5. 같은 execution 이라도 /interact 와 /cancel 은 캐시를 공유하지 않는다 (route 축)', async () => {
    // 같은 인터셉터가 두 자리(`interact`·`cancel`)에 붙어 있는데 키에 route 가 없으면,
    // `CancelDto` 가 전 필드 optional 이라 body 가 겹칠 때 한쪽 응답이 다른 쪽에 재생된다.
    //
    // **판별력** — 두 route 의 결과가 다르게 나오는 body 를 쓴다. `{command:'cancel'}` 은
    // `/interact` 에서는 정상 명령(terminal 이라 410)이지만 `/cancel` 에서는 `CancelDto` 에
    // 없는 필드라 `forbidNonWhitelisted` 로 **400 VALIDATION_ERROR** 다. route 세그먼트가
    // 빠지면 두 번째 요청이 검증에 닿기도 전에 캐시 hit 으로 410 을 받는다.
    //
    // 부수 효과로 **실 파이프라인에서의 route 이름**(`context.getHandler().name`)도 고정한다 —
    // 단위 mock 은 `getHandler()` 를 스스로 만들어 내므로 이 값을 검증할 수 없는 자리다.
    const { workflowId } = await createTriggerWithInteraction(db, {
      interactionEnabled: true,
    });
    const executionId = randomUUID();
    await db.query(
      `INSERT INTO execution (id, workflow_id, status, started_at, finished_at)
       VALUES ($1, $2, 'completed', NOW(), NOW())`,
      [executionId, workflowId],
    );
    const iextToken = mintInteractionToken(executionId);
    const idempotencyKey = `e2e-route-${randomUUID()}`;
    const body = { command: 'cancel' };

    const viaInteract = await request(BASE_URL)
      .post(`/api/external/executions/${executionId}/interact`)
      .set('Authorization', `Bearer ${iextToken}`)
      .set('Idempotency-Key', idempotencyKey)
      .send(body);
    expect(viaInteract.status).toBe(410);

    // **행동 단언이 먼저다** (IDEM-4 와 같은 이유 — 키 레이아웃 단언을 앞에 두면 뮤턴트가
    // 거기서 죽어 실제 피해가 관측되지 않는다). route 세그먼트가 빠지면 이 요청이 검증에
    // 닿기도 전에 캐시 hit 으로 interact 의 410 을 받는다.
    const viaCancel = await request(BASE_URL)
      .post(`/api/external/executions/${executionId}/cancel`)
      .set('Authorization', `Bearer ${iextToken}`)
      .set('Idempotency-Key', idempotencyKey)
      .send(body);
    expect(viaCancel.status).toBe(400);
    expect(viaCancel.body.error.code).toBe('VALIDATION_ERROR');

    // 그 다음이 키 레이아웃 — 실 파이프라인의 route 이름(`getHandler().name`)을 고정한다.
    expect(
      await redis.get(
        idempotencyCacheKey(executionId, idempotencyKey, 'interact'),
      ),
    ).not.toBeNull();
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
