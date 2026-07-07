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
    // 활성 워크스페이스의 단일 진실은 토큰 클레임이다(결정1, data-flow/12-workspace §1.5).
    // jwt.strategy 가 activeWorkspaceId → X-Workspace-Id 헤더 → legacy workspaceId → personal
    // 순서로 이미 request.user.workspaceId 를 확정한다. 헤더는 그 안에서 fallback 으로만
    // 소비되므로 여기서는 토큰 우선(user.workspaceId), 인증 전 컨텍스트에서만 헤더로 보조.
    const workspaceId =
      request.user?.workspaceId || request.headers['x-workspace-id'];
    if (!workspaceId) {
      throw new BadRequestException({
        code: 'WORKSPACE_ID_REQUIRED',
        message: 'Workspace ID is required',
      });
    }
    return workspaceId;
  },
);
