import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'crypto';
import { generateSync } from 'otplib';
import { TotpService } from './totp.service';
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

  const makeUser = (over: Partial<User> = {}): User =>
    ({
      id: 'user-1',
      email: 'user@example.com',
      twoFactorEnabled: false,
      twoFactorSecret: null,
      totpRecoveryCodes: null,
      ...over,
    }) as unknown as User;

  beforeEach(async () => {
    usersService = {
      findById: jest.fn(),
      update: jest.fn().mockResolvedValue(undefined),
    };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TotpService,
        { provide: UsersService, useValue: usersService },
        { provide: ConfigService, useValue: { get: jest.fn() } },
      ],
    }).compile();
    service = module.get(TotpService);
  });

  describe('setup', () => {
    it('base32 secret·otpauth URI·QR data URL 을 발급하고 secret 을 저장한다', async () => {
      usersService.findById.mockResolvedValue(makeUser());
      const res = await service.setup('user-1');

      expect(res.secret).toMatch(/^[A-Z2-7]+$/); // base32 alphabet
      // v13 generateSecret 기본 20바이트 → 32 base32 chars (>=16바이트 가드 통과)
      expect(res.secret.length).toBeGreaterThanOrEqual(32);
      expect(res.otpauthUrl).toContain('otpauth://totp/Clemvion:');
      expect(res.otpauthUrl).toContain('issuer=Clemvion');
      expect(res.qrCodeDataUrl).toMatch(/^data:image\/png;base64,/);
      expect(usersService.update).toHaveBeenCalledWith('user-1', {
        twoFactorSecret: res.secret,
      });
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
        makeUser({ twoFactorSecret: secret }),
      );
      const code = generateSync({ secret });

      const { recoveryCodes } = await service.verifyAndEnable('user-1', code);

      expect(recoveryCodes).toHaveLength(10);
      const lastCall = usersService.update.mock.calls.at(-1);
      expect(lastCall[1].twoFactorEnabled).toBe(true);
      // 평문이 아니라 해시(64 hex)만 저장
      expect(lastCall[1].totpRecoveryCodes).toHaveLength(10);
      expect(lastCall[1].totpRecoveryCodes[0]).toMatch(/^[a-f0-9]{64}$/);
    });

    it('틀린 코드면 UnauthorizedException', async () => {
      usersService.findById.mockResolvedValue(
        makeUser({ twoFactorSecret: RFC6238_SECRET_B32 }),
      );
      await expect(
        service.verifyAndEnable('user-1', '000000'),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('secret 미발급이면 BadRequestException', async () => {
      usersService.findById.mockResolvedValue(makeUser());
      await expect(
        service.verifyAndEnable('user-1', '123456'),
      ).rejects.toBeInstanceOf(BadRequestException);
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
