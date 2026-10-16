import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import Redis from 'ioredis';
import { Client } from 'pg';
import { randomUUID } from 'node:crypto';
import request from 'supertest';

import { CHAT_CHANNEL_LISTENER_CHANNEL } from '../src/modules/chat-channel/channel-listener.bus';
import { createDbClient, uniqueEmail, uniqueName } from './helpers/db';
import { createTeamWorkspace, registerAndLogin } from './helpers/auth';
import { nextE2eClientIp } from './helpers/e2e-client-ip';

/**
 * e2e: 채팅 채널 트리거를 켜면 트리거 단위 listener 레지스트리(`ChannelListenerRegistry`)에
 * 들어가 켠 뒤 시작한 실행의 메시지가 채널로 나간다(NERV Task `CLE-T-PXTGVQ`, 채팅 채널
 * REQ-CHAT-070 · R-CC-29). 등록 · 해제는 Redis pub/sub 로 다른 인스턴스에도 알리고, 구독 연결이
 * 다시 붙으면 활성 트리거를 DB 에서 다시 등록한다.
 *
 * **레지스트리를 비운 상태를 만드는 법**: 트리거 행을 SQL 로 넣는다. 서버는 부팅 때 DB 를 읽어
 * 일괄 등록했으므로 그 뒤에 넣은 행은 레지스트리에 없다. 꺼진 채 재시작을 넘긴 트리거와 같다.
 *
 * **dispatcher 가 레지스트리를 통과했는지 보는 법**: `chat_channel_health` 다. 시드 행은
 * `'unknown'` 이다. 레지스트리를 통과하면 dispatcher 가 완료 안내를 보내려 하고, 봇 토큰 비밀이
 * 없어 실패해 `degraded` 로 적은 뒤 그 처리 끝에서 `healthy` 로 올린다. 어느 쪽이든 `'unknown'` 이
 * 아니다. 레지스트리에 없으면 dispatcher 는 DB 를 읽기 전에 건너뛰어 `'unknown'` 이 남는다.
 * 대화 매핑(`executionId` 비우기)은 신호로 쓰지 않는다. 인입이 실행을 시작한 **뒤에** 매핑을
 * 쓰므로 짧은 워크플로우는 완료 이벤트가 먼저 와서 매핑이 남을 수 있다.
 *
 * 서버가 Telegram API 에 닿지 않으므로 메시지가 실제로 나가는지는 보지 못한다. 단위 테스트
 * (`triggers.service.spec.ts`, `channel-listener.bus.spec.ts`, `chat-channel.module.spec.ts`)가
 * 등록 조건과 메시지 형식을 고정한다.
 */

const BASE_URL = process.env.E2E_BASE_URL ?? 'http://backend-e2e:3011';

/** dispatcher 가 실행 완료 이벤트를 처리할 때까지 기다리는 상한. */
const SIGNAL_TIMEOUT_MS = 20_000;
/** 실행이 끝난 뒤에도 신호가 없음을 확인할 때 더 기다리는 시간. */
const QUIET_PERIOD_MS = 1_500;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

