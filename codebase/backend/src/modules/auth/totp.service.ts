import {
  BadRequestException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { generateSecret, generateURI, verifySync } from 'otplib';
import * as QRCode from 'qrcode';
import { createHash, randomBytes } from 'crypto';
import { UsersService } from '../users/users.service';
import { User } from '../users/entities/user.entity';

const ISSUER = 'Clemvion';
const RECOVERY_CODE_COUNT = 10;
// v12 `authenticator.options = { window: 1 }` 와 동등한 허용 오차. otplib v13 은
// tolerance 를 초 단위로 받으며(`epochTolerance`), period 30s 기준 30 = ±1 time step.
// 표준 Google Authenticator 호환(6자리 / 30초 step) 은 v13 기본값.
const EPOCH_TOLERANCE_SECONDS = 30;

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
  ) {}

  /**
   * base32 secret 으로 6자리 TOTP 코드를 검증한다 (otplib v13, sync 경로).
   * - `epochTolerance`: ±1 time step (v12 `window:1` 등가).
   * - 손상·과거 형식 secret 으로 verify 자체가 throw 하면(예: 16바이트 미만
   *   `SecretTooShortError`) 500 대신 "검증 실패(false)" 로 처리한다.
   */
  private verifyCode(token: string, secret: string): boolean {
    try {
      return verifySync({
        secret,
        token,
        epochTolerance: EPOCH_TOLERANCE_SECONDS,
      }).valid;
    } catch (err) {
      // 에러 타입명만 로깅 — otplib 내부 에러 메시지가 로그 집계로 유입되지
      // 않도록 한다 (OWASP A09). 타입명(예: SecretTooShortError)으로 충분히 진단 가능.
      this.logger.warn(
        `TOTP verify threw (${(err as Error).name}), treating as invalid`,
      );
      return false;
    }
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
    const secret = generateSecret();
    const otpauthUrl = generateURI({
      issuer: ISSUER,
      label: user.email,
      secret,
    });
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
    const isValid = this.verifyCode(code, user.twoFactorSecret);
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
      if (this.verifyCode(trimmed, user.twoFactorSecret)) return true;
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
