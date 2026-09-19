import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { Client } from 'pg';
import request from 'supertest';

import { createDbClient, uniqueEmail, uniqueName } from './helpers/db';
import { registerAndLogin, createTeamWorkspace } from './helpers/auth';

/**
 * e2e: Database · HTTP 통합의 연결 테스트가 실제 연결 경로를 탄다 —
 * spec/2-navigation/4-integration.md §5.3 · §5.4 · §9.2 `preview-test` 행.
 *
 * 종전에는 두 서비스에 transport tester 가 없어 필드 구조만 맞으면 «Connection successful» 이었다.
 * e2e 환경은 `ALLOW_PRIVATE_HOST_TARGETS` 를 켜지 않으므로(docker-compose.e2e.yml), 사설 host 를 가리키는
 * 통합은 SSRF 가드에 막혀야 한다 — 그 결과가 세 경로(preview-test · `:id/test` · rotate)에 모두 나타나는지가
 * 이 파일의 대상이다. 실제 접속 · 인증 분기는 테스터 unit spec 이 본다.
 *
 * rotate 의 **상태 코드는 단언하지 않는다** — 구현 400 · spec §9.4 422 가 어긋나 있고 트래커에서 정한다.
 */

const BASE_URL = process.env.E2E_BASE_URL ?? 'http://backend-e2e:3011';

describe('Integration connection test — Database · HTTP (e2e)', () => {
  let db: Client;
  let token: string;
  let workspaceId: string;

  // compose 의 postgres 서비스 — 사설 대역 IP 로 해석된다.
  const privateDb = {
    driver: 'postgres',
    host: 'postgres',
    port: 5432,
    database: 'clemvion_e2e',
    username: 'clemvion',
    password: 'clemvion-e2e',
    ssl: 'disable',
  };
  const loopbackHttp = {
    base_url: 'http://127.0.0.1:3011/api/health',
    token: 'e2e-token-old',
  };

  beforeAll(async () => {
    db = createDbClient();
    await db.connect();
    const owner = await registerAndLogin(BASE_URL, uniqueEmail('conntest'), db);
    token = owner.accessToken;
    workspaceId = await createTeamWorkspace(
      BASE_URL,
      token,
      uniqueName('CONNTEST'),
    );
  }, 60_000);

  afterAll(async () => {
    await db.end();
  });

  function post(path: string) {
    return request(BASE_URL)
      .post(path)
      .set('Authorization', `Bearer ${token}`)
      .set('X-Workspace-Id', workspaceId);
  }

  async function createIntegration(body: {
    serviceType: string;
    authType: string;
    credentials: Record<string, unknown>;
  }): Promise<string> {
    const res = await post('/api/integrations').send({
      ...body,
      name: uniqueName(`conn-${body.serviceType}`),
      scope: 'personal',
    });
    expect(res.status).toBe(201);
    return (res.body.data as { id: string }).id;
  }

  it('A. preview-test — 사설 host 의 Database 는 DB_HOST_BLOCKED, host 는 응답에 싣지 않는다', async () => {
    const res = await post('/api/integrations/preview-test').send({
      serviceType: 'database',
      authType: 'connection_string',
      credentials: privateDb,
    });

    expect([200, 201]).toContain(res.status);
    const data = res.body.data as {
      success: boolean;
      code?: string;
      message: string;
    };
    expect(data.success).toBe(false);
    expect(data.code).toBe('DB_HOST_BLOCKED');
    expect(data.message).not.toContain('postgres');
  });

  it('B. preview-test — loopback base_url 의 HTTP 는 HTTP_BLOCKED', async () => {
    const res = await post('/api/integrations/preview-test').send({
      serviceType: 'http',
      authType: 'bearer_token',
      credentials: loopbackHttp,
    });

    expect([200, 201]).toContain(res.status);
    const data = res.body.data as {
      success: boolean;
      code?: string;
      message: string;
    };
    expect(data.success).toBe(false);
    expect(data.code).toBe('HTTP_BLOCKED');
    expect(data.message).not.toContain('127.0.0.1');
  });

  it('C. 저장된 Database 통합의 :id/test 도 같은 테스터를 탄다', async () => {
    const id = await createIntegration({
      serviceType: 'database',
      authType: 'connection_string',
      credentials: privateDb,
    });

    const res = await post(`/api/integrations/${id}/test`).send();

    expect([200, 201]).toContain(res.status);
    expect(res.body.data).toMatchObject({
      success: false,
      code: 'DB_HOST_BLOCKED',
    });
  });

  it('D. rotate — 새 자격증명이 테스트를 통과하지 못하면 교체하지 않는다', async () => {
    // base_url 이 없는 HTTP 통합으로 만든다(테스터가 호출하지 않는다) — 회전 입력만 loopback 을 가리킨다.
    const id = await createIntegration({
      serviceType: 'http',
      authType: 'bearer_token',
      credentials: { token: 'e2e-token-old' },
    });

    // 생성도 `last_rotated_at` 을 채우므로 «null» 이 아니라 «회전 전과 같다» 로 본다. 자격증명은 저장할 때마다 새 IV 로
    // 암호화되므로 암호문이 그대로면 저장이 일어나지 않은 것이다.
    const readRow = () =>
      db.query<{ last_rotated_at: Date | null; credentials: string }>(
        'SELECT last_rotated_at, credentials::text AS credentials FROM integration WHERE id = $1',
        [id],
      );
    const before = (await readRow()).rows[0];

    const res = await post(`/api/integrations/${id}/rotate`).send({
      credentials: loopbackHttp,
    });

    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.status).toBeLessThan(500);
    expect(res.body?.code ?? res.body?.error?.code).toBe(
      'INTEGRATION_TEST_FAILED',
    );
    const after = (await readRow()).rows[0];
    expect(after).toEqual(before);
  });

  it('E. rotate 성공 — 바꾸는 컬럼만 저장해도 자격증명은 암호화돼 저장되고 회전 시각이 바뀐다', async () => {
    // rotate 는 엔티티 전체가 아니라 바꾸는 컬럼만 `save` 한다(동시 logUsage 의 lastUsedAt 을 되돌리지 않으려고).
    // 부분 객체 저장에서도 컬럼 transformer(암호화)가 걸리는지는 실제 DB 로만 확인된다.
    const id = await createIntegration({
      serviceType: 'http',
      authType: 'bearer_token',
      credentials: { token: 'e2e-rotate-old' },
    });
    const readRow = () =>
      db.query<{ last_rotated_at: Date; credentials: string }>(
        'SELECT last_rotated_at, credentials::text AS credentials FROM integration WHERE id = $1',
        [id],
      );
    const before = (await readRow()).rows[0];
    const secret = `e2e-rotate-new-${Date.now()}`;

    const res = await post(`/api/integrations/${id}/rotate`).send({
      credentials: { token: secret },
    });

    expect([200, 201]).toContain(res.status);
    expect(res.body.data).toMatchObject({ id, status: 'connected' });
    const after = (await readRow()).rows[0];
    expect(after.credentials).not.toBe(before.credentials);
    expect(after.credentials).not.toContain(secret);
    expect(new Date(after.last_rotated_at).getTime()).toBeGreaterThan(
      new Date(before.last_rotated_at).getTime(),
    );
  });
});
