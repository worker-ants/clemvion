import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { createServer } from 'node:http';
import { createAdapter } from '@socket.io/redis-adapter';
import Redis from 'ioredis';
import { Client } from 'pg';
import { Server } from 'socket.io';
import { io, Socket } from 'socket.io-client';
import request from 'supertest';

import { createDbClient, uniqueEmail, uniqueName } from './helpers/db';
import { registerAndLogin } from './helpers/auth';

/**
 * 여러 서버 인스턴스에서의 WebSocket 전달 e2e
 * ([WebSocket 연결과 채널 구독 「여러 서버 인스턴스에서의 전달」](CLE-API-WS-MSG#46-여러-서버-인스턴스에서의-전달)).
 *
 * e2e compose 의 백엔드는 하나다. 이 테스트 프로세스가 같은 Redis 에 Socket.IO Redis adapter 를
 * 건 두 번째 서버 인스턴스(B)로 동작한다.
 * - B 가 채널에 낸 이벤트를 백엔드에 붙은 구독 소켓이 받는다(다른 인스턴스 → 백엔드).
 * - 백엔드의 채널 발행이 `ws:sio#/ws#<채널>#` 로 PUBLISH 된다(백엔드 → 다른 인스턴스).
 * - 전송은 websocket 하나라 polling 요청은 거절한다(CLE-API-WS-CONN §2.1).
 */
const BASE_URL = process.env.E2E_BASE_URL ?? 'http://backend-e2e:3011';
const EVENT_TIMEOUT_MS = 10_000;
const ADAPTER_KEY = 'ws:sio';

function redisClient(): Redis {
  return new Redis({
    host: process.env.REDIS_HOST ?? 'redis',
    port: Number(process.env.REDIS_PORT ?? '6379'),
    maxRetriesPerRequest: null,
  });
}

function waitForEvent<T>(socket: Socket, event: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      socket.off(event, onEvent);
      reject(new Error(`${event} 를 ${EVENT_TIMEOUT_MS}ms 안에 받지 못했다`));
    }, EVENT_TIMEOUT_MS);
    const onEvent = (payload: T) => {
      clearTimeout(timer);
      resolve(payload);
    };
    socket.once(event, onEvent);
  });
}

describe('WebSocket 여러 서버 인스턴스 전달 (e2e)', () => {
  let db: Client;
  let accessToken: string;
  let userId: string;
  let socket: Socket;
  let pub: Redis;
  let sub: Redis;
  let instanceB: Server;

  beforeAll(async () => {
    db = createDbClient();
    await db.connect();
    ({ accessToken, userId } = await registerAndLogin(
      BASE_URL,
      uniqueEmail('ws-multi'),
      db,
    ));

    socket = io(`${BASE_URL}/ws`, {
      auth: { token: accessToken },
      transports: ['websocket'],
      reconnection: false,
    });
    await waitForEvent(socket, 'connect');

    pub = redisClient();
    sub = pub.duplicate();
    // engine 이 있어야 close() 가 끝난다. 듣지 않는 http 서버에 붙인다.
    instanceB = new Server(createServer());
    instanceB.adapter(createAdapter(pub, sub, { key: ADAPTER_KEY }));
    instanceB.of('/ws');
  }, 60_000);

  afterAll(async () => {
    socket?.close();
    await instanceB?.close();
    await sub?.quit().catch(() => undefined);
    await pub?.quit().catch(() => undefined);
    await db.end();
  });

  it('다른 서버 인스턴스가 채널에 낸 이벤트를 백엔드에 붙은 구독 소켓이 받는다', async () => {
    const channel = `notifications:${userId}`;
    const subscribed = waitForEvent<{ success: boolean; channel?: string }>(
      socket,
      'subscribed',
    );
    socket.emit('subscribe', { channel });
    await expect(subscribed).resolves.toEqual({ success: true, channel });

    const nonce = uniqueName('ws-multi-nonce');
    const received = waitForEvent<{ nonce: string }>(
      socket,
      'e2e.cross_instance',
    );
    instanceB.of('/ws').to(channel).emit('e2e.cross_instance', { nonce });

    await expect(received).resolves.toEqual({ nonce });
  });

  it('백엔드의 실행 채널 발행이 ws:sio 접두 채널로 PUBLISH 된다', async () => {
    const observer = redisClient();
    try {
      const channels = new Set<string>();
      const waiters = new Map<string, () => void>();
      observer.on('pmessage', (_pattern: string, channel: string) => {
        channels.add(channel);
        waiters.get(channel)?.();
      });
      await observer.psubscribe(`${ADAPTER_KEY}#/ws#*`);

      const created = await request(BASE_URL)
        .post('/api/workflows')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ name: uniqueName('ws-multi-wf') });
      expect(created.status).toBe(201);
      const workflowId = (created.body.data as { id: string }).id;

      const executed = await request(BASE_URL)
        .post(`/api/workflows/${workflowId}/execute`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({});
      expect(executed.status).toBe(202);
      const executionId = (executed.body.data as { executionId: string })
        .executionId;
      const expected = `${ADAPTER_KEY}#/ws#execution:${executionId}#`;

      const published = new Promise<void>((resolve, reject) => {
        if (channels.has(expected)) return resolve();
        const timer = setTimeout(
          () =>
            reject(
              new Error(
                `${expected} 를 ${EVENT_TIMEOUT_MS}ms 안에 받지 못했다`,
              ),
            ),
          EVENT_TIMEOUT_MS,
        );
        waiters.set(expected, () => {
          clearTimeout(timer);
          resolve();
        });
      });
      await expect(published).resolves.toBeUndefined();
    } finally {
      await observer.quit().catch(() => undefined);
    }
  });

  it('polling 전송 요청은 거절한다', async () => {
    const res = await request(BASE_URL)
      .get('/socket.io/')
      .query({ EIO: '4', transport: 'polling' });

    expect(res.status).toBe(400);
    expect(res.body).toEqual(
      expect.objectContaining({ message: 'Transport unknown' }),
    );
  });
});
