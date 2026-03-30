import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { UsersService } from '../../users/users.service';
import { WorkspacesService } from '../../workspaces/workspaces.service';
import type { JwtPayload } from '../../../common/decorators';

interface JwtTokenPayload {
  sub: string;
  email: string;
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

  async validate(payload: JwtTokenPayload): Promise<JwtPayload> {
    const user = await this.usersService.findById(payload.sub);
    if (!user || !user.emailVerified) {
      throw new UnauthorizedException({
        code: 'TOKEN_INVALID',
        message: 'Invalid token or unverified account',
      });
    }

    // Find personal workspace for Phase 1
    const workspace = await this.workspacesService.findPersonalWorkspace(
      user.id,
    );
    const role = workspace
      ? ((await this.workspacesService.getMemberRole(workspace.id, user.id)) ??
        'owner')
      : 'owner';

    return {
      sub: user.id,
      email: user.email,
      workspaceId: workspace?.id ?? '',
      role,
    };
  }
}
