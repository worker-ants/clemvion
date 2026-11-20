import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import {
  Controller,
  type DynamicModule,
  Get,
  type INestApplication,
  Module,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { Throttle, ThrottlerModule } from '@nestjs/throttler';
import { createHash, randomUUID } from 'crypto';
import type { NextFunction, Request, Response } from 'express';
import Redis from 'ioredis';
import request from 'supertest';

import { UserThrottlerGuard } from '../src/common/guards/user-throttler.guard';
import { RedisConnectionProvider } from '../src/common/redis/redis-connection.provider';
import {
  REDIS_THROTTLER_COMMAND_TIMEOUT_MS,
  RedisThrottlerStorage,
  throttleBlockKey,
  throttleHitKey,
} from '../src/common/throttler/redis-throttler.storage';
import {
  buildThrottlerOptions,
  DEFAULT_THROTTLER,
  ThrottlerStorageModule,
} from '../src/common/throttler/throttler-storage.module';

/**
 * e2e: 요청 빈도 제한 저장소를 공유 Redis 로 옮긴 뒤의 동작 (NERV Task `CLE-T-JK1JFZ`).
 *
 * ## backend 컨테이너가 아니라 이 프로세스에 앱을 띄우는 이유
 *
 * e2e backend 는 `NODE_ENV=test` 로 떠서 `skipIf`(`shouldSkipThrottle`)가 요청 빈도 제한을 통째로 끈다.
 * 그래서 이 spec 은 실제 저장소 · 실제 `UserThrottlerGuard` · 실제 Redis 로 앱 두 개를 이 프로세스에 띄우고
 * `skipIf` 만 끈다. 두 앱이 같은 Redis 를 보므로 서버 인스턴스 둘과 같다. Lua 스크립트가 실제 Redis 에서
 * 도는지도 여기서 본다. 단위 테스트는 Redis 를 모사한다.
 *
 * 사용자 id 에 실행마다 새 UUID 를 넣어 이전 실행의 카운터와 섞이지 않게 한다.
 */

const REDIS_HOST = process.env.REDIS_HOST ?? 'redis';
const REDIS_PORT = Number(process.env.REDIS_PORT ?? '6379');
const REDIS_PASSWORD = process.env.REDIS_PASSWORD;

@Controller('throttle-e2e')
class ThrottleProbeController {
  @Get('default')
  byDefault() {
    return { ok: true };
  }

  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  @Get('route')
  route() {
    return { ok: true };
  }

  @Throttle({ default: { limit: 1, ttl: 1_000 } })
  @Get('short')
  short() {
    return { ok: true };
  }
}

/** 앱마다 다른 Redis 설정을 주려고 공유 연결 provider 를 전역 모듈로 바꿔 끼운다. */
function redisConnectionModule(conn: RedisConnectionProvider): DynamicModule {
  @Module({})
  class E2eRedisModule {}
  return {
    module: E2eRedisModule,
    global: true,
    providers: [{ provide: RedisConnectionProvider, useValue: conn }],
    exports: [RedisConnectionProvider],
  };
}

function connectionFor(port: number): RedisConnectionProvider {
  const values: Record<string, unknown> = {
    'redis.host': REDIS_HOST,
    'redis.port': port,
    'redis.password': REDIS_PASSWORD,
  };
  return new RedisConnectionProvider({
    get: (key: string) => values[key],
  } as unknown as ConfigService);
}

async function createApp(
  conn: RedisConnectionProvider,
): Promise<INestApplication> {
  const moduleRef = await Test.createTestingModule({
    imports: [
      redisConnectionModule(conn),
      ThrottlerModule.forRootAsync({
        imports: [ThrottlerStorageModule],
        inject: [RedisThrottlerStorage],
        useFactory: (storage: RedisThrottlerStorage) => ({
          ...buildThrottlerOptions(storage),
          // 이 프로세스도 NODE_ENV=test 다. 제한을 실제로 걸려고 건너뛰기만 끈다.
          skipIf: () => false,
        }),
      }),
    ],
    controllers: [ThrottleProbeController],
    providers: [{ provide: APP_GUARD, useClass: UserThrottlerGuard }],
  }).compile();
  const app = moduleRef.createNestApplication();
  // 운영에서는 JwtAuthGuard 가 채우는 req.user 를 헤더로 대신 채운다.
  app.use((req: Request, _res: Response, next: NextFunction) => {
    const userId = req.header('x-e2e-user');
    if (userId) (req as unknown as { user: unknown }).user = { sub: userId };
    next();
  });
  await app.init();
  return app;
}

/** `ThrottlerGuard.generateKey` 와 같은 식. Redis 에 실제로 그 키가 생겼는지 볼 때 쓴다. */
function guardKey(handler: string, tracker: string): string {
  return createHash('sha256')
    .update(`ThrottleProbeController-${handler}-default-${tracker}`)
    .digest('hex');
}

describe('요청 빈도 제한 Redis 저장소 (e2e)', () => {
  const runId = randomUUID();
  let redis: Redis;
  let connA: RedisConnectionProvider;
  let connB: RedisConnectionProvider;
  let downClient: Redis;
  let appA: INestApplication;
  let appB: INestApplication;
  let appDown: INestApplication;

  beforeAll(async () => {
    redis = new Redis({
      host: REDIS_HOST,
      port: REDIS_PORT,
      ...(REDIS_PASSWORD ? { password: REDIS_PASSWORD } : {}),
    });
    connA = connectionFor(REDIS_PORT);
    connB = connectionFor(REDIS_PORT);
    // 아무것도 듣지 않는 포트. 재연결하지 않게 해서 Redis 명령이 곧바로 실패하고 메모리 저장소로 내려간다.
    // 응답이 늦는 경우(제한 시간)는 단위 테스트가 본다.
    downClient = new Redis({
      host: REDIS_HOST,
      port: 1,
      lazyConnect: true,
      maxRetriesPerRequest: 0,
      retryStrategy: () => null,
    });
    downClient.on('error', () => undefined);
    const connDown = {
      getClientOrNull: () => downClient,
    } as unknown as RedisConnectionProvider;
    appA = await createApp(connA);
    appB = await createApp(connB);
    appDown = await createApp(connDown);
  }, 30_000);

  afterAll(async () => {
    await Promise.all([appA?.close(), appB?.close(), appDown?.close()]);
    await Promise.all([connA?.onModuleDestroy(), connB?.onModuleDestroy()]);
    downClient?.disconnect();
    await redis?.quit();
  });

  it('전역 기본 한도(100/분)를 두 인스턴스가 한 카운터로 나눠 센다', async () => {
    const user = `${runId}-default`;
    for (let i = 0; i < DEFAULT_THROTTLER.limit; i += 1) {
      const app = i % 2 === 0 ? appA : appB;
      await request(app.getHttpServer())
        .get('/throttle-e2e/default')
        .set('x-e2e-user', user)
        .expect(200);
    }

    const res = await request(appA.getHttpServer())
      .get('/throttle-e2e/default')
      .set('x-e2e-user', user);
    expect(res.status).toBe(429);
    expect(Number(res.headers['retry-after'])).toBeGreaterThan(0);

    // 한도를 넘긴 순간 차단 키가 생기고 hit 키는 지워진다.
    const key = guardKey('byDefault', `user:${user}`);
    expect(await redis.get(throttleBlockKey(key))).toBe(
      String(DEFAULT_THROTTLER.limit + 1),
    );
    expect(await redis.exists(throttleHitKey(key))).toBe(0);
  });

  it('라우트별 @Throttle 한도를 두 인스턴스가 함께 세고, 창 TTL 을 Redis 키에 건다', async () => {
    const user = `${runId}-route`;
    await request(appA.getHttpServer())
      .get('/throttle-e2e/route')
      .set('x-e2e-user', user)
      .expect(200);
    const hitKey = throttleHitKey(guardKey('route', `user:${user}`));
    const pttl = await redis.pttl(hitKey);
    expect(pttl).toBeGreaterThan(0);
    expect(pttl).toBeLessThanOrEqual(60_000);

    await request(appB.getHttpServer())
      .get('/throttle-e2e/route')
      .set('x-e2e-user', user)
      .expect(200);
    const third = await request(appA.getHttpServer())
      .get('/throttle-e2e/route')
      .set('x-e2e-user', user)
      .expect(200);
    expect(third.headers['x-ratelimit-remaining']).toBe('0');

    await request(appB.getHttpServer())
      .get('/throttle-e2e/route')
      .set('x-e2e-user', user)
      .expect(429);
  });

  it('UserThrottlerGuard 의 사용자 키로 사용자마다 따로 센다', async () => {
    const first = `${runId}-user-1`;
    const second = `${runId}-user-2`;
    for (let i = 0; i < 3; i += 1) {
      await request(appA.getHttpServer())
        .get('/throttle-e2e/route')
        .set('x-e2e-user', first)
        .expect(200);
    }
    await request(appB.getHttpServer())
      .get('/throttle-e2e/route')
      .set('x-e2e-user', first)
      .expect(429);

    await request(appB.getHttpServer())
      .get('/throttle-e2e/route')
      .set('x-e2e-user', second)
      .expect(200);
  });

  it('차단이 끝나면 새 창에서 다시 센다', async () => {
    const user = `${runId}-short`;
    await request(appA.getHttpServer())
      .get('/throttle-e2e/short')
      .set('x-e2e-user', user)
      .expect(200);
    await request(appB.getHttpServer())
      .get('/throttle-e2e/short')
      .set('x-e2e-user', user)
      .expect(429);

    await new Promise((resolve) => setTimeout(resolve, 1_200));

    await request(appB.getHttpServer())
      .get('/throttle-e2e/short')
      .set('x-e2e-user', user)
      .expect(200);
    await request(appA.getHttpServer())
      .get('/throttle-e2e/short')
      .set('x-e2e-user', user)
      .expect(429);
  });

  it('Redis 에 닿지 못하면 메모리 저장소로 제한을 계속 건다', async () => {
    const user = `${runId}-down`;
    const started = Date.now();
    for (let i = 0; i < 3; i += 1) {
      await request(appDown.getHttpServer())
        .get('/throttle-e2e/route')
        .set('x-e2e-user', user)
        .expect(200);
    }
    await request(appDown.getHttpServer())
      .get('/throttle-e2e/route')
      .set('x-e2e-user', user)
      .expect(429);
    // 첫 요청만 제한 시간을 기다리고 뒤 요청은 재시도 대기 동안 Redis 를 부르지 않는다.
    expect(Date.now() - started).toBeLessThan(
      REDIS_THROTTLER_COMMAND_TIMEOUT_MS * 4,
    );

    // 그 사용자의 카운터는 Redis 에 생기지 않았다.
    expect(
      await redis.exists(throttleHitKey(guardKey('route', `user:${user}`))),
    ).toBe(0);
  });
});
