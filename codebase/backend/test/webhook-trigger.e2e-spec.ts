import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { Client } from 'pg';
import crypto from 'node:crypto';
import request from 'supertest';

import { createDbClient, uniqueEmail, uniqueName } from './helpers/db';
import { registerAndLogin, createTeamWorkspace } from './helpers/auth';

/**
 * e2e: 외부 인입(웹훅 수신) 흐름 — spec/5-system/12-webhook.md.
 *
 * 인증은 trigger.auth_config_id 가 가리키는 AuthConfig 로 검증된다 (inline config 폐지).
 *   - 미존재 → 404 TRIGGER_NOT_FOUND
 *   - 비활성 트리거 → 410 TRIGGER_INACTIVE
 *   - authConfigId 없음 → 인증 없음 (202)
 *   - bearer / api_key / basic_auth / hmac AuthConfig → 자격 불일치 401 AUTH_FAILED, 일치 202
 *   - AuthConfig.is_active=false → 401
 *   - 인증 성공 시 AuthConfig.last_used_at 갱신 (fire-and-forget)
 */

const BASE_URL = process.env.E2E_BASE_URL ?? 'http://backend-e2e:3011';

describe('Webhook trigger (e2e)', () => {
  let db: Client;
  let token: string;
  let workspaceId: string;
  let workflowId: string;

  beforeAll(async () => {
    db = createDbClient();
    await db.connect();
    const owner = await registerAndLogin(BASE_URL, uniqueEmail('hook'), db);
    token = owner.accessToken;
    workspaceId = await createTeamWorkspace(
      BASE_URL,
      token,
      uniqueName('HOOK'),
    );

    const wf = await request(BASE_URL)
      .post('/api/workflows')
      .set('Authorization', `Bearer ${token}`)
      .set('X-Workspace-Id', workspaceId)
      .send({ name: uniqueName('hook-wf') });
    workflowId = wf.body.data.id;
  }, 60_000);

  afterAll(async () => {
    await db.end();
  });

  /**
   * AuthConfig 생성. create 응답은 자동 발급된 key/token/secret 을 평문으로 1회
   * 노출하므로(§2.17.2), 반환값에서 평문을 그대로 쓸 수 있다.
   */
  async function createAuthConfig(
    type: string,
    config: Record<string, unknown> = {},
  ): Promise<{ id: string; config: Record<string, unknown> }> {
    const res = await request(BASE_URL)
      .post('/api/auth-configs')
      .set('Authorization', `Bearer ${token}`)
      .set('X-Workspace-Id', workspaceId)
      .send({ name: uniqueName('ac'), type, config });
    expect(res.status).toBe(201);
    const data = res.body.data as {
      id: string;
      config: Record<string, unknown>;
    };
    return data;
  }

  async function createWebhookTrigger(
    name: string,
    endpointPath: string,
    opts: { authConfigId?: string; isActive?: boolean } = {},
  ): Promise<string> {
    const res = await request(BASE_URL)
      .post('/api/triggers')
      .set('Authorization', `Bearer ${token}`)
      .set('X-Workspace-Id', workspaceId)
      .send({
        workflowId,
        type: 'webhook',
        name,
        endpointPath,
        isActive: opts.isActive ?? true,
        ...(opts.authConfigId ? { authConfigId: opts.authConfigId } : {}),
      });
    expect(res.status).toBe(201);
    return (res.body.data as { id: string }).id;
  }

  it('A. 활성 webhook 트리거 (인증 없음) 수신 → 202 + executionId', async () => {
    const path = crypto.randomUUID(); // endpoint_path 는 v4 UUID 형식 강제(W1)
    await createWebhookTrigger(uniqueName('hook-a'), path);

    const res = await request(BASE_URL)
      .post(`/api/hooks/${path}`)
      .send({ payload: 'hello' });
    expect(res.status).toBe(202);
    expect(
      (res.body.data as { executionId: string }).executionId,
    ).toBeDefined();
  });

  it('B. 미존재 endpointPath → 404 TRIGGER_NOT_FOUND', async () => {
    const res = await request(BASE_URL)
      .post('/api/hooks/no-such-path-xyz')
      .send({});
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('TRIGGER_NOT_FOUND');
  });

  it('B2. 비-UUID endpointPath 로 트리거 생성 → 400 VALIDATION_ERROR (W1·WH-MG-02)', async () => {
    // ValidationPipe(@IsUUID('4')) 스택이 비-UUID endpoint_path 를 DB 도달 전에 막는지
    // e2e 레벨에서 검증 — DTO unit 과 별개로 실 파이프라인 회귀 가드.
    const res = await request(BASE_URL)
      .post('/api/triggers')
      .set('Authorization', `Bearer ${token}`)
      .set('X-Workspace-Id', workspaceId)
      .send({
        workflowId,
        type: 'webhook',
        name: uniqueName('hook-b2'),
        endpointPath: 'my-integration',
        isActive: true,
      });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('B3. 필수 파라미터 누락 → 400 INVALID_WEBHOOK_PAYLOAD + 공식 봉투 error.details[] (WH-EP-05-2 §5.2)', async () => {
    // 전용 워크플로 — manual_trigger 에 required 파라미터 부여. 공유 workflowId 를
    // 오염시키지 않도록 분리(다른 테스트의 무-파라미터 webhook 이 깨지지 않게).
    const wf = await request(BASE_URL)
      .post('/api/workflows')
      .set('Authorization', `Bearer ${token}`)
      .set('X-Workspace-Id', workspaceId)
      .send({ name: uniqueName('hook-b3') });
    const wfId = (wf.body.data as { id: string }).id;
    // 자동 생성된 manual_trigger 노드에 required string + optional number 파라미터 주입
    // (number 는 coerce 실패 경로 검증용 — required 아님이라 누락은 통과).
    await db.query(
      `UPDATE node SET config = $1 WHERE workflow_id = $2 AND type = 'manual_trigger'`,
      [
        JSON.stringify({
          parameters: [
            { name: 'orderId', type: 'string', required: true },
            { name: 'amount', type: 'number' },
          ],
        }),
        wfId,
      ],
    );

    const path = crypto.randomUUID();
    const tr = await request(BASE_URL)
      .post('/api/triggers')
      .set('Authorization', `Bearer ${token}`)
      .set('X-Workspace-Id', workspaceId)
      .send({
        workflowId: wfId,
        type: 'webhook',
        name: uniqueName('hook-b3'),
        endpointPath: path,
        isActive: true,
      });
    expect(tr.status).toBe(201);

    // orderId 누락 → GlobalExceptionFilter 가 공식 봉투로 직렬화. errors 가 아니라
    // error.details[] 로 필드별 사유가 surface 되어야 한다(§5.2 구현).
    const res = await request(BASE_URL)
      .post(`/api/hooks/${path}`)
      .send({ wrong: 'value' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_WEBHOOK_PAYLOAD');
    expect(res.body.error.requestId).toBeDefined();
    expect(res.body.error.details).toEqual([
      {
        field: 'orderId',
        code: 'MISSING_REQUIRED_FIELD',
        message: 'Required parameter is missing',
      },
    ]);
    // 구 flat 형식(errors[].reason)이 응답에 남아있지 않아야 한다.
    expect(res.body.errors).toBeUndefined();
    expect(res.body.error.errors).toBeUndefined();

    // 타입 강제 변환 실패(coerce) → TYPE_COERCION_FAILED. orderId 는 채우고
    // amount 에 비숫자 전송.
    const res2 = await request(BASE_URL)
      .post(`/api/hooks/${path}`)
      .send({ orderId: 'abc', amount: 'not-a-number' });
    expect(res2.status).toBe(400);
    expect(res2.body.error.code).toBe('INVALID_WEBHOOK_PAYLOAD');
    expect(res2.body.error.details).toEqual([
      {
        field: 'amount',
        code: 'TYPE_COERCION_FAILED',
        message: 'Value could not be coerced to the declared type',
      },
    ]);
  });

  it('C. 비활성 트리거 → 410 TRIGGER_INACTIVE', async () => {
    const path = crypto.randomUUID();
    const triggerId = await createWebhookTrigger(uniqueName('hook-c'), path);

    await request(BASE_URL)
      .patch(`/api/triggers/${triggerId}`)
      .set('Authorization', `Bearer ${token}`)
      .set('X-Workspace-Id', workspaceId)
      .send({ isActive: false })
      .expect(200);

    const res = await request(BASE_URL).post(`/api/hooks/${path}`).send({});
    expect(res.status).toBe(410);
    expect(res.body.error.code).toBe('TRIGGER_INACTIVE');
  });

  it('D. bearer AuthConfig — 잘못된 토큰 401, 올바른 토큰 202', async () => {
    const path = crypto.randomUUID();
    const ac = await createAuthConfig('bearer_token');
    const expectedToken = ac.config.token as string;
    await createWebhookTrigger(uniqueName('hook-d'), path, {
      authConfigId: ac.id,
    });

    const bad = await request(BASE_URL)
      .post(`/api/hooks/${path}`)
      .set('Authorization', 'Bearer wrong')
      .send({});
    expect(bad.status).toBe(401);
    expect(bad.body.error.code).toBe('AUTH_FAILED');

    const ok = await request(BASE_URL)
      .post(`/api/hooks/${path}`)
      .set('Authorization', `Bearer ${expectedToken}`)
      .send({});
    expect(ok.status).toBe(202);
  });

  it('E. hmac AuthConfig — 서명 누락 401, 올바른 서명 202', async () => {
    const path = crypto.randomUUID();
    const ac = await createAuthConfig('hmac');
    const secret = ac.config.secret as string;
    const payload = JSON.stringify({ event: 'push', ref: 'main' });
    await createWebhookTrigger(uniqueName('hook-e'), path, {
      authConfigId: ac.id,
    });

    const missing = await request(BASE_URL)
      .post(`/api/hooks/${path}`)
      .set('Content-Type', 'application/json')
      .send(payload);
    expect(missing.status).toBe(401);
    expect(missing.body.error.code).toBe('AUTH_FAILED');

    // rawBody: true (main.ts) 가 켜져 있으므로 올바른 서명은 202.
    const sig = `sha256=${crypto
      .createHmac('sha256', secret)
      .update(payload)
      .digest('hex')}`;
    const sigged = await request(BASE_URL)
      .post(`/api/hooks/${path}`)
      .set('Content-Type', 'application/json')
      .set('x-hub-signature-256', sig)
      .send(payload);
    expect(sigged.status).toBe(202);
  });

  // ── 본문 크기 경계 (WH-NF-02 옵션 C) ──────────────────────────────
  // J/K/L/M 은 알파벳 순서가 아니라 "본문 크기 경계" 주제로 묶어 인접 배치한다
  // (인증 1MB 통과/초과, 공개 32KB, 인증 1MB 초과).
  it('J. 인증(HMAC) webhook 512KB 본문 → 202 (라우트 스코프 1MB 파서 + rawBody/HMAC, WH-NF-02 옵션 C)', async () => {
    // 512KB 는 express 전역 기본 100KB 를 초과하므로, 통과하려면 /api/hooks/* 라우트 스코프
    // 1MB 파서가 전역보다 먼저 적용돼야 한다. HMAC 가 검증되려면 그 파서가 rawBody 도
    // 보존해야 한다 — 즉 본 테스트 하나가 (1MB 한도 + 미들웨어 순서 + rawBody) 를 동시 검증.
    const path = crypto.randomUUID();
    const ac = await createAuthConfig('hmac');
    const secret = ac.config.secret as string;
    await createWebhookTrigger(uniqueName('hook-j'), path, {
      authConfigId: ac.id,
    });

    const payload = JSON.stringify({
      event: 'push',
      blob: 'x'.repeat(512 * 1024),
    });
    expect(Buffer.byteLength(payload)).toBeGreaterThan(100 * 1024);
    const sig = `sha256=${crypto
      .createHmac('sha256', secret)
      .update(payload)
      .digest('hex')}`;
    const res = await request(BASE_URL)
      .post(`/api/hooks/${path}`)
      .set('Content-Type', 'application/json')
      .set('x-hub-signature-256', sig)
      .send(payload);
    expect(res.status).toBe(202);
  });

  it('K. webhook 본문 1MB 초과 → 413 PAYLOAD_TOO_LARGE (라우트 스코프 limit + 표준 봉투)', async () => {
    const path = crypto.randomUUID();
    await createWebhookTrigger(uniqueName('hook-k'), path); // 인증 없음 — 파서가 auth 전에 거부
    const tooBig = JSON.stringify({ blob: 'x'.repeat(1100 * 1024) }); // > 1MiB
    const res = await request(BASE_URL)
      .post(`/api/hooks/${path}`)
      .set('Content-Type', 'application/json')
      .send(tooBig);
    expect(res.status).toBe(413);
    expect(res.body.error.code).toBe('PAYLOAD_TOO_LARGE');
    expect(res.body.error.requestId).toBeDefined();
  });

  it('L. 공개 webhook 32KB 초과(1MB 미만) → 413 PUBLIC_WEBHOOK_BODY_TOO_LARGE (Guard 유지)', async () => {
    // 64KB 는 라우트 1MB 파서를 통과해 Guard 까지 도달하고, 공개 32KB 한도에서 거부된다.
    const path = crypto.randomUUID();
    await createWebhookTrigger(uniqueName('hook-l'), path); // auth_config_id IS NULL (공개)
    const payload = JSON.stringify({ blob: 'x'.repeat(64 * 1024) });
    const res = await request(BASE_URL)
      .post(`/api/hooks/${path}`)
      .set('Content-Type', 'application/json')
      .send(payload);
    expect(res.status).toBe(413);
    expect(res.body.error.code).toBe('PUBLIC_WEBHOOK_BODY_TOO_LARGE');
  });

  it('M. 인증 webhook 본문 1MB 초과 → 413 PAYLOAD_TOO_LARGE (인증 경로도 라우트 limit 적용)', async () => {
    // 라우트 스코프 파서는 인증/HMAC 검증보다 먼저(express 미들웨어) 동작하므로, 1MB 초과는
    // 서명 유효성과 무관하게 파서 단계에서 413 으로 거부된다. (J 가 인증 < 1MB 통과를 커버.)
    const path = crypto.randomUUID();
    const ac = await createAuthConfig('hmac');
    await createWebhookTrigger(uniqueName('hook-m'), path, {
      authConfigId: ac.id,
    });
    const tooBig = JSON.stringify({ blob: 'x'.repeat(1100 * 1024) }); // > 1MiB
    const res = await request(BASE_URL)
      .post(`/api/hooks/${path}`)
      .set('Content-Type', 'application/json')
      .send(tooBig);
    expect(res.status).toBe(413);
    expect(res.body.error.code).toBe('PAYLOAD_TOO_LARGE');
  });

  it('F. api_key AuthConfig — 헤더 누락/오류 401, 올바른 키 202', async () => {
    const path = crypto.randomUUID();
    const ac = await createAuthConfig('api_key');
    const key = ac.config.key as string;
    await createWebhookTrigger(uniqueName('hook-f'), path, {
      authConfigId: ac.id,
    });

    const bad = await request(BASE_URL)
      .post(`/api/hooks/${path}`)
      .set('X-API-Key', 'nope')
      .send({});
    expect(bad.status).toBe(401);

    const ok = await request(BASE_URL)
      .post(`/api/hooks/${path}`)
      .set('X-API-Key', key)
      .send({});
    expect(ok.status).toBe(202);
  });

  it('G. basic_auth AuthConfig — 잘못된 자격 401, 올바른 자격 202', async () => {
    const path = crypto.randomUUID();
    const ac = await createAuthConfig('basic_auth', {
      username: 'hookuser',
      password: 'hookpass',
    });
    await createWebhookTrigger(uniqueName('hook-g'), path, {
      authConfigId: ac.id,
    });

    const badB64 = Buffer.from('hookuser:wrong').toString('base64');
    const bad = await request(BASE_URL)
      .post(`/api/hooks/${path}`)
      .set('Authorization', `Basic ${badB64}`)
      .send({});
    expect(bad.status).toBe(401);

    const okB64 = Buffer.from('hookuser:hookpass').toString('base64');
    const ok = await request(BASE_URL)
      .post(`/api/hooks/${path}`)
      .set('Authorization', `Basic ${okB64}`)
      .send({});
    expect(ok.status).toBe(202);
  });

  it('H. AuthConfig.is_active=false → 401', async () => {
    const path = crypto.randomUUID();
    const ac = await createAuthConfig('bearer_token');
    const tok = ac.config.token as string;
    await request(BASE_URL)
      .patch(`/api/auth-configs/${ac.id}`)
      .set('Authorization', `Bearer ${token}`)
      .set('X-Workspace-Id', workspaceId)
      .send({ isActive: false })
      .expect(200);
    await createWebhookTrigger(uniqueName('hook-h'), path, {
      authConfigId: ac.id,
    });

    const res = await request(BASE_URL)
      .post(`/api/hooks/${path}`)
      .set('Authorization', `Bearer ${tok}`)
      .send({});
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('AUTH_FAILED');
  });

  it('I. 인증 성공 시 AuthConfig.last_used_at 갱신 (fire-and-forget, 폴링 확인)', async () => {
    const path = crypto.randomUUID();
    const ac = await createAuthConfig('bearer_token');
    const tok = ac.config.token as string;
    await createWebhookTrigger(uniqueName('hook-i'), path, {
      authConfigId: ac.id,
    });

    const before = await request(BASE_URL)
      .get(`/api/auth-configs/${ac.id}`)
      .set('Authorization', `Bearer ${token}`)
      .set('X-Workspace-Id', workspaceId);
    expect(before.body.data.lastUsedAt ?? null).toBeNull();

    await request(BASE_URL)
      .post(`/api/hooks/${path}`)
      .set('Authorization', `Bearer ${tok}`)
      .send({})
      .expect(202);

    // fire-and-forget UPDATE 라 약간의 지연 후 반영 — 최대 ~3초 폴링.
    let lastUsedAt: string | null = null;
    for (let i = 0; i < 6; i++) {
      const cur = await request(BASE_URL)
        .get(`/api/auth-configs/${ac.id}`)
        .set('Authorization', `Bearer ${token}`)
        .set('X-Workspace-Id', workspaceId);
      lastUsedAt = cur.body.data.lastUsedAt ?? null;
      if (lastUsedAt) break;
      await new Promise((r) => setTimeout(r, 500));
    }
    expect(lastUsedAt).not.toBeNull();
  });
});
