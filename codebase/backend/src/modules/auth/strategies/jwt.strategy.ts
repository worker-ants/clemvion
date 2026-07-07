import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { UsersService } from '../../users/users.service';
import { WorkspacesService } from '../../workspaces/workspaces.service';
import type { JwtPayload } from '../../../common/decorators';

/**
 * 서명된 access token 의 페이로드. 활성 워크스페이스 클레임 필드는
 * `activeWorkspaceId`(결정2 = B) 이며, 전환기 dual-read 로 legacy `workspaceId` 도 함께
 * 수용한다 — write(서명)는 `activeWorkspaceId` 만 발행한다(auth.service.generateTokens).
 */
interface JwtTokenPayload {
  sub: string;
  email: string;
  activeWorkspaceId?: string;
  workspaceId?: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    configService: ConfigService,
    private readonly usersService: UsersService,
    private readonly workspacesService: WorkspacesService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('jwt.secret') ?? 'fallback-secret',
    });
  }

  /**
   * 활성 워크스페이스는 access token 의 `activeWorkspaceId` 클레임에서 확정한다
   * (data-flow/12-workspace §1.5 · Rationale, 결정1·2). 전환기 dual-read 로 legacy
   * `workspaceId` 클레임도 수용한다. 클레임이 가리키는 워크스페이스의 멤버십을 검증해
   * 활성값·role 을 확정하며, 비멤버(탈퇴·삭제·위조)나 클레임 부재(회원가입 직후) 시
   * personal(없으면 첫 멤버십)로 graceful fallback 한다 — 이로써 request.user.workspaceId 가
   * 토큰 기반 활성 워크스페이스가 된다.
   *
   * 참고: `X-Workspace-Id` 헤더 기반 전환은 하위호환을 위해 `WorkspaceId` 데코레이터·
   * `RolesGuard` 가 여전히 우선 소비한다(헤더 present 시 header-first). 클라이언트가 헤더를
   * 떼면 위 토큰 클레임(= request.user.workspaceId)이 활성 워크스페이스의 단일 진실이 된다.
   */
  async validate(payload: JwtTokenPayload): Promise<JwtPayload> {
    const user = await this.usersService.findById(payload.sub);
    if (!user || !user.emailVerified) {
      throw new UnauthorizedException({
        code: 'TOKEN_INVALID',
        message: 'Invalid token or unverified account',
      });
    }

    // 토큰 클레임(dual-read)이 가리키는 워크스페이스의 멤버십을 검증해 활성값으로 채택.
    const claimed = payload.activeWorkspaceId ?? payload.workspaceId;
    if (claimed) {
      const role = await this.workspacesService.getMemberRole(claimed, user.id);
      if (role) {
        return { sub: user.id, email: user.email, workspaceId: claimed, role };
      }
      // 비멤버 → 아래 personal/첫 멤버십 fallback (graceful).
    }

    // fallback: personal 우선, 없으면 첫 멤버십(초대 가입자 보호) — sign 측
    // resolveTokenWorkspaceContext 와 동일 순서.
    const personal = await this.workspacesService.findPersonalWorkspace(
      user.id,
    );
    if (personal) {
      const role =
        (await this.workspacesService.getMemberRole(personal.id, user.id)) ??
        'member';
      return {
        sub: user.id,
        email: user.email,
        workspaceId: personal.id,
        role,
      };
    }

    const memberships = await this.workspacesService.listForUser(user.id);
    if (memberships.length > 0) {
      const first = memberships[0];
      return {
        sub: user.id,
        email: user.email,
        workspaceId: first.id,
        role: first.role,
      };
    }

    throw new UnauthorizedException({
      code: 'WORKSPACE_NOT_FOUND',
      message: 'No workspace found for user',
    });
  }
}
