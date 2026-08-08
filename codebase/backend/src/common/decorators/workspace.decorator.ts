import {
  createParamDecorator,
  ExecutionContext,
  BadRequestException,
} from '@nestjs/common';
import { resolveWorkspaceContext } from '../utils/workspace-context.util';

export const WorkspaceId = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string => {
    const request: {
      headers: Record<string, string | string[] | undefined>;
      user?: { workspaceId?: string };
    } = ctx.switchToHttp().getRequest();
    // 우선순위: X-Workspace-Id 헤더(하위호환 전환 수단) > JWT 토큰 클레임(request.user.workspaceId).
    // 헤더가 있으면 그 워크스페이스를, 없으면 토큰의 활성 워크스페이스(jwt.strategy 가
    // activeWorkspaceId dual-read 로 확정)를 사용한다 — `resolveWorkspaceContext` 공용 헬퍼로
    // `RolesGuard` 와 동일한 header-first 규칙(+ 중복 헤더 정규화)을 적용하므로 두 곳의
    // 워크스페이스 컨텍스트 계산이 항상 일치한다.
    // 헤더 스푸핑(비멤버)은 `RolesGuard` 가 403 으로 차단한다 — 이 라우트에 `@Roles()` 가
    // 붙어 있는지와 **무관하게 항상**이다. `RolesGuard` 는 헤더가 토큰 확정값을 덮어쓸 때마다
    // (= 이 데코레이터가 헤더값을 반환할 때마다) 멤버십을 재검증한다(자세한 근거는
    // `roles.guard.ts` docstring "두 검사는 독립이다" 참조). 즉 이 데코레이터가 반환하는 값을
    // 핸들러가 소비하기 **이전에** 이미 멤버십이 확정돼 있다.
    // 클라이언트가 헤더를 떼면 토큰 클레임이 활성 워크스페이스의 단일 진실이 된다(결정1).
    const { workspaceId } = resolveWorkspaceContext(
      request.headers,
      request.user?.workspaceId,
    );
    if (!workspaceId) {
      throw new BadRequestException({
        code: 'WORKSPACE_ID_REQUIRED',
        message: 'Workspace ID is required',
      });
    }
    return workspaceId;
  },
);
