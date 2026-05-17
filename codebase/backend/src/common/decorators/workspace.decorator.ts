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
    // Priority: X-Workspace-Id header > JWT workspaceId
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
