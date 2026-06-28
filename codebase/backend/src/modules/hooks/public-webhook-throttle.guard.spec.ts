import {
  ExecutionContext,
  HttpException,
  HttpStatus,
  Logger,
  PayloadTooLargeException,
} from '@nestjs/common';
import { Repository } from 'typeorm';
import { Trigger } from '../triggers/entities/trigger.entity';
import {
  PublicWebhookQuotaService,
  UNIDENTIFIED_IP_BUCKET,
} from './public-webhook-quota.service';
import {
  PublicWebhookReqShape,
  PublicWebhookThrottleGuard,
} from './public-webhook-throttle.guard';

// Guard 가 `getRequest` 로 읽는 형태를 그대로 재사용 — 필드 동기화 중복 제거(A-3).
type ReqShape = PublicWebhookReqShape;

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
  // env·spy 복원을 afterEach 로 통일(B-5/B-7) — 개별 테스트의 try/finally·mockRestore 중복 제거.
  // env 는 테스트별 스냅샷 후 복원해 `TRUST_CF_CONNECTING_IP` 등 변이가 누설되지 않게 한다.
  let envSnapshot: NodeJS.ProcessEnv;
  beforeEach(() => {
    envSnapshot = { ...process.env };
  });
  afterEach(() => {
    process.env = envSnapshot;
    jest.restoreAllMocks();
  });

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

  it('trigger 조회는 partial `select` 없이 full entity 로 한다 (보안 회귀 가드)', async () => {
    // 과거 `select: { authConfigId: true }` partial projection 이 authConfigId 를 비-null 로
    // 잘못 반환해 모든 공개 webhook 이 인증으로 오판 → 보호 우회. select 재도입을 차단한다.
    const { guard, triggerRepository } = makeGuard({
      trigger: { authConfigId: null } as Partial<Trigger>,
    });
    await guard.canActivate(makeContext(PUBLIC_REQ));
    expect(triggerRepository.findOne).toHaveBeenCalledWith(
      expect.not.objectContaining({ select: expect.anything() }),
    );
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
    } catch (err_) {
      const err = err_ as HttpException;
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

  it('공개 webhook + IP 식별 불가 → 단일 공유 버킷(UNIDENTIFIED_IP_BUCKET)으로 consumeStart (D-12 완화 한도)', async () => {
    // 과거엔 fail-open(`if (!ip) return true`)이라 헤더만 제거하면 rate-limit 이 무제한 우회됐다.
    // 이제 미식별 요청 전체를 단일 공유 버킷으로 묶어 한도를 적용한다 — 무제한 우회 → 유한 상한.
    const { guard, quota } = makeGuard({
      trigger: { authConfigId: null } as Partial<Trigger>,
    });
    const noIp: ReqShape = {
      params: { endpointPath: 'abc123' },
      headers: {},
      body: {},
    };
    await expect(guard.canActivate(makeContext(noIp))).resolves.toBe(true);
    expect(quota.consumeStart).toHaveBeenCalledWith(UNIDENTIFIED_IP_BUCKET);
    // W14: 미식별 경로에서도 Guard 가 조회한 trigger 를 req 에 첨부(HooksService 재사용).
    expect(noIp.__publicWebhookTrigger).toEqual({ authConfigId: null });
  });

  it('공개 webhook + IP 식별 불가 + 공유 버킷 분당 한도 초과 → 429 (우회 차단)', async () => {
    const { guard } = makeGuard({
      trigger: { authConfigId: null } as Partial<Trigger>,
      consume: { allowed: false, reason: 'startup_rate' },
    });
    const noIp: ReqShape = {
      params: { endpointPath: 'abc123' },
      headers: {},
      body: {},
    };
    await expect(guard.canActivate(makeContext(noIp))).rejects.toMatchObject({
      status: HttpStatus.TOO_MANY_REQUESTS,
    });
  });

  it('공개 webhook + IP 식별 불가 + 공유 버킷 시간당 상한 초과 → 429 + HOURLY 코드 (D-12)', async () => {
    const { guard } = makeGuard({
      trigger: { authConfigId: null } as Partial<Trigger>,
      consume: { allowed: false, reason: 'hourly_new' },
    });
    const noIp: ReqShape = {
      params: { endpointPath: 'abc123' },
      headers: {},
      body: {},
    };
    expect.assertions(2);
    try {
      await guard.canActivate(makeContext(noIp));
    } catch (err_) {
      const err = err_ as HttpException;
      expect(err.getStatus()).toBe(HttpStatus.TOO_MANY_REQUESTS);
      const r = err.getResponse() as { error?: { code?: string } };
      expect(r.error?.code).toBe('PUBLIC_WEBHOOK_HOURLY_LIMIT');
    }
  });

  it('cf-connecting-ip 우선 추출 (TRUST_CF_CONNECTING_IP=true)', async () => {
    // 04 m-3 — CF 신뢰는 기본 off 라 CF 우선을 검증하려면 명시 활성화. 복원은 afterEach.
    process.env.TRUST_CF_CONNECTING_IP = 'true';
    const { guard, quota } = makeGuard({
      trigger: { authConfigId: null } as Partial<Trigger>,
    });
    const req: ReqShape = {
      params: { endpointPath: 'abc123' },
      headers: {
        'cf-connecting-ip': '1.1.1.1',
        'x-forwarded-for': '2.2.2.2',
      },
      body: {},
    };
    await guard.canActivate(makeContext(req));
    expect(quota.consumeStart).toHaveBeenCalledWith('1.1.1.1');
  });

  // 04 m-3 — 기본(플래그 off)에서는 위변조 가능한 CF 헤더 무시 → XFF 로 rate-limit.
  it('기본(TRUST_CF_CONNECTING_IP off)에서는 cf-connecting-ip 를 무시하고 XFF 사용', async () => {
    delete process.env.TRUST_CF_CONNECTING_IP; // 복원은 afterEach.
    const { guard, quota } = makeGuard({
      trigger: { authConfigId: null } as Partial<Trigger>,
    });
    const req: ReqShape = {
      params: { endpointPath: 'abc123' },
      headers: {
        'cf-connecting-ip': '1.1.1.1',
        'x-forwarded-for': '2.2.2.2',
      },
      body: {},
    };
    await guard.canActivate(makeContext(req));
    expect(quota.consumeStart).toHaveBeenCalledWith('2.2.2.2');
  });

  it('trigger 조회 실패 → fail-open(통과) + error 레벨 로깅(모니터링 가시성, W2)', async () => {
    const errorLog = jest.spyOn(Logger.prototype, 'error').mockImplementation();
    const { guard, quota } = makeGuard({ findThrows: true });
    await expect(guard.canActivate(makeContext(PUBLIC_REQ))).resolves.toBe(
      true,
    );
    expect(quota.consumeStart).not.toHaveBeenCalled();
    // fail-open 은 공개 webhook 보호를 무력화하므로 error 레벨로 남겨 알람이 탐지하게 한다.
    expect(errorLog).toHaveBeenCalledTimes(1);
    // spy 복원은 afterEach(jest.restoreAllMocks) 가 담당.
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

  // (extractClientIp 헤더 추출 엣지 케이스는 `auth/utils/client-ip.spec.ts` 의
  //  `extractClientIpFromHeaders` 로 이관 — Guard 는 공유 코어를 직접 호출한다.)

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
