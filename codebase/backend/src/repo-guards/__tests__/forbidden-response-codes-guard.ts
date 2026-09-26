// 라우트의 `@ApiForbiddenResponse` 설명이 **가드가 낼 수 있는 거부 코드**를 전부 싣는지 세는 가드 — 순수 로직(reflection).
//
// 소비처는 형제 파일 `forbidden-response-codes.spec.ts`. 배경·근거는 그 파일 헤더에 있다.

import 'reflect-metadata';
import { METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants';

import {
  lowestRequiredRole,
  NOT_A_MEMBER,
  ROLE_REQUIRED,
  type WorkspaceRoleName,
} from '../../common/constants/workspace-roles';
import { IS_PUBLIC_KEY } from '../../common/decorators/public.decorator';
import {
  handlerConsumesWorkspaceId,
  workspaceParamNamesOf,
} from '../../common/decorators/workspace.decorator';
import { ROLES_KEY } from '../../common/guards/roles.guard';

/**
 * `@nestjs/swagger` 가 응답 · 제외 메타데이터를 싣는 키(`DECORATORS.API_RESPONSE` · `API_EXCLUDE_ENDPOINT` ·
 * `API_EXCLUDE_CONTROLLER`). 패키지가 `dist/constants` 를 `exports` 로 열지 않아 값을 옮겨 적었다 — 키가 바뀌면 403 설명이
 * 전부 «없음» 으로 읽혀 위반이 쏟아지므로 조용히 통과하지는 않는다(형제 가드 `http-status-advertised` 와 같은 사정).
 */
const SWAGGER_API_RESPONSE = 'swagger/apiResponse';
const SWAGGER_EXCLUDE_ENDPOINT = 'swagger/apiExcludeEndpoint';
const SWAGGER_EXCLUDE_CONTROLLER = 'swagger/apiExcludeController';

/** 컨트롤러 클래스 — 이름(보고용)과 프로토타입(핸들러 순회)만 쓴다. */
export interface ControllerClass {
  readonly name: string;
  readonly prototype: unknown;
}

type Handler = (...args: never[]) => unknown;

/** 라우트 핸들러 하나 — 컨트롤러 클래스와 메서드. */
export interface RouteHandler {
  readonly controller: ControllerClass;
  readonly name: string;
  readonly handler: Handler;
}

/** 위반 한 건 — 가드가 낼 수 있는데 403 설명에 없는 코드. */
export interface ForbiddenCodeViolation {
  readonly controller: string;
  readonly handler: string;
  /** 가드가 이 라우트에서 낼 수 있는 코드(순서: `NOT_A_MEMBER` 먼저). */
  readonly expected: readonly string[];
  /** 그중 설명에 없는 코드. 403 광고 자체가 없으면 `expected` 전부. */
  readonly missing: readonly string[];
  /** 403 설명(없으면 `null`). */
  readonly description: string | null;
}

/** 한 번의 판정 결과. */
export interface ForbiddenCodeScan {
  readonly violations: readonly ForbiddenCodeViolation[];
  /** 가드가 403 을 낼 수 있어 대조한 라우트 수 — vacuity floor 가 본다. 위반과 같은 순회에서 센다. */
  readonly checked: number;
}

/**
 * 파일들을 불러와 `@Controller` 클래스를 모은다. export 된 값 중 클래스 메타데이터에 `PATH_METADATA` 가 있는 것만.
 *
 * 정적 import 목록을 두지 않는 이유: 새 컨트롤러가 목록에 없으면 검사 밖으로 조용히 빠진다. 파일 스캔이 모집단을 정한다.
 */
export async function loadControllers(
  files: readonly string[],
): Promise<ControllerClass[]> {
  const out: ControllerClass[] = [];
  for (const file of files) {
    if (!file.endsWith('.controller.ts')) continue;
    const mod = (await import(file)) as Record<string, unknown>;
    for (const value of Object.values(mod)) {
      if (
        typeof value === 'function' &&
        Reflect.getMetadata(PATH_METADATA, value) !== undefined
      ) {
        out.push(value);
      }
    }
  }
  return out;
}

/** 컨트롤러들의 라우트 핸들러(`@Get` 등 — `METHOD_METADATA` 가 있는 메서드)를 모은다. */
export function collectRouteHandlers(
  controllers: readonly ControllerClass[],
): RouteHandler[] {
  const out: RouteHandler[] = [];
  for (const controller of controllers) {
    const proto = controller.prototype as Record<string, unknown>;
    for (const name of Object.getOwnPropertyNames(proto)) {
      if (name === 'constructor') continue;
      const handler = proto[name];
      if (typeof handler !== 'function') continue;
      if (Reflect.getMetadata(METHOD_METADATA, handler) === undefined) continue;
      out.push({ controller, name, handler: handler as Handler });
    }
  }
  return out;
}

/** 핸들러 우선, 없으면 클래스 — `Reflector.getAllAndOverride([handler, class])` 와 같은 순서. */
function metadataOf<T>(key: string, route: RouteHandler): T | undefined {
  return (Reflect.getMetadata(key, route.handler) ??
    Reflect.getMetadata(key, route.controller)) as T | undefined;
}

/**
 * 이 라우트에서 `RolesGuard` 가 낼 수 있는 403 코드 — `RolesGuard.canActivate` · `assertMember` 와 같은 규칙.
 *
 * | 라우트 | 코드 |
 * |---|---|
 * | `@Public()` — `JwtAuthGuard` 가 인증을 건너뛰어 `request.user` 가 없고, 가드는 멤버십을 보지 않는다 | 없음 |
 * | `@Roles()` 도 워크스페이스 소비(`@WorkspaceId()` · `@WorkspaceParam()`)도 없음 — 전역 API | 없음 |
 * | 그 밖 | `NOT_A_MEMBER` + (`@Roles()` 가 있으면) 요구 중 **가장 낮은** 역할의 코드 |
 *
 * 가장 낮은 역할이 `viewer` 면 코드가 더해지지 않는다(`ROLE_REQUIRED.viewer` 가 `NOT_A_MEMBER`). 문턱은 가드와 **같은 함수**
 * (`lowestRequiredRole`)로 고른다. 이 표 전체가 실제 가드와 같은지는 spec 의 «모델 캐너리» 가 실제 `RolesGuard` 를 돌려
 * 대조한다.
 */
export function guardRejectionCodes(route: RouteHandler): string[] {
  if (metadataOf<boolean>(IS_PUBLIC_KEY, route)) return [];
  const roles = metadataOf<string[]>(ROLES_KEY, route) ?? [];
  const consumes =
    handlerConsumesWorkspaceId(route.controller, route.handler) ||
    workspaceParamNamesOf(route.controller, route.handler).length > 0;
  if (roles.length === 0 && !consumes) return [];

  const codes = [NOT_A_MEMBER.code];
  if (roles.length > 0) {
    const threshold = lowestRequiredRole(roles);
    // 서열 밖 문자열이 문턱이면 가드는 요구를 충족한 것으로 본다(서열 0) — 역할 코드가 없다.
    const rejection = Object.hasOwn(ROLE_REQUIRED, threshold)
      ? ROLE_REQUIRED[threshold as WorkspaceRoleName]
      : undefined;
    if (rejection && !codes.includes(rejection.code))
      codes.push(rejection.code);
  }
  return codes;
}

/** OpenAPI 에서 빠진 라우트인가 — 핸들러 `@ApiExcludeEndpoint()` 또는 클래스 `@ApiExcludeController()`. */
function isExcluded(route: RouteHandler): boolean {
  return (
    Reflect.getMetadata(SWAGGER_EXCLUDE_ENDPOINT, route.handler) !==
      undefined ||
    Reflect.getMetadata(SWAGGER_EXCLUDE_CONTROLLER, route.controller) !==
      undefined
  );
}

/** 이 라우트의 403 설명 — 데코레이터가 평가된 **최종 문장**(상수 보간이 끝난 값). 없으면 `null`. */
function forbiddenDescription(route: RouteHandler): string | null {
  const responses = metadataOf<Record<string, { description?: unknown }>>(
    SWAGGER_API_RESPONSE,
    route,
  );
  const description = responses?.['403']?.description;
  return typeof description === 'string' ? description : null;
}

/**
 * 라우트마다 가드 코드를 계산해 403 설명과 대조한다. OpenAPI 에서 빠진 라우트는 광고가 없으니 묻지 않는다.
 *
 * **포함 여부는 부분 문자열로 본다** — 설명 속 `NOT_A_MEMBER` 라는 글자가 있으면 싣은 것이다. 설명 형식(괄호 · 구두점)은 이
 * 가드가 강제하지 않는다 — 형식은 공용 헬퍼(`common/swagger` `forbiddenForRole`)가 맡는다.
 */
export function scanForbiddenResponseCodes(
  routes: readonly RouteHandler[],
): ForbiddenCodeScan {
  const violations: ForbiddenCodeViolation[] = [];
  let checked = 0;
  for (const route of routes) {
    if (isExcluded(route)) continue;
    const expected = guardRejectionCodes(route);
    if (expected.length === 0) continue;
    checked++;
    const description = forbiddenDescription(route);
    const missing = expected.filter(
      (code) => description === null || !description.includes(code),
    );
    if (missing.length > 0) {
      violations.push({
        controller: route.controller.name,
        handler: route.name,
        expected,
        missing,
        description,
      });
    }
  }
  return {
    violations: violations.sort(
      (a, b) =>
        a.controller.localeCompare(b.controller) ||
        a.handler.localeCompare(b.handler),
    ),
    checked,
  };
}
