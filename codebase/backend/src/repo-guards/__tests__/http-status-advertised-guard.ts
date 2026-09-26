// 컨트롤러 핸들러의 **실제 성공 코드**가 OpenAPI 로 **광고한 성공 코드** 안에 있는지 세는 가드 — 순수 로직.
//
// 소비처는 형제 파일 `http-status-advertised.spec.ts`. 배경·근거는 그 파일 헤더에 있다.

import 'reflect-metadata';
import * as fs from 'node:fs';
import { HttpStatus } from '@nestjs/common';
import * as swagger from '@nestjs/swagger';
import * as ts from 'typescript';

import {
  decoratorCallName,
  toPosixRelative,
} from '../../common/__test-utils__/source-scan';

/** 라우트를 여는 Nest 데코레이터. `@All` 은 POST 가 아니므로 Nest 기본값 200 을 받는다. */
const HTTP_VERBS = new Set([
  'Get',
  'Post',
  'Put',
  'Patch',
  'Delete',
  'Options',
  'Head',
  'All',
]);

/** 응답 데코레이터의 이름 모양 — `@nestjs/swagger` 도 저장소 래퍼도 이 모양이다. */
const RESPONSE_DECORATOR = /^Api\w*Response$/;

/**
 * `@nestjs/swagger` 가 응답 데코레이터 메타데이터를 싣는 키(`DECORATORS.API_RESPONSE`).
 *
 * 패키지가 `dist/constants` 를 `exports` 로 열지 않아 import 할 수 없어 값을 옮겨 적었다. 키가 바뀌면
 * 아래 `swaggerResponseStatuses` 가 빈 표를 내고, spec 의 «표가 비지 않는다» 케이스가 RED 를 낸다.
 */
const SWAGGER_API_RESPONSE_METADATA = 'swagger/apiResponse';

/**
 * 응답 데코레이터 이름 → 그 데코레이터가 광고하는 상태 코드. `null` 은 «알지만 고정된 상태가 없다»
 * (`ApiDefaultResponse`)이다. 표에 **없는** `Api*Response` 이름은 스캔이 `unresolved` 로 보고한다.
 */
export type ResponseStatusMap = ReadonlyMap<string, number | null>;

/**
 * `@nestjs/swagger` 의 `Api*Response` 팩토리를 **실제로 적용해** 상태 코드를 읽는다.
 *
 * 이름 → 코드 표를 손으로 쓰지 않는 이유: 이 패키지는 `ApiPartialContentResponse`(206) ·
 * `ApiResetContentResponse`(205) 처럼 2xx 데코레이터를 50개 가까이 내보낸다. 손으로 쓴 표는 그중
 * 저장소가 지금 쓰는 것만 담게 되고, 새 이름이 쓰이는 날 그 핸들러의 광고가 조용히 빈 집합이 된다.
 * `ApiResponse` 는 인자의 `status` 로 정해지므로 표에 넣지 않는다(스캔이 따로 읽는다).
 */
export function swaggerResponseStatuses(): Map<string, number | null> {
  const out = new Map<string, number | null>();
  for (const [name, factory] of Object.entries(swagger)) {
    if (!RESPONSE_DECORATOR.test(name) || name === 'ApiResponse') continue;
    if (typeof factory !== 'function') continue;
    class Probe {
      handler(): void {}
    }
    const descriptor = Object.getOwnPropertyDescriptor(
      Probe.prototype,
      'handler',
    ) as PropertyDescriptor;
    (factory as (options: object) => MethodDecorator)({})(
      Probe.prototype,
      'handler',
      descriptor,
    );
    const keys = Object.keys(
      (Reflect.getMetadata(
        SWAGGER_API_RESPONSE_METADATA,
        descriptor.value as object,
      ) as Record<string, unknown> | undefined) ?? {},
    );
    // 키가 하나가 아니면 무엇을 광고하는지 모른다 — 표에 넣지 않아 쓰는 자리가 `unresolved` 가 된다.
    if (keys.length !== 1) continue;
    const code = Number(keys[0]);
    out.set(name, Number.isInteger(code) ? code : null);
  }
  return out;
}

/**
 * 저장소 래퍼(`common/swagger/api-wrapped.ts` 의 `ApiOkWrappedResponse` 등)를 **파싱해** 래퍼 이름 →
 * 내부에서 부르는 swagger 데코레이터의 상태 코드로 옮긴다.
 *
 * 래퍼 이름의 접두사(`ApiOk…`)를 믿지 않는다 — 이름과 달리 `ApiCreatedResponse` 를 부르는 래퍼가 생기면
 * 이름으로 판정하는 가드는 그 래퍼를 쓰는 모든 핸들러를 거꾸로 판정한다. 내부 호출이 상태 하나로
 * 모이지 않는 래퍼(0개 · 둘 이상)는 `problems` 로 돌려준다.
 */
