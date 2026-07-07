import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import type { Request } from 'express';
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
      // 활성 워크스페이스 결정에 X-Workspace-Id 헤더(rollout fallback)를 참조하기 위해
      // request 를 콜백에 전달한다 — 멤버십 검증을 인증 진입점 1곳(본 전략)으로 수렴.
      passReqToCallback: true,
    });
  }

  /**
   * 활성 워크스페이스의 단일 진실은 토큰 클레임이다(data-flow/12-workspace §1.5 · Rationale).
   * 우선순위(결정1·2, 2026-07-07):
   *   activeWorkspaceId(신규 클레임) → X-Workspace-Id 헤더(rollout fallback) →
   *   legacy workspaceId(전환기 dual-read) → personal → 첫 멤버십.
   * 지정된 워크스페이스의 멤버십을 검증해 활성값·role 을 확정한다 — 비멤버(탈퇴·삭제·위조)나
   * 클레임 부재(legacy·회원가입 직후) 시 personal(없으면 첫 멤버십)로 graceful fallback.
   */
  async validate(req: Request, payload: JwtTokenPayload): Promise<JwtPayload> {
    const user = await this.usersService.findById(payload.sub);
    if (!user || !user.emailVerified) {
      throw new UnauthorizedException({
        code: 'TOKEN_INVALID',
        message: 'Invalid token or unverified account',
      });
    }

    const rawHeader = req.headers?.['x-workspace-id'];
    const headerWorkspaceId = Array.isArray(rawHeader)
      ? rawHeader[0]
      : rawHeader;
    const claimed =
      payload.activeWorkspaceId ?? headerWorkspaceId ?? payload.workspaceId;

    // 토큰(또는 rollout 헤더)이 가리키는 워크스페이스의 멤버십을 검증해 활성값으로 채택.
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
