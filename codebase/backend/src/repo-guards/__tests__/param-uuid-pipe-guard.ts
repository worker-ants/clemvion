// 컨트롤러의 **id-형 경로 파라미터**가 UUID 계약 두 축을 다 갖췄는지 세는 가드 — 순수 로직.
//
// 소비처는 형제 파일 `param-uuid-pipe.spec.ts`. 배경·근거는 그 파일 헤더에 있다.

import * as fs from 'node:fs';
import * as ts from 'typescript';

import { toPosixRelative } from '../../common/__test-utils__/source-scan';

/** 위반 한 건 — 어느 축이 빠졌는지까지 싣는다. */
export interface UuidParamViolation {
  /** `src` 기준 POSIX 상대경로. */
  readonly file: string;
  /** 핸들러 메서드 이름 — 줄 번호를 쓰지 않는 이유는 `source-scan.enclosingScopeName` 참조. */
  readonly method: string;
  /** `@Param('<name>')` 의 이름. 이것이 라우트 경로의 `:name` 이다. */
  readonly param: string;
  /** 빠진 축 (정렬). */
  readonly missing: readonly ('ParseUUIDPipe' | "@ApiParam format:'uuid'")[];
}

/**
 * 이 이름이면 UUID 경로 파라미터로 본다.
 *
 * 실측(2026-09-12, controller 35개): id-형 136건 · 비-id 9건(`provider`×3 ·
 * `installToken`×2 · `endpointPath`×2 · `token` · `type`). 비-id 는 전부 정당한 비-UUID 라
 * **허용목록이 필요 없다** — 술어가 이름으로 가른다.
 *
 * 언젠가 `externalId` 처럼 id-형이면서 UUID 가 아닌 파라미터가 생기면 이 가드가 RED 를 내고,
 * 그때 사람이 *"이름을 바꿀 것인가 / 예외를 만들 것인가"* 를 판단하면 된다. 조용히 통과하는
 * 쪽보다 시끄러운 쪽이 낫다.
 */
function isIdShaped(name: string): boolean {
  return name === 'id' || /Id$/.test(name);
}

/** 데코레이터 호출의 이름 (`@Foo(...)` → `'Foo'`). 호출이 아니면 `null`. */
function decoratorCallName(
  decorator: ts.Decorator,
  sf: ts.SourceFile,
): string | null {
  const expr = decorator.expression;
  return ts.isCallExpression(expr) ? expr.expression.getText(sf) : null;
}

/**
 * 한 메서드의 `@ApiParam({ name, format })` 선언을 `name → format==='uuid'` 로 모은다.
 *
 * 객체 리터럴이 아닌 형태(변수 전개 등)는 담지 않는다 — 이 저장소에 그런 형태가 없고(실측
 * 127건 전부 인라인 리터럴), 정적으로 따라가려면 데이터플로 분석이 된다.
 */
function apiParamUuidFlags(
  method: ts.MethodDeclaration,
  sf: ts.SourceFile,
): Map<string, boolean> {
  const out = new Map<string, boolean>();
  for (const d of ts.getDecorators(method) ?? []) {
    if (decoratorCallName(d, sf) !== 'ApiParam') continue;
    const arg = (d.expression as ts.CallExpression).arguments[0];
    if (!arg || !ts.isObjectLiteralExpression(arg)) continue;
    let name: string | null = null;
    let uuid = false;
    for (const prop of arg.properties) {
      if (!ts.isPropertyAssignment(prop)) continue;
      const key = prop.name.getText(sf);
      if (key === 'name' && ts.isStringLiteralLike(prop.initializer)) {
        name = prop.initializer.text;
      } else if (key === 'format' && ts.isStringLiteralLike(prop.initializer)) {
        uuid = prop.initializer.text === 'uuid';
      }
    }
    if (name !== null) out.set(name, uuid);
  }
  return out;
}

/** `@ApiExcludeEndpoint()` 가 붙은 핸들러인가 — OpenAPI 에서 통째로 빠지는 자리. */
function isExcludedFromOpenApi(
  method: ts.MethodDeclaration,
  sf: ts.SourceFile,
): boolean {
  return (ts.getDecorators(method) ?? []).some(
    (d) => decoratorCallName(d, sf) === 'ApiExcludeEndpoint',
  );
}

