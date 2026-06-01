import {
  ExecutionContext,
  HttpException,
  HttpStatus,
  PayloadTooLargeException,
} from '@nestjs/common';
import { Repository } from 'typeorm';
import { Trigger } from '../triggers/entities/trigger.entity';
import { PublicWebhookQuotaService } from './public-webhook-quota.service';
import { PublicWebhookThrottleGuard } from './public-webhook-throttle.guard';

interface ReqShape {
  params?: { endpointPath?: string };
  headers?: Record<string, unknown>;
  body?: unknown;
  rawBody?: Buffer;
}

function makeContext(req: ReqShape): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => req,
      getResponse: () => ({}),
    }),
  } as unknown as ExecutionContext;
}

function makeGuard(opts: {
  trigger?: Partial<Trigger> | null;
  consume?: { allowed: boolean; reason: 'startup_rate' | 'hourly_new' | null };
  findThrows?: boolean;
}) {
  const triggerRepository = {
    findOne: opts.findThrows
      ? jest.fn().mockRejectedValue(new Error('db down'))
      : jest.fn().mockResolvedValue(opts.trigger ?? null),
  } as unknown as Repository<Trigger>;
  const quota = {
    consumeStart: jest
      .fn()
      .mockResolvedValue(opts.consume ?? { allowed: true, reason: null }),
  } as unknown as PublicWebhookQuotaService;
  const guard = new PublicWebhookThrottleGuard(triggerRepository, quota);
  return { guard, triggerRepository, quota };
}

const PUBLIC_REQ: ReqShape = {
  params: { endpointPath: 'abc123' },
  headers: { 'x-forwarded-for': '9.9.9.9' },
  body: { hello: 'world' },
};

describe('PublicWebhookThrottleGuard', () => {
  it('endpointPath 없으면 통과(방어적)', async () => {
    const { guard } = makeGuard({});
    await expect(guard.canActivate(makeContext({}))).resolves.toBe(true);
  });

  it('trigger 미존재 → 통과(HooksService 가 404)', async () => {
    const { guard, quota } = makeGuard({ trigger: null });
    await expect(guard.canActivate(makeContext(PUBLIC_REQ))).resolves.toBe(
      true,
    );
    expect(quota.consumeStart).not.toHaveBeenCalled();
  });

  it('인증 webhook(authConfigId 존재) → throttle 건너뜀', async () => {
    const { guard, quota } = makeGuard({
      trigger: { authConfigId: 'ac-1' } as Partial<Trigger>,
    });
    await expect(guard.canActivate(makeContext(PUBLIC_REQ))).resolves.toBe(
      true,
    );
    expect(quota.consumeStart).not.toHaveBeenCalled();
  });

  it('공개 webhook + 한도 내 → 통과 + consumeStart 호출', async () => {
    const { guard, quota } = makeGuard({
      trigger: { authConfigId: null } as Partial<Trigger>,
    });
    await expect(guard.canActivate(makeContext(PUBLIC_REQ))).resolves.toBe(
      true,
    );
    expect(quota.consumeStart).toHaveBeenCalledWith('9.9.9.9');
  });

  it('공개 webhook + rate-limit 초과 → 429', async () => {
    const { guard } = makeGuard({
      trigger: { authConfigId: null } as Partial<Trigger>,
      consume: { allowed: false, reason: 'startup_rate' },
    });
    await expect(
      guard.canActivate(makeContext(PUBLIC_REQ)),
    ).rejects.toMatchObject({ status: HttpStatus.TOO_MANY_REQUESTS });
  });

  it('hourly 초과 → 429 + HOURLY 코드', async () => {
    const { guard } = makeGuard({
      trigger: { authConfigId: null } as Partial<Trigger>,
      consume: { allowed: false, reason: 'hourly_new' },
    });
    expect.assertions(2);
    try {
      await guard.canActivate(makeContext(PUBLIC_REQ));
    } catch (e) {
      const err = e as HttpException;
      expect(err.getStatus()).toBe(HttpStatus.TOO_MANY_REQUESTS);
      const r = err.getResponse() as { error?: { code?: string } };
      expect(r.error?.code).toBe('PUBLIC_WEBHOOK_HOURLY_LIMIT');
    }
  });

  it('공개 webhook + body 크기 초과 → 413', async () => {
    const { guard, quota } = makeGuard({
      trigger: { authConfigId: null } as Partial<Trigger>,
    });
    const big: ReqShape = {
      params: { endpointPath: 'abc123' },
      headers: { 'x-forwarded-for': '9.9.9.9' },
      rawBody: Buffer.alloc(
        PublicWebhookThrottleGuard.DEFAULT_MAX_BODY_BYTES + 1,
      ),
    };
    await expect(guard.canActivate(makeContext(big))).rejects.toBeInstanceOf(
      PayloadTooLargeException,
    );
    expect(quota.consumeStart).not.toHaveBeenCalled();
  });

  it('공개 webhook + IP 식별 불가 → 통과(추적 불가 fail-open)', async () => {
    const { guard, quota } = makeGuard({
      trigger: { authConfigId: null } as Partial<Trigger>,
    });
    const noIp: ReqShape = {
      params: { endpointPath: 'abc123' },
      headers: {},
      body: {},
    };
    await expect(guard.canActivate(makeContext(noIp))).resolves.toBe(true);
    expect(quota.consumeStart).not.toHaveBeenCalled();
  });

  it('cf-connecting-ip 우선 추출', async () => {
    const { guard, quota } = makeGuard({
      trigger: { authConfigId: null } as Partial<Trigger>,
    });
    const req: ReqShape = {
      params: { endpointPath: 'abc123' },
      headers: { 'cf-connecting-ip': '1.1.1.1', 'x-forwarded-for': '2.2.2.2' },
      body: {},
    };
    await guard.canActivate(makeContext(req));
    expect(quota.consumeStart).toHaveBeenCalledWith('1.1.1.1');
  });

  it('trigger 조회 실패 → fail-open(통과)', async () => {
    const { guard, quota } = makeGuard({ findThrows: true });
    await expect(guard.canActivate(makeContext(PUBLIC_REQ))).resolves.toBe(
      true,
    );
    expect(quota.consumeStart).not.toHaveBeenCalled();
  });
});
