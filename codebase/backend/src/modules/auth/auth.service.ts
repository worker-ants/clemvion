import {
  Injectable,
  BadRequestException,
  UnauthorizedException,
  ConflictException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, MoreThan, Repository } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import { createHash } from 'crypto';
import { User } from '../users/entities/user.entity';
import { RefreshToken } from './entities/refresh-token.entity';
import { UsersService } from '../users/users.service';
import { WebAuthnService } from './webauthn/webauthn.service';
import { WorkspacesService } from '../workspaces/workspaces.service';
import { WorkspaceInvitationsService } from '../workspaces/workspace-invitations.service';
import { MailService } from '../mail/mail.service';
import {
  comparePassword,
  hashPassword,
  validatePasswordStrength,
} from '../../common/utils/password.util';
import { LoginHistoryService } from './login-history.service';
import { deriveDeviceLabel } from './utils/device-label';
import type { AuthContext } from './types/auth-context';
import { SessionsService } from './sessions.service';

export type { AuthContext };

@Injectable()
export class AuthService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly usersService: UsersService,
    private readonly workspacesService: WorkspacesService,
    private readonly invitationsService: WorkspaceInvitationsService,
    private readonly mailService: MailService,
    @InjectRepository(RefreshToken)
    private readonly refreshTokenRepository: Repository<RefreshToken>,
    private readonly webauthnService: WebAuthnService,
    private readonly dataSource: DataSource,
    private readonly loginHistory: LoginHistoryService,
    private readonly sessionsService: SessionsService,
  ) {}

  // ========== PASSWORD RE-VERIFICATION (레이어 정렬 — refactor 02 C-3) ==========

  /**
   * 현재 사용자의 비밀번호를 재확인한다 (2FA 비활성화 등 민감 작업의 재인증용).
   * 옛 `AuthController.disable2fa` 가 raw `bcrypt.compare` 로 직접 수행하던 검증을
   * Service 로 이관한 것 — `data-flow/2-auth.md §1.2` 가 bcrypt 비교를 일관되게
   * `AuthService` 에 배치한다(레이어 정렬). 검증은 login 과 동일한 `comparePassword`
   * 헬퍼를 쓰며, 실패 시 에러 코드(`PASSWORD_REQUIRED`/`PASSWORD_INVALID`)·메시지·
   * 401 shape 은 옛 컨트롤러 동작 그대로 보존한다.
   */
  async verifyPasswordForUser(
    userId: string,
    plainPassword: string,
  ): Promise<void> {
    const user = await this.usersService.findById(userId);
    // !user: 사용자 미존재 / !passwordHash: OAuth-only 계정 — 둘 다 비밀번호 재확인 불가
    if (!user || !user.passwordHash) {
      throw new UnauthorizedException({
        code: 'PASSWORD_REQUIRED',
        message: '비밀번호 확인이 필요합니다.',
      });
    }
    const ok = await comparePassword(plainPassword, user.passwordHash);
    if (!ok) {
      throw new UnauthorizedException({
        code: 'PASSWORD_INVALID',
        message: '비밀번호가 일치하지 않습니다.',
      });
    }
  }

  // ========== REGISTER ==========
  async register(
    dto: {
      name: string;
      email: string;
      password: string;
      invitationToken?: string;
    },
    ctx: AuthContext = {},
  ): Promise<
    | { message: string }
    | { message: string; accessToken: string; refreshToken: string }
  > {
    const exists = await this.usersService.emailExists(dto.email);
    if (exists) {
      throw new ConflictException({
        code: 'RESOURCE_CONFLICT',
        message: 'Email already registered',
      });
    }

    validatePasswordStrength(dto.password);

    if (dto.invitationToken) {
      return this.registerWithInvitation(dto, dto.invitationToken, ctx);
    }

    const passwordHash = await hashPassword(dto.password);
    const emailVerifyToken = uuidv4();
    const emailVerifyExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24h

    await this.usersService.create({
      name: dto.name,
      email: dto.email,
      passwordHash,
      // Store SHA-256 hash; only the raw token is emailed (mirrors passwordResetToken).
      emailVerifyToken: this.hashToken(emailVerifyToken),
      emailVerifyExpiresAt,
      emailVerified: false,
    });

    await this.mailService.sendVerificationEmail(
      dto.email,
      dto.name,
      emailVerifyToken, // raw UUID — only the hashed copy lives in DB
    );

    return { message: 'Registration successful. Please verify your email.' };
  }

  /**
   * Sign-up via an invitation token. The token is the proof of email
   * ownership, so we skip the verification mail and auto-login. User row +
   * workspace membership + invitation.acceptedAt all live in one transaction
   * so a partial failure rolls back the whole thing (spec/5-system/1-auth.md §1.5.2).
   *
   * No personal workspace is auto-created — the invited team workspace is the
   * user's first context (spec/2-navigation/10-auth-flow.md §6.1).
   */
  private async registerWithInvitation(
    dto: { name: string; email: string; password: string },
    invitationToken: string,
    ctx: AuthContext,
  ): Promise<{
    message: string;
    accessToken: string;
    refreshToken: string;
  }> {
    const meta = await this.invitationsService.getMetaByToken(invitationToken);
    if (meta.email.toLowerCase() !== dto.email.trim().toLowerCase()) {
      throw new BadRequestException({
        code: 'invitation_email_mismatch',
        message: '초대 이메일과 가입 이메일이 일치하지 않습니다.',
      });
    }

    const passwordHash = await hashPassword(dto.password);

    const savedUser = await this.dataSource.transaction(async (manager) => {
      const userRepo = manager.getRepository(User);
      const newUser = userRepo.create({
        name: dto.name,
        email: dto.email.trim().toLowerCase(),
        passwordHash,
        emailVerified: true,
      });
      const saved = await userRepo.save(newUser);

      // consumeForRegistration enforces token validity + adds the membership.
      // Email match was already enforced above; the token's email is the
      // source of truth for the workspace association.
      await this.invitationsService.consumeForRegistration(
        manager,
        invitationToken,
        saved.id,
      );

      return saved;
    });

    const tokens = await this.generateTokens(savedUser, false, undefined, ctx);
    await this.loginHistory.record({
      userId: savedUser.id,
      email: savedUser.email,
      event: 'login_success',
      ip: ctx.ip ?? null,
      userAgent: ctx.userAgent ?? null,
    });

    return {
      message: 'Registration successful.',
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
    };
  }

  // ========== VERIFY EMAIL ==========
  async verifyEmail(
    token: string,
    ctx: AuthContext = {},
  ): Promise<{
    accessToken: string;
    refreshToken: string;
  }> {
    const userByToken = await this.findUserByVerifyToken(token);
    if (!userByToken) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'Invalid or expired verification token',
      });
    }

    if (
      userByToken.emailVerifyExpiresAt &&
      new Date() > userByToken.emailVerifyExpiresAt
    ) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'Verification token has expired',
      });
    }

    await this.dataSource.transaction(async (manager) => {
      await manager.getRepository(User).update(userByToken.id, {
        emailVerified: true,
        emailVerifyToken: null as unknown as string,
        emailVerifyExpiresAt: null as unknown as Date,
      });

      await this.workspacesService.createPersonalWorkspace(
        userByToken.id,
        userByToken.name,
        userByToken.email,
        manager,
      );
    });

    const tokens = await this.generateTokens(
      userByToken,
      false,
      undefined,
      ctx,
    );
    await this.loginHistory.record({
      userId: userByToken.id,
      email: userByToken.email,
      event: 'login_success',
      ip: ctx.ip ?? null,
      userAgent: ctx.userAgent ?? null,
    });
    return tokens;
  }

  // ========== LOGIN ==========
  async login(
    dto: {
      email: string;
      password: string;
      rememberMe?: boolean;
    },
    ctx: AuthContext = {},
  ): Promise<
    | { accessToken: string; refreshToken: string }
    | {
        requires2fa: true;
        methods: Array<'webauthn' | 'totp'>;
        challengeToken: string;
      }
  > {
    const user = await this.usersService.findByEmail(dto.email);
    if (!user) {
      await this.loginHistory.record({
        userId: null,
        email: dto.email,
        event: 'login_failed',
        ip: ctx.ip ?? null,
        userAgent: ctx.userAgent ?? null,
        failureReason: 'USER_NOT_FOUND',
      });
      throw new UnauthorizedException({
        code: 'LOGIN_FAILED',
        message: 'Invalid email or password',
      });
    }

    // Check lock
    if (await this.usersService.isLocked(user)) {
      await this.loginHistory.record({
        userId: user.id,
        email: user.email,
        event: 'login_failed',
        ip: ctx.ip ?? null,
        userAgent: ctx.userAgent ?? null,
        failureReason: 'ACCOUNT_LOCKED',
      });
      throw new UnauthorizedException({
        code: 'ACCOUNT_LOCKED',
        message: 'Account locked. Try again in 10 minutes.',
      });
    }

    if (!user.emailVerified) {
      await this.loginHistory.record({
        userId: user.id,
        email: user.email,
        event: 'login_failed',
        ip: ctx.ip ?? null,
        userAgent: ctx.userAgent ?? null,
        failureReason: 'EMAIL_NOT_VERIFIED',
      });
      throw new UnauthorizedException({
        code: 'LOGIN_FAILED',
        message: 'Please verify your email before logging in',
      });
    }

    if (!user.passwordHash) {
      await this.loginHistory.record({
        userId: user.id,
        email: user.email,
        event: 'login_failed',
        ip: ctx.ip ?? null,
        userAgent: ctx.userAgent ?? null,
        failureReason: 'PASSWORD_NOT_SET',
      });
      throw new UnauthorizedException({
        code: 'LOGIN_FAILED',
        message: 'Invalid email or password',
      });
    }

    const isValid = await comparePassword(dto.password, user.passwordHash);
    if (!isValid) {
      await this.usersService.incrementLoginAttempts(user.id);
      await this.loginHistory.record({
        userId: user.id,
        email: user.email,
        event: 'login_failed',
        ip: ctx.ip ?? null,
        userAgent: ctx.userAgent ?? null,
        failureReason: 'INVALID_PASSWORD',
      });
      throw new UnauthorizedException({
        code: 'LOGIN_FAILED',
        message: 'Invalid email or password',
      });
    }

    await this.usersService.resetLoginAttempts(user.id);

    // 2FA 활성 사용자: 5분 만료 challenge token 발급. spec/5-system/1-auth.md §1.4.2 —
    //   WebAuthn credential ≥ 1 → methods=['webauthn'] (TOTP fallback 자동 금지)
    //   else two_factor_enabled=true → methods=['totp']
    // WebAuthnService.countCredentials() 는 기능 비활성(§1.4.3) 시 0 을 반환해
    // TOTP/일반 분기로 폴백 — 운영자 미설정에 사용자가 락아웃되지 않도록.
    const webauthnCount = await this.webauthnService.countCredentials(user.id);
    const hasTotp = user.twoFactorEnabled;
    if (webauthnCount > 0 || hasTotp) {
      const methods: Array<'webauthn' | 'totp'> =
        webauthnCount > 0 ? ['webauthn'] : ['totp'];
      const challengeToken = this.jwtService.sign(
        {
          sub: user.id,
          mfa_challenge: true,
          method: methods[0],
          rememberMe: !!dto.rememberMe,
        },
        { expiresIn: 300 },
      );
      return {
        requires2fa: true,
        methods,
        challengeToken,
      };
    }

    const tokens = await this.generateTokens(
      user,
      dto.rememberMe,
      undefined,
      ctx,
    );
    await this.loginHistory.record({
      userId: user.id,
      email: user.email,
      event: 'login_success',
      ip: ctx.ip ?? null,
      userAgent: ctx.userAgent ?? null,
    });
    return tokens;
  }

  /**
   * 2FA 활성 사용자의 로그인 2단계.
   * `/auth/login`에서 받은 challengeToken과 6자리 TOTP 코드(또는 복구 코드)를 검증한다.
   */
  async loginWithTotp(
    challengeToken: string,
    code: string,
    verifier: (user: User, code: string) => Promise<boolean>,
    ctx: AuthContext = {},
  ): Promise<{ accessToken: string; refreshToken: string }> {
    let payload: { sub: string; mfa_challenge?: boolean; rememberMe?: boolean };
    try {
      payload = this.jwtService.verify(challengeToken);
    } catch {
      throw new UnauthorizedException({
        code: 'CHALLENGE_INVALID',
        message: '인증 세션이 만료됐어요. 다시 로그인해 주세요.',
      });
    }
    if (!payload.mfa_challenge) {
      throw new UnauthorizedException({
        code: 'CHALLENGE_INVALID',
        message: '잘못된 challenge token이에요.',
      });
    }
    const user = await this.usersService.findById(payload.sub);
    if (!user || !user.twoFactorEnabled) {
      throw new UnauthorizedException({
        code: 'TOTP_NOT_ENABLED',
        message: '이 계정은 2FA가 비활성 상태예요. 다시 로그인해 주세요.',
      });
    }
    // spec/5-system/1-auth.md Rationale 1.4.D — WebAuthn credential 보유 사용자는
    // TOTP 자동 fallback 차단. WebAuthnService.countCredentials() 는 §1.4.3 비활성 시
    // 0 을 반환해 백스탑을 자동으로 풀어준다 (락아웃 방지).
    const webauthnCount = await this.webauthnService.countCredentials(user.id);
    if (webauthnCount > 0) {
      throw new UnauthorizedException({
        code: 'WEBAUTHN_REQUIRED',
        message:
          'Passkey 로 로그인해 주세요. (WebAuthn 등록 사용자는 TOTP 우회 불가)',
      });
    }
    const ok = await verifier(user, code);
    if (!ok) {
      await this.loginHistory.record({
        userId: user.id,
        email: user.email,
        event: 'totp_failed',
        ip: ctx.ip ?? null,
        userAgent: ctx.userAgent ?? null,
        failureReason: 'TOTP_INVALID',
      });
      throw new UnauthorizedException({
        code: 'TOTP_INVALID',
        message: '인증 코드가 올바르지 않아요.',
      });
    }
    const tokens = await this.generateTokens(
      user,
      !!payload.rememberMe,
      undefined,
      ctx,
    );
    await this.loginHistory.record({
      userId: user.id,
      email: user.email,
      event: 'login_success',
      ip: ctx.ip ?? null,
      userAgent: ctx.userAgent ?? null,
    });
    return tokens;
  }

  /**
   * WebAuthn 2FA 단계 진입 — `/auth/login` 발급 challengeToken 을 검증하고
   * 사용자/`rememberMe` 를 추출한다. WebAuthnService 가 실제 ceremony 검증을 마친 뒤
   * 본 함수가 반환한 user 로 `issueTokensAfterMfa` 를 호출해 토큰 발급한다.
   */
  async consumeChallengeToken(
    challengeToken: string,
    expectedMethod: 'webauthn' | 'totp',
  ): Promise<{ user: User; rememberMe: boolean }> {
    let payload: {
      sub: string;
      mfa_challenge?: boolean;
      method?: string;
      rememberMe?: boolean;
    };
    try {
      payload = this.jwtService.verify(challengeToken);
    } catch {
      throw new UnauthorizedException({
        code: 'CHALLENGE_INVALID',
        message: '인증 세션이 만료됐어요. 다시 로그인해 주세요.',
      });
    }
    if (!payload.mfa_challenge) {
      throw new UnauthorizedException({
        code: 'CHALLENGE_INVALID',
        message: '잘못된 challenge token이에요.',
      });
    }
    // method 가 박혀있으면 일치 검증 (예: TOTP 분기 토큰을 WebAuthn verify 로 우회 차단)
    if (payload.method && payload.method !== expectedMethod) {
      throw new UnauthorizedException({
        code: 'CHALLENGE_METHOD_MISMATCH',
        message: '이 challenge token 은 다른 인증 방식용이에요.',
      });
    }
    const user = await this.usersService.findById(payload.sub);
    if (!user) {
      throw new UnauthorizedException({
        code: 'CHALLENGE_INVALID',
        message: '인증 세션이 유효하지 않아요.',
      });
    }
    return { user, rememberMe: !!payload.rememberMe };
  }

  /** WebAuthn 또는 다른 2FA 방식 verify 성공 후 정식 토큰 발급. */
  async issueTokensAfterMfa(
    user: User,
    rememberMe: boolean,
    ctx: AuthContext = {},
  ): Promise<{ accessToken: string; refreshToken: string }> {
    const tokens = await this.generateTokens(user, rememberMe, undefined, ctx);
    await this.loginHistory.record({
      userId: user.id,
      email: user.email,
      event: 'login_success',
      ip: ctx.ip ?? null,
      userAgent: ctx.userAgent ?? null,
    });
    return tokens;
  }

  // ========== LOGOUT ==========
  async logout(refreshToken: string, ctx: AuthContext = {}): Promise<void> {
    const tokenHash = this.hashToken(refreshToken);
    const stored = await this.refreshTokenRepository.findOne({
      where: { tokenHash },
      relations: ['user'],
    });
    if (stored) {
      // Revoke entire family
      await this.refreshTokenRepository.update(
        { familyId: stored.familyId },
        { isRevoked: true },
      );
      const user = stored.user;
      if (user) {
        await this.loginHistory.record({
          userId: user.id,
          email: user.email,
          event: 'logout',
          ip: ctx.ip ?? null,
          userAgent: ctx.userAgent ?? null,
          familyId: stored.familyId,
        });
      }
    }
  }

  // ========== REFRESH ==========
  /**
   * Refresh token 회전. 세 분기로 갈린다:
   *  1. **reuse 탐지** (`stored.isRevoked`) — 이미 revoke 된 토큰 재사용 → family 전체
   *     revoke + `loginHistory` 보안 이벤트 기록 후 401.
   *  2. **만료** (`expiresAt < now`) — 부작용 없이 401 `TOKEN_EXPIRED` (트랜잭션 미진입).
   *  3. **정상 회전** — 구 토큰 revoke + 신규 토큰 INSERT 를 **단일 트랜잭션**으로 원자화
   *     (05 C-1). revoke 는 조건부 UPDATE 라 동시 회전(TOCTOU)을 `affected=0` 으로 차단한다.
   */
  async refresh(
    refreshToken: string,
    ctx: AuthContext = {},
  ): Promise<{
    accessToken: string;
    refreshToken: string;
  }> {
    const tokenHash = this.hashToken(refreshToken);
    const stored = await this.refreshTokenRepository.findOne({
      where: { tokenHash },
      relations: ['user'],
    });

    if (!stored) {
      throw new UnauthorizedException({
        code: 'TOKEN_INVALID',
        message: 'Invalid refresh token',
      });
    }

    // Reuse detection: if token is revoked, revoke entire family (potential theft)
    if (stored.isRevoked) {
      await this.refreshTokenRepository.update(
        { familyId: stored.familyId },
        { isRevoked: true },
      );
      if (stored.user) {
        await this.loginHistory.record({
          userId: stored.user.id,
          email: stored.user.email,
          event: 'token_reuse_detected',
          ip: ctx.ip ?? null,
          userAgent: ctx.userAgent ?? null,
          familyId: stored.familyId,
        });
      }
      throw new UnauthorizedException({
        code: 'TOKEN_INVALID',
        message: 'Refresh token reuse detected. All sessions revoked.',
      });
    }

    if (new Date() > stored.expiresAt) {
      throw new UnauthorizedException({
        code: 'TOKEN_EXPIRED',
        message: 'Refresh token expired',
      });
    }

    const user = stored.user;
    if (!user) {
      // 토큰은 유효하나 user 관계가 비어있다 (데이터 손상). 회전 불가 — reuse 분기의
      // `if (stored.user)` 방어와 동일하게 안전 거부한다.
      throw new UnauthorizedException({
        code: 'TOKEN_INVALID',
        message: 'Invalid refresh token',
      });
    }

    // 05 C-1 — revoke(구 토큰)+INSERT(신규 토큰)를 단일 트랜잭션으로 원자화한다.
    // 중간 실패 시 구 토큰의 `is_revoked=false` 가 유지돼 세션 소실을 막는다.
    // (옛 구현은 revoke 후 별도 INSERT — 그 사이 크래시 시 구 토큰만 무효화되고
    // 신규 토큰이 없어 세션이 통째로 사라졌다.)
    //
    // revoke 는 **조건부 UPDATE** (`is_revoked=false AND expires_at>now`)로 수행해,
    // 위 findOne→검증→update 사이의 TOCTOU 창(동일 토큰 동시 refresh 로 인한 이중 회전)을
    // 닫는다 — affected=0 이면 다른 요청이 먼저 회전·무효화한 것이므로 거부한다.
    // `lastUsedAt`/`lastUsedIp` 스탬프도 같은 UPDATE 에 포함해 /profile/sessions 의
    // "last activity" 정확성을 유지한다. loginHistory 기록은 회전 원자성과 무관하고
    // refresh 정상 회전은 보안 이벤트가 아니므로(spec §1.4) 남기지 않는다.
    return this.dataSource.transaction(async (manager) => {
      const now = new Date();
      const result = await manager.getRepository(RefreshToken).update(
        { id: stored.id, isRevoked: false, expiresAt: MoreThan(now) },
        {
          isRevoked: true,
          lastUsedAt: now,
          lastUsedIp: ctx.ip ?? null,
        },
      );
      // affected 가 0/undefined/null 이면(드라이버별) 매칭 행 없음 — 다른 요청이
      // 먼저 회전했거나 만료 경계에 걸린 것이므로 신규 토큰을 발급하지 않는다.
      if (!result.affected) {
        throw new UnauthorizedException({
          code: 'TOKEN_INVALID',
          message: 'Invalid refresh token',
        });
      }
      // Issue new tokens in same family — INSERT joins this transaction.
      return this.generateTokens(user, false, stored.familyId, ctx, manager);
    });
  }

  // ========== FORGOT PASSWORD ==========
  async forgotPassword(email: string): Promise<{ message: string }> {
    try {
      const user = await this.usersService.findByEmail(email);
      if (user) {
        const resetToken = uuidv4();
        const resetExpires = new Date(Date.now() + 30 * 60 * 1000); // 30 min
        await this.usersService.update(user.id, {
          passwordResetToken: this.hashToken(resetToken),
          passwordResetExpiresAt: resetExpires,
        });
        await this.mailService.sendPasswordResetEmail(
          user.email,
          user.name,
          resetToken,
        );
      }
    } catch {
      // Swallow all errors (DB, mail dispatch) so the response is
      // indistinguishable from the "user not found" path. Without this,
      // different failure modes leak whether an account exists. The
      // underlying services log their own errors for operators.
    }
    // Always return same response to prevent email enumeration
    return {
      message: 'If an account exists, a password reset link has been sent.',
    };
  }

  // ========== RESEND VERIFICATION ==========
  async resendVerification(email: string): Promise<{ message: string }> {
    try {
      const user = await this.usersService.findByEmail(email);
      // Only re-issue for accounts that exist and are not yet verified.
      if (user && !user.emailVerified) {
        const emailVerifyToken = uuidv4();
        const emailVerifyExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24h
        await this.usersService.update(user.id, {
          // Store SHA-256 hash; only the raw token is emailed (mirrors passwordResetToken).
          emailVerifyToken: this.hashToken(emailVerifyToken),
          emailVerifyExpiresAt,
        });
        await this.mailService.sendVerificationEmail(
          user.email,
          user.name,
          emailVerifyToken, // raw UUID — only the hashed copy lives in DB
        );
      }
    } catch {
      // Swallow all errors (DB, mail dispatch) so the response is
      // indistinguishable from the "user not found / already verified" path.
      // Without this, different failure modes leak whether an account exists.
      // The underlying services log their own errors for operators.
    }
    // Always return the same response to prevent email enumeration.
    return {
      message:
        'If an account exists and is not yet verified, a verification email has been sent.',
    };
  }

  // ========== RESET PASSWORD ==========
  async resetPassword(token: string, newPassword: string): Promise<void> {
    validatePasswordStrength(newPassword);

    const user = await this.findUserByResetToken(token);
    if (!user) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'Invalid or expired reset token',
      });
    }

    if (
      user.passwordResetExpiresAt &&
      new Date() > user.passwordResetExpiresAt
    ) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'Reset token has expired',
      });
    }

    const passwordHash = await hashPassword(newPassword);
    await this.usersService.update(user.id, {
      passwordHash,
      passwordResetToken: null as unknown as string,
      passwordResetExpiresAt: null as unknown as Date,
    });

    // Revoke all refresh tokens for this user
    await this.refreshTokenRepository.update(
      { userId: user.id },
      { isRevoked: true },
    );
  }

  // ========== CHECK EMAIL ==========
  async checkEmail(email: string): Promise<{ available: boolean }> {
    const exists = await this.usersService.emailExists(email);
    return { available: !exists };
  }

  // ========== HELPERS ==========

  /**
   * 비밀번호 변경 후 세션 회전 (refactor 04 A-1 — 옵션 B). 인증 spec §2.3 / Rationale 2.3.C.
   *
   * 변경을 수행한 본인은 이미 `currentPassword` 로 재인증됐다는 전제에서:
   *   1) 사용자의 **모든** 활성 family 를 revoke (탈취 가능한 구 refresh token 전부 무효화) +
   *      `session_revoked`(bulk) 기록 — `SessionsService` 경유(data-flow §1.2 emitter 일관성).
   *   2) 현재 디바이스에 새 세션(access + refresh) 재발급 — 표준 7일(`rememberMe=false`).
   *      현재 family 를 식별할 수단이 없어(refresh 쿠키 Path `/api/auth` 한정) remember-me 미승계.
   *
   * @returns 재발급된 `{ accessToken, refreshToken }`. 호출자(UsersController)가 refresh 쿠키를
   *   설정하고 accessToken 을 응답 본문으로 반환한다.
   * @throws UnauthorizedException `UNAUTHENTICATED` — 사용자 없음.
   */
  async rotateSessionAfterPasswordChange(
    userId: string,
    ctx: AuthContext = {},
  ): Promise<{ accessToken: string; refreshToken: string }> {
    await this.sessionsService.revokeAllFamilies(userId, ctx);
    const user = await this.usersService.findById(userId);
    if (!user) {
      throw new UnauthorizedException({ code: 'UNAUTHENTICATED' });
    }
    return this.generateTokens(user, false, undefined, ctx);
  }

  // ========== EMAIL CHANGE (spec/5-system/1-auth.md §1.1.B) ==========

  /**
   * 이메일 변경 시작. 재인증(password 또는 TOTP) → 신규 이메일 검증 → SHA-256 토큰(1h)
   * 저장 → 신규 이메일로 확인 메일 발송. 재인증 수단 없는 OAuth-only 는
   * `REAUTH_NOT_AVAILABLE`. 이메일 OTP 는 변경 대상 메일함과의 순환성으로 배제(Rationale 1.1.B-4).
   */
  async requestEmailChange(
    userId: string,
    newEmail: string,
    auth: { password?: string; totpCode?: string },
  ): Promise<void> {
    // 1) 재인증 — 세션 강제 종료와 동일 계약 재사용(password OR TOTP).
    await this.sessionsService.reauthenticate(userId, auth);

    const user = await this.usersService.findById(userId);
    if (!user) {
      throw new UnauthorizedException({ code: 'UNAUTHENTICATED' });
    }

    // 2) 신규 이메일 검증 — 현재와 동일(대소문자 무시) 금지 + 타 계정 사용 중 금지.
    if (newEmail.trim().toLowerCase() === user.email.toLowerCase()) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: '현재 이메일과 동일한 주소예요.',
      });
    }
    if (await this.usersService.emailTakenByOther(newEmail, userId)) {
      throw new ConflictException({
        code: 'RESOURCE_CONFLICT',
        message: 'Email already registered',
      });
    }

    // 3) 토큰 발급 — raw 는 메일로만, DB 엔 SHA-256 해시(email_verify_token 패턴 §1.1).
    const rawToken = uuidv4();
    await this.usersService.update(userId, {
      pendingEmail: newEmail,
      emailChangeToken: this.hashToken(rawToken),
      emailChangeExpiresAt: new Date(Date.now() + 60 * 60 * 1000), // 1h
    });

    // 4) 신규 이메일로 확인 메일.
    await this.mailService.sendEmailChangeVerification(
      newEmail,
      user.name,
      rawToken,
    );
  }

  /**
   * 이메일 변경 확인. 토큰을 **인증 사용자에 바인딩**해 검증(누출 링크 단독 무용,
   * Rationale 1.1.B-2) → email 교체 → 전 세션 revoke + 현재 디바이스 재발급(Rationale 2.3.C)
   * → 옛 이메일 통지(best-effort). 감사(`user.email_changed`)·쿠키 set 은 controller 책임.
   */
  async verifyEmailChange(
    userId: string,
    token: string,
    ctx: AuthContext = {},
  ): Promise<{ accessToken: string; refreshToken: string }> {
    const user = await this.usersService.findById(userId);
    if (
      !user ||
      !user.pendingEmail ||
      !user.emailChangeToken ||
      user.emailChangeToken !== this.hashToken(token) ||
      !user.emailChangeExpiresAt ||
      user.emailChangeExpiresAt.getTime() < Date.now()
    ) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'Invalid or expired email change token',
      });
    }

    const oldEmail = user.email;
    const newEmail = user.pendingEmail;

    // 확인 시점 재검사 — request 이후 신규 이메일이 타 계정에 선점됐는지(대소문자 무시).
    if (await this.usersService.emailTakenByOther(newEmail, userId)) {
      await this.clearPendingEmailChange(userId);
      throw new ConflictException({
        code: 'RESOURCE_CONFLICT',
        message: 'Email already registered',
      });
    }

    // email 교체 + 검증 완료 + pending 정리. email UNIQUE 제약이 race 의 최종 가드.
    try {
      await this.usersService.update(userId, {
        email: newEmail,
        emailVerified: true,
        pendingEmail: null,
        emailChangeToken: null,
        emailChangeExpiresAt: null,
      });
    } catch (e) {
      if (this.isUniqueEmailViolation(e)) {
        await this.clearPendingEmailChange(userId);
        throw new ConflictException({
          code: 'RESOURCE_CONFLICT',
          message: 'Email already registered',
        });
      }
      throw e;
    }

    // 전 세션 revoke + 현재 디바이스 재발급 (비밀번호 변경과 동형).
    await this.sessionsService.revokeAllFamilies(userId, ctx);
    const updated = await this.usersService.findById(userId);
    if (!updated) {
      throw new UnauthorizedException({ code: 'UNAUTHENTICATED' });
    }
    const tokens = await this.generateTokens(updated, false, undefined, ctx);

    // 옛 이메일 통지 — best-effort(변경은 이미 커밋). 실패해도 주 동작을 깨지 않는다.
    try {
      await this.mailService.sendEmailChangedNotice(
        oldEmail,
        updated.name,
        newEmail,
      );
    } catch {
      // MailService 가 자체 로깅. 통지 누락이 변경을 되돌리지 않는다.
    }

    return tokens;
  }

  /**
   * 진행 중인 이메일 변경의 확인 메일 재발송(토큰 재발급, 1h). pending 없으면 VALIDATION_ERROR.
   */
  async resendEmailChange(userId: string): Promise<void> {
    const user = await this.usersService.findById(userId);
    if (!user || !user.pendingEmail) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'No pending email change',
      });
    }
    const rawToken = uuidv4();
    await this.usersService.update(userId, {
      emailChangeToken: this.hashToken(rawToken),
      emailChangeExpiresAt: new Date(Date.now() + 60 * 60 * 1000),
    });
    await this.mailService.sendEmailChangeVerification(
      user.pendingEmail,
      user.name,
      rawToken,
    );
  }

  /** 진행 중인 이메일 변경 취소(pending 정리). 멱등 — pending 없어도 정상 동작. */
  async cancelEmailChange(userId: string): Promise<void> {
    await this.clearPendingEmailChange(userId);
  }

  private async clearPendingEmailChange(userId: string): Promise<void> {
    await this.usersService.update(userId, {
      pendingEmail: null,
      emailChangeToken: null,
      emailChangeExpiresAt: null,
    });
  }

  private isUniqueEmailViolation(err: unknown): boolean {
    if (typeof err !== 'object' || err === null) return false;
    const e = err as { code?: string; driverError?: { code?: string } };
    return e.code === '23505' || e.driverError?.code === '23505';
  }

  // Public entry point for OAuth sign-in — wraps the private token issuance
  // so other auth paths (email/password login, refresh) remain the only callers
  // of the private implementation.
  async issueTokensForOauthUser(
    user: User,
    rememberMe: boolean,
    ctx: AuthContext = {},
  ): Promise<{ accessToken: string; refreshToken: string }> {
    const tokens = await this.generateTokens(user, rememberMe, undefined, ctx);
    await this.loginHistory.record({
      userId: user.id,
      email: user.email,
      event: 'login_success',
      ip: ctx.ip ?? null,
      userAgent: ctx.userAgent ?? null,
    });
    return tokens;
  }

  /**
   * Access JWT + 회전 refresh token 발급. **`private` — 외부 노출 금지.**
   *
   * `@param manager` (05 C-1): 전달되면 refresh token INSERT 가 그 `EntityManager` 의
   * 트랜잭션에 합류한다 (refresh 회전이 revoke+INSERT 를 원자화하는 경로). 미전달 시
   * (login / OAuth callback / verifyEmail / invitation 가입)엔 기본 repository 로 INSERT —
   * 호출처 무변경. JWT sign·workspace context 조회는 DB write 가 아니므로 트랜잭션 의미와
   * 무관하게 선행된다.
   *
   * @internal 트랜잭션 컨텍스트 전파 전용 — `public` 승격 금지(trust boundary 확장 방지).
   */
  private async generateTokens(
    user: User,
    rememberMe = false,
    familyId?: string,
    ctx: AuthContext = {},
    // 05 C-1 — refresh 회전 시 revoke(구 토큰)+INSERT(신규 토큰)를 단일 트랜잭션에
    // 묶기 위한 optional manager. 미전달 시(login/OAuth 경로) 기존 repository 사용 —
    // 호출처 무변경. JWT sign 은 DB 무관이라 트랜잭션 밖에서 선계산된다.
    manager?: EntityManager,
  ): Promise<{ accessToken: string; refreshToken: string }> {
    const context = await this.resolveTokenWorkspaceContext(user);

    const accessPayload = {
      sub: user.id,
      email: user.email,
      workspaceId: context.workspaceId,
      role: context.role,
    };

    const accessToken = this.jwtService.sign(accessPayload, {
      expiresIn: 900, // 15분
    });

    // refresh token 생성
    const rawRefreshToken = uuidv4();
    const tokenHash = this.hashToken(rawRefreshToken);
    const refreshExpDays = rememberMe ? 30 : 7;
    const expiresAt = new Date(
      Date.now() + refreshExpDays * 24 * 60 * 60 * 1000,
    );

    const userAgent = ctx.userAgent ?? null;
    const refreshRepo = manager
      ? manager.getRepository(RefreshToken)
      : this.refreshTokenRepository;
    const refreshTokenEntity = refreshRepo.create({
      userId: user.id,
      tokenHash,
      familyId: familyId ?? uuidv4(),
      expiresAt,
      ipAddress: ctx.ip ?? null,
      userAgent,
      deviceLabel: userAgent ? deriveDeviceLabel(userAgent) : null,
    });
    await refreshRepo.save(refreshTokenEntity);

    return { accessToken, refreshToken: rawRefreshToken };
  }

  /**
   * Resolve which workspace this token's `workspaceId` claim should point at.
   * Order:
   *   1. The user's personal workspace if one exists (legacy users stay sticky).
   *   2. Otherwise the first workspace they're a member of (invitation-token
   *      sign-ups land here — their only membership is the team that invited
   *      them, so no personal workspace gets auto-created).
   *   3. Otherwise create the personal workspace (true cold-start fallback).
   *
   * This is the choke point that keeps spec/2-navigation/10-auth-flow.md §6.1
   * honest — `invitationToken` sign-ups must NOT trigger a personal workspace.
   */
  private async resolveTokenWorkspaceContext(
    user: User,
  ): Promise<{ workspaceId: string; role: string }> {
    const personal = await this.workspacesService.findPersonalWorkspace(
      user.id,
    );
    if (personal) {
      const role =
        (await this.workspacesService.getMemberRole(personal.id, user.id)) ??
        'owner';
      return { workspaceId: personal.id, role };
    }

    const memberships = await this.workspacesService.listForUser(user.id);
    if (memberships.length > 0) {
      const first = memberships[0];
      return { workspaceId: first.id, role: first.role };
    }

    const workspace =
      await this.workspacesService.findOrCreatePersonalWorkspace(
        user.id,
        user.name,
        user.email,
      );
    return { workspaceId: workspace.id, role: 'owner' };
  }

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private async findUserByVerifyToken(token: string): Promise<User | null> {
    // Hash-on-compare: DB stores the SHA-256 hash (mirrors passwordResetToken).
    const repo = this.refreshTokenRepository.manager.getRepository(User);
    return repo.findOne({ where: { emailVerifyToken: this.hashToken(token) } });
  }

  private async findUserByResetToken(token: string): Promise<User | null> {
    const repo = this.refreshTokenRepository.manager.getRepository(User);
    return repo.findOne({
      where: { passwordResetToken: this.hashToken(token) },
    });
  }
}
