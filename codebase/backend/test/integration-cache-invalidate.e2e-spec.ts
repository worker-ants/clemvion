import {
  describe,
  it,
  expect,
  beforeAll,
  beforeEach,
  afterAll,
} from '@jest/globals';
import { Client } from 'pg';
import request from 'supertest';
import Redis from 'ioredis';

import { createDbClient, uniqueEmail, uniqueName } from './helpers/db';
import { registerAndLogin, createTeamWorkspace } from './helpers/auth';

/**
 * e2e: integration 자격증명 회전·삭제의 멀티 인스턴스 캐시 무효화 broadcast
 * (refactor 04 m-4, spec/4-nodes/4-integration/2-database-query.md §4·§Rationale).
 *
 * 검증: rotate / remove 가 Redis pub/sub 채널 `integration:cache:invalidate` 로
 * integrationId 를 broadcast 한다 — 별도 인스턴스의 구독자(여기서는 raw ioredis
 * 구독자)가 이를 수신해 자기 로컬 풀을 evict 할 수 있음을 실 Redis 경유로 확인한다.
 * (전 인스턴스 풀 eviction 의 핵심 전제는 "publish 가 실제로 채널에 도달" 이다.)
 */

const BASE_URL = process.env.E2E_BASE_URL ?? 'http://backend-e2e:3011';
// SoT: INTEGRATION_CACHE_INVALIDATE_CHANNEL (src/common/redis/integration-cache-bus.service.ts).
// e2e 는 src 모듈 그래프를 끌어오지 않으려 문자열 리터럴로 둔다 — 채널명 변경 시 양쪽 갱신.
const CHANNEL = 'integration:cache:invalidate';

describe('Integration cache invalidate pub/sub (e2e, 04 m-4)', () => {
  let db: Client;
  let token: string;
  let workspaceId: string;
  let sub: Redis;
  const received: string[] = [];

  beforeAll(async () => {
    db = createDbClient();
    await db.connect();
    const owner = await registerAndLogin(BASE_URL, uniqueEmail('cacheinv'), db);
    token = owner.accessToken;
    workspaceId = await createTeamWorkspace(
      BASE_URL,
      token,
      uniqueName('CACHEINV'),
    );

    sub = new Redis({
      host: process.env.REDIS_HOST ?? 'redis',
      port: Number(process.env.REDIS_PORT ?? '6379'),
    });
    sub.on('message', (channel: string, message: string) => {
      if (channel === CHANNEL) received.push(message);
    });
    await sub.subscribe(CHANNEL);
  }, 60_000);

  beforeEach(() => {
    received.length = 0;
  });

  afterAll(async () => {
    if (sub) await sub.quit().catch(() => undefined);
    await db.end();
  });

  async function createHttpApiKey(
    name: string,
    apiKey: string,
  ): Promise<string> {
    const res = await request(BASE_URL)
      .post('/api/integrations')
      .set('Authorization', `Bearer ${token}`)
      .set('X-Workspace-Id', workspaceId)
      .send({
        serviceType: 'http',
        name,
        authType: 'api_key',
        credentials: {
          base_url: 'https://api.example.com',
          location: 'header',
          key_name: 'X-Api-Key',
          value: apiKey,
        },
        scope: 'personal',
      });
    expect(res.status).toBe(201);
    return (res.body.data as { id: string }).id;
  }

  async function waitForBroadcast(
    integrationId: string,
    timeoutMs = 5_000,
  ): Promise<boolean> {
    const deadline = Date.now() + timeoutMs;
    while (!received.includes(integrationId) && Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, 50));
    }
    return received.includes(integrationId);
  }

  it('A. rotate 가 integrationId 를 채널에 broadcast', async () => {
    const id = await createHttpApiKey(uniqueName('cache-rot'), 'secret-1');

    const rot = await request(BASE_URL)
      .post(`/api/integrations/${id}/rotate`)
      .set('Authorization', `Bearer ${token}`)
      .set('X-Workspace-Id', workspaceId)
      .send({ credentials: { value: 'secret-2' } });
    // POST :id/rotate 는 NestJS 기본 201 (HttpCode 미지정). 본 테스트의 핵심은
    // 회전 성공 후 broadcast 이므로 성공 코드(200/201)만 확인한다.
    expect([200, 201]).toContain(rot.status);

    await waitForBroadcast(id);
    // toContain 은 실패 시 수신된 배열과 기대 id 를 함께 출력해 디버깅을 돕는다.
    expect(received).toContain(id);
  }, 30_000);

  it('B. remove 가 integrationId 를 채널에 broadcast', async () => {
    const id = await createHttpApiKey(uniqueName('cache-del'), 'secret-1');

    const del = await request(BASE_URL)
      .delete(`/api/integrations/${id}`)
      .set('Authorization', `Bearer ${token}`)
      .set('X-Workspace-Id', workspaceId);
    expect(del.status).toBe(204);

    await waitForBroadcast(id);
    expect(received).toContain(id);
  }, 30_000);
});
