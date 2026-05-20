import {
  Injectable,
  BadRequestException,
  UnauthorizedException,
  ConflictException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';
import { createHash } from 'crypto';
import { User } from '../users/entities/user.entity';
import { RefreshToken } from './entities/refresh-token.entity';
import { UsersService } from '../users/users.service';
import { WebAuthnService } from './webauthn/webauthn.service';
import { WorkspacesService } from '../workspaces/workspaces.service';
import { WorkspaceInvitationsService } from '../workspaces/workspace-invitations.service';
import { MailService } from '../mail/mail.service';
import { validatePasswordStrength } from '../../common/utils/password.util';
import { LoginHistoryService } from './login-history.service';
import { deriveDeviceLabel } from './utils/device-label';
import type { AuthContext } from './types/auth-context';

const BCRYPT_ROUNDS = 12;

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
  ) {}

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

    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);
    const emailVerifyToken = uuidv4();
    const emailVerifyExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24h

    await this.usersService.create({
      name: dto.name,
      email: dto.email,
      passwordHash,
      emailVerifyToken,
      emailVerifyExpiresAt,
      emailVerified: false,
    });

    await this.mailService.sendVerificationEmail(
      dto.email,
      dto.name,
      emailVerifyToken,
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

    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);

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

    const isValid = await bcrypt.compare(dto.password, user.passwordHash);
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

    // Mark the rotated token as revoked AND stamp its last_used metadata so the
    // user sees an accurate "last activity" in /profile/sessions.
    await this.refreshTokenRepository.update(stored.id, {
      isRevoked: true,
      lastUsedAt: new Date(),
      lastUsedIp: ctx.ip ?? null,
    });

    // Issue new tokens in same family
    const user = stored.user;
    return this.generateTokens(user, false, stored.familyId, ctx);
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

    const passwordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
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

  private async generateTokens(
    user: User,
    rememberMe = false,
    familyId?: string,
    ctx: AuthContext = {},
  ): Promise<{ accessToken: string; refreshToken: string }> {
    const context = await this.resolveTokenWorkspaceContext(user);

    const accessPayload = {
      sub: user.id,
      email: user.email,
      workspaceId: context.workspaceId,
      role: context.role,
    };

    const accessToken = this.jwtService.sign(accessPayload, {
      expiresIn: 900, // 15 minutes
    });

    // Create refresh token
    const rawRefreshToken = uuidv4();
    const tokenHash = this.hashToken(rawRefreshToken);
    const refreshExpDays = rememberMe ? 30 : 7;
    const expiresAt = new Date(
      Date.now() + refreshExpDays * 24 * 60 * 60 * 1000,
    );

    const userAgent = ctx.userAgent ?? null;
    const refreshTokenEntity = this.refreshTokenRepository.create({
      userId: user.id,
      tokenHash,
      familyId: familyId ?? uuidv4(),
      expiresAt,
      ipAddress: ctx.ip ?? null,
      userAgent,
      deviceLabel: userAgent ? deriveDeviceLabel(userAgent) : null,
    });
    await this.refreshTokenRepository.save(refreshTokenEntity);

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
    // Direct repository access for token-based lookup
    const repo = this.refreshTokenRepository.manager.getRepository(User);
    return repo.findOne({ where: { emailVerifyToken: token } });
  }

  private async findUserByResetToken(token: string): Promise<User | null> {
    const repo = this.refreshTokenRepository.manager.getRepository(User);
    return repo.findOne({
      where: { passwordResetToken: this.hashToken(token) },
    });
  }
}
