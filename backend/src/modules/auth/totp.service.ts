import {
  BadRequestException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { authenticator } from 'otplib';
import * as QRCode from 'qrcode';
import { createHash, randomBytes } from 'crypto';
import { UsersService } from '../users/users.service';
import { User } from '../users/entities/user.entity';

const ISSUER = 'Idea Workflow';
const RECOVERY_CODE_COUNT = 10;

function generateRecoveryCode(): string {
  // xxxx-xxxx-xxxx (소문자 영숫자 12자리)
  const raw = randomBytes(9).toString('base64url').slice(0, 12).toLowerCase();
  return `${raw.slice(0, 4)}-${raw.slice(4, 8)}-${raw.slice(8, 12)}`;
}

function hashRecoveryCode(code: string): string {
  return createHash('sha256').update(code).digest('hex');
}

@Injectable()
export class TotpService {
  private readonly logger = new Logger(TotpService.name);

  constructor(
    private readonly usersService: UsersService,
    private readonly configService: ConfigService,
  ) {
    // 6자리 코드, 30초 step (기본값) — 표준 Google Authenticator 호환
    authenticator.options = { window: 1 };
  }

  /**
   * 사용자에게 임시 secret을 발급하고 QR 코드(data URL)를 반환한다.
   * 검증(verify) 전까지는 `twoFactorSecret`만 저장되고 `twoFactorEnabled`는 false 유지.
   */
  async setup(
    userId: string,
  ): Promise<{ secret: string; otpauthUrl: string; qrCodeDataUrl: string }> {
    const user = await this.usersService.findById(userId);
    if (!user) {
      throw new BadRequestException({
        code: 'USER_NOT_FOUND',
        message: '사용자를 찾을 수 없습니다.',
      });
    }
    const secret = authenticator.generateSecret();
    const otpauthUrl = authenticator.keyuri(user.email, ISSUER, secret);
    const qrCodeDataUrl = await QRCode.toDataURL(otpauthUrl);
    await this.usersService.update(userId, { twoFactorSecret: secret });
    return { secret, otpauthUrl, qrCodeDataUrl };
  }

  /**
   * setup으로 발급한 secret으로 6자리 코드를 검증해 활성화한다.
   * 활성화 시 복구 코드 10개를 발급해 평문(일회성)으로 반환하고, 해시만 저장한다.
   */
  async verifyAndEnable(
    userId: string,
    code: string,
  ): Promise<{ recoveryCodes: string[] }> {
    const user = await this.usersService.findById(userId);
    if (!user || !user.twoFactorSecret) {
      throw new BadRequestException({
        code: 'TOTP_NOT_INITIALIZED',
        message: '2FA 설정을 먼저 시작해주세요.',
      });
    }
    const isValid = authenticator.check(code, user.twoFactorSecret);
    if (!isValid) {
      throw new UnauthorizedException({
        code: 'TOTP_INVALID',
        message: '인증 코드가 올바르지 않습니다.',
      });
    }
    const codes = Array.from({ length: RECOVERY_CODE_COUNT }, () =>
      generateRecoveryCode(),
    );
    await this.usersService.update(userId, {
      twoFactorEnabled: true,
      totpRecoveryCodes: codes.map(hashRecoveryCode),
    });
    return { recoveryCodes: codes };
  }

  /** 2FA 비활성. 호출 전에 비밀번호 재확인은 컨트롤러에서 수행. */
  async disable(userId: string): Promise<void> {
    await this.usersService.update(userId, {
      twoFactorEnabled: false,
      twoFactorSecret: null as unknown as string,
      totpRecoveryCodes: null,
    });
  }

  /**
   * 로그인 2단계: 코드를 검증한다. TOTP 또는 복구 코드 중 하나라도 일치하면 true.
   * 복구 코드를 사용한 경우 해당 항목은 제거된다(일회성).
   */
  async verifyForLogin(user: User, code: string): Promise<boolean> {
    if (!user.twoFactorEnabled || !user.twoFactorSecret) return false;
    const trimmed = code.trim();
    // 1) TOTP
    if (/^\d{6}$/.test(trimmed)) {
      if (authenticator.check(trimmed, user.twoFactorSecret)) return true;
    }
    // 2) 복구 코드
    const hash = hashRecoveryCode(trimmed);
    const codes = user.totpRecoveryCodes ?? [];
    const idx = codes.indexOf(hash);
    if (idx >= 0) {
      const remaining = codes.filter((_, i) => i !== idx);
      await this.usersService.update(user.id, {
        totpRecoveryCodes: remaining,
      });
      this.logger.log(
        `User ${user.id} used a recovery code. ${remaining.length} remaining.`,
      );
      return true;
    }
    return false;
  }
}
