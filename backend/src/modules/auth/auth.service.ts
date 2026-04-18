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
import { WorkspacesService } from '../workspaces/workspaces.service';
import { MailService } from '../mail/mail.service';
import { validatePasswordStrength } from '../../common/utils/password.util';

const BCRYPT_ROUNDS = 12;

@Injectable()
export class AuthService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly usersService: UsersService,
    private readonly workspacesService: WorkspacesService,
    private readonly mailService: MailService,
    @InjectRepository(RefreshToken)
    private readonly refreshTokenRepository: Repository<RefreshToken>,
    private readonly dataSource: DataSource,
  ) {}

  // ========== REGISTER ==========
  async register(dto: {
    name: string;
    email: string;
    password: string;
  }): Promise<{ message: string }> {
    const exists = await this.usersService.emailExists(dto.email);
    if (exists) {
      throw new ConflictException({
        code: 'RESOURCE_CONFLICT',
        message: 'Email already registered',
      });
    }

    validatePasswordStrength(dto.password);

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

  // ========== VERIFY EMAIL ==========
  async verifyEmail(token: string): Promise<{
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

    return this.generateTokens(userByToken);
  }

  // ========== LOGIN ==========
  async login(dto: {
    email: string;
    password: string;
    rememberMe?: boolean;
  }): Promise<
    | { accessToken: string; refreshToken: string }
    | { requiresTotp: true; challengeToken: string }
  > {
    const user = await this.usersService.findByEmail(dto.email);
    if (!user) {
      throw new UnauthorizedException({
        code: 'LOGIN_FAILED',
        message: 'Invalid email or password',
      });
    }

    // Check lock
    if (await this.usersService.isLocked(user)) {
      throw new UnauthorizedException({
        code: 'ACCOUNT_LOCKED',
        message: 'Account locked. Try again in 10 minutes.',
      });
    }

    if (!user.emailVerified) {
      throw new UnauthorizedException({
        code: 'LOGIN_FAILED',
        message: 'Please verify your email before logging in',
      });
    }

    if (!user.passwordHash) {
      throw new UnauthorizedException({
        code: 'LOGIN_FAILED',
        message: 'Invalid email or password',
      });
    }

    const isValid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!isValid) {
      await this.usersService.incrementLoginAttempts(user.id);
      throw new UnauthorizedException({
        code: 'LOGIN_FAILED',
        message: 'Invalid email or password',
      });
    }

    await this.usersService.resetLoginAttempts(user.id);

    // 2FA 활성 사용자: 5분 만료 challenge token 발급, 클라이언트는 /auth/login/totp로 검증
    if (user.twoFactorEnabled) {
      const challengeToken = this.jwtService.sign(
        { sub: user.id, mfa_challenge: true, rememberMe: !!dto.rememberMe },
        { expiresIn: 300 },
      );
      return { requiresTotp: true, challengeToken };
    }

    return this.generateTokens(user, dto.rememberMe);
  }

  /**
   * 2FA 활성 사용자의 로그인 2단계.
   * `/auth/login`에서 받은 challengeToken과 6자리 TOTP 코드(또는 복구 코드)를 검증한다.
   */
  async loginWithTotp(
    challengeToken: string,
    code: string,
    verifier: (user: User, code: string) => Promise<boolean>,
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
    const ok = await verifier(user, code);
    if (!ok) {
      throw new UnauthorizedException({
        code: 'TOTP_INVALID',
        message: '인증 코드가 올바르지 않아요.',
      });
    }
    return this.generateTokens(user, !!payload.rememberMe);
  }

  // ========== LOGOUT ==========
  async logout(refreshToken: string): Promise<void> {
    const tokenHash = this.hashToken(refreshToken);
    const stored = await this.refreshTokenRepository.findOne({
      where: { tokenHash },
    });
    if (stored) {
      // Revoke entire family
      await this.refreshTokenRepository.update(
        { familyId: stored.familyId },
        { isRevoked: true },
      );
    }
  }

  // ========== REFRESH ==========
  async refresh(refreshToken: string): Promise<{
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

    // Revoke current token
    await this.refreshTokenRepository.update(stored.id, { isRevoked: true });

    // Issue new tokens in same family
    const user = stored.user;
    return this.generateTokens(user, false, stored.familyId);
  }

  // ========== FORGOT PASSWORD ==========
  async forgotPassword(email: string): Promise<{ message: string }> {
    const user = await this.usersService.findByEmail(email);
    if (user) {
      const resetToken = uuidv4();
      const resetExpires = new Date(Date.now() + 30 * 60 * 1000); // 30 min
      await this.usersService.update(user.id, {
        passwordResetToken: resetToken,
        passwordResetExpiresAt: resetExpires,
      });
      // TODO: Send reset email
      console.log(`[DEV] Password reset token for ${email}: ${resetToken}`);
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
  ): Promise<{ accessToken: string; refreshToken: string }> {
    return this.generateTokens(user, rememberMe);
  }

  private async generateTokens(
    user: User,
    rememberMe = false,
    familyId?: string,
  ): Promise<{ accessToken: string; refreshToken: string }> {
    const workspace =
      await this.workspacesService.findOrCreatePersonalWorkspace(
        user.id,
        user.name,
        user.email,
      );
    const role =
      (await this.workspacesService.getMemberRole(workspace.id, user.id)) ??
      'owner';

    const accessPayload = {
      sub: user.id,
      email: user.email,
      workspaceId: workspace.id,
      role,
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

    const refreshTokenEntity = this.refreshTokenRepository.create({
      userId: user.id,
      tokenHash,
      familyId: familyId ?? uuidv4(),
      expiresAt,
    });
    await this.refreshTokenRepository.save(refreshTokenEntity);

    return { accessToken, refreshToken: rawRefreshToken };
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
    return repo.findOne({ where: { passwordResetToken: token } });
  }
}
