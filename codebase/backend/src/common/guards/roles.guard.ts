import {
  CanActivate,
  ExecutionContext,
  Injectable,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { WorkspacesService } from '../../modules/workspaces/workspaces.service';

export const ROLES_KEY = 'roles';

/**
 * 라우트 핸들러에 최소 요구 역할을 표시한다.
 * 여러 역할이 주어지면 그중 하나라도 충족하면 통과.
 *
 * 사용 예: `@Roles('editor')` — Editor 이상(Editor/Admin/Owner) 허용
 */
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);

const ROLE_HIERARCHY: Record<string, number> = {
  viewer: 1,
  editor: 2,
  admin: 3,
  owner: 4,
};

interface RequestWithUser {
  user?: { sub?: string; workspaceId?: string };
  headers: Record<string, string | string[] | undefined>;
}

/**
 * 워크스페이스 컨텍스트(`X-Workspace-Id` 헤더 또는 JWT)에서 사용자의 역할을 조회해
 * 라우트의 최소 요구 역할과 비교한다.
 *
 * - `@Roles()`가 없는 라우트는 자동 통과 (default Allow).
 * - 사용자가 워크스페이스 멤버가 아니면 거부.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly workspacesService: WorkspacesService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<RequestWithUser>();
    const userId = request.user?.sub;
    if (!userId) return false;

    const headerWorkspaceId = request.headers['x-workspace-id'];
    const workspaceId =
      (Array.isArray(headerWorkspaceId)
        ? headerWorkspaceId[0]
        : headerWorkspaceId) || request.user?.workspaceId;
    if (!workspaceId) return false;

    const role = await this.workspacesService.getMemberRole(
      workspaceId,
      userId,
    );
    if (!role) return false;

    const userLevel = ROLE_HIERARCHY[role] || 0;
    return requiredRoles.some(
      (required) => userLevel >= (ROLE_HIERARCHY[required] || 0),
    );
  }
}
