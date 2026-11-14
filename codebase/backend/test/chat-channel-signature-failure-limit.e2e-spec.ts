import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import Redis from 'ioredis';
import { Client } from 'pg';
import request from 'supertest';

import {
  makeSignatureFailureKey,
  SIGNATURE_FAILURE_LIMIT_PER_MIN,
  SIGNATURE_FAILURE_WINDOW_SEC,
} from '../src/modules/chat-channel/chat-channel-signature-failure-limiter.service';
import { createDbClient } from './helpers/db';
import { setupChatChannelTrigger } from './helpers/e2e-chat-channel-fixture';

/**
 * e2e: 채팅 채널 서명 검증 실패 한도의 키 IP 와 TTL (NERV Task `CLE-T-CC3GPN` · `CLE-T-A5T8D6`).
 *
 * 서명 참조가 있는 Telegram 트리거를 두고 시크릿은 저장하지 않는다. 그러면 모든 요청이 시크릿 조회에서
 * 실패해 `Invalid Telegram secret token` 401 을 받는다. 한도에 닿은 쌍은 검증 없이
 * `Too many failed signature checks` 401 을 받으므로 메시지로 둘을 가른다.
 *
 * 키의 IP 는 `req.ip` 다(2026-11-14 답 A). 백엔드는 `trust proxy 1` 이라 `X-Forwarded-For` 의 맨 뒤 값이
 * `req.ip` 가 된다. 운영에서는 앞 프록시가 덧붙인 값이라 보내는 쪽이 정할 수 없다. 그래서 첫 값만 바꾼
 * 요청은 같은 버킷이고, 맨 뒤 값이 다른 요청은 다른 버킷이다.
 *
 * TTL 복구는 Lua 스크립트가 실제 Redis 에서 도는지 본다. 단위 테스트는 Redis 를 모사해서 스크립트가
 * 실제로 TTL 을 다시 거는지 알 수 없다.
 *
 * IP 는 다른 e2e 파일(203.0.113.0/24)과 겹치지 않게 TEST-NET-2(198.51.100.0/24)를 쓴다. 키에 트리거
 * id(실행마다 새 UUID)가 들어가므로 이전 실행의 카운터와도 섞이지 않는다.
 */

const BASE_URL = process.env.E2E_BASE_URL ?? 'http://backend-e2e:3011';

const SPOOFED_FIRST = '198.51.100.41';
const PROXY_SEEN = '198.51.100.42';
const OTHER_PROXY_SEEN = '198.51.100.43';
const TTL_LESS_IP = '198.51.100.44';

const INVALID_TOKEN = 'Invalid Telegram secret token';
const TOO_MANY = 'Too many failed signature checks';

describe('채팅 채널 서명 실패 한도 (e2e)', () => {
  let db: Client;
  let redis: Redis;
  let endpointPath: string;
  let triggerId: string;

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
    const setup = await setupChatChannelTrigger({ db, provider: 'telegram' });
    endpointPath = setup.endpointPath;
    triggerId = setup.triggerId;
    // 서명 참조만 두고 시크릿은 저장하지 않는다. 시크릿 조회가 실패해 모든 요청이 401 이다.
    await db.query(`UPDATE trigger SET config = $1::jsonb WHERE id = $2`, [
      JSON.stringify({
        chatChannel: {
          provider: 'telegram',
          botTokenRef: `secret://triggers/${triggerId}/bot-token`,
          inboundSigningRef: `secret://triggers/${triggerId}/inbound-signing`,
        },
      }),
      triggerId,
    ]);
  }, 30_000);

  afterAll(async () => {
    if (triggerId) {
      await redis
        .del(
          makeSignatureFailureKey(triggerId, PROXY_SEEN),
          makeSignatureFailureKey(triggerId, OTHER_PROXY_SEEN),
          makeSignatureFailureKey(triggerId, TTL_LESS_IP),
        )
        .catch(() => undefined);
      await db
        .query('DELETE FROM trigger WHERE id = $1', [triggerId])
        .catch(() => undefined);
    }
    await redis.quit();
    await db.end();
  });

  function postUpdate(xff: string) {
    return request(BASE_URL)
      .post(`/api/hooks/${endpointPath}`)
      .set('x-forwarded-for', xff)
      .set('x-telegram-bot-api-secret-token', 'wrong-secret-token')
      .set('content-type', 'application/json')
      .send(
        JSON.stringify({
          update_id: 1,
          message: {
            message_id: 1,
            chat: { id: 1, type: 'private' },
            from: { id: 1, is_bot: false },
            text: 'hi',
          },
        }),
      );
  }

  it('XFF 첫 값이 아니라 req.ip(맨 뒤 값)로 센다', async () => {
    for (let i = 0; i < SIGNATURE_FAILURE_LIMIT_PER_MIN; i += 1) {
      const res = await postUpdate(`${SPOOFED_FIRST}, ${PROXY_SEEN}`);
      expect(res.status).toBe(401);
      expect(res.body.error.message).toBe(INVALID_TOKEN);
    }

    // 첫 값을 바꿔도 같은 버킷이다. 검증 없이 한도 응답을 받는다.
    const spoofed = await postUpdate(`198.51.100.99, ${PROXY_SEEN}`);
    expect(spoofed.status).toBe(401);
    expect(spoofed.body.error).toEqual({
      code: 'AUTH_FAILED',
      message: TOO_MANY,
    });

    // 첫 값이 같아도 맨 뒤 값이 다르면 다른 버킷이다. 막히지 않고 서명 검증으로 간다.
    const otherBucket = await postUpdate(
      `${SPOOFED_FIRST}, ${OTHER_PROXY_SEEN}`,
    );
    expect(otherBucket.status).toBe(401);
    expect(otherBucket.body.error.message).toBe(INVALID_TOKEN);

    // 막힌 요청은 세지 않는다. 카운터는 한도에서 멈추고 고정 창 TTL 이 걸려 있다.
    const key = makeSignatureFailureKey(triggerId, PROXY_SEEN);
    expect(Number(await redis.get(key))).toBe(SIGNATURE_FAILURE_LIMIT_PER_MIN);
    const ttl = await redis.ttl(key);
    expect(ttl).toBeGreaterThan(0);
    expect(ttl).toBeLessThanOrEqual(SIGNATURE_FAILURE_WINDOW_SEC);
  });

  it('TTL 없이 남은 카운터도 다음 실패에서 TTL 을 다시 얻는다', async () => {
    const key = makeSignatureFailureKey(triggerId, TTL_LESS_IP);
    // 예전 pipeline 의 EXPIRE 가 실패해 TTL 없이 남은 키를 흉내 낸다.
    await redis.set(key, '3');
    expect(await redis.ttl(key)).toBe(-1);

    const res = await postUpdate(TTL_LESS_IP);
    expect(res.status).toBe(401);
    expect(res.body.error.message).toBe(INVALID_TOKEN);

    expect(Number(await redis.get(key))).toBe(4);
    const ttl = await redis.ttl(key);
    expect(ttl).toBeGreaterThan(0);
    expect(ttl).toBeLessThanOrEqual(SIGNATURE_FAILURE_WINDOW_SEC);
  });
});
