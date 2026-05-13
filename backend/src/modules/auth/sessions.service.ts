import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { MoreThan, Not, Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { createHash } from 'crypto';
import { RefreshToken } from './entities/refresh-token.entity';
import { UsersService } from '../users/users.service';
import { TotpService } from './totp.service';
import { LoginHistoryService } from './login-history.service';
import { RevokeSessionDto } from './dto/requests/revoke-session.dto';
import { SessionDto } from './dto/responses/session.dto';
import { deriveDeviceLabel } from './utils/device-label';
import type { AuthContext } from './types/auth-context';

@Injectable()
export class SessionsService {
  constructor(
    @InjectRepository(RefreshToken)
    private readonly refreshTokenRepository: Repository<RefreshToken>,
    private readonly usersService: UsersService,
    private readonly totpService: TotpService,
    private readonly loginHistory: LoginHistoryService,
  ) {}

  /**
   * 사용자의 활성 세션을 family 단위로 묶어 반환한다.
   * 같은 family 의 가장 최근 row 메타데이터를 노출한다.
   */
  async listActiveSessions(
    userId: string,
    currentRefreshToken: string | null,
  ): Promise<SessionDto[]> {
    const [rows, currentFamilyId] = await Promise.all([
      this.refreshTokenRepository.find({
        where: {
          userId,
          isRevoked: false,
          expiresAt: MoreThan(new Date()),
        },
        order: { createdAt: 'DESC' },
      }),
      currentRefreshToken !== null
        ? this.resolveCurrentFamilyId(currentRefreshToken)
        : Promise.resolve<string | null>(null),
    ]);

    const grouped = new Map<string, RefreshToken>();
    for (const row of rows) {
      const existing = grouped.get(row.familyId);
      if (!existing) {
        grouped.set(row.familyId, row);
        continue;
      }
      grouped.set(row.familyId, pickNewer(row, existing));
    }

    return Array.from(grouped.values()).map((row) =>
      this.toDto(row, currentFamilyId),
    );
  }

  /**
   * 단일 세션(family) 강제 종료. 본인 인증 필수.
   *
   * `currentRefreshToken` 이 주어지면 self-revoke 시도를 API 레벨에서 차단한다.
   * (현재 세션은 /auth/logout 으로 종료해야 한다.)
   */
  async revokeFamily(
    userId: string,
    familyId: string,
    auth: RevokeSessionDto,
    ctx: AuthContext,
    currentRefreshToken: string | null,
  ): Promise<void> {
    const owned = await this.refreshTokenRepository.findOne({
      where: { userId, familyId },
    });
    if (!owned) {
      // 정보 누출 방지: 타인의 family 든 없는 family 든 동일하게 404
      throw new NotFoundException({
        code: 'SESSION_NOT_FOUND',
        message: '해당 세션을 찾을 수 없어요.',
      });
    }

    if (currentRefreshToken) {
      const currentFamilyId =
        await this.resolveCurrentFamilyId(currentRefreshToken);
      if (currentFamilyId && currentFamilyId === familyId) {
        throw new BadRequestException({
          code: 'CANNOT_REVOKE_CURRENT_SESSION',
          message:
            '현재 세션은 강제 종료할 수 없어요. 로그아웃 버튼을 이용해 주세요.',
        });
      }
    }

    const user = await this.usersService.findById(userId);
    if (!user) {
      throw new UnauthorizedException({ code: 'UNAUTHENTICATED' });
    }
    await this.verifyReauth(user, auth);

    await this.refreshTokenRepository.update(
      { userId, familyId },
      { isRevoked: true },
    );

    await this.loginHistory.record({
      userId,
      email: user.email,
      event: 'session_revoked',
      ip: ctx.ip ?? null,
      userAgent: ctx.userAgent ?? null,
      familyId,
    });
  }

  /**
   * 현재 세션을 제외한 모든 활성 세션을 종료한다.
   */
  async revokeOtherFamilies(
    userId: string,
    currentRefreshToken: string,
    auth: RevokeSessionDto,
    ctx: AuthContext,
  ): Promise<{ revoked: number }> {
    const user = await this.usersService.findById(userId);
    if (!user) {
      throw new UnauthorizedException({ code: 'UNAUTHENTICATED' });
    }
    await this.verifyReauth(user, auth);

    const currentFamilyId =
      await this.resolveCurrentFamilyId(currentRefreshToken);
    if (!currentFamilyId) {
      throw new BadRequestException({
        code: 'CURRENT_SESSION_REQUIRED',
        message: '현재 세션을 식별할 수 없어요. 다시 로그인 후 시도해 주세요.',
      });
    }

    const result = await this.refreshTokenRepository.update(
      {
        userId,
        isRevoked: false,
        familyId: Not(currentFamilyId),
      },
      { isRevoked: true },
    );

    const revoked = result.affected ?? 0;
    if (revoked > 0) {
      // bulk revoke 는 단일 familyId 가 없으므로 familyId=null 로 기록.
      // failureReason 은 "실패 원인" 의미라 성공 이벤트엔 사용하지 않는다.
      await this.loginHistory.record({
        userId,
        email: user.email,
        event: 'session_revoked',
        ip: ctx.ip ?? null,
        userAgent: ctx.userAgent ?? null,
        familyId: null,
      });
    }
    return { revoked };
  }

  /**
   * 사용자 유형별 본인 재인증.
   *
   * 우선순위 (위에서부터 매치):
   *   1) `passwordHash` 보유 + `password` 입력 → bcrypt 검증
   *   2) `twoFactorEnabled` + `totpCode` 입력 → TOTP 검증
   *   3) 둘 다 가진 사용자는 1 → 2 순으로 한 가지만 통과해도 된다
   *   4) 어느 자격증명도 없거나 미입력 → `REAUTH_REQUIRED`
   *
   * `passwordHash` 도 2FA 도 없는 OAuth-only 사용자는 `REAUTH_NOT_AVAILABLE`
   * 로 차단한다. 본 사용자는 먼저 2FA 활성화 또는 비밀번호 설정이 필요.
   */
  private async verifyReauth(
    user: {
      id: string;
      passwordHash: string | null;
      twoFactorEnabled: boolean;
    },
    auth: RevokeSessionDto,
  ): Promise<void> {
    const hasPassword = !!user.passwordHash;
    const has2fa = user.twoFactorEnabled;

    if (!hasPassword && !has2fa) {
      throw new ForbiddenException({
        code: 'REAUTH_NOT_AVAILABLE',
        message:
          '이 작업을 수행하려면 먼저 비밀번호 설정 또는 2FA 활성화가 필요해요.',
      });
    }

    if (hasPassword && auth.password) {
      const ok = await bcrypt.compare(auth.password, user.passwordHash!);
      if (ok) return;
      throw new UnauthorizedException({
        code: 'PASSWORD_INVALID',
        message: '비밀번호가 일치하지 않아요.',
      });
    }

    if (has2fa && auth.totpCode) {
      const userFull = await this.usersService.findById(user.id);
      if (!userFull) {
        throw new UnauthorizedException({ code: 'UNAUTHENTICATED' });
      }
      const ok = await this.totpService.verifyForLogin(userFull, auth.totpCode);
      if (ok) return;
      throw new UnauthorizedException({
        code: 'TOTP_INVALID',
        message: '인증 코드가 올바르지 않아요.',
      });
    }

    throw new BadRequestException({
      code: 'REAUTH_REQUIRED',
      message: hasPassword
        ? '비밀번호 확인이 필요해요.'
        : '2FA 코드 입력이 필요해요.',
    });
  }

  private async resolveCurrentFamilyId(
    refreshToken: string,
  ): Promise<string | null> {
    if (!refreshToken) return null;
    const hash = createHash('sha256').update(refreshToken).digest('hex');
    const row = await this.refreshTokenRepository.findOne({
      where: { tokenHash: hash, isRevoked: false },
    });
    return row?.familyId ?? null;
  }

  private toDto(row: RefreshToken, currentFamilyId: string | null): SessionDto {
    return {
      familyId: row.familyId,
      deviceLabel: row.deviceLabel ?? deriveDeviceLabel(row.userAgent),
      ipAddress: row.lastUsedIp ?? row.ipAddress,
      lastUsedAt: row.lastUsedAt ? row.lastUsedAt.toISOString() : null,
      createdAt: row.createdAt.toISOString(),
      expiresAt: row.expiresAt.toISOString(),
      isCurrent: currentFamilyId !== null && row.familyId === currentFamilyId,
    };
  }
}

function pickNewer(a: RefreshToken, b: RefreshToken): RefreshToken {
  const ta = (a.lastUsedAt ?? a.createdAt).getTime();
  const tb = (b.lastUsedAt ?? b.createdAt).getTime();
  return ta >= tb ? a : b;
}
