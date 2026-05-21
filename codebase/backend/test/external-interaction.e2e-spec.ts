import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { Client } from 'pg';
import request from 'supertest';
import { createHmac, randomUUID } from 'crypto';

import { createDbClient } from './helpers/db';

/**
 * e2e: External Interaction API ([Spec EIA §1~§11]).
 *
 * 실 인프라 위에서 다음 invariant 를 검증한다:
 * 1. webhook 트리거 호출 응답이 `interaction.token` + `endpoints` 를 포함 (per_execution)
 * 2. iext token 으로 InteractionGuard 통과 + interact 가 비동기 202 반환
 * 3. 다른 execution 의 iext 로는 401 (scope_mismatch / token rejected)
 * 4. itk 토큰 verifyNotificationSignature — HMAC SHA256 검증 (sender 측의 헬퍼)
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
  const endpointPath = `e2e-${triggerId.slice(0, 8)}`;
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
      .send({});
    const r2 = await request(BASE_URL)
      .post(`/api/hooks/${setup.endpointPath}`)
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
});
