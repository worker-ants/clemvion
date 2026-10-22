import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { Client } from 'pg';
import request from 'supertest';
import { io, Socket } from 'socket.io-client';

import { createDbClient, uniqueEmail, uniqueName } from './helpers/db';
import { registerAndLogin } from './helpers/auth';

/**
 * 실행 채널 구독 e2e ([WebSocket 연결과 채널 구독 「채널 구독」](CLE-API-WS#4-채널-구독)).
 *
 * 에디터는 실행을 시작한 뒤 `execution:<id>` 를 구독하고, 서버가 구독 직후 보내는
 * `execution.snapshot` 으로 하단 실행 패널을 채운다. NestJS 12 부터 전역 enhancer
 * (`APP_INTERCEPTOR` · `APP_GUARD` · `APP_PIPE`)가 게이트웨이 핸들러에도 붙어서 HTTP 전용
 * `LoggingInterceptor` 가 `subscribe` 를 `exception` 으로 끝냈고, 화면에는 «실시간 업데이트
 * 연결이 지연» 토스트와 빈 패널만 남았다. 단위 테스트는 핸들러를 직접 불러 이 파이프라인을
 * 지나지 않으므로 실제 소켓으로 고정한다.
 */
const BASE_URL = process.env.E2E_BASE_URL ?? 'http://backend-e2e:3011';
const EVENT_TIMEOUT_MS = 10_000;

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

describe('WebSocket 실행 채널 구독 (e2e)', () => {
  let db: Client;
  let accessToken: string;
  let socket: Socket;

  beforeAll(async () => {
    db = createDbClient();
    await db.connect();
    ({ accessToken } = await registerAndLogin(
      BASE_URL,
      uniqueEmail('ws-sub'),
      db,
    ));

    socket = io(`${BASE_URL}/ws`, {
      auth: { token: accessToken },
      transports: ['websocket'],
      reconnection: false,
    });
    await waitForEvent(socket, 'connect');
  }, 60_000);

  afterAll(async () => {
    socket?.close();
    await db.end();
  });

  it('실행 직후 구독하면 subscribed 성공과 그 실행의 snapshot 을 받고 exception 은 없다', async () => {
    const exceptions: unknown[] = [];
    socket.on('exception', (payload: unknown) => exceptions.push(payload));

    const created = await request(BASE_URL)
      .post('/api/workflows')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ name: uniqueName('ws-sub-wf') });
    expect(created.status).toBe(201);
    const workflowId = (created.body.data as { id: string }).id;

    const executed = await request(BASE_URL)
      .post(`/api/workflows/${workflowId}/execute`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({});
    expect(executed.status).toBe(202);
    const executionId = (executed.body.data as { executionId: string })
      .executionId;
    const channel = `execution:${executionId}`;

    const subscribed = waitForEvent<{ success: boolean; channel?: string }>(
      socket,
      'subscribed',
    );
    const snapshot = waitForEvent<{
      executionId: string;
      execution: { id: string; status: string };
    }>(socket, 'execution.snapshot');
    socket.emit('subscribe', { channel });

    await expect(subscribed).resolves.toEqual({ success: true, channel });
    const received = await snapshot;
    expect(received.executionId).toBe(executionId);
    expect(received.execution.id).toBe(executionId);
    expect(exceptions).toEqual([]);
  });
});
