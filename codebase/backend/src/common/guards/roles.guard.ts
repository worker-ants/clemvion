import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { WorkspacesService } from '../../modules/workspaces/workspaces.service';
import { resolveRequestWorkspaceContext } from '../utils/workspace-context.util';
import { isUuidShaped } from '../utils/uuid';
import {
  handlerConsumesWorkspaceId,
  workspaceParamNamesOf,
} from '../decorators/workspace.decorator';

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

const roleLevel = (role: string): number => ROLE_HIERARCHY[role] || 0;

const NOT_A_MEMBER = {
  code: 'NOT_A_MEMBER',
  message: '워크스페이스 멤버가 아닙니다.',
} as const;

/**
 * 멤버의 역할 미달 거부 — **라우트가 요구하는 최소 역할**의 코드다. 메시지는 서비스 계층과 같은
 * 한국어다(`workspaces.service.ts` 의 `throwAdminRequired`). `viewer` 는 멤버십과 같아 비멤버와 같은
 * 본문이다 — 멤버는 누구나 viewer 이상이라 이 자리는 DB 에 계층 밖 역할 문자열이 있을 때만 닿는다.
 */
const ROLE_REQUIRED: Record<string, { code: string; message: string }> = {
  viewer: NOT_A_MEMBER,
  editor: {
    code: 'EDITOR_REQUIRED',
    message: 'Editor 이상의 권한이 필요합니다.',
  },
  admin: { code: 'ADMIN_REQUIRED', message: 'Admin 이상의 권한이 필요합니다.' },
  owner: { code: 'OWNER_REQUIRED', message: 'Owner 권한이 필요합니다.' },
};

interface RequestWithUser {
  user?: { sub?: string; workspaceId?: string };
  headers: Record<string, string | string[] | undefined>;
  /** 라우트 경로 파라미터 — 가드는 파이프보다 먼저 돌아 **검증 전 원문**을 본다. */
  params?: Record<string, string | undefined>;
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
 * ## 경로 워크스페이스 — `@WorkspaceParam(...)` 라우트 (2026-09-25~)
 *
 * 워크스페이스를 경로 파라미터로 받는 라우트(`/workspaces/:id/...` · 전환)는 **경로 값이 인가
 * 대상**이다 — 위 header-first 모델의 예외다. 종전 가드는 이 값을 보지 않아, `@Roles('owner')` 가 붙은
 * `transferOwnership` 조차 헤더 · 토큰의 워크스페이스를 검사했다.
 *
 * - 경로 값은 토큰이 검증한 적이 없으므로 멤버십을 **매 요청 조회**한다(`@Roles()` 유무 무관).
 * - `@Roles()` 요구도 경로 워크스페이스에 대해 판정한다.
 * - 가드는 파이프보다 먼저 돌아 원문을 본다 — `isUuidShaped` 가 아니면 판정 없이 넘기고
 *   `@WorkspaceParam` 에 내장된 `ParseUUIDPipe` 가 400 을 낸다. nil UUID 처럼 형식은 맞는 값은
 *   조회해 403 이다.
 * - 헤더 컨텍스트(`@WorkspaceId()`)까지 소비하는 핸들러면 그쪽은 멤버십만 본다.
 *
 * 평범한 `@Param` 으로 워크스페이스 ID 를 받으면 이 가드가 알아보지 못한다 — 저장소 가드
 * `workspace-param-binding` 이 그 바인딩을 CI 에서 막는다. 근거: `spec/data-flow/12-workspace.md`
 * §Rationale "경로 파라미터 워크스페이스도 가드가 본다".
 *
 * ## 대상 제외 (전역 가드라 반드시 보존)
 *
 * - `@Public()` 라우트·`request.user` 부재(미인증) — 인증 판정은 `JwtAuthGuard` 소관
 * - 워크스페이스 컨텍스트가 없는 라우트 — 검증 대상이 없다
 * - **`@Roles()` · `@WorkspaceId()` · `@WorkspaceParam()` 중 어느 것도 안 쓰는 라우트** —
 *   워크스페이스와 무관한 전역 API(예: `system-status`). `handlerConsumesWorkspaceId` ·
 *   `workspaceParamNamesOf` 로 실제 소비 여부를 reflection 확인한다. 이 예외가 없으면 FE `apiClient` 가 습관적으로 모든 요청에 붙이는
 *   `X-Workspace-Id` 헤더(`lib/api/client.ts`) 때문에 워크스페이스와 무관한 엔드포인트가
 *   헤더값과 토큰 클레임이 다를 때마다 불필요하게 멤버십 재검증·403 을 받는다
 *   (2026-08-08 e2e 회귀로 실측 — `system-status.e2e-spec.ts`).
 *
 * ## 거부 코드 (2026-09-25~)
 *
 * 멤버십 · 역할 거부는 코드를 실은 `ForbiddenException`(403)이다 — 비멤버(헤더 위조 · 경로 · 부재
 * 워크스페이스를 구분하지 않는다)는 요구 역할과 무관하게 `NOT_A_MEMBER`, 멤버의 역할 미달은 요구 중
 * 가장 낮은 역할의 `EDITOR_REQUIRED` / `ADMIN_REQUIRED` / `OWNER_REQUIRED`. 종전에는 `false` 를
 * 돌려줘 전역 필터가 기본값 `FORBIDDEN` 을 채웠다 — 새 경로에만 코드를 붙이면 같은 실패가 경로에
 * 따라 다른 본문을 내므로 전 경로를 함께 바꿨다.
 *
 * `false`(코드 없음)로 남는 자리는 둘이다 — 미인증 요청이 `@Roles()` 라우트에 닿는 경우와
 * `@Roles()` 라우트에 워크스페이스 컨텍스트가 없는 경우. 앞은 `JwtAuthGuard` 가 먼저 401 을 내고
 * 뒤는 토큰이 가입 직후에도 personal 워크스페이스를 가져, 도달 경로가 없다. 근거:
 * `spec/data-flow/12-workspace.md` §Rationale "가드 거부의 오류 코드".
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly workspacesService: WorkspacesService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredRoles =
      this.reflector.getAllAndOverride<string[] | undefined>(ROLES_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) ?? [];
    const needsRoleCheck = requiredRoles.length > 0;

