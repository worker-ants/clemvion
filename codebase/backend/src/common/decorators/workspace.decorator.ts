import {
  createParamDecorator,
  ExecutionContext,
  BadRequestException,
} from '@nestjs/common';

export const WorkspaceId = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string => {
    const request: {
      headers: Record<string, string>;
      user?: { workspaceId?: string };
    } = ctx.switchToHttp().getRequest();
    // 우선순위: X-Workspace-Id 헤더(하위호환 전환 수단) > JWT 토큰 클레임(request.user.workspaceId).
    // 헤더가 있으면 그 워크스페이스를, 없으면 토큰의 활성 워크스페이스(jwt.strategy 가
    // activeWorkspaceId dual-read 로 확정)를 사용한다 — `RolesGuard` 와 동일한 header-first 규칙이라
    // 두 곳의 워크스페이스 컨텍스트가 일관된다. 헤더 스푸핑(비멤버)은 RolesGuard 가 403 으로 차단한다.
    // 클라이언트가 헤더를 떼면 토큰 클레임이 활성 워크스페이스의 단일 진실이 된다(결정1).
    const workspaceId =
      request.headers['x-workspace-id'] || request.user?.workspaceId;
    if (!workspaceId) {
      throw new BadRequestException({
        code: 'WORKSPACE_ID_REQUIRED',
        message: 'Workspace ID is required',
      });
    }
    return workspaceId;
  },
);
