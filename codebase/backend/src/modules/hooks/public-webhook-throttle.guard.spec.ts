import {
  ExecutionContext,
  HttpException,
  HttpStatus,
  PayloadTooLargeException,
} from '@nestjs/common';
import { Repository } from 'typeorm';
import { Trigger } from '../triggers/entities/trigger.entity';
import { PublicWebhookQuotaService } from './public-webhook-quota.service';
import {
  PublicWebhookThrottleGuard,
  extractClientIp,
} from './public-webhook-throttle.guard';

/** Exported for shared use — guard + tests share the same shape definition. */
export interface ReqShape {
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
  maxBodyBytes?: number;
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

  // inject optional configService with maxBodyBytes override
  const configService =
    opts.maxBodyBytes !== undefined
      ? ({
          get: jest.fn((k: string) =>
            k === 'publicWebhook.maxBodyBytes' ? opts.maxBodyBytes : undefined,
          ),
        } as unknown as import('@nestjs/config').ConfigService)
      : undefined;

  const guard = new PublicWebhookThrottleGuard(
    triggerRepository,
    quota,
    configService,
  );
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

  // ── W11: measureBodyBytes 분기 테스트 ──────────────────────────────────────

  it('measureBodyBytes — rawBody Buffer → 정확한 byte 수 반환', () => {
    const { guard } = makeGuard({});
    const buf = Buffer.from('hello');
    expect(guard.measureBodyBytes(buf, undefined)).toBe(5);
  });

  it('measureBodyBytes — rawBody 없고 body null → 0 반환', () => {
    const { guard } = makeGuard({});
    expect(guard.measureBodyBytes(undefined, null)).toBe(0);
  });

  it('measureBodyBytes — rawBody 없고 body undefined → 0 반환', () => {
    const { guard } = makeGuard({});
    expect(guard.measureBodyBytes(undefined, undefined)).toBe(0);
  });

  it('measureBodyBytes — rawBody 없고 body string → utf8 byte 수', () => {
    const { guard } = makeGuard({});
    const str = '안녕'; // 3 bytes per char in UTF-8
    const expected = Buffer.byteLength(str, 'utf8');
    expect(guard.measureBodyBytes(undefined, str)).toBe(expected);
  });

  it('measureBodyBytes — rawBody 없고 body object → JSON 직렬화 byte 수', () => {
    const { guard } = makeGuard({});
    const obj = { hello: 'world' };
    const expected = Buffer.byteLength(JSON.stringify(obj), 'utf8');
    expect(guard.measureBodyBytes(undefined, obj)).toBe(expected);
  });

  it('measureBodyBytes — 직렬화 불가(순환 참조) → maxBodyBytes+1 반환 (W6 보수적 차단)', () => {
    const { guard } = makeGuard({});
    const circular: Record<string, unknown> = {};
    circular.self = circular;
    // 직렬화 불가 → 보수적으로 maxBodyBytes + 1 반환
    const result = guard.measureBodyBytes(undefined, circular);
    expect(result).toBe(PublicWebhookThrottleGuard.DEFAULT_MAX_BODY_BYTES + 1);
  });

  // ── Info#13: extractClientIp 엣지 케이스 ─────────────────────────────────

  it('extractClientIp — XFF 다중 IP 중 첫 번째만 추출', () => {
    const ip = extractClientIp({
      'x-forwarded-for': '10.0.0.1, 10.0.0.2, 10.0.0.3',
    });
    expect(ip).toBe('10.0.0.1');
  });

  it('extractClientIp — cf-connecting-ip 빈 문자열 → XFF 폴백', () => {
    const ip = extractClientIp({
      'cf-connecting-ip': '   ',
      'x-forwarded-for': '8.8.8.8',
    });
    expect(ip).toBe('8.8.8.8');
  });

  it('extractClientIp — 헤더 모두 없음 → undefined', () => {
    expect(extractClientIp({})).toBeUndefined();
  });

  it('extractClientIp — XFF 값이 공백만 → undefined', () => {
    expect(extractClientIp({ 'x-forwarded-for': '   ' })).toBeUndefined();
  });

  // ── Info#14: maxBodyBytes config override ────────────────────────────────

  it('maxBodyBytes config override — 낮은 한도 적용 시 초과 → 413', async () => {
    const { guard } = makeGuard({
      trigger: { authConfigId: null } as Partial<Trigger>,
      maxBodyBytes: 10,
    });
    const req: ReqShape = {
      params: { endpointPath: 'abc123' },
      headers: { 'x-forwarded-for': '9.9.9.9' },
      rawBody: Buffer.alloc(11), // 11 bytes > 10
    };
    await expect(guard.canActivate(makeContext(req))).rejects.toBeInstanceOf(
      PayloadTooLargeException,
    );
  });

  it('maxBodyBytes config override — 낮은 한도 적용 시 미만 → 통과', async () => {
    const { guard, quota } = makeGuard({
      trigger: { authConfigId: null } as Partial<Trigger>,
      maxBodyBytes: 100,
    });
    const req: ReqShape = {
      params: { endpointPath: 'abc123' },
      headers: { 'x-forwarded-for': '9.9.9.9' },
      rawBody: Buffer.alloc(50), // 50 < 100
    };
    await expect(guard.canActivate(makeContext(req))).resolves.toBe(true);
    expect(quota.consumeStart).toHaveBeenCalled();
  });
});
