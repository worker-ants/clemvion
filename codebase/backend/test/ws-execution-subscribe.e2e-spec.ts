import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { Client } from 'pg';
import request from 'supertest';
import type { Socket } from 'socket.io-client';

import { createDbClient, uniqueEmail, uniqueName } from './helpers/db';
import { registerAndLogin } from './helpers/auth';
import { connectWs, waitForEvent, type SubscribedAck } from './helpers/ws';

/**
 * 실행 채널 구독 e2e ([WebSocket 연결과 채널 구독 「채널 구독」](CLE-API-WS-MSG#4-채널-구독)).
 *
 * 에디터는 실행을 시작한 뒤 `execution:<id>` 를 구독하고, 서버가 구독 직후 보내는
 * `execution.snapshot` 으로 하단 실행 패널을 채운다. 전역 enhancer 가 게이트웨이 핸들러에도 붙어서
 * (근거는 `src/common/utils/http-context.ts`) HTTP 전용 `LoggingInterceptor` 가 `subscribe` 를
 * `exception` 으로 끝냈고, 화면에는 «실시간 업데이트 연결이 지연» 토스트와 빈 패널만 남았다. 단위
 * 테스트는 핸들러를 직접 불러 이 파이프라인을 지나지 않으므로 실제 소켓으로 고정한다.
 */
const BASE_URL = process.env.E2E_BASE_URL ?? 'http://backend-e2e:3011';

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

    socket = await connectWs(BASE_URL, accessToken);
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

    // 두 대기를 함께 묶는다. 하나씩 await 하면 앞의 것이 실패할 때 뒤의 거부가 unhandled 로 남는다.
    // 서버가 `exception` 을 보내면 두 대기 모두 그 payload 로 바로 실패한다.
    const both = Promise.all([
      waitForEvent<SubscribedAck>(socket, 'subscribed'),
      waitForEvent<{
        executionId: string;
        execution: { id: string; status: string };
      }>(socket, 'execution.snapshot'),
    ]);
    socket.emit('subscribe', { channel });

    const [subscribed, received] = await both;
    expect(subscribed).toEqual({ success: true, channel });
    expect(received.executionId).toBe(executionId);
    expect(received.execution.id).toBe(executionId);
    expect(exceptions).toEqual([]);
  });

  // 실패 응답에도 요청한 channel 이 실린다([WebSocket 메시지 「구독 인가」](CLE-API-WS-MSG#44-구독-인가)).
  // 클라이언트는 이 값으로 같은 소켓의 여러 구독 중 어느 것이 실패했는지 가린다.
  it('다른 워크스페이스의 실행을 구독하면 FORBIDDEN 과 요청한 channel 을 받는다', async () => {
    const other = await registerAndLogin(
      BASE_URL,
      uniqueEmail('ws-sub-other'),
      db,
    );
    const created = await request(BASE_URL)
      .post('/api/workflows')
      .set('Authorization', `Bearer ${other.accessToken}`)
      .send({ name: uniqueName('ws-sub-other-wf') });
    expect(created.status).toBe(201);
    const executed = await request(BASE_URL)
      .post(
        `/api/workflows/${(created.body.data as { id: string }).id}/execute`,
      )
      .set('Authorization', `Bearer ${other.accessToken}`)
      .send({});
    expect(executed.status).toBe(202);
    const channel = `execution:${(executed.body.data as { executionId: string }).executionId}`;

    const subscribed = waitForEvent<SubscribedAck>(socket, 'subscribed');
    socket.emit('subscribe', { channel });

    expect(await subscribed).toEqual({
      success: false,
      error: 'Not authorized for this execution',
      code: 'FORBIDDEN',
      channel,
    });
  });
});
