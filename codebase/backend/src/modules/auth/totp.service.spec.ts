import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ConflictException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { getRepositoryToken } from '@nestjs/typeorm';
import { createHash } from 'crypto';
import { generateSync } from 'otplib';
import {
  TotpService,
  isTotpSetupExpired,
  TOTP_SETUP_TTL_MS,
} from './totp.service';
import { UsersService } from '../users/users.service';
import { User } from '../users/entities/user.entity';

// RFC 6238 Appendix B 표준 TOTP 테스트 벡터 (SHA1, 20-byte ASCII
// "12345678901234567890" → base32). T=59s → 8자리 94287082 → 6자리 287082.
// v12·Google Authenticator·otplib v13 모두 RFC 6238 준수이므로 이 벡터가
// 일치하면 base32 secret 해석·코드 계산이 cross-version 동일함을 보장한다.
const RFC6238_SECRET_B32 = 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ';

describe('TotpService', () => {
  let service: TotpService;
  let usersService: {
    findById: jest.Mock;
    update: jest.Mock;
  };
  let userRepository: { update: jest.Mock };

  const makeUser = (over: Partial<User> = {}): User =>
    ({
      id: 'user-1',
      email: 'user@example.com',
      twoFactorEnabled: false,
      twoFactorSecret: null,
      twoFactorSetupStartedAt: null,
      totpRecoveryCodes: null,
      ...over,
    }) as unknown as User;

  // 설정 시작 뒤 1분. 대기 secret 이 아직 살아 있다.
  const freshStart = (): Date => new Date(Date.now() - 60_000);
  // 설정 시작 뒤 11분. 대기 secret 이 만료됐다.
  const staleStart = (): Date =>
    new Date(Date.now() - (TOTP_SETUP_TTL_MS + 60_000));

  beforeEach(async () => {
    usersService = {
      findById: jest.fn(),
      update: jest.fn().mockResolvedValue(undefined),
    };
    userRepository = {
      update: jest.fn().mockResolvedValue({ affected: 1 }),
    };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TotpService,
        { provide: UsersService, useValue: usersService },
        { provide: ConfigService, useValue: { get: jest.fn() } },
        { provide: getRepositoryToken(User), useValue: userRepository },
      ],
    }).compile();
    service = module.get(TotpService);
  });

  describe('setup', () => {
    it('base32 secret·otpauth URI·QR data URL 을 발급하고 secret 과 설정 시작 시각을 저장한다', async () => {
      usersService.findById.mockResolvedValue(makeUser());
      const before = Date.now();
      const res = await service.setup('user-1');
      const after = Date.now();

      expect(res.secret).toMatch(/^[A-Z2-7]+$/); // base32 alphabet
      // v13 generateSecret 기본 20바이트 → 32 base32 chars (>=16바이트 가드 통과)
      expect(res.secret.length).toBeGreaterThanOrEqual(32);
      expect(res.otpauthUrl).toContain('otpauth://totp/Clemvion:');
      expect(res.otpauthUrl).toContain('issuer=Clemvion');
      expect(res.qrCodeDataUrl).toMatch(/^data:image\/png;base64,/);
      // TOTP 가 꺼져 있을 때만 쓰는 조건부 갱신이다. secret 과 설정 시작 시각을 한 갱신으로 쓴다.
      expect(userRepository.update).toHaveBeenCalledTimes(1);
      const [where, values] = userRepository.update.mock.calls[0];
      expect(where).toEqual({ id: 'user-1', twoFactorEnabled: false });
      expect(Object.keys(values).sort()).toEqual([
        'twoFactorSecret',
        'twoFactorSetupStartedAt',
      ]);
      expect(values.twoFactorSecret).toBe(res.secret);
      expect(values.twoFactorSetupStartedAt).toBeInstanceOf(Date);
      const startedAt = (values.twoFactorSetupStartedAt as Date).getTime();
      expect(startedAt).toBeGreaterThanOrEqual(before);
      expect(startedAt).toBeLessThanOrEqual(after);
    });

    it('TOTP 가 켜진 계정이면 409 TOTP_ALREADY_ENABLED 이고 secret 을 쓰지 않는다', async () => {
      usersService.findById.mockResolvedValue(
        makeUser({ twoFactorEnabled: true, twoFactorSecret: 'OLD' }),
      );
      await expectAlreadyEnabled(service.setup('user-1'));
      expect(userRepository.update).not.toHaveBeenCalled();
      expect(usersService.update).not.toHaveBeenCalled();
    });

    it('읽은 뒤 다른 요청이 켜서 조건부 갱신이 0행이면 409 TOTP_ALREADY_ENABLED', async () => {
      usersService.findById.mockResolvedValue(makeUser());
      userRepository.update.mockResolvedValueOnce({ affected: 0 });
      await expectAlreadyEnabled(service.setup('user-1'));
    });

    it('사용자가 없으면 BadRequestException', async () => {
      usersService.findById.mockResolvedValue(null);
      await expect(service.setup('nope')).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });
  });

  describe('verifyAndEnable', () => {
    it('올바른 코드면 활성화하고 복구 코드 10개를 반환한다', async () => {
      const secret = (await bootstrapSecret(service, usersService)).secret;
      usersService.findById.mockResolvedValue(
        makeUser({
          twoFactorSecret: secret,
          twoFactorSetupStartedAt: freshStart(),
        }),
      );
      const code = generateSync({ secret });

      const { recoveryCodes } = await service.verifyAndEnable('user-1', code);

      expect(recoveryCodes).toHaveLength(10);
      const lastCall = userRepository.update.mock.calls.at(-1);
      // TOTP 가 꺼져 있고 코드를 확인한 secret 이 그대로일 때만 켠다.
      expect(lastCall[0]).toEqual({
        id: 'user-1',
        twoFactorEnabled: false,
        twoFactorSecret: secret,
      });
      expect(lastCall[1].twoFactorEnabled).toBe(true);
      // 켜면 설정 시작 시각을 비운다.
      expect(lastCall[1]).toHaveProperty('twoFactorSetupStartedAt', null);
      // 평문이 아니라 해시(64 hex)만 저장
      expect(lastCall[1].totpRecoveryCodes).toHaveLength(10);
      expect(lastCall[1].totpRecoveryCodes[0]).toMatch(/^[a-f0-9]{64}$/);
    });

    it('TOTP 가 켜진 계정이면 맞는 코드여도 409 TOTP_ALREADY_ENABLED 이고 복구 코드를 다시 발급하지 않는다', async () => {
      usersService.findById.mockResolvedValue(
        makeUser({
          twoFactorEnabled: true,
          twoFactorSecret: RFC6238_SECRET_B32,
          totpRecoveryCodes: ['h1'],
        }),
      );
      await expectAlreadyEnabled(
        service.verifyAndEnable(
          'user-1',
          generateSync({ secret: RFC6238_SECRET_B32 }),
        ),
      );
      expect(userRepository.update).not.toHaveBeenCalled();
      expect(usersService.update).not.toHaveBeenCalled();
    });

    it('TOTP 가 켜진 계정이면 틀린 코드에도 401 이 아니라 409 다(코드를 확인하지 않는다)', async () => {
      usersService.findById.mockResolvedValue(
        makeUser({
          twoFactorEnabled: true,
          twoFactorSecret: RFC6238_SECRET_B32,
        }),
      );
      await expectAlreadyEnabled(service.verifyAndEnable('user-1', '000000'));
    });

    it('코드 확인 뒤 다른 요청이 먼저 켜서 조건부 갱신이 0행이면 409 TOTP_ALREADY_ENABLED', async () => {
      const secret = RFC6238_SECRET_B32;
      usersService.findById
        .mockResolvedValueOnce(
          makeUser({
            twoFactorSecret: secret,
            twoFactorSetupStartedAt: freshStart(),
          }),
        )
        .mockResolvedValueOnce(
          makeUser({ twoFactorEnabled: true, twoFactorSecret: secret }),
        );
      userRepository.update.mockResolvedValueOnce({ affected: 0 });
      await expectAlreadyEnabled(
        service.verifyAndEnable('user-1', generateSync({ secret })),
      );
    });

    it('코드 확인 뒤 다른 setup 이 secret 을 바꿔 조건부 갱신이 0행이면 401 TOTP_INVALID', async () => {
      const secret = RFC6238_SECRET_B32;
      usersService.findById
        .mockResolvedValueOnce(
          makeUser({
            twoFactorSecret: secret,
            twoFactorSetupStartedAt: freshStart(),
          }),
        )
        .mockResolvedValueOnce(makeUser({ twoFactorSecret: 'OTHER' }));
      userRepository.update.mockResolvedValueOnce({ affected: 0 });
      const err = await service
        .verifyAndEnable('user-1', generateSync({ secret }))
        .then(
          () => {
            throw new Error('expected rejection');
          },
          (err_: unknown) => err_,
        );
      expect(err).toBeInstanceOf(UnauthorizedException);
      expect((err as UnauthorizedException).getResponse()).toMatchObject({
        code: 'TOTP_INVALID',
      });
    });

    it('틀린 코드면 UnauthorizedException', async () => {
      usersService.findById.mockResolvedValue(
        makeUser({
          twoFactorSecret: RFC6238_SECRET_B32,
          twoFactorSetupStartedAt: freshStart(),
        }),
      );
      await expect(
        service.verifyAndEnable('user-1', '000000'),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    // 근거: NERV CLE-ACCT-SIGNIN REQ-SIGNIN-084 (CLE-T-FRCRF7)
    it.each([
      ['설정 시작 뒤 10분이 지남', staleStart],
      ['설정 시작 시각이 없음(규칙 전에 시작한 대기 secret)', () => null],
    ])(
      '%s → 맞는 코드여도 대기 secret 과 시각을 비우고 400 TOTP_NOT_INITIALIZED',
      async (_name, startedAt) => {
        const secret = RFC6238_SECRET_B32;
        usersService.findById.mockResolvedValue(
          makeUser({
            twoFactorSecret: secret,
            twoFactorSetupStartedAt: startedAt(),
          }),
        );

        const err = await rejectionOf(
          service.verifyAndEnable('user-1', generateSync({ secret })),
        );

        expect(err).toBeInstanceOf(BadRequestException);
        expect((err as BadRequestException).getResponse()).toMatchObject({
          code: 'TOTP_NOT_INITIALIZED',
        });
        // 켜지 않고 비우기만 한다. 다른 설정 시작이 쓴 새 secret 을 지우지 않도록 읽은 secret 이 그대로일 때만 비운다.
        expect(userRepository.update).toHaveBeenCalledTimes(1);
        expect(userRepository.update).toHaveBeenCalledWith(
          { id: 'user-1', twoFactorEnabled: false, twoFactorSecret: secret },
          { twoFactorSecret: null, twoFactorSetupStartedAt: null },
        );
        expect(usersService.update).not.toHaveBeenCalled();
      },
    );

    it('만료를 비우는 갱신이 0행(그 사이 새 설정 시작)이어도 400 TOTP_NOT_INITIALIZED 이고 켜지 않는다', async () => {
      usersService.findById.mockResolvedValue(
        makeUser({
          twoFactorSecret: RFC6238_SECRET_B32,
          twoFactorSetupStartedAt: staleStart(),
        }),
      );
      userRepository.update.mockResolvedValueOnce({ affected: 0 });

      const err = await rejectionOf(
        service.verifyAndEnable(
          'user-1',
          generateSync({ secret: RFC6238_SECRET_B32 }),
        ),
      );

      expect((err as BadRequestException).getResponse()).toMatchObject({
        code: 'TOTP_NOT_INITIALIZED',
      });
      expect(userRepository.update).toHaveBeenCalledTimes(1);
    });

    it('TOTP 가 켜진 계정은 설정 시작 시각이 없어도 만료보다 409 TOTP_ALREADY_ENABLED 가 먼저다', async () => {
      usersService.findById.mockResolvedValue(
        makeUser({
          twoFactorEnabled: true,
          twoFactorSecret: RFC6238_SECRET_B32,
          twoFactorSetupStartedAt: null,
        }),
      );
      await expectAlreadyEnabled(service.verifyAndEnable('user-1', '000000'));
      expect(userRepository.update).not.toHaveBeenCalled();
    });

    it('secret 미발급이면 BadRequestException', async () => {
      usersService.findById.mockResolvedValue(makeUser());
      await expect(
        service.verifyAndEnable('user-1', '123456'),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('사용자가 없으면(findById null) BadRequestException', async () => {
      usersService.findById.mockResolvedValue(null);
      await expect(
        service.verifyAndEnable('ghost', '123456'),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('disableUnchecked', () => {
    it('2FA secret·복구 코드·활성 플래그를 모두 초기화한다', async () => {
      await service.disableUnchecked('user-1');
      expect(usersService.update).toHaveBeenCalledWith('user-1', {
        twoFactorEnabled: false,
        twoFactorSecret: null,
        twoFactorSetupStartedAt: null,
        totpRecoveryCodes: null,
      });
    });
  });

  describe('verifyForLogin', () => {
    it('유효한 TOTP 코드면 true', async () => {
      const user = makeUser({
        twoFactorEnabled: true,
        twoFactorSecret: RFC6238_SECRET_B32,
      });
      const code = generateSync({ secret: RFC6238_SECRET_B32 });
      expect(await service.verifyForLogin(user, code)).toBe(true);
    });

    it('복구 코드면 true 이고 해당 코드를 소비한다', async () => {
      const recovery = 'abcd-efgh-ijkl';
      const hash = createHash('sha256').update(recovery).digest('hex');
      const user = makeUser({
        twoFactorEnabled: true,
        twoFactorSecret: RFC6238_SECRET_B32,
        totpRecoveryCodes: [hash, 'other'],
      });
      expect(await service.verifyForLogin(user, recovery)).toBe(true);
      expect(usersService.update).toHaveBeenCalledWith('user-1', {
        totpRecoveryCodes: ['other'],
      });
    });

    it('2FA 비활성 사용자면 false', async () => {
      const user = makeUser({ twoFactorEnabled: false });
      expect(await service.verifyForLogin(user, '123456')).toBe(false);
    });
  });

  /**
   * 2FA 해제 전 코드 확인 — 로그인 2단계와 같은 코드(6자리 TOTP 또는 TOTP 복구 코드)를 받는다
   * (NERV CLE-ACCT-SIGNIN, CLE-T-75TDTN).
   */
  describe('verifyForDisable', () => {
    const TOTP_INVALID = {
      code: 'TOTP_INVALID',
      message: '인증 코드가 올바르지 않습니다.',
    };

    it('유효한 TOTP 코드면 통과한다', async () => {
      usersService.findById.mockResolvedValue(
        makeUser({
          twoFactorEnabled: true,
          twoFactorSecret: RFC6238_SECRET_B32,
        }),
      );
      const code = generateSync({ secret: RFC6238_SECRET_B32 });

      await expect(
        service.verifyForDisable('user-1', code),
      ).resolves.toBeUndefined();
    });

    it('복구 코드면 통과하고 그 코드를 소비한다', async () => {
      const recovery = 'abcd-efgh-ijkl';
      const hash = createHash('sha256').update(recovery).digest('hex');
      usersService.findById.mockResolvedValue(
        makeUser({
          twoFactorEnabled: true,
          twoFactorSecret: RFC6238_SECRET_B32,
          totpRecoveryCodes: [hash, 'other'],
        }),
      );

      await expect(
        service.verifyForDisable('user-1', recovery),
      ).resolves.toBeUndefined();
      expect(usersService.update).toHaveBeenCalledWith('user-1', {
        totpRecoveryCodes: ['other'],
      });
    });

    it.each([
      ['틀린 6자리 코드', { twoFactorEnabled: true }, '000000'],
      ['모르는 복구 코드', { twoFactorEnabled: true }, 'zzzz-zzzz-zzzz'],
      ['2FA 가 꺼진 사용자', { twoFactorEnabled: false }, 'VALID'],
    ] as Array<[string, Partial<User>, string]>)(
      '%s 면 401 TOTP_INVALID',
      async (_label, over, code) => {
        usersService.findById.mockResolvedValue(
          makeUser({ twoFactorSecret: RFC6238_SECRET_B32, ...over }),
        );
        const input =
          code === 'VALID'
            ? generateSync({ secret: RFC6238_SECRET_B32 })
            : code;

        const err = await service.verifyForDisable('user-1', input).then(
          () => {
            throw new Error('expected rejection');
          },
          (err_: unknown) => err_,
        );
        expect(err).toBeInstanceOf(UnauthorizedException);
        expect((err as UnauthorizedException).getResponse()).toEqual(
          TOTP_INVALID,
        );
      },
    );

    it('사용자가 없으면 401 TOTP_INVALID', async () => {
      usersService.findById.mockResolvedValue(null);

      await expect(
        service.verifyForDisable('user-1', '123456'),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });
  });

  // m-9 게이트: otplib v12 → v13 메이저 업그레이드의 기존 secret 호환성.
  describe('cross-version 호환성 (otplib v12→v13)', () => {
    it('RFC 6238 표준 벡터를 v13 이 동일하게 계산한다 (= v12·Google Authenticator)', () => {
      // epoch 59s, period 30s, 6자리 → RFC Appendix B 의 287082
      expect(generateSync({ secret: RFC6238_SECRET_B32, epoch: 59 })).toBe(
        '287082',
      );
    });

    it('v12 형식 base32 secret 으로 발급된 코드를 v13 검증이 그대로 수락한다', async () => {
      // 기존 사용자가 v12 시절 저장한 secret 을 그대로 둔 채 로그인하는 상황
      const legacyUser = makeUser({
        twoFactorEnabled: true,
        twoFactorSecret: RFC6238_SECRET_B32,
      });
      const codeNow = generateSync({ secret: RFC6238_SECRET_B32 });
      expect(await service.verifyForLogin(legacyUser, codeNow)).toBe(true);
    });

    it('손상·과소 secret 은 검증 throw 없이 false (로그인 500 방지)', async () => {
      const brokenUser = makeUser({
        twoFactorEnabled: true,
        twoFactorSecret: 'AA', // 16바이트 미만 → v13 SecretTooShortError
      });
      await expect(service.verifyForLogin(brokenUser, '123456')).resolves.toBe(
        false,
      );
    });
  });
});

/** setup 을 통해 실제 secret 을 발급해 반환하는 헬퍼. */
async function bootstrapSecret(
  service: TotpService,
  usersService: { findById: jest.Mock; update: jest.Mock },
): Promise<{ secret: string }> {
  usersService.findById.mockResolvedValueOnce({
    id: 'user-1',
    email: 'user@example.com',
  } as unknown as User);
  const { secret } = await service.setup('user-1');
  return { secret };
}

async function expectAlreadyEnabled(promise: Promise<unknown>): Promise<void> {
  const err = await promise.then(
    () => {
      throw new Error('거부되지 않았다');
    },
    (err_: unknown) => err_,
  );
  expect(err).toBeInstanceOf(ConflictException);
  expect((err as ConflictException).getResponse()).toMatchObject({
    code: 'TOTP_ALREADY_ENABLED',
  });
}

async function rejectionOf(promise: Promise<unknown>): Promise<unknown> {
  return promise.then(
    () => {
      throw new Error('거부되지 않았다');
    },
    (err_: unknown) => err_,
  );
}

// 근거: NERV CLE-ACCT-SIGNIN REQ-SIGNIN-084 (CLE-T-FRCRF7)
describe('isTotpSetupExpired', () => {
  const now = new Date('2026-11-05T12:00:00.000Z');
  const minutesAgo = (m: number) => new Date(now.getTime() - m * 60_000);

  it.each([
    { name: '시각이 없다', startedAt: null, expired: true },
    {
      name: '10분 1ms 전에 시작했다',
      startedAt: new Date(now.getTime() - (TOTP_SETUP_TTL_MS + 1)),
      expired: true,
    },
    { name: '11분 전에 시작했다', startedAt: minutesAgo(11), expired: true },
    {
      name: '정확히 10분 전에 시작했다',
      startedAt: new Date(now.getTime() - TOTP_SETUP_TTL_MS),
      expired: false,
    },
    { name: '1분 전에 시작했다', startedAt: minutesAgo(1), expired: false },
    { name: '방금 시작했다', startedAt: now, expired: false },
    {
      name: '시작 시각이 미래다',
      startedAt: new Date(now.getTime() + 60_000),
      expired: false,
    },
  ])('$name → 만료 $expired', ({ startedAt, expired }) => {
    expect(isTotpSetupExpired(startedAt, now)).toBe(expired);
  });
});
