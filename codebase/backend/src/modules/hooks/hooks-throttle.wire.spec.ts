import { NotFoundException, type INestApplication } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { ThrottlerModule } from '@nestjs/throttler';
import { getRepositoryToken } from '@nestjs/typeorm';
import request from 'supertest';

import { UserThrottlerGuard } from '../../common/guards/user-throttler.guard';
import { Trigger } from '../triggers/entities/trigger.entity';
import { EmbedConfigService } from './embed-config.service';
import { HookTriggerThrottlerGuard } from './hook-trigger-throttler.guard';
import { HooksController } from './hooks.controller';
import { HooksService } from './hooks.service';
import { PublicWebhookQuotaService } from './public-webhook-quota.service';
import { PublicWebhookThrottleGuard } from './public-webhook-throttle.guard';

/**
 * `POST /hooks/:endpointPath` 의 전역 요청 한도를 **실제 Nest 가드 체인**으로 본다(REQ-CHAT-079).
 *
 * ## e2e 가 아니라 여기서 보는 이유
 *
 * e2e 컨테이너는 `NODE_ENV=test` 로 뜨고 `ThrottlerModule` 의 `skipIf`(`shouldSkipThrottle`)가 그때 전역
 * 한도를 통째로 끈다. 그래서 e2e 로는 "채팅 요청이 한도를 넘어도 막히지 않는다" 를 가릴 수 없다. 이 spec
 * 은 `skipIf` 없이 한도를 2 로 둔 모듈에서 전역 가드(`APP_GUARD`) → 공개 웹훅 가드 → 웹훅 한도 가드
 * 순서가 실제 라우트 데코레이터대로 도는지 본다.
 *
 * ## 무엇이 진짜이고 무엇이 mock 인가
 *
 * 컨트롤러 · 세 가드 · Throttler 저장소는 진짜다. 트리거 저장소 · 공개 웹훅 quota · `HooksService` 는
 * mock 이다. 채팅이 아닌 트리거는 `authConfigId` 를 둬서 공개 웹훅 IP quota 를 타지 않게 한다. 그래야
 * 429 가 전역 한도에서만 나온다.
 */
describe('POST /hooks/:endpointPath — 전역 요청 한도 (가드 체인)', () => {
  const LIMIT = 2;

  const triggers: Record<string, Partial<Trigger>> = {
    'chat-hook': {
      id: 'trigger-chat',
      endpointPath: 'chat-hook',
      type: 'webhook',
      authConfigId: null,
      config: { chatChannel: { provider: 'slack' } },
    },
    'plain-hook': {
      id: 'trigger-plain',
      endpointPath: 'plain-hook',
      type: 'webhook',
      authConfigId: 'auth-config-1',
      config: {},
    },
  };

  let app: INestApplication;
  let consumeStart: jest.Mock;

  beforeEach(async () => {
    consumeStart = jest.fn().mockResolvedValue({ allowed: true, reason: null });
    const moduleRef = await Test.createTestingModule({
      imports: [
        ThrottlerModule.forRoot({
          throttlers: [{ name: 'default', ttl: 60_000, limit: LIMIT }],
        }),
      ],
      controllers: [HooksController],
      providers: [
        { provide: APP_GUARD, useClass: UserThrottlerGuard },
        PublicWebhookThrottleGuard,
        HookTriggerThrottlerGuard,
        {
          provide: getRepositoryToken(Trigger),
          useValue: {
            findOne: jest.fn(({ where }: { where: { endpointPath: string } }) =>
              Promise.resolve(triggers[where.endpointPath] ?? null),
            ),
          },
        },
        { provide: PublicWebhookQuotaService, useValue: { consumeStart } },
        {
          provide: HooksService,
          useValue: {
            handleWebhook: jest.fn(
              (
                _path: string,
                _req: unknown,
                _raw: unknown,
                trigger: unknown,
              ) =>
                trigger
                  ? Promise.resolve({ executionId: 'exec-1' })
                  : Promise.reject(new NotFoundException()),
            ),
          },
        },
        { provide: EmbedConfigService, useValue: {} },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  const post = (endpointPath: string) =>
    request(app.getHttpServer()).post(`/hooks/${endpointPath}`).send({});

  it('채팅 채널 트리거는 limit 을 넘겨도 429 를 받지 않는다', async () => {
    for (let i = 0; i < LIMIT + 3; i += 1) {
      const res = await post('chat-hook');
      expect(res.status).toBe(202);
    }
  });

  it('채팅이 아닌 웹훅은 limit 을 넘으면 429 를 받는다 — 위 단언이 vacuous 하지 않다', async () => {
    for (let i = 0; i < LIMIT; i += 1) {
      expect((await post('plain-hook')).status).toBe(202);
    }
    expect((await post('plain-hook')).status).toBe(429);
  });

  it('채팅 채널 요청은 같은 클라이언트의 일반 웹훅 한도를 쓰지 않는다', async () => {
    for (let i = 0; i < LIMIT + 3; i += 1) {
      await post('chat-hook');
    }
    for (let i = 0; i < LIMIT; i += 1) {
      expect((await post('plain-hook')).status).toBe(202);
    }
  });

  it('없는 endpointPath 도 전역 한도를 받는다(404 → 429)', async () => {
    for (let i = 0; i < LIMIT; i += 1) {
      expect((await post('missing-hook')).status).toBe(404);
    }
    expect((await post('missing-hook')).status).toBe(429);
  });

  it('채팅 채널 트리거는 공개 웹훅 IP quota 도 타지 않는다', async () => {
    await post('chat-hook');
    expect(consumeStart).not.toHaveBeenCalled();
  });
});
