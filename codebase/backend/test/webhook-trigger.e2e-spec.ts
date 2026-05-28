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
    const path = `e2e-a-${crypto.randomBytes(8).toString('hex')}`;
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

  it('C. 비활성 트리거 → 410 TRIGGER_INACTIVE', async () => {
    const path = `e2e-c-${crypto.randomBytes(8).toString('hex')}`;
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
    const path = `e2e-d-${crypto.randomBytes(8).toString('hex')}`;
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
    const path = `e2e-e-${crypto.randomBytes(8).toString('hex')}`;
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

  it('F. api_key AuthConfig — 헤더 누락/오류 401, 올바른 키 202', async () => {
    const path = `e2e-f-${crypto.randomBytes(8).toString('hex')}`;
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
    const path = `e2e-g-${crypto.randomBytes(8).toString('hex')}`;
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
    const path = `e2e-h-${crypto.randomBytes(8).toString('hex')}`;
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
    const path = `e2e-i-${crypto.randomBytes(8).toString('hex')}`;
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
