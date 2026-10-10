import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import Redis from 'ioredis';
import { Client } from 'pg';
import { randomUUID } from 'node:crypto';
import request from 'supertest';

import { ChannelConversationService } from '../src/modules/chat-channel/channel-conversation.service';
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
 *
 * 워크플로우가 꺼져 있으면(NERV Task `CLE-T-XRWFMJ`) `/start` 는 새 실행을 시작하지 못하고
 * 그 앞의 기존 실행 취소도 하지 않는다. 202 ignored 이고 옛 실행은 그대로 `running` 이다.
 *
 * 대화 매핑을 비우는 compare-and-set 은 Lua 스크립트라 단위 테스트의 Redis 모사로는 스크립트가
 * 실제로 도는지 알 수 없다. 여기서 실제 Redis 로 일치 · 불일치 경로를 확인한다(`/cancel` 요청과
 * `ChannelConversationService` 직접 호출). 채팅 채널 listener 는 e2e 에서 등록되지 않아(Telegram
 * setWebhook 이 막힌다) 실행 종결 이벤트가 dispatcher 를 거쳐 매핑을 비우는 경로는 여기서 보지 못한다.
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

  /** 워크플로우에 manual_trigger 노드를 두고, 대화 상태가 `running` 실행을 가리키게 한다. */
  async function seedRunningConversation(
    setup: Awaited<ReturnType<typeof setupChatChannelTrigger>>,
    chatId: number,
    userId: number,
  ): Promise<{ oldExecutionId: string; key: string }> {
    await db.query(
      `INSERT INTO node (id, workflow_id, type, category, label, config, position_x, position_y, created_at, updated_at)
       VALUES ($1, $2, 'manual_trigger', 'trigger', 'trg', $3, 0, 0, NOW(), NOW())`,
      [randomUUID(), setup.workflowId, JSON.stringify({ parameters: [] })],
    );
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
    return { oldExecutionId, key };
  }

  function postText(
    endpointPath: string,
    chatId: number,
    userId: number,
    text: string,
  ) {
    return request(BASE_URL)
      .post(`/api/hooks/${endpointPath}`)
      .set('x-forwarded-for', nextE2eClientIp())
      .set('content-type', 'application/json')
      .send(
        JSON.stringify({
          update_id: Math.floor(Date.now() / 1000),
          message: {
            message_id: 1,
            chat: { id: chatId, type: 'private' },
            from: { id: userId, is_bot: false },
            text,
          },
        }),
      );
  }

  it('꺼진 워크플로우의 대화에 /start → 202 ignored, 옛 실행은 running 그대로이고 새 실행이 없다', async () => {
    const setup = await setupChatChannelTrigger({ db, provider: 'telegram' });
    const chatId = 71002;
    const userId = 81002;
    const { oldExecutionId, key } = await seedRunningConversation(
      setup,
      chatId,
      userId,
    );
    await db.query('UPDATE workflow SET is_active = false WHERE id = $1', [
      setup.workflowId,
    ]);

    try {
      const res = await postText(setup.endpointPath, chatId, userId, '/start');

      expect(res.status).toBe(202);
      expect(res.body.data.executionId).toBe('ignored');

      const old = await db.query<{ status: string }>(
        'SELECT status FROM execution WHERE id = $1',
        [oldExecutionId],
      );
      expect(old.rows[0]?.status).toBe('running');
      const count = await db.query<{ n: string }>(
        'SELECT count(*)::text AS n FROM execution WHERE workflow_id = $1',
        [setup.workflowId],
      );
      expect(Number(count.rows[0].n)).toBe(1);
      const raw = await redis.get(key);
      expect(
        (JSON.parse(raw as string) as { executionId: string | null })
          .executionId,
      ).toBe(oldExecutionId);
    } finally {
      await redis.del(key);
      await db
        .query('DELETE FROM trigger WHERE id = $1', [setup.triggerId])
        .catch(() => undefined);
    }
  });

  it('running 실행이 있는 대화에 /start → 옛 실행은 cancelled, 새 실행이 시작된다', async () => {
    const setup = await setupChatChannelTrigger({ db, provider: 'telegram' });
    const chatId = 71001;
    const userId = 81001;
    const { oldExecutionId, key } = await seedRunningConversation(
      setup,
      chatId,
      userId,
    );

    try {
      const res = await postText(setup.endpointPath, chatId, userId, '/start');

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

      // 대화는 새 실행에 이어진다. 새 실행이 곧 끝나 종결 이벤트가 매핑을 비웠다면 null 이다. 어느 쪽이든
      // 옛 실행을 가리키면 안 된다.
      const raw = await redis.get(key);
      const stored = raw
        ? (JSON.parse(raw) as { executionId: string | null }).executionId
        : null;
      expect([newExecutionId, null]).toContain(stored);
    } finally {
      await redis.del(key);
      await db
        .query('DELETE FROM trigger WHERE id = $1', [setup.triggerId])
        .catch(() => undefined);
    }
  });

  // 근거: NERV Task `CLE-T-V4WVF2`. `/cancel` 도 대화가 읽은 실행을 가리킬 때만 매핑을 비운다. 실제 Redis 의
  // Lua compare-and-set 이 일치 경로에서 값을 바꾸는지 본다.
  it('/cancel → 옛 실행은 cancelled, 대화 매핑은 실제 Redis 의 compare-and-set 으로 비워진다', async () => {
    const setup = await setupChatChannelTrigger({ db, provider: 'telegram' });
    const chatId = 71003;
    const userId = 81003;
    const { oldExecutionId, key } = await seedRunningConversation(
      setup,
      chatId,
      userId,
    );

    try {
      const res = await postText(setup.endpointPath, chatId, userId, '/cancel');

      expect(res.status).toBe(202);
      expect(res.body.data.executionId).toBe(oldExecutionId);
      const old = await db.query<{ status: string }>(
        'SELECT status FROM execution WHERE id = $1',
        [oldExecutionId],
      );
      expect(old.rows[0]?.status).toBe('cancelled');

      const raw = await redis.get(key);
      const stored = JSON.parse(raw as string) as {
        executionId: string | null;
        channelUserKey: string;
      };
      expect(stored.executionId).toBeNull();
      expect(stored.channelUserKey).toBe(String(userId));
    } finally {
      await redis.del(key);
      await db
        .query('DELETE FROM trigger WHERE id = $1', [setup.triggerId])
        .catch(() => undefined);
    }
  });

  describe('ChannelConversationService.clearExecutionIdIfMatches — 실제 Redis (Lua)', () => {
    const triggerId = randomUUID();
    const cleanup: string[] = [];

    afterAll(async () => {
      if (cleanup.length > 0) await redis.del(...cleanup);
    });

    const seed = async (chatId: number, executionId: string) => {
      const key = conversationKeyOf(triggerId, chatId);
      cleanup.push(key);
      // 빈 배열을 가진 값이다. Lua 에서 JSON 을 다시 만들면 cjson 이 빈 배열을 객체로 바꾼다.
      const raw = JSON.stringify({
        executionId,
        threadId: 'default',
        channelUserKey: 'u1',
        startedAt: '2026-10-10T00:00:00.000Z',
        lastUpdateAt: '2026-10-10T00:00:00.000Z',
        pendingFormModal: { nodeId: 'n1', fields: [] },
      });
      await redis.set(key, raw, 'EX', 600);
      return { key, raw };
    };

    it('일치하면 executionId 만 null 로 바꾸고 나머지 값과 TTL(7일)을 새로 건다', async () => {
      const { key } = await seed(72001, 'exec-a');
      const service = new ChannelConversationService(undefined, redis);

      const cleared = await service.clearExecutionIdIfMatches(
        triggerId,
        '72001',
        'exec-a',
      );

      expect(cleared).toBe(true);
      const stored = JSON.parse((await redis.get(key)) as string) as {
        executionId: string | null;
        pendingFormModal: { fields: unknown };
      };
      expect(stored.executionId).toBeNull();
      // 문자열 그대로 비교해 바꾸므로 빈 배열이 객체로 변하지 않는다.
      expect(Array.isArray(stored.pendingFormModal.fields)).toBe(true);
      expect(await redis.ttl(key)).toBeGreaterThan(600);
    });

    it('대화가 다른 실행을 가리키면 값과 TTL 을 건드리지 않는다', async () => {
      const { key, raw } = await seed(72002, 'exec-new');
      const service = new ChannelConversationService(undefined, redis);

      const cleared = await service.clearExecutionIdIfMatches(
        triggerId,
        '72002',
        'exec-old',
      );

      expect(cleared).toBe(false);
      expect(await redis.get(key)).toBe(raw);
      expect(await redis.ttl(key)).toBeLessThanOrEqual(600);
    });
  });
});
