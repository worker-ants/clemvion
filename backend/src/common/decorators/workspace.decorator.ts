import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export const WorkspaceId = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string => {
    const request = ctx.switchToHttp().getRequest();
    // Priority: X-Workspace-Id header > JWT workspaceId
    return request.headers['x-workspace-id'] || request.user?.workspaceId || '';
  },
);
