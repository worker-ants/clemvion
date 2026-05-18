import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { createHash, randomBytes } from 'crypto';
import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} from '@simplewebauthn/server';
import type {
  RegistrationResponseJSON,
  AuthenticationResponseJSON,
  PublicKeyCredentialCreationOptionsJSON,
  PublicKeyCredentialRequestOptionsJSON,
  AuthenticatorTransportFuture,
} from '@simplewebauthn/server';
import { UsersService } from '../users/users.service';
import { WebAuthnCredential } from './entities/webauthn-credential.entity';
import { LoginHistoryService } from './login-history.service';
import type { WebAuthnConfig } from '../../common/config/webauthn.config';

const RECOVERY_CODE_COUNT = 10;
const OPTIONS_TOKEN_TTL_SEC = 300; // 5분 (spec/5-system/1-auth.md §1.4.3·§1.4.C)

type OptionsTokenKind = 'webauthn_register' | 'webauthn_auth';

interface OptionsTokenPayload {
  kind: OptionsTokenKind;
  sub: string;
  challenge: string; // base64url
  exp: number;
}

export interface WebAuthnLoginContext {
  ip?: string | null;
  userAgent?: string | null;
}

function generateRecoveryCode(): string {
  // 동일 포맷: xxxx-xxxx-xxxx (TOTP 의 totp.service.ts 와 일치)
  const raw = randomBytes(9).toString('base64url').slice(0, 12).toLowerCase();
  return `${raw.slice(0, 4)}-${raw.slice(4, 8)}-${raw.slice(8, 12)}`;
}

function hashRecoveryCode(code: string): string {
  return createHash('sha256').update(code).digest('hex');
}

/**
 * WebAuthn (Passkey · 보안 키) 2FA 서비스.
 *
 * spec/5-system/1-auth.md §1.4 — TOTP 와 두 방식 공존, WebAuthn 우선·자동 fallback 금지.
 * Rationale 1.4.A~E.
 */
@Injectable()
export class WebAuthnService {
  private readonly logger = new Logger(WebAuthnService.name);

  constructor(
    @InjectRepository(WebAuthnCredential)
    private readonly credentialRepo: Repository<WebAuthnCredential>,
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly loginHistory: LoginHistoryService,
  ) {}

  private getConfig(): WebAuthnConfig {
    const cfg = this.configService.get<WebAuthnConfig>('webauthn');
    if (!cfg) {
      throw new Error('webauthn config not registered');
    }
    return cfg;
  }

  /** 사용자 본인의 credential 목록 (base64url challenge 형태로 노출 금지 — 공개 필드만). */
  async listCredentials(userId: string): Promise<WebAuthnCredential[]> {
    return this.credentialRepo.find({
      where: { userId },
      order: { createdAt: 'ASC' },
    });
  }

  /** 등록된 credential 개수 — login() 분기 결정용. */
  async countCredentials(userId: string): Promise<number> {
    return this.credentialRepo.count({ where: { userId } });
  }

  // ========== REGISTRATION ==========

  async generateRegistrationOptionsFor(userId: string): Promise<{
    publicKey: PublicKeyCredentialCreationOptionsJSON;
    optionsToken: string;
  }> {
    const user = await this.usersService.findById(userId);
    if (!user) {
      throw new NotFoundException({
        code: 'USER_NOT_FOUND',
        message: '사용자를 찾을 수 없습니다.',
      });
    }
    const { rpID, rpName } = this.getConfig();

    const existing = await this.listCredentials(userId);
    const options = await generateRegistrationOptions({
      rpName,
      rpID,
      userID: Buffer.from(userId),
      userName: user.email,
      userDisplayName: user.name,
      attestationType: 'none',
      // 동일 인증기 중복 등록 차단 (다중 등록 허용은 다른 인증기에 한해서)
      excludeCredentials: existing.map((c) => ({
        id: c.credentialId,
        transports: c.transports as AuthenticatorTransportFuture[],
      })),
      authenticatorSelection: {
        residentKey: 'preferred',
        userVerification: 'preferred',
      },
    });

    const optionsToken = this.signOptionsToken('webauthn_register', userId, options.challenge);
    return { publicKey: options, optionsToken };
  }