/**
 * `*.controller.ts` 들에서 **UUID 계약이 빠진 id-형 경로 파라미터**를 찾는다.
 *
 * 두 축을 함께 본다 (`spec/conventions/swagger.md §5-4` 의 한 조항):
 *
 * | 축 | 무엇을 지키나 |
 * |---|---|
 * | `@Param('id', ParseUUIDPipe)` | **런타임** — 파싱 불가 값을 400 에서 끊는다 |
 * | `@ApiParam({ format: 'uuid' })` | **문서** — 생성된 OpenAPI 가 그 형식을 광고한다 |
 *
 * 한 축만 세면 나머지 절반이 조용히 빠진다 — 실제로 그랬다(§spec 헤더 참조).
 *
 * **예외는 이름 목록이 아니라 구조로 둔다**: `@ApiExcludeEndpoint()` 핸들러는 OpenAPI 에
 * 실리지 않으므로 `@ApiParam` 축을 묻지 않는다(런타임 축은 그대로 묻는다 — e2e 백도어라도
 * 파싱 불가 입력에 500 을 내서는 안 된다).
 *
 * @param files 스캔 대상 절대경로 목록. 호출자가 `collectTsFiles` 로 모은다.
 * @param srcRoot 보고 경로를 상대화할 기준.
 */
export function findUuidParamViolations(
  files: readonly string[],
  srcRoot: string,
): UuidParamViolation[] {
  const out: UuidParamViolation[] = [];
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
        const method = node.name.getText(sf);
        const declared = apiParamUuidFlags(node, sf);
        const excluded = isExcludedFromOpenApi(node, sf);
        for (const parameter of node.parameters) {
          for (const d of ts.getDecorators(parameter) ?? []) {
            if (decoratorCallName(d, sf) !== 'Param') continue;
            const call = d.expression as ts.CallExpression;
            const first = call.arguments[0];
            // 인자 없는 `@Param()` 은 파라미터 객체 전체를 받는 형태라 이름이 없다.
            if (!first || !ts.isStringLiteralLike(first)) continue;
            const param = first.text;
            if (!isIdShaped(param)) continue;
            const missing: UuidParamViolation['missing'][number][] = [];
            const pipes = call.arguments
              .slice(1)
              .map((a) => a.getText(sf))
              .join(',');
            // `ParseUUIDPipe` · `new ParseUUIDPipe({ version: '4' })` 둘 다 받는다 —
            // 실측 135건이 107 : 28 로 갈린다.
            if (!pipes.includes('ParseUUIDPipe')) missing.push('ParseUUIDPipe');
            if (!excluded && declared.get(param) !== true) {
              missing.push("@ApiParam format:'uuid'");
            }
            if (missing.length > 0) {
              out.push({ file: rel, method, param, missing });
            }
          }
        }
      }
      ts.forEachChild(node, visit);
    };
    visit(sf);
  }
  return out.sort(
    (a, b) =>
      a.file.localeCompare(b.file) ||
      a.method.localeCompare(b.method) ||
      a.param.localeCompare(b.param),
  );
}

/** id-형 경로 파라미터의 총 수 — vacuity 방지용(스캔이 0건이면 위 단언이 공허해진다). */
export function countIdShapedParams(files: readonly string[]): number {
  let count = 0;
  for (const file of files) {
    if (!file.endsWith('.controller.ts')) continue;
    const sf = ts.createSourceFile(
      file,
      fs.readFileSync(file, 'utf8'),
      ts.ScriptTarget.Latest,
      true,
    );
    const visit = (node: ts.Node): void => {
      if (ts.isMethodDeclaration(node)) {
        for (const parameter of node.parameters) {
          for (const d of ts.getDecorators(parameter) ?? []) {
            if (decoratorCallName(d, sf) !== 'Param') continue;
            const first = (d.expression as ts.CallExpression).arguments[0];
            if (
              first &&
              ts.isStringLiteralLike(first) &&
              isIdShaped(first.text)
            ) {
              count++;
            }
          }
        }
      }
      ts.forEachChild(node, visit);
    };
    visit(sf);
  }
  return count;
}
