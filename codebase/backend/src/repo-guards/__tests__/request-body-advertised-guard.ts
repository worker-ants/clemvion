// 라우트의 요청 본문(`@Body()`)이 OpenAPI 에 스키마로 광고되는지 세는 가드 — 순수 로직(reflection).
//
// 소비처는 형제 파일 `request-body-advertised.spec.ts`. 배경·근거는 그 파일 헤더에 있다.

import 'reflect-metadata';

import { UNVALIDATED_METATYPES } from '../../common/pipes/validation.pipe';
import { bodyArgIndexes } from '../../shared/testing/swagger-probe';
import type { RouteHandler } from './forbidden-response-codes-guard';

/**
 * `@nestjs/swagger` 가 파라미터 · 제외 메타데이터를 싣는 키(`DECORATORS.API_PARAMETERS` · `API_EXCLUDE_ENDPOINT` ·
 * `API_EXCLUDE_CONTROLLER`). 패키지가 `dist/constants` 를 `exports` 로 열지 않아 값을 옮겨 적었다 — 키가 바뀌면 `@ApiBody` 가
 * 전부 «없음» 으로 읽혀 인라인 본문이 위반으로 쏟아지므로 조용히 통과하지는 않는다(형제 가드와 같은 사정).
 */
const SWAGGER_API_PARAMETERS = 'swagger/apiParameters';
const SWAGGER_EXCLUDE_ENDPOINT = 'swagger/apiExcludeEndpoint';
const SWAGGER_EXCLUDE_CONTROLLER = 'swagger/apiExcludeController';

/** 위반 한 건 — `@Body()` 자리의 설계 타입이 클래스가 아닌데 `@ApiBody` 가 없다. */
export interface RequestBodyViolation {
  readonly controller: string;
  readonly handler: string;
  /** 그 자리의 설계 타입 이름(`Object` · `String` …). emit 되지 않았으면 `(없음)`. */
  readonly designType: string;
}

/** 한 번의 판정 결과. */
export interface RequestBodyScan {
  readonly violations: readonly RequestBodyViolation[];
  /** 대조한 `@Body()` 자리 수 — vacuity floor 가 본다. 위반과 같은 순회에서 센다. */
  readonly checked: number;
  /** 그중 설계 타입이 클래스가 아닌 자리 — 판정 분기가 실제 코드에서 도는지 floor 가 본다. */
  readonly unschematized: number;
}

/**
 * 이 설계 타입이면 전역 `CustomValidationPipe` 가 검증을 건너뛰고(`toValidate`), 플러그인도 스키마를 만들지 못한다. 목록은 파이프가
 * export 하는 **그 상수**를 쓴다 — 옮겨 적으면 둘이 갈리는 날 가드가 파이프가 보지 않는 타입을 묻거나 보는 타입을 놓친다. 설계 타입이
 * emit 되지 않은 자리(`undefined`)도 파이프가 건너뛴다(`!metatype`).
 */
function isUnschematized(designType: unknown): boolean {
  return (
    designType === undefined ||
    (UNVALIDATED_METATYPES as readonly unknown[]).includes(designType)
  );
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

/** 핸들러에 `@ApiBody` 가 있는가 — swagger 파라미터 메타데이터의 `in: 'body'`. */
function advertisesBody(route: RouteHandler): boolean {
  const params = Reflect.getMetadata(SWAGGER_API_PARAMETERS, route.handler) as
    ReadonlyArray<{ in?: unknown }> | undefined;
  return (params ?? []).some((p) => p.in === 'body');
}

/**
 * 라우트마다 `@Body()` 자리의 설계 타입을 보고, 클래스가 아닌데 `@ApiBody` 가 없는 자리를 모은다. OpenAPI 에서 빠진 라우트는 묻지
 * 않는다.
 *
 * `@ApiBody` 가 **맞는** DTO 를 가리키는지는 보지 않는다 — 광고의 존재만 센다. 그 짝은 라우트별 캐너리(`*-body.spec.ts`)가 본다.
 */
export function scanRequestBodyAdvertised(
  routes: readonly RouteHandler[],
): RequestBodyScan {
  const violations: RequestBodyViolation[] = [];
  let checked = 0;
  let unschematized = 0;
  for (const route of routes) {
    if (isExcluded(route)) continue;
    const indexes = bodyArgIndexes(route.controller, route.name);
    if (indexes.length === 0) continue;
    const types = Reflect.getMetadata(
      'design:paramtypes',
      route.controller.prototype as object,
      route.name,
    ) as unknown[] | undefined;
    for (const index of indexes) {
      checked++;
      const designType = types?.[index];
      if (!isUnschematized(designType)) continue;
      unschematized++;
      if (advertisesBody(route)) continue;
      violations.push({
        controller: route.controller.name,
        handler: route.name,
        designType:
          typeof designType === 'function' ? designType.name : '(없음)',
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
    unschematized,
  };
}