export function wrapperResponseStatuses(
  file: string,
  base: ResponseStatusMap,
): { statuses: Map<string, number>; problems: string[] } {
  const sf = ts.createSourceFile(
    file,
    fs.readFileSync(file, 'utf8'),
    ts.ScriptTarget.Latest,
    true,
  );
  const statuses = new Map<string, number>();
  const problems: string[] = [];
  for (const stmt of sf.statements) {
    if (!ts.isFunctionDeclaration(stmt) || !stmt.name || !stmt.body) continue;
    const name = stmt.name.text;
    if (!RESPONSE_DECORATOR.test(name)) continue;
    const inner = new Set<number>();
    const visit = (node: ts.Node): void => {
      if (ts.isCallExpression(node)) {
        const code = base.get(node.expression.getText(sf));
        if (typeof code === 'number') inner.add(code);
      }
      ts.forEachChild(node, visit);
    };
    visit(stmt.body);
    if (inner.size === 1) statuses.set(name, [...inner][0]);
    else
      problems.push(
        `${name}: 내부 응답 데코레이터 상태 ${[...inner].join(',') || '없음'}`,
      );
  }
  return { statuses, problems };
}

/** 위반 한 건 — 광고가 실제 성공 코드를 담지 않는다. */
export interface HttpStatusViolation {
  /** `src` 기준 POSIX 상대경로. */
  readonly file: string;
  /** 핸들러 메서드 이름. */
  readonly method: string;
  /** HTTP 메서드(`POST` 등). */
  readonly verb: string;
  /** 실제 성공 코드 — `@HttpCode(n)` 이 있으면 n, 없으면 Nest 기본값(POST 201 · 그 외 200). */
  readonly actual: number;
  /** 광고된 성공(2xx) 코드들(오름차순). */
  readonly advertised: readonly number[];
}

/** 판정할 수 없는 자리 — 모르는 것을 통과로 치지 않고 따로 보고한다. */
export interface HttpStatusUnresolved {
  readonly file: string;
  readonly method: string;
  /** 무엇을 못 읽었나 — `@HttpCode(<식>)` · `@ApiResponse status` · 표에 없는 `@Api…Response`. */
  readonly what: string;
}

/** 한 번의 스캔 결과. */
export interface HttpStatusScan {
  readonly violations: readonly HttpStatusViolation[];
  readonly unresolved: readonly HttpStatusUnresolved[];
  /**
   * 대조한 핸들러 수 — 성공 응답을 **하나 이상 광고하는** 라우트만 센다(광고가 없으면 대조할 것이
   * 없다). vacuity floor 가 본다. 위반과 **같은 순회**에서 센다.
   */
  readonly checked: number;
}

const HTTP_CODE_UNRESOLVED = '@HttpCode(<식>)';

/**
 * `HttpStatus.X` · 숫자 리터럴을 상태 코드로 읽는다. 그 밖의 식(변수 · 계산)은 `null`.
 *
 * `HttpStatus` 이름도 손으로 옮기지 않고 **런타임 enum 에서 찾는다**.
 */
function statusOf(expr: ts.Expression, sf: ts.SourceFile): number | null {
  if (ts.isNumericLiteral(expr)) return Number(expr.text);
  if (
    ts.isPropertyAccessExpression(expr) &&
    expr.expression.getText(sf) === 'HttpStatus'
  ) {
    const code: unknown = (HttpStatus as Record<string, unknown>)[
      expr.name.text
    ];
    return typeof code === 'number' ? code : null;
  }
  return null;
}

/** `@ApiResponse({ status })` 의 status. 객체 리터럴이 아니거나 status 가 없으면 `null`. */
function apiResponseStatus(
  call: ts.CallExpression,
  sf: ts.SourceFile,
): number | null {
  const arg = call.arguments[0];
  if (!arg || !ts.isObjectLiteralExpression(arg)) return null;
  for (const prop of arg.properties) {
    if (ts.isPropertyAssignment(prop) && prop.name.getText(sf) === 'status') {
      return statusOf(prop.initializer, sf);
    }
  }
  return null;
}

const isSuccess = (code: number): boolean => code >= 200 && code < 300;

/**
 * 핸들러 **하나**를 판정한다. 라우트가 아니거나(`@Get` 등이 없음) OpenAPI 에서 빠진
 * (`@ApiExcludeEndpoint()`) 핸들러는 `null` — 광고가 문서에 실리지 않으니 대조할 것도 없다.
 */
