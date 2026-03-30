import {
  Injectable,
  CanActivate,
  ExecutionContext,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';

export const ROLES_KEY = 'roles';
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);

const ROLE_HIERARCHY: Record<string, number> = {
  viewer: 1,
  editor: 2,
  admin: 3,
  owner: 4,
};

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const { user } = context.switchToHttp().getRequest();
    if (!user?.role) {
      return false;
    }

    const userLevel = ROLE_HIERARCHY[user.role] || 0;
    return requiredRoles.some(
      (role) => userLevel >= (ROLE_HIERARCHY[role] || 0),
    );
  }
}
