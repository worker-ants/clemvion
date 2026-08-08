import {
  createParamDecorator,
  ExecutionContext,
  BadRequestException,
} from '@nestjs/common';
import { ROUTE_ARGS_METADATA } from '@nestjs/common/constants';
import { resolveWorkspaceContext } from '../utils/workspace-context.util';

/**
 * `@WorkspaceId()` 의 실제 파라미터 팩토리. 이름을 붙여 모듈 top-level 로 뺀 이유는
 * 아래 `handlerConsumesWorkspaceId` 가 `ROUTE_ARGS_METADATA` 에 저장된 `factory` 참조와
 * **동일 함수 identity** 로 비교해야 하기 때문이다 — `createParamDecorator` 에 인라인
 * 화살표 함수를 넘기면 그 참조를 재사용할 방법이 없다.
 */
function extractWorkspaceId(_data: unknown, ctx: ExecutionContext): string {
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
  // 붙어 있는지와 **무관하게 항상**이다(단, 이 데코레이터가 실제로 붙은 라우트에 한한다 —
  // `@Roles()`·`@WorkspaceId()` 둘 다 없는 라우트는 `RolesGuard` 가 애초에 검사하지 않는다,
  // `handlerConsumesWorkspaceId` 참조). `RolesGuard` 는 헤더가 토큰 확정값을 덮어쓸 때마다
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
}

export const WorkspaceId = createParamDecorator(extractWorkspaceId);

/**
 * `RolesGuard` 가 "이 핸들러가 `@WorkspaceId()` 를 실제로 소비하는가" 를 판별할 때 쓴다.
 *
 * 배경(2026-08-08 e2e WARNING — `system-status.e2e-spec.ts` 회귀): `RolesGuard` 는 전역
 * `APP_GUARD` 라 라우트가 `@WorkspaceId()` 를 쓰든 말든 요청에 `X-Workspace-Id` 헤더가
 * 실리면 무조건 읽었다. FE `apiClient` 는 이 헤더를 **모든** 요청에 습관적으로 붙이므로
 * (`lib/api/client.ts`), 워크스페이스와 무관한 전역 API(`system-status` 등)에도 헤더가
 * 실리고, 헤더가 토큰 클레임과 다르면 `RolesGuard` 가 불필요하게 멤버십을 재검증해 403 을
 * 낼 수 있었다 — plan 의 "워크스페이스 컨텍스트가 없는 라우트는 종전대로 통과" 불변식 위반.
 * `ROUTE_ARGS_METADATA` 에 등록된 파라미터 팩토리를 이 함수와 identity 비교해, 실제로
 * `@WorkspaceId()` 를 쓰는 라우트만 워크스페이스 컨텍스트를 평가하도록 좁힌다 — 사람이
 * 추가로 기억해야 하는 별도 데코레이터(opt-in 재도입)가 아니라 기존 사용 여부의 reflection 이다.
 */
export function handlerConsumesWorkspaceId(
  // `ExecutionContext.getClass()` / `.getHandler()` 는 각각 `Type<unknown>` / `Function`
  // 을 반환한다(Nest 코어 시그니처) — 좁은 함수 타입을 받으면 `context.getHandler()` 를
  // 그대로 넘길 때 tsc 가 거부한다(빌드에서만 드러남, eslint 단독으론 미검출 — 2026-08-08
  // e2e 실측).
  controllerClass: object,
  handler: Function, // eslint-disable-line @typescript-eslint/no-unsafe-function-type
): boolean {
  const methodName = handler.name;
  if (!methodName) return false;
  const argsMetadata = Reflect.getMetadata(
    ROUTE_ARGS_METADATA,
    controllerClass,
    methodName,
  ) as Record<string, { factory?: unknown }> | undefined;
  if (!argsMetadata) return false;
  return Object.values(argsMetadata).some(
    (entry) => entry?.factory === extractWorkspaceId,
  );
}
