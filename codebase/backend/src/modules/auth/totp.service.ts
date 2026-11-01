import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
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

/**
 * TOTP 가 켜진 계정의 설정 재실행 거부. 켜진 뒤 secret · 복구 코드를 바꾸는 길은 끄기(비밀번호 + 인증 코드) 뒤 다시 켜는
 * 흐름뿐이다(NERV CLE-ACCT-SIGNIN, CLE-T-94FTMV).
 */
function totpAlreadyEnabled(): ConflictException {
  return new ConflictException({
    code: 'TOTP_ALREADY_ENABLED',
    message: '2단계 인증이 이미 켜져 있습니다. 다시 설정하려면 먼저 끄세요.',
  });
}

function totpInvalid(): UnauthorizedException {
  return new UnauthorizedException({
    code: 'TOTP_INVALID',
    message: '인증 코드가 올바르지 않습니다.',
  });
}

/**
 * 사용자의 2FA 컬럼(`twoFactorEnabled` · `twoFactorSecret` · `totpRecoveryCodes`)을 쓰는 경로가 둘이다.
 * - `userRepository.update` 로 직접 쓰는 곳은 `setup` · `verifyAndEnable` 둘뿐이다. 두 곳은 "TOTP 가 꺼져 있다"(`verifyAndEnable`
 *   은 "확인한 secret 이 그대로다"도)를 WHERE 조건으로 거는 조건부 갱신이 필요하다. `UsersService.update` 는 id 만으로 조건
 *   없이 쓰므로 읽은 뒤 다른 요청이 TOTP 를 켜면 켜진 계정의 secret · 복구 코드를 덮어쓸 수 있다.
 * - 나머지(`disableUnchecked` · `verifyForLogin` 의 복구 코드 소비)는 조건이 필요 없어 소유 모듈의 `usersService.update` 를 거친다.
 *
 * 조건부 갱신을 `UsersService` 의 메서드로 옮기면 `AuthModule` 의 `User` forFeature 등록도 뺄 수 있다. 다만 users 모듈을 바꾸는
 * 일이라 CLE-T-94FTMV 범위 밖이다. 2FA 컬럼이나 `UsersService.update` 의 부수 동작을 바꿀 때는 위 두 곳을 함께 본다.
 */
@Injectable()
export class TotpService {
  private readonly logger = new Logger(TotpService.name);

  constructor(
    private readonly usersService: UsersService,
    private readonly configService: ConfigService,
    // 켜짐 여부를 조건으로 거는 갱신(setup · verifyAndEnable)에만 쓴다. `UsersService.update` 는 조건 없이 쓰므로
    // 읽은 뒤 다른 요청이 TOTP 를 켜면 켜진 계정의 secret · 복구 코드를 덮어쓸 수 있다.
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
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
   * TOTP 가 이미 켜져 있으면 secret 을 쓰지 않고 409 `TOTP_ALREADY_ENABLED` 로 거부한다. 저장은 TOTP 가 꺼져 있을 때만
   * 쓰는 조건부 갱신이라 읽은 뒤 다른 요청이 켠 경우도 같은 409 다.
   * 비밀번호는 확인하지 않는다. `AuthService.startTwoFactorSetup` 이 먼저 확인하고 부른다. `AuthModule` 이 `TotpService` 를
   * export 하지 않아 다른 모듈은 주입받지 못한다.
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
    if (user.twoFactorEnabled) throw totpAlreadyEnabled();
    const secret = generateSecret();
    const otpauthUrl = generateURI({
      issuer: ISSUER,
      label: user.email,
      secret,
    });
    const qrCodeDataUrl = await QRCode.toDataURL(otpauthUrl);
    const { affected } = await this.userRepository.update(
      { id: userId, twoFactorEnabled: false },
      { twoFactorSecret: secret },
    );
    if (!affected) throw totpAlreadyEnabled();
    return { secret, otpauthUrl, qrCodeDataUrl };
  }

  /**
   * setup으로 발급한 secret으로 6자리 코드를 검증해 활성화한다.
   * 활성화 시 복구 코드 10개를 발급해 평문(일회성)으로 반환하고, 해시만 저장한다.
   * TOTP 가 이미 켜져 있으면 코드를 확인하지 않고 409 `TOTP_ALREADY_ENABLED` 로 거부한다(복구 코드를 다시 발급하지 않는다).
   * 저장은 TOTP 가 꺼져 있고 코드를 확인한 secret 이 그대로일 때만 쓰는 조건부 갱신이다. 그 사이 다른 요청이 켰으면 409,
   * 다른 setup 이 secret 을 바꿨으면 확인한 코드가 지금 secret 과 맞지 않으므로 401 `TOTP_INVALID` 다.
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
    if (user.twoFactorEnabled) throw totpAlreadyEnabled();
    const isValid = this.verifyCode(code, user.twoFactorSecret);
    if (!isValid) throw totpInvalid();
    const codes = Array.from({ length: RECOVERY_CODE_COUNT }, () =>
      generateRecoveryCode(),
    );
    const { affected } = await this.userRepository.update(
      {
        id: userId,
        twoFactorEnabled: false,
        twoFactorSecret: user.twoFactorSecret,
      },
      {
        twoFactorEnabled: true,
        totpRecoveryCodes: codes.map(hashRecoveryCode),
      },
    );
    if (!affected) {
      const current = await this.usersService.findById(userId);
      throw current?.twoFactorEnabled ? totpAlreadyEnabled() : totpInvalid();
    }
    return { recoveryCodes: codes };
  }

  /**
   * 2FA 해제 전 코드 확인. 로그인 2단계와 같은 코드(6자리 TOTP 또는 TOTP 복구 코드)를 받고,
   * 복구 코드는 로그인과 같이 소비한다. 틀리면 401 TOTP_INVALID
   * (NERV CLE-ACCT-SIGNIN, CLE-T-75TDTN).
   */
  async verifyForDisable(userId: string, code: string): Promise<void> {
    const user = await this.usersService.findById(userId);
    if (!user || !(await this.verifyForLogin(user, code))) {
      throw totpInvalid();
    }
  }

  /**
   * 2FA 비활성. 이 메서드는 아무것도 확인하지 않는다 — 비밀번호 → 코드 재확인은 `AuthService.disableTwoFactor` 가 순서를
   * 지키며 부른다. 다른 경로에서 이 메서드만 부르면 재인증이 빠진다. 그래서 이름에 `Unchecked` 를 두고, `AuthModule` 이
   * `TotpService` 를 export 하지 않아 다른 모듈은 주입받지 못한다.
   */
  async disableUnchecked(userId: string): Promise<void> {
    await this.usersService.update(userId, {
      twoFactorEnabled: false,
      twoFactorSecret: null,
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
