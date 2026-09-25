import {
  createParamDecorator,
  ExecutionContext,
  BadRequestException,
  ParseUUIDPipe,
} from '@nestjs/common';
import { ROUTE_ARGS_METADATA } from '@nestjs/common/constants';
import { resolveRequestWorkspaceContext } from '../utils/workspace-context.util';

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
  // activeWorkspaceId dual-read 로 확정)를 사용한다 — `resolveRequestWorkspaceContext` 공용 헬퍼로
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
  const { workspaceId } = resolveRequestWorkspaceContext(
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

/**
 * `@WorkspaceParam()` 의 실제 파라미터 팩토리 — `extractWorkspaceId` 와 같은 이유로 이름을 붙여
 * top-level 에 둔다(`workspaceParamNamesOf` 가 identity 로 비교한다).
 */
function extractWorkspaceParam(
  name: unknown,
  ctx: ExecutionContext,
): string | undefined {
  const request: { params?: Record<string, string | undefined> } = ctx
    .switchToHttp()
    .getRequest();
  return typeof name === 'string' ? request.params?.[name] : undefined;
}

const workspaceParamDecorator = createParamDecorator(extractWorkspaceParam);

/**
 * 워크스페이스 ID 를 **경로 파라미터**로 받는 바인딩 — `@Param('<name>', ParseUUIDPipe)` 자리에 쓴다.
 *
 * `RolesGuard` 는 이 팩토리를 `ROUTE_ARGS_METADATA` 에서 identity 로 찾아 **등록 이름의 경로 값**을
 * 인가 대상으로 쓴다(`workspaceParamNamesOf`). 경로 값은 토큰이 검증한 적이 없으므로 가드가 멤버십을
 * 매 요청 조회하고, `@Roles()` 요구도 그 워크스페이스에 대해 판정한다 — 헤더 · 토큰의 워크스페이스가
 * 아니다. 근거: `spec/data-flow/12-workspace.md` §Rationale "경로 파라미터 워크스페이스도 가드가 본다".
 *
 * `ParseUUIDPipe` 를 **내장**한다. 가드는 파이프보다 먼저 돌아 원문을 보므로 형식이 아닌 값은 판정 없이
 * 넘기는데, 그 값을 400 으로 끊는 것이 이 파이프다 — 호출부가 따로 적게 두면 빠뜨린 자리에서 형식 파손
 * 값이 서비스까지 흐른다.
 *
 * 평범한 `@Param` 으로 워크스페이스 ID 를 받으면 가드가 알아보지 못한다 — 그 모양은 저장소 가드
 * `workspace-param-binding` 이 CI 에서 막는다.
 */
export const WorkspaceParam = (name: string): ParameterDecorator =>
  workspaceParamDecorator(name, new ParseUUIDPipe());

/**
 * 핸들러가 `@WorkspaceParam(...)` 으로 받는 경로 파라미터 이름들. 없으면 빈 배열.
 *
 * `handlerConsumesWorkspaceId` 와 같은 reflection 이다 — 같은 `ROUTE_ARGS_METADATA` 를 같은
 * `Function.name` 키로 읽고, 팩토리만 다르다. 부트 캐너리(`workspace-reflection-canary.ts`)가 두
 * 판별을 함께 세는 이유다.
 */
export function workspaceParamNamesOf(
  controllerClass: object,
  handler: Function, // eslint-disable-line @typescript-eslint/no-unsafe-function-type
): string[] {
  const methodName = handler.name;
  if (!methodName) return [];
  const argsMetadata = Reflect.getMetadata(
    ROUTE_ARGS_METADATA,
    controllerClass,
    methodName,
  ) as Record<string, { factory?: unknown; data?: unknown }> | undefined;
  if (!argsMetadata) return [];
  return Object.values(argsMetadata)
    .filter((entry) => entry?.factory === extractWorkspaceParam)
    .map((entry) => entry.data)
    .filter((data): data is string => typeof data === 'string');
}
