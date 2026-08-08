import {
  CanActivate,
  ExecutionContext,
  Injectable,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { WorkspacesService } from '../../modules/workspaces/workspaces.service';
import { resolveWorkspaceContext } from '../utils/workspace-context.util';

export const ROLES_KEY = 'roles';

/**
 * 라우트 핸들러에 최소 요구 역할을 표시한다.
 * 여러 역할이 주어지면 그중 하나라도 충족하면 통과.
 *
 * 사용 예: `@Roles('editor')` — Editor 이상(Editor/Admin/Owner) 허용
 *
 * **역할 계층 비교만** 통제한다. 워크스페이스 멤버십 검증은 이 데코레이터와 무관하게
 * 항상 수행되므로, "조회 엔드포인트라 `@Roles()` 를 안 붙였다" 가 멤버십 우회로
 * 이어지지 않는다 (아래 `RolesGuard` 주석 참조).
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
 * 워크스페이스 컨텍스트에서 사용자의 멤버십·역할을 검증한다.
 * `APP_GUARD` 로 전역 등록되어 모든 라우트를 통과한다 (`app.module.ts`).
 *
 * ## 두 검사는 독립이다
 *
 * - **멤버십 검사** — 라우트의 `@Roles()` 유무와 **무관하게** 수행한다.
 * - **역할 계층 검사** — `@Roles()` 가 있을 때만 수행한다.
 *
 * 종전에는 `requiredRoles` 가 비면 멤버십 조회 **이전에** `return true` 했다. 그 결과
 * `@Roles()` 없이 `@WorkspaceId()` 를 쓰는 라우트(2026-08-08 실측 222건 중 73건)에서
 * 인증된 사용자가 `X-Workspace-Id` 헤더만 위조해 타 워크스페이스 리소스에 접근할 수
 * 있었다(cross-tenant). 멤버십을 데코레이터에서 분리해 이 클래스를 구조적으로 닫는다 —
 * 라우트마다 사람이 데코레이터를 기억하는 opt-in 모델은 이미 최소 2회 누락됐다.
 * 근거·전수 목록: `spec/data-flow/12-workspace.md` §Rationale "멤버십 검증은 가드
 * 1곳에서 — `@Roles()` 와 무관".
 *
 * ## DB 왕복은 두 이유 중 하나로 발생한다 (OR 조건)
 *
 * 워크스페이스 컨텍스트는 **header-first** 다 — `X-Workspace-Id` 가 있으면 그 값,
 * 없으면 `request.user.workspaceId`(토큰 클레임). 후자는 `jwt.strategy` 가 **이미
 * 멤버십을 검증해** 채운 값이므로 그 자체로는 재조회가 불요하다.
 *
 * 그럼에도 `getMemberRole` 조회는 다음 **둘 중 하나만 참이어도** 실행된다:
 *
 * 1. **멤버십 재검증** — 헤더가 토큰 확정값을 덮어쓸 때(`membershipUnverified`)만.
 *    `@Roles()` 유무와 무관하다.
 * 2. **역할 계층 비교** — `@Roles()` 가 있는 라우트는 헤더 유무와 무관하게 **항상**.
 *    역할 문자열 자체가 DB 조회 없이는 알 수 없기 때문이다.
 *
 * 따라서 "헤더가 없으면 DB 를 왕복하지 않는다" 는 `@Roles()` 없는 라우트에서만 참이다
 * — `@Roles()` 라우트는 헤더 부재에도 이유 2 로 매 요청 조회한다.
 *
 * 이는 header-first 를 유지한다 — 기각된 token-first(헤더 완전 무시)로의 회귀가
 * 아니다 (`12-workspace.md` §Rationale "URL slug = FE 라우팅 SoT").
 *
 * ## 대상 제외 (전역 가드라 반드시 보존)
 *
 * - `@Public()` 라우트·`request.user` 부재(미인증) — 인증 판정은 `JwtAuthGuard` 소관
 * - 워크스페이스 컨텍스트가 없는 라우트 — 검증 대상이 없다
 *
 * 거부는 `false` 반환(= Nest 기본 `ForbiddenException`, 403)이다. 전용 error code 를
 * 붙이지 않는 이유: `@Roles()` 라우트의 비멤버 거부도 종전부터 코드 없는 403 이라,
 * 새 경로에만 코드를 붙이면 **동일한 실패가 `@Roles()` 유무에 따라 다른 body** 를
 * 내게 된다. 가드 거부에 코드를 부여하려면 전 경로를 함께 바꿔야 한다(별도 작업).
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
    const needsRoleCheck = !!requiredRoles && requiredRoles.length > 0;

    const request = context.switchToHttp().getRequest<RequestWithUser>();
    const userId = request.user?.sub;

    // 미인증 — 인증 판정은 JwtAuthGuard 소관. 역할을 요구하는 라우트만 여기서 막는다.
    if (!userId) return !needsRoleCheck;

    // `WorkspaceId` 데코레이터와 공유하는 단일 헬퍼 — 두 곳이 같은 경로로 컨텍스트를
    // 계산해야 "가드가 검증한 값"과 "핸들러가 소비하는 값"이 갈라지지 않는다.
    const { workspaceId, membershipUnverified } = resolveWorkspaceContext(
      request.headers,
      request.user?.workspaceId,
    );

    // 워크스페이스 컨텍스트 부재 — 검증 대상이 없다.
    if (!workspaceId) return !needsRoleCheck;

    if (!needsRoleCheck && !membershipUnverified) return true;

    const role = await this.workspacesService.getMemberRole(
      workspaceId,
      userId,
    );
    // 비멤버 — @Roles() 유무와 무관하게 차단한다.
    if (!role) return false;

    if (!needsRoleCheck) return true;

    const userLevel = ROLE_HIERARCHY[role] || 0;
    return requiredRoles.some(
      (required) => userLevel >= (ROLE_HIERARCHY[required] || 0),
    );
  }
}
