import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import Redis from 'ioredis';
import { Client } from 'pg';
import { randomUUID } from 'node:crypto';
import request from 'supertest';

import { createDbClient } from './helpers/db';
import { nextE2eClientIp } from './helpers/e2e-client-ip';
import { setupChatChannelTrigger } from './helpers/e2e-chat-channel-fixture';

/**
 * e2e: 활성 실행이 있는 대화에 `/start` 가 오면 기존 실행을 취소하고 새로 시작한다
 * (NERV Task `CLE-T-V4WVF2`, CCH-CV-02/03 명령 우선).
 *
 * 대화 상태(Redis)가 `running` 실행을 가리키게 둔 뒤 Telegram `/start` 를 보낸다. 옛 실행은
 * 실행 중지 경로로 `cancelled` 가 되고 새 실행이 생긴다. 대화 상태는 더 이상 옛 실행을 가리키지 않는다.
 * 옛 실행의 종결 이벤트가 새 실행의 매핑을 지우지 않는 것은 단위 테스트
 * (`channel-conversation.service.spec.ts` 의 `clearExecutionIdIfMatches`)가 고정한다.
 */

const BASE_URL = process.env.E2E_BASE_URL ?? 'http://backend-e2e:3011';

/** `channel-conversation.service.ts` 의 키 형식과 같아야 한다. */
const conversationKeyOf = (triggerId: string, chatId: number) =>
  `chat-channel:${triggerId}:${chatId}`;

describe('Telegram /start 재시작 (e2e)', () => {
  let db: Client;
  let redis: Redis;

  beforeAll(async () => {
    db = createDbClient();
    await db.connect();
    redis = new Redis({
      host: process.env.REDIS_HOST ?? 'redis',
      port: Number(process.env.REDIS_PORT ?? '6379'),
      ...(process.env.REDIS_PASSWORD
        ? { password: process.env.REDIS_PASSWORD }
        : {}),
    });
  }, 30_000);

  afterAll(async () => {
    await redis.quit();
    await db.end();
  });

  it('running 실행이 있는 대화에 /start → 옛 실행은 cancelled, 새 실행이 시작된다', async () => {
    const setup = await setupChatChannelTrigger({ db, provider: 'telegram' });
    await db.query(
      `INSERT INTO node (id, workflow_id, type, category, label, config, position_x, position_y, created_at, updated_at)
       VALUES ($1, $2, 'manual_trigger', 'trigger', 'trg', $3, 0, 0, NOW(), NOW())`,
      [randomUUID(), setup.workflowId, JSON.stringify({ parameters: [] })],
    );
    const chatId = 71001;
    const userId = 81001;
    const oldExecutionId = randomUUID();
    await db.query(
      `INSERT INTO execution (id, workflow_id, status, started_at)
       VALUES ($1, $2, 'running', NOW())`,
      [oldExecutionId, setup.workflowId],
    );
    const key = conversationKeyOf(setup.triggerId, chatId);
    const now = new Date().toISOString();
    await redis.set(
      key,
      JSON.stringify({
        executionId: oldExecutionId,
        threadId: 'default',
        channelUserKey: String(userId),
        startedAt: now,
        lastUpdateAt: now,
      }),
      'EX',
      600,
    );

    try {
      const res = await request(BASE_URL)
        .post(`/api/hooks/${setup.endpointPath}`)
        .set('x-forwarded-for', nextE2eClientIp())
        .set('content-type', 'application/json')
        .send(
          JSON.stringify({
            update_id: Math.floor(Date.now() / 1000),
            message: {
              message_id: 1,
              chat: { id: chatId, type: 'private' },
              from: { id: userId, is_bot: false },
              text: '/start',
            },
          }),
        );

      expect(res.status).toBe(202);
      const newExecutionId = res.body.data.executionId as string;
      expect(newExecutionId).not.toBe('ignored');
      expect(newExecutionId).not.toBe(oldExecutionId);

      const old = await db.query<{ status: string }>(
        'SELECT status FROM execution WHERE id = $1',
        [oldExecutionId],
      );
      expect(old.rows[0]?.status).toBe('cancelled');
      const fresh = await db.query<{ id: string }>(
        'SELECT id FROM execution WHERE id = $1',
        [newExecutionId],
      );
      expect(fresh.rowCount).toBe(1);

      // 새 실행이 곧 끝나면 종결 이벤트가 매핑을 비울 수 있다(null). 옛 실행만 아니면 된다.
      const raw = await redis.get(key);
      const stored = raw
        ? (JSON.parse(raw) as { executionId: string | null }).executionId
        : null;
      expect(stored).not.toBe(oldExecutionId);
    } finally {
      await redis.del(key);
      await db
        .query('DELETE FROM trigger WHERE id = $1', [setup.triggerId])
        .catch(() => undefined);
    }
  });
});