  async verifyRegistration(
    userId: string,
    optionsToken: string,
    response: RegistrationResponseJSON,
    deviceName?: string,
  ): Promise<{
    verified: boolean;
    credentialUuid: string;
    webauthnRecoveryCodes: string[];
  }> {
    const payload = this.verifyOptionsToken(optionsToken, 'webauthn_register', userId);
    const { rpID, origins } = this.getConfig();

    let verification: Awaited<ReturnType<typeof verifyRegistrationResponse>>;
    try {
      verification = await verifyRegistrationResponse({
        response,
        expectedChallenge: payload.challenge,
        expectedOrigin: origins,
        expectedRPID: rpID,
        requireUserVerification: false,
      });
    } catch (err) {
      this.logger.warn(
        `WebAuthn registration verify failed for user ${userId}: ${err instanceof Error ? err.message : String(err)}`,
      );
      throw new BadRequestException({
        code: 'WEBAUTHN_VERIFY_FAILED',
        message: 'WebAuthn 등록 검증에 실패했어요.',
      });
    }

    if (!verification.verified || !verification.registrationInfo) {
      throw new BadRequestException({
        code: 'WEBAUTHN_VERIFY_FAILED',
        message: 'WebAuthn 등록 검증에 실패했어요.',
      });
    }

    const { credential, aaguid } = verification.registrationInfo;
    // simplewebauthn v13 returns credential = { id, publicKey, counter, transports? }
    const credentialId = credential.id;
    const publicKey = Buffer.from(credential.publicKey);
    const counter = String(credential.counter ?? 0);
    const transports = (response.response.transports ?? []) as string[];

    // credential_id UNIQUE — 중복 시 friendly error
    const dup = await this.credentialRepo.findOne({ where: { credentialId } });
    if (dup) {
      throw new ConflictException({
        code: 'WEBAUTHN_CREDENTIAL_EXISTS',
        message: '이미 등록된 인증기예요.',
      });
    }

    const isFirst = (await this.countCredentials(userId)) === 0;
    const entity = this.credentialRepo.create({
      userId,
      credentialId,
      publicKey,
      counter,
      transports,
      aaguid: aaguid ?? null,
      deviceName: deviceName?.trim() || null,
    });
    const saved = await this.credentialRepo.save(entity);

    let recoveryPlain: string[] = [];
    if (isFirst) {
      recoveryPlain = Array.from({ length: RECOVERY_CODE_COUNT }, () => generateRecoveryCode());
      await this.usersService.update(userId, {
        webauthnRecoveryCodes: recoveryPlain.map(hashRecoveryCode),
      });
    }

    return {
      verified: true,
      credentialUuid: saved.id,
      webauthnRecoveryCodes: recoveryPlain,
    };
  }

  // ========== AUTHENTICATION ==========

  /** 로그인 2FA 단계에서 호출 — challengeToken 으로 사용자 식별. */
  async generateAuthenticationOptionsForUser(userId: string): Promise<{
    publicKey: PublicKeyCredentialRequestOptionsJSON;
    optionsToken: string;
  }> {
    const { rpID } = this.getConfig();
    const credentials = await this.listCredentials(userId);
    if (credentials.length === 0) {
      throw new BadRequestException({
        code: 'WEBAUTHN_NOT_REGISTERED',
        message: '등록된 WebAuthn 인증기가 없어요.',
      });
    }

    const options = await generateAuthenticationOptions({
      rpID,
      allowCredentials: credentials.map((c) => ({
        id: c.credentialId,
        transports: c.transports as AuthenticatorTransportFuture[],
      })),
      userVerification: 'preferred',
    });

    const optionsToken = this.signOptionsToken('webauthn_auth', userId, options.challenge);
    return { publicKey: options, optionsToken };
  }

