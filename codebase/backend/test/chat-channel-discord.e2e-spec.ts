import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import { Client } from 'pg';
import request from 'supertest';

import { createDbClient } from './helpers/db';
import { setupChatChannelTrigger } from './helpers/e2e-chat-channel-fixture';

/**
 * e2e: Discord Chat Channel adapter ([Spec providers/discord.md §3~§6]).
 *
 * 검증:
 * 1. PING handshake — 200 OK + root-level `{ type: 1 }` (TransformInterceptor 우회)
 * 2. 잘못된 signature → 401
 * 3. inboundSigningRef 미설정 (legacy) → signing skip + PING 응답
 * 4. 미지원 type → 202 + ignored
 *
 * ed25519 signature 의 정상 검증은 unit test (discord-signing.spec) 가 keypair round-trip
 * 검증 — e2e 는 HooksController PING handshake + 401 path 만 검증.
 */

const BASE_URL = process.env.E2E_BASE_URL ?? 'http://backend-e2e:3011';

// user/workspace/workflow/trigger fixture 는 `helpers/e2e-chat-channel-fixture.ts` 공용 헬퍼로.
// Discord 는 `inboundSigningRef` 가 trigger.config 에 박히지 않는다 — signing skip
// (legacy) path 검증 위한 의도적 누락. 헬퍼가 provider='discord' 인자에서 이 동작을 보장.

describe('Discord Chat Channel e2e', () => {
  let db: Client;
  let endpointPath: string;
  let triggerId: string;

  beforeAll(async () => {
    db = createDbClient();
    await db.connect();
    const setup = await setupChatChannelTrigger({ db, provider: 'discord' });
    endpointPath = setup.endpointPath;
    triggerId = setup.triggerId;
  });

  afterAll(async () => {
    if (db) {
      await db
        .query('DELETE FROM trigger WHERE id = $1', [triggerId])
        .catch(() => undefined);
      await db.end().catch(() => undefined);
    }
  });

  it('PING (type=1) + signing skip (legacy) → 200 + { type: 1 }', async () => {
    const body = JSON.stringify({
      id: 'I-ping-1',
      application_id: 'A',
      type: 1,
      token: 'tok',
      version: 1,
    });
    const res = await request(BASE_URL)
      .post(`/api/hooks/${endpointPath}`)
      .set('content-type', 'application/json')
      .send(body);
    expect(res.status).toBe(200);
    expect(res.body.type).toBe(1);
  });

  it('미지원 type (autocomplete=4) → 202 + ignored', async () => {
    const body = JSON.stringify({
      id: 'I-ac-1',
      application_id: 'A',
      type: 4,
      token: 'tok',
      version: 1,
      channel_id: 'C1',
      channel: { id: 'C1', type: 1 },
      user: { id: 'U1' },
    });
    const res = await request(BASE_URL)
      .post(`/api/hooks/${endpointPath}`)
      .set('content-type', 'application/json')
      .send(body);
    expect(res.status).toBe(202);
  });

  it('guild channel (type=0) → 202 + ignored (parser null)', async () => {
    const body = JSON.stringify({
      id: 'I-guild-1',
      application_id: 'A',
      type: 2,
      token: 'tok',
      version: 1,
      channel_id: 'C2',
      channel: { id: 'C2', type: 0 },
      user: { id: 'U1' },
      data: { name: 'workflow', options: [{ name: 'start', type: 1 }] },
    });
    const res = await request(BASE_URL)
      .post(`/api/hooks/${endpointPath}`)
      .set('content-type', 'application/json')
      .send(body);
    expect(res.status).toBe(202);
  });

  it('inboundSigningRef 설정된 trigger + 잘못된 signature → 401', async () => {
    const setup = await setupChatChannelTrigger({ db, provider: 'discord' });
    await db.query(`UPDATE trigger SET config = $1::jsonb WHERE id = $2`, [
      JSON.stringify({
        chatChannel: {
          provider: 'discord',
          botTokenRef: `secret://triggers/${setup.triggerId}/bot-token`,
          inboundSigningRef: `secret://triggers/${setup.triggerId}/inbound-signing`,
        },
      }),
      setup.triggerId,
    ]);
    const body = JSON.stringify({
      id: 'I',
      type: 1,
      token: 't',
      version: 1,
      application_id: 'A',
    });
    const res = await request(BASE_URL)
      .post(`/api/hooks/${setup.endpointPath}`)
      .set('content-type', 'application/json')
      .set('x-signature-ed25519', 'f'.repeat(128))
      .set('x-signature-timestamp', String(Math.floor(Date.now() / 1000)))
      .send(body);
    expect(res.status).toBe(401);
    await db
      .query('DELETE FROM trigger WHERE id = $1', [setup.triggerId])
      .catch(() => undefined);
  });

  // ai-review (PR #301 security INFO #2) 후속 — chat-channel inbound webhook 은
  // public route 라 workspace owner 의 `emailVerified` 와 무관하게 동작한다
  // (`jwt.strategy` 가드는 protected API 한정). 본 invariant 가 향후 회귀로
  // 깨지면 (예: 누군가 inbound 처리에 owner.emailVerified 검사를 잘못 추가)
  // 본 케이스가 fail 해 차단한다. 헬퍼 JSDoc 의 "ownerEmailVerified" 옵션
  // 노트와 함께 SoT 를 이룸.
  it('owner.emailVerified=false trigger 의 inbound (PING) → 200 + signing skip (legacy)', async () => {
    const setup = await setupChatChannelTrigger({
      db,
      provider: 'discord',
      ownerEmailVerified: false,
    });
    const body = JSON.stringify({
      id: 'I-unverified-ping-1',
      application_id: 'A',
      type: 1,
      token: 'tok',
      version: 1,
    });
    const res = await request(BASE_URL)
      .post(`/api/hooks/${setup.endpointPath}`)
      .set('content-type', 'application/json')
      .send(body);
    // inbound 는 owner.emailVerified 와 무관 — PING handshake 정상 수행.
    expect(res.status).toBe(200);
    expect(res.body.type).toBe(1);
    await db
      .query('DELETE FROM trigger WHERE id = $1', [setup.triggerId])
      .catch(() => undefined);
  });
});