    const request = context.switchToHttp().getRequest<RequestWithUser>();
    const userId = request.user?.sub;

    // 미인증 — 인증 판정은 JwtAuthGuard 소관. 역할을 요구하는 라우트만 여기서 막는다.
    if (!userId) return !needsRoleCheck;

    const controllerClass = context.getClass();
    const handler = context.getHandler();
    const consumesRequestContext = handlerConsumesWorkspaceId(
      controllerClass,
      handler,
    );

    // 경로로 워크스페이스를 받는 라우트 — 인가 대상은 경로 값이다(클래스 docstring "경로 워크스페이스").
    const pathParamNames = workspaceParamNamesOf(controllerClass, handler);
    if (pathParamNames.length > 0) {
      for (const name of pathParamNames) {
        const raw = request.params?.[name];
        // 가드는 파이프보다 먼저 돈다 — 형식이 아니면 판정하지 않고 넘긴다. `@WorkspaceParam` 에
        // 내장된 `ParseUUIDPipe` 가 400 을 내고 핸들러는 돌지 않는다. 조회하면 22P02 → 500 이다.
        if (typeof raw !== 'string' || !isUuidShaped(raw)) continue;
        await this.assertMember(raw, userId, requiredRoles);
      }
      // `@Roles()` 요구는 경로 워크스페이스에 대해 판정했다. 헤더 컨텍스트까지 소비하는 핸들러면
      // 그쪽은 `@Roles()` 없는 `@WorkspaceId()` 라우트와 같게 멤버십만 본다.
      if (!consumesRequestContext) return true;
      return this.checkRequestContext(request, userId, []);
    }

    // `@Roles()` 도 `@WorkspaceId()` 도 안 쓰는 라우트는 워크스페이스와 무관한 전역 API다 —
    // 헤더가 실려 있어도 검증 대상이 없다(클래스 docstring "대상 제외" 참조).
    // `@Roles()` 라우트는 워크스페이스 컨텍스트를 파라미터로 노출하지 않고도 암묵적으로
    // (토큰의 활성 워크스페이스) 쓸 수 있으므로 이 단축 통과에서 항상 제외한다.
    if (!needsRoleCheck && !consumesRequestContext) return true;

    return this.checkRequestContext(request, userId, requiredRoles);
  }

  /** 헤더 · 토큰의 워크스페이스 컨텍스트를 검증한다. `requiredRoles` 가 비면 멤버십만 본다. */
  private async checkRequestContext(
    request: RequestWithUser,
    userId: string,
    requiredRoles: readonly string[],
  ): Promise<boolean> {
    const needsRoleCheck = requiredRoles.length > 0;
    // `WorkspaceId` 데코레이터와 공유하는 단일 헬퍼 — 두 곳이 같은 경로로 컨텍스트를
    // 계산해야 "가드가 검증한 값"과 "핸들러가 소비하는 값"이 갈라지지 않는다.
    const { workspaceId, membershipUnverified } =
      resolveRequestWorkspaceContext(
        request.headers,
        request.user?.workspaceId,
      );

    // 워크스페이스 컨텍스트 부재 — 검증 대상이 없다. `@Roles()` 라우트의 이 거부는 코드가 없다
    // (가입 직후에도 토큰이 personal 워크스페이스를 가져 도달 경로가 없다).
    if (!workspaceId) return !needsRoleCheck;

    if (!needsRoleCheck && !membershipUnverified) return true;

    await this.assertMember(workspaceId, userId, requiredRoles);
    return true;
  }

  /**
   * 멤버십과 역할 계층을 판정하고, 거부면 코드를 실어 던진다 — 비멤버는 요구 역할과 무관하게
   * `NOT_A_MEMBER`, 멤버의 역할 미달은 요구 중 **가장 낮은** 역할의 코드다(여럿 중 하나라도 충족하면
   * 통과하므로 가장 낮은 것이 실제 문턱이다).
   */
  private async assertMember(
    workspaceId: string,
    userId: string,
    requiredRoles: readonly string[],
  ): Promise<void> {
    const role = await this.workspacesService.getMemberRole(
      workspaceId,
      userId,
    );
    if (!role) throw new ForbiddenException(NOT_A_MEMBER);
    if (requiredRoles.length === 0) return;

    const threshold = requiredRoles.reduce((lowest, required) =>
      roleLevel(required) < roleLevel(lowest) ? required : lowest,
    );
    if (roleLevel(role) >= roleLevel(threshold)) return;
    throw new ForbiddenException(ROLE_REQUIRED[threshold] ?? NOT_A_MEMBER);
  }
}