function judgeHandler(
  method: ts.MethodDeclaration,
  sf: ts.SourceFile,
  rel: string,
  statuses: ResponseStatusMap,
): {
  violation: HttpStatusViolation | null;
  unresolved: HttpStatusUnresolved[];
  checked: boolean;
} | null {
  const name = method.name.getText(sf);
  let verb: string | null = null;
  let httpCode: number | null = null;
  let excluded = false;
  const advertised = new Set<number>();
  const unresolved: HttpStatusUnresolved[] = [];
  const miss = (what: string): void => {
    unresolved.push({ file: rel, method: name, what });
  };

  for (const d of ts.getDecorators(method) ?? []) {
    const callee = decoratorCallName(d, sf);
    if (callee === null) continue;
    const call = d.expression as ts.CallExpression;
    if (HTTP_VERBS.has(callee)) {
      verb = callee.toUpperCase();
    } else if (callee === 'HttpCode') {
      const arg = call.arguments[0];
      httpCode = arg ? statusOf(arg, sf) : null;
      if (httpCode === null) miss(HTTP_CODE_UNRESOLVED);
    } else if (callee === 'ApiExcludeEndpoint') {
      excluded = true;
    } else if (callee === 'ApiResponse') {
      const status = apiResponseStatus(call, sf);
      if (status === null) miss('@ApiResponse status');
      else if (isSuccess(status)) advertised.add(status);
    } else if (statuses.has(callee)) {
      const status = statuses.get(callee);
      if (typeof status === 'number' && isSuccess(status))
        advertised.add(status);
    } else if (RESPONSE_DECORATOR.test(callee)) {
      miss(`@${callee}`);
    }
  }

  if (verb === null || excluded) return null;
  // `@HttpCode(<식>)` 을 못 읽었으면 실제 코드를 모른다 — 위반으로도 통과로도 치지 않는다.
  const actualKnown = !unresolved.some((u) => u.what === HTTP_CODE_UNRESOLVED);
  if (!actualKnown || advertised.size === 0) {
    return { violation: null, unresolved, checked: false };
  }

  // Nest 기본값 — `RouterResponseController.getStatusByMethod`: POST 만 201, 나머지 200.
  const actual =
    httpCode ?? (verb === 'POST' ? HttpStatus.CREATED : HttpStatus.OK);
  const violation = advertised.has(actual)
    ? null
    : {
        file: rel,
        method: name,
        verb,
        actual,
        advertised: [...advertised].sort((a, b) => a - b),
      };
  return { violation, unresolved, checked: true };
}

/**
 * `*.controller.ts` 들에서 **광고한 성공 코드가 실제 성공 코드를 담지 않는** 핸들러를 찾는다.
 *
 * **`@Res()` 핸들러도 면제하지 않는다.** Nest 는 핸들러를 부르기 **전에**
 * `responseController.setStatus(res, httpStatusCode)` 를 무조건 부른다
 * (`@nestjs/core/router/router-execution-context.js`). 핸들러가 `res.status()` 를 따로 부르지 않는 한
 * `@Res()` 로 직접 쓰는 SSE 도 이 코드로 나간다 — spec 의 «근거 캐너리» 가 이 동작을 실제 요청으로 고정한다.
 *
 * @param files 스캔 대상 절대경로 목록. 호출자가 `collectTsFiles` 로 모은다.
 * @param srcRoot 보고 경로를 상대화할 기준.
 * @param statuses 응답 데코레이터 이름 → 상태 코드(`swaggerResponseStatuses` + `wrapperResponseStatuses`).
 */
export function scanHttpStatusAdvertised(
  files: readonly string[],
  srcRoot: string,
  statuses: ResponseStatusMap,
): HttpStatusScan {
  const violations: HttpStatusViolation[] = [];
  const unresolved: HttpStatusUnresolved[] = [];
  let checked = 0;
  for (const file of files) {
    if (!file.endsWith('.controller.ts')) continue;
    const sf = ts.createSourceFile(
      file,
      fs.readFileSync(file, 'utf8'),
      ts.ScriptTarget.Latest,
      true,
    );
    const rel = toPosixRelative(srcRoot, file);
    const visit = (node: ts.Node): void => {
      if (ts.isMethodDeclaration(node) && node.name) {
        const judged = judgeHandler(node, sf, rel, statuses);
        if (judged) {
          if (judged.violation) violations.push(judged.violation);
          unresolved.push(...judged.unresolved);
          if (judged.checked) checked++;
        }
      }
      ts.forEachChild(node, visit);
    };
    visit(sf);
  }
  const byPlace = (
    a: { file: string; method: string },
    b: { file: string; method: string },
  ): number => a.file.localeCompare(b.file) || a.method.localeCompare(b.method);
  return {
    violations: violations.sort(byPlace),
    unresolved: unresolved.sort(byPlace),
    checked,
  };
}
