import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { decode, sign, type JwtPayload } from 'jsonwebtoken';
import { Client } from 'pg';
import request from 'supertest';
import type { Socket } from 'socket.io-client';

import { MSG_AUTH_TOKEN_EXPIRING } from '../src/modules/websocket/websocket-events.types';
import { createDbClient, uniqueEmail, uniqueName } from './helpers/db';
import { registerAndLogin } from './helpers/auth';
import { connectWs, waitForEvent, type SubscribedAck } from './helpers/ws';

/**
 * 연결 중 토큰 만료 e2e ([WebSocket 연결 「2.2 인증」](CLE-API-WS-CONN#22-인증), CLE-T-PK4KG7).
 *
 * 소켓 수명은 토큰 수명에 묶인다. 서버는 핸드셰이크에서 검증한 토큰의 `exp` 로 타이머를 걸어 만료 60초
 * 전에 `auth.token_expired` 를 보내고 `exp` 에 연결을 끊는다. 클라이언트는 새 토큰으로 다시 연결한다.
 *
 * access token 수명은 900초라 그대로는 기다릴 수 없다. 이 테스트는 backend-e2e 와 같은 `JWT_SECRET` 으로
 * `exp` 를 몇 초 뒤로 잡은 토큰을 직접 서명한다. 게이트웨이는 서명과 `exp` 만 검증하므로 운영 경로를
 * 그대로 탄다. 운영 코드나 설정에는 수명을 바꾸는 길을 만들지 않는다. 남은 시간이 60초보다 짧은 토큰이라
 * 사전 통지는 연결 직후에 온다. 60초 lead 값 자체는 게이트웨이 단위 테스트가 확인한다.
 */
const BASE_URL = process.env.E2E_BASE_URL ?? 'http://backend-e2e:3011';

// backend-e2e 의 JWT_SECRET(docker-compose.e2e.yml). runner env 에 없으면 compose 값(테스트 전용, 공개됨)을 쓴다.
const JWT_SECRET =
  process.env.JWT_SECRET ?? 'clemvion-e2e-jwt-secret-do-not-use-in-prod-x9y8z7';

/** 짧은 토큰의 남은 수명(초). 연결 · 통지 확인을 마치기에 넉넉하고 기다리기에 짧은 값이다. */
const SHORT_TOKEN_TTL_S = 5;

/** 컨테이너 사이 시계와 타이머 지연을 감안한 허용 오차. */
const CLOCK_TOLERANCE_MS = 1_000;

/**
 * 로그인으로 받은 토큰과 같은 클레임(`sub` · `email` · `activeWorkspaceId` · `role`)에 `exp` 만 짧게 잡아
 * 다시 서명한다.
 */
function signShortLivedToken(accessToken: string, expSeconds: number): string {
  const claims = decode(accessToken) as JwtPayload | null;
  if (!claims || typeof claims.sub !== 'string') {
    throw new Error('로그인 토큰에서 sub 를 읽지 못했다');
  }
  const { iat: _iat, exp: _exp, ...rest } = claims;
  return sign({ ...rest, exp: expSeconds }, JWT_SECRET, {
    algorithm: 'HS256',
  });
}

describe('WebSocket 연결 중 토큰 만료 (e2e)', () => {
  let db: Client;
  let accessToken: string;
  const sockets: Socket[] = [];

  beforeAll(async () => {
    db = createDbClient();
    await db.connect();
    ({ accessToken } = await registerAndLogin(
      BASE_URL,
      uniqueEmail('ws-expiry'),
      db,
    ));
  }, 60_000);

  afterAll(async () => {
    for (const socket of sockets) socket.close();
    await db.end();
  });

  it('만료가 가까운 토큰은 사전 통지를 받고 exp 에 서버가 끊는다. 새 토큰으로 다시 붙으면 구독과 snapshot 을 받는다', async () => {
    const expSeconds = Math.floor(Date.now() / 1000) + SHORT_TOKEN_TTL_S;
    const expMs = expSeconds * 1000;

    // 통지는 연결 직후에 온다. `connect` 를 기다리는 동안 놓치지 않도록 소켓을 만든 직후 리스너를 붙인다.
    let notice$!: Promise<{ message: string; expiresAt: string }>;
    let disconnect$!: Promise<string>;
    const shortSocket = await connectWs(
      BASE_URL,
      signShortLivedToken(accessToken, expSeconds),
      {
        onCreated: (socket) => {
          notice$ = waitForEvent(socket, 'auth.token_expired');
          disconnect$ = waitForEvent(socket, 'disconnect', {
            timeoutMs: SHORT_TOKEN_TTL_S * 1000 + 10_000,
          });
          // 앞의 대기가 실패해 뒤의 것을 기다리지 않게 되면 그 거부가 unhandled 로 남는다.
          disconnect$.catch(() => undefined);
        },
      },
    );
    sockets.push(shortSocket);

    const notice = await notice$;
    expect(notice).toEqual({
      message: MSG_AUTH_TOKEN_EXPIRING,
      expiresAt: new Date(expMs).toISOString(),
    });
    // 통지는 끊기 전에 온다.
    expect(shortSocket.connected).toBe(true);

    // 서버가 끊은 경우 socket.io 는 자동 재연결하지 않는다(CLE-API-WS-CONN §6.1).
    const reason = await disconnect$;
    expect(reason).toBe('io server disconnect');
    expect(Date.now()).toBeGreaterThanOrEqual(expMs - CLOCK_TOLERANCE_MS);

    // 새 토큰(로그인으로 받은 정상 토큰)으로 다시 붙는다.
    const socket = await connectWs(BASE_URL, accessToken);
    sockets.push(socket);

    const created = await request(BASE_URL)
      .post('/api/workflows')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ name: uniqueName('ws-expiry-wf') });
    expect(created.status).toBe(201);
    const executed = await request(BASE_URL)
      .post(
        `/api/workflows/${(created.body.data as { id: string }).id}/execute`,
      )
      .set('Authorization', `Bearer ${accessToken}`)
      .send({});
    expect(executed.status).toBe(202);
    const executionId = (executed.body.data as { executionId: string })
      .executionId;
    const channel = `execution:${executionId}`;

    const both = Promise.all([
      waitForEvent<SubscribedAck>(socket, 'subscribed'),
      waitForEvent<{ executionId: string }>(socket, 'execution.snapshot'),
    ]);
    socket.emit('subscribe', { channel });
    const [subscribed, snapshot] = await both;
    expect(subscribed).toEqual({ success: true, channel });
    expect(snapshot.executionId).toBe(executionId);
  }, 60_000);
});
