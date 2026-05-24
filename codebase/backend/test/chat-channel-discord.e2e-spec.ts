import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import { Client } from 'pg';
import { randomBytes, randomUUID } from 'crypto';
import request from 'supertest';

import { createDbClient } from './helpers/db';

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

async function setupDiscordTrigger(db: Client): Promise<{
  triggerId: string;
  endpointPath: string;
}> {
  const workspaceId = randomUUID();
  const userId = randomUUID();
  await db.query(
    `INSERT INTO "user" (id, email, name, password_hash, email_verified, created_at, updated_at)
     VALUES ($1, $2, $3, $4, true, NOW(), NOW())
     ON CONFLICT DO NOTHING`,
    [userId, `discord-e2e-${userId.slice(0, 8)}@e2e.local`, 'Discord E2E', 'x'],
  );
  await db.query(
    `INSERT INTO workspace (id, name, slug, owner_id, created_at, updated_at)
     VALUES ($1, $2, $3, $4, NOW(), NOW())`,
    [
      workspaceId,
      `discord-${workspaceId.slice(0, 8)}`,
      `discord-${workspaceId.slice(0, 8)}`,
      userId,
    ],
  );
  const workflowId = randomUUID();
  await db.query(
    `INSERT INTO workflow (id, name, workspace_id, is_active, current_version, created_by, created_at, updated_at)
     VALUES ($1, $2, $3, true, 1, $4, NOW(), NOW())`,
    [workflowId, 'discord-e2e-wf', workspaceId, userId],
  );
  const triggerId = randomUUID();
  const endpointPath = `discord-e2e-${randomBytes(6).toString('hex')}`;
  await db.query(
    `INSERT INTO trigger
       (id, workspace_id, workflow_id, type, name, endpoint_path, is_active, config,
        chat_channel_health, created_at, updated_at)
     VALUES ($1, $2, $3, 'webhook', 'discord-e2e-trigger', $4, true, $5::jsonb, 'unknown', NOW(), NOW())`,
    [
      triggerId,
      workspaceId,
      workflowId,
      endpointPath,
      JSON.stringify({
        chatChannel: {
          provider: 'discord',
          botTokenRef: `secret://triggers/${triggerId}/bot-token`,
          // 의도적으로 inboundSigningRef 비움 — signing skip path (legacy) 검증
        },
      }),
    ],
  );
  return { triggerId, endpointPath };
}

describe('Discord Chat Channel e2e', () => {
  let db: Client;
  let endpointPath: string;
  let triggerId: string;

  beforeAll(async () => {
    db = createDbClient();
    await db.connect();
    const setup = await setupDiscordTrigger(db);
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
    const setup = await setupDiscordTrigger(db);
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
});