  /**
   * verify 후 counter 갱신. counter 역행 시 row 즉시 삭제 + LoginHistory `webauthn_failed`.
   * (spec Rationale 1.4.E)
   */
  async verifyAuthentication(
    userId: string,
    optionsToken: string,
    response: AuthenticationResponseJSON,
    ctx: WebAuthnLoginContext = {},
  ): Promise<{ verified: boolean }> {
    const payload = this.verifyOptionsToken(optionsToken, 'webauthn_auth', userId);
    const { rpID, origins } = this.getConfig();

    const credentialId = response.id;
    const credential = await this.credentialRepo.findOne({
      where: { credentialId, userId },
    });
    if (!credential) {
      throw new UnauthorizedException({
        code: 'WEBAUTHN_CREDENTIAL_NOT_FOUND',
        message: '인증기를 찾을 수 없어요.',
      });
    }

    let verification: Awaited<ReturnType<typeof verifyAuthenticationResponse>>;
    try {
      verification = await verifyAuthenticationResponse({
        response,
        expectedChallenge: payload.challenge,
        expectedOrigin: origins,
        expectedRPID: rpID,
        requireUserVerification: false,
        credential: {
          id: credential.credentialId,
          publicKey: new Uint8Array(credential.publicKey),
          counter: Number(credential.counter),
          transports: credential.transports as AuthenticatorTransportFuture[],
        },
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      const counterRegression = /counter/i.test(msg) && /regress|same|less/i.test(msg);
      if (counterRegression) {
        // Rationale 1.4.E — 즉시 삭제
        await this.credentialRepo.delete({ id: credential.id });
        await this.loginHistory.record({
          userId,
          email: (await this.usersService.findById(userId))?.email ?? 'unknown',
          event: 'webauthn_failed',
          ip: ctx.ip ?? null,
          userAgent: ctx.userAgent ?? null,
          failureReason: 'WEBAUTHN_COUNTER_REGRESSION',
        });
        this.logger.error(
          `WebAuthn counter regression detected for user ${userId}, credential ${credential.id} — credential deleted`,
        );
        throw new UnauthorizedException({
          code: 'WEBAUTHN_COUNTER_REGRESSION',
          message: '인증기에서 비정상 신호가 감지돼 등록을 해제했어요. 다시 등록해 주세요.',
        });
      }
      await this.loginHistory.record({
        userId,
        email: (await this.usersService.findById(userId))?.email ?? 'unknown',
        event: 'webauthn_failed',
        ip: ctx.ip ?? null,
        userAgent: ctx.userAgent ?? null,
        failureReason: 'WEBAUTHN_INVALID',
      });
      this.logger.warn(`WebAuthn auth verify failed for user ${userId}: ${msg}`);
      throw new UnauthorizedException({
        code: 'WEBAUTHN_INVALID',
        message: 'WebAuthn 인증에 실패했어요.',
      });
    }

    if (!verification.verified) {
      await this.loginHistory.record({
        userId,
        email: (await this.usersService.findById(userId))?.email ?? 'unknown',
        event: 'webauthn_failed',
        ip: ctx.ip ?? null,
        userAgent: ctx.userAgent ?? null,
        failureReason: 'WEBAUTHN_INVALID',
      });
      throw new UnauthorizedException({
        code: 'WEBAUTHN_INVALID',
        message: 'WebAuthn 인증에 실패했어요.',
      });
    }

    await this.credentialRepo.update(credential.id, {
      counter: String(verification.authenticationInfo.newCounter),
      lastUsedAt: new Date(),
    });
    return { verified: true };
  }

  /** 복구 코드로 2FA 통과. 일치 시 해당 항목 1회 제거. */
  async verifyRecoveryCode(userId: string, code: string): Promise<boolean> {
    const user = await this.usersService.findById(userId);
    if (!user || !user.webauthnRecoveryCodes) return false;
    const hash = hashRecoveryCode(code.trim());
    const codes = user.webauthnRecoveryCodes;
    const idx = codes.indexOf(hash);
    if (idx < 0) return false;
    const remaining = codes.filter((_, i) => i !== idx);
    await this.usersService.update(userId, {
      webauthnRecoveryCodes: remaining.length > 0 ? remaining : null,
    });
    this.logger.log(
      `User ${userId} used a webauthn recovery code. ${remaining.length} remaining.`,
    );
    return true;
  }

  // ========== CREDENTIAL MANAGEMENT ==========

  async renameCredential(
    userId: string,
    credentialUuid: string,
    deviceName: string,
  ): Promise<WebAuthnCredential> {
    const credential = await this.credentialRepo.findOne({
      where: { id: credentialUuid },
    });
    if (!credential) {
      // enumeration 방지 — 본인 소유 아니면 404 동일 처리
      throw new NotFoundException({
        code: 'WEBAUTHN_CREDENTIAL_NOT_FOUND',
        message: '인증기를 찾을 수 없어요.',
      });
    }
    if (credential.userId !== userId) {
      throw new NotFoundException({
        code: 'WEBAUTHN_CREDENTIAL_NOT_FOUND',
        message: '인증기를 찾을 수 없어요.',
      });
    }
    credential.deviceName = deviceName.trim();
    return this.credentialRepo.save(credential);
  }

  /** 개별 삭제. 마지막 credential 이면 user.webauthn_recovery_codes 도 NULL 화. */
  async deleteCredential(userId: string, credentialUuid: string): Promise<void> {
    const credential = await this.credentialRepo.findOne({
      where: { id: credentialUuid },
    });
    if (!credential || credential.userId !== userId) {
      throw new NotFoundException({
        code: 'WEBAUTHN_CREDENTIAL_NOT_FOUND',
        message: '인증기를 찾을 수 없어요.',
      });
    }
    await this.credentialRepo.delete({ id: credentialUuid });
    const remaining = await this.countCredentials(userId);
    if (remaining === 0) {
      // 애플리케이션 레이어 책임 — DB 트리거 아님 (spec/1-data-model.md §2.1)
      await this.usersService.update(userId, { webauthnRecoveryCodes: null });
    }
  }

  /** 복구 코드 재발급 (호출 전 비밀번호 재확인은 컨트롤러에서). */
  async regenerateRecoveryCodes(userId: string): Promise<string[]> {
    const count = await this.countCredentials(userId);
    if (count === 0) {
      throw new ForbiddenException({
        code: 'WEBAUTHN_NOT_REGISTERED',
        message: '등록된 WebAuthn 인증기가 없어요.',
      });
    }
    const codes = Array.from({ length: RECOVERY_CODE_COUNT }, () => generateRecoveryCode());
    await this.usersService.update(userId, {
      webauthnRecoveryCodes: codes.map(hashRecoveryCode),
    });
    return codes;
  }

  // ========== OPTIONS TOKEN (stateless JWT) ==========

  private signOptionsToken(
    kind: OptionsTokenKind,
    userId: string,
    challenge: string,
  ): string {
    return this.jwtService.sign(
      { kind, sub: userId, challenge },
      { expiresIn: OPTIONS_TOKEN_TTL_SEC },
    );
  }

  private verifyOptionsToken(
    token: string,
    expectedKind: OptionsTokenKind,
    expectedSub: string,
  ): OptionsTokenPayload {
    let payload: OptionsTokenPayload;
    try {
      payload = this.jwtService.verify<OptionsTokenPayload>(token);
    } catch {
      throw new BadRequestException({
        code: 'INVALID_OPTIONS_TOKEN',
        message: 'WebAuthn 옵션 토큰이 만료됐어요. 다시 시도해 주세요.',
      });
    }
    if (payload.kind !== expectedKind) {
      throw new BadRequestException({
        code: 'INVALID_OPTIONS_TOKEN',
        message: '잘못된 WebAuthn 옵션 토큰이에요.',
      });
    }
    if (payload.sub !== expectedSub) {
      throw new BadRequestException({
        code: 'INVALID_OPTIONS_TOKEN',
        message: '잘못된 사용자에게 발급된 옵션 토큰이에요.',
      });
    }
    return payload;
  }
}