describe('채팅 채널 트리거를 켤 때의 listener 레지스트리 (e2e)', () => {
  let db: Client;
  let redis: Redis;
  let token: string;
  let workspaceId: string;
  let ownerId: string;
  let chatSeq = 0;

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
    const owner = await registerAndLogin(BASE_URL, uniqueEmail('cclisten'), db);
    token = owner.accessToken;
    ownerId = owner.userId;
    workspaceId = await createTeamWorkspace(
      BASE_URL,
      token,
      uniqueName('CCLISTEN'),
    );
  }, 30_000);

  afterAll(async () => {
    await redis.quit();
    await db.end();
  });

  /**
   * 켜진 워크플로우(manual_trigger 노드 하나)와 Telegram 채팅 채널 트리거를 SQL 로 넣는다.
   * 서버를 거치지 않으므로 레지스트리에 들어가지 않는다. `inboundSigningRef` 를 비워 인입의
   * secret_token 검증을 건너뛴다.
   */
  async function seedTelegramTrigger(isActive: boolean) {
    const workflowId = randomUUID();
    await db.query(
      `INSERT INTO workflow (id, name, workspace_id, is_active, current_version, created_by, created_at, updated_at)
       VALUES ($1, $2, $3, true, 1, $4, NOW(), NOW())`,
      [workflowId, uniqueName('cclisten-wf'), workspaceId, ownerId],
    );
    await db.query(
      `INSERT INTO node (id, workflow_id, type, category, label, config, position_x, position_y, created_at, updated_at)
       VALUES ($1, $2, 'manual_trigger', 'trigger', 'trg', $3, 0, 0, NOW(), NOW())`,
      [randomUUID(), workflowId, JSON.stringify({ parameters: [] })],
    );
    const triggerId = randomUUID();
    const endpointPath = randomUUID();
    await db.query(
      `INSERT INTO trigger
         (id, workspace_id, workflow_id, type, name, endpoint_path, is_active, config,
          chat_channel_health, created_at, updated_at)
       VALUES ($1, $2, $3, 'webhook', $4, $5, $6, $7::jsonb, 'unknown', NOW(), NOW())`,
      [
        triggerId,
        workspaceId,
        workflowId,
        uniqueName('cclisten-trigger'),
        endpointPath,
        isActive,
        JSON.stringify({
          chatChannel: {
            provider: 'telegram',
            botTokenRef: `secret://triggers/${triggerId}/bot-token`,
          },
        }),
      ],
    );
    return { triggerId, endpointPath };
  }

  /** 봇에 메시지를 보낸 것처럼 인입을 보내고 시작한 실행 id 를 돌려준다. */
  async function sendMessage(endpointPath: string): Promise<string> {
    chatSeq += 1;
    const chatId = 72000 + chatSeq;
    const res = await request(BASE_URL)
      .post(`/api/hooks/${endpointPath}`)
      .set('x-forwarded-for', nextE2eClientIp())
      .set('content-type', 'application/json')
      .send(
        JSON.stringify({
          update_id: Math.floor(Date.now() / 1000) + chatSeq,
          message: {
            message_id: 1,
            chat: { id: chatId, type: 'private' },
            from: { id: 82000 + chatSeq, is_bot: false },
            text: 'hello',
          },
        }),
      );
    expect(res.status).toBe(202);
    const executionId = (res.body.data as { executionId: string }).executionId;
    expect(executionId).not.toBe('ignored');
    return executionId;
  }

  async function health(triggerId: string): Promise<string> {
    const r = await db.query<{ chat_channel_health: string }>(
      'SELECT chat_channel_health FROM trigger WHERE id = $1',
      [triggerId],
    );
    return r.rows[0].chat_channel_health;
  }

  /** dispatcher 가 이 트리거의 이벤트를 처리했다는 신호를 기다린다. */
  async function waitForDispatch(triggerId: string): Promise<string> {
    const deadline = Date.now() + SIGNAL_TIMEOUT_MS;
    for (;;) {
      const h = await health(triggerId);
      if (h !== 'unknown') return h;
      if (Date.now() > deadline) return h;
      await sleep(200);
    }
  }

  /** 실행이 끝날 때까지 기다린 뒤 조금 더 기다린다 — 신호가 «없음» 을 볼 때 쓴다. */
  async function waitForExecutionEnd(executionId: string): Promise<string> {
    const deadline = Date.now() + SIGNAL_TIMEOUT_MS;
    let status = '';
    while (Date.now() <= deadline) {
      const r = await db.query<{ status: string }>(
        'SELECT status FROM execution WHERE id = $1',
        [executionId],
      );
      status = r.rows[0]?.status ?? '';
      if (['completed', 'failed', 'cancelled'].includes(status)) break;
      await sleep(200);
    }
    await sleep(QUIET_PERIOD_MS);
    return status;
  }

  async function listenerSubscribers(): Promise<number> {
    const reply = (await redis.call(
      'PUBSUB',
      'NUMSUB',
      CHAT_CHANNEL_LISTENER_CHANNEL,
    )) as [string, number];
    return Number(reply[1]);
  }

  /** 다른 인스턴스가 보낸 것처럼 레지스트리 변경을 알린다. */
  function publishFromOtherInstance(body: Record<string, unknown>) {
    return redis.publish(
      CHAT_CHANNEL_LISTENER_CHANNEL,
      JSON.stringify({ v: 1, origin: `e2e-${randomUUID()}`, ...body }),
    );
  }

  // 대조군이 먼저다. 뒤의 재구독 테스트가 활성 트리거를 DB 에서 모두 다시 등록하기 때문이다.
  it(
    '대조군: 레지스트리에 없는 활성 트리거는 실행이 끝나도 dispatcher 가 건너뛴다',
    async () => {
      const { triggerId, endpointPath } = await seedTelegramTrigger(true);

      const executionId = await sendMessage(endpointPath);
      const status = await waitForExecutionEnd(executionId);

      expect(status).toBe('completed');
      expect(await health(triggerId)).toBe('unknown');
    },
    SIGNAL_TIMEOUT_MS * 2,
  );

  it(
    '꺼진 트리거를 켜는 PATCH 뒤 시작한 실행의 이벤트를 dispatcher 가 처리한다',
    async () => {
      const { triggerId, endpointPath } = await seedTelegramTrigger(false);

      const patch = await request(BASE_URL)
        .patch(`/api/triggers/${triggerId}`)
        .set('Authorization', `Bearer ${token}`)
        .set('X-Workspace-Id', workspaceId)
        .send({ isActive: true });
      expect(patch.status).toBe(200);
      expect((patch.body.data as { isActive: boolean }).isActive).toBe(true);

      await sendMessage(endpointPath);

      expect(await waitForDispatch(triggerId)).not.toBe('unknown');
    },
    SIGNAL_TIMEOUT_MS * 2,
  );

  it(
    '다른 인스턴스가 알린 등록 · 해제를 반영한다',
    async () => {
      expect(await listenerSubscribers()).toBeGreaterThanOrEqual(1);

      // 등록: 다른 인스턴스에서 켠 트리거.
      const registered = await seedTelegramTrigger(true);
      const receivers = await publishFromOtherInstance({
        op: 'register',
        triggerId: registered.triggerId,
        provider: 'telegram',
      });
      expect(receivers).toBeGreaterThanOrEqual(1);
      await sleep(300);
      await sendMessage(registered.endpointPath);
      expect(await waitForDispatch(registered.triggerId)).not.toBe('unknown');

      // 해제: 다른 인스턴스에서 지운 트리거. 등록을 알린 뒤 해제를 알린다.
      const removed = await seedTelegramTrigger(true);
      await publishFromOtherInstance({
        op: 'register',
        triggerId: removed.triggerId,
        provider: 'telegram',
      });
      await publishFromOtherInstance({
        op: 'unregister',
        triggerId: removed.triggerId,
      });
      await sleep(300);
      const executionId = await sendMessage(removed.endpointPath);
      expect(await waitForExecutionEnd(executionId)).toBe('completed');
      expect(await health(removed.triggerId)).toBe('unknown');
    },
    SIGNAL_TIMEOUT_MS * 3,
  );

  it(
    '구독 연결이 다시 붙으면 놓친 등록을 DB 에서 복원한다',
    async () => {
      // 알림을 놓친 활성 트리거 — DB 에만 있다.
      const { triggerId, endpointPath } = await seedTelegramTrigger(true);

      // 서버의 pub/sub 연결을 끊는다. ioredis 가 다시 붙어 'ready' 를 낸다.
      await redis.call('CLIENT', 'KILL', 'TYPE', 'pubsub');
      const deadline = Date.now() + SIGNAL_TIMEOUT_MS;
      while ((await listenerSubscribers()) < 1) {
        if (Date.now() > deadline) throw new Error('listener 구독이 다시 붙지 않았다');
        await sleep(100);
      }
      // 재구독 응답 뒤의 DB 복원이 끝나기를 기다린다.
      await sleep(1_000);

      await sendMessage(endpointPath);

      expect(await waitForDispatch(triggerId)).not.toBe('unknown');
    },
    SIGNAL_TIMEOUT_MS * 3,
  );
});
