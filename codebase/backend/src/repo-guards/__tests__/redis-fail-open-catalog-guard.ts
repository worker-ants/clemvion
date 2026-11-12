// `clemvion.redis.fail_open` 의 (`component`, `reason`) 라벨 쌍 — 코드 선언 · 실배선 정합 가드의 순수 로직.
//
// 소비처는 형제 파일 `redis-fail-open-catalog.spec.ts`. 배경·근거는 그 파일 헤더에 있다.
// 파서 순수 로직과 소비 spec 을 분리하는 규약은 형제 가드 `masked-reject-callers-guard.ts` 와
// 동일하다.

import * as fs from 'node:fs';
import * as path from 'node:path';
import * as ts from 'typescript';
import { collectTsFiles } from '../../common/__test-utils__/source-scan';

/** 라벨 쌍이 선언된 파일 (저장소 루트 기준). */
export const UNION_SOURCE =
  'codebase/backend/src/modules/metrics/business-metrics.service.ts';

/**
 * 라벨 쌍을 선언한 interface 이름. 키가 component, 값이 그 component 의 reason 유니온이다.
 * 오탈자가 조용히 "0건" 을 만들지 않도록 상수로 둔다.
 */
export const REASON_MAP_TYPE_NAME = 'RedisFailOpenReasonMap';

/** 계측 메서드 이름 — 실배선 여부를 이 호출로 센다. */
export const RECORDER_FN = 'recordRedisFailOpen';

/** 선언 · 배선의 단위. */
export interface FailOpenPair {
  component: string;
  reason: string;
}

/** 호출부 하나. 정적으로 풀지 못한 인자는 `null` 이다. */
export interface WiredCall {
  file: string;
  component: string | null;
  /** 이 호출이 낼 수 있는 reason 전부(삼항이면 두 갈래). 풀지 못하면 `null`. */
  reasons: string[] | null;
}

/** 리터럴 유니온 타입 노드에서 문자열 리터럴을 모은다. */
function literalsOfType(t: ts.TypeNode): string[] {
  if (ts.isUnionTypeNode(t)) return t.types.flatMap(literalsOfType);
  if (ts.isParenthesizedTypeNode(t)) return literalsOfType(t.type);
  if (ts.isLiteralTypeNode(t) && ts.isStringLiteral(t.literal)) {
    return [t.literal.text];
  }
  return [];
}

/**
 * `interface RedisFailOpenReasonMap { idempotency: 'a' | 'b'; … }` 를 소스 텍스트에서 읽는다.
 *
 * **정규식이 아니라 AST 로 읽는다** — 주석 안의 예시(`// 예: 'foo' | 'bar'`)나 JSDoc 의
 * 문자열이 값으로 잡히면 가드가 자기 오판을 사실로 굳힌다. 형제 가드
 * `masked-reject-callers-guard.ts` 가 정규식→AST 로 옮긴 것과 같은 이유다.
 */
export function parseReasonMap(fileName: string, text: string): FailOpenPair[] {
  const sf = ts.createSourceFile(fileName, text, ts.ScriptTarget.Latest, true);
  const out: FailOpenPair[] = [];
  const visit = (node: ts.Node): void => {
    if (
      ts.isInterfaceDeclaration(node) &&
      node.name.text === REASON_MAP_TYPE_NAME
    ) {
      for (const member of node.members) {
        if (!ts.isPropertySignature(member) || !member.type) continue;
        const name = member.name;
        const component =
          ts.isIdentifier(name) || ts.isStringLiteral(name) ? name.text : null;
        if (component === null) continue;
        for (const reason of literalsOfType(member.type)) {
          out.push({ component, reason });
        }
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return sortPairs(out);
}

/** 저장소의 선언 파일을 읽는다. 파일이 없으면 ENOENT 로 던진다(빈 배열로 통과하지 않는다). */
export function readReasonMap(repoRoot: string): FailOpenPair[] {
  const abs = path.join(repoRoot, UNION_SOURCE);
  return parseReasonMap(abs, fs.readFileSync(abs, 'utf8'));
}

/** 선언된 component 이름 전수(정렬, 중복 없음). */
export function componentsOf(pairs: readonly FailOpenPair[]): string[] {
  return [...new Set(pairs.map((p) => p.component))].sort();
}

function sortPairs(pairs: FailOpenPair[]): FailOpenPair[] {
  return pairs.sort((a, b) =>
    a.component === b.component
      ? a.reason.localeCompare(b.reason)
      : a.component.localeCompare(b.component),
  );
}

/** `x satisfies T` · `x as T` · `(x)` 를 벗긴다. */
function unwrap(expr: ts.Expression): ts.Expression {
  let e = expr;
  while (
    ts.isSatisfiesExpression(e) ||
    ts.isAsExpression(e) ||
    ts.isParenthesizedExpression(e)
  ) {
    e = e.expression;
  }
  return e;
}

/**
 * 인자 식이 낼 수 있는 문자열 값 전부. 문자열 리터럴, 같은 파일의 `const X = 'lit'`
 * (한 단계), 두 갈래가 모두 풀리는 삼항만 푼다. 그 밖은 `null`.
 */
function resolveStrings(
  expr: ts.Expression,
  consts: ReadonlyMap<string, string>,
): string[] | null {
  const e = unwrap(expr);
  if (ts.isStringLiteral(e) || ts.isNoSubstitutionTemplateLiteral(e)) {
    return [e.text];
  }
  if (ts.isIdentifier(e)) {
    const v = consts.get(e.text);
    return v === undefined ? null : [v];
  }
  if (ts.isConditionalExpression(e)) {
    const a = resolveStrings(e.whenTrue, consts);
    const b = resolveStrings(e.whenFalse, consts);
    return a && b ? [...a, ...b] : null;
  }
  return null;
}

/** 노드를 감싼 가장 가까운 메서드 · 함수 선언. */
function enclosingFunction(
  node: ts.Node,
): ts.MethodDeclaration | ts.FunctionDeclaration | null {
  for (let p = node.parent; p; p = p.parent) {
    if (ts.isMethodDeclaration(p) || ts.isFunctionDeclaration(p)) return p;
  }
  return null;
}

/** `this.name(...)` 또는 `name(...)` 호출인가. */
function callsByName(sf: ts.SourceFile, name: string): ts.CallExpression[] {
  const out: ts.CallExpression[] = [];
  const visit = (node: ts.Node): void => {
    if (ts.isCallExpression(node)) {
      const callee = node.expression;
      const hit =
        (ts.isPropertyAccessExpression(callee) &&
          callee.expression.kind === ts.SyntaxKind.ThisKeyword &&
          callee.name.text === name) ||
        (ts.isIdentifier(callee) && callee.text === name);
      if (hit) out.push(node);
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return out;
}

/**
 * 소스 하나에서 `<obj>.recordRedisFailOpen(<component>, <reason>)` 호출부를 모은다.
 *
 * 인자는 리터럴, 같은 파일의 `const` 리터럴(한 단계, `satisfies` · `as` 는 벗긴다), 두 갈래가
 * 모두 풀리는 삼항을 푼다. 인자가 **감싼 메서드 · 함수의 매개변수**면 같은 파일 안에서 그
 * 메서드를 부르는 곳(`this.name(…)` · `name(…)`)의 같은 자리 인자를 한 단계 더 따라간다.
 * 강등 기록을 helper 한 곳으로 모은 서비스(`sse-fanout.service.ts` 의 `degrade`)가 그 형태다.
 * 따라간 호출부 중 하나라도 못 풀거나 호출부가 없으면 `null` 이다.
 */
export function wiredCallsInSource(
  fileName: string,
  text: string,
): WiredCall[] {
  if (!text.includes(RECORDER_FN)) return [];
  const sf = ts.createSourceFile(fileName, text, ts.ScriptTarget.Latest, true);

  /** 같은 파일 안의 `const X = 'literal'` 초기값 표. */
  const consts = new Map<string, string>();
  const collectConsts = (node: ts.Node): void => {
    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.initializer
    ) {
      const init = unwrap(node.initializer);
      if (ts.isStringLiteral(init)) consts.set(node.name.text, init.text);
    }
    ts.forEachChild(node, collectConsts);
  };
  collectConsts(sf);

  /** 인자 하나를 푼다. 매개변수면 한 단계 따라간다. */
  const resolveArg = (
    call: ts.CallExpression,
    index: number,
  ): string[] | null => {
    const arg = call.arguments[index];
    if (!arg) return null;
    const direct = resolveStrings(arg, consts);
    if (direct) return direct;
    const e = unwrap(arg);
    if (!ts.isIdentifier(e)) return null;
    const fn = enclosingFunction(call);
    if (!fn || !fn.name || !ts.isIdentifier(fn.name)) return null;
    const paramIndex = fn.parameters.findIndex(
      (p) => ts.isIdentifier(p.name) && p.name.text === e.text,
    );
    if (paramIndex < 0) return null;
    const callers = callsByName(sf, fn.name.text);
    if (callers.length === 0) return null;
    const values: string[] = [];
    for (const caller of callers) {
      const a = caller.arguments[paramIndex];
      const v = a ? resolveStrings(a, consts) : null;
      if (!v) return null;
      values.push(...v);
    }
    return values;
  };

  const found: WiredCall[] = [];
  const visit = (node: ts.Node): void => {
    if (
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression) &&
      node.expression.name.text === RECORDER_FN
    ) {
      const components = resolveArg(node, 0);
      found.push({
        file: fileName,
        component: components && components.length === 1 ? components[0] : null,
        reasons: resolveArg(node, 1),
      });
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return found;
}

/** `src/` 하위 `.ts` 전수 (spec·dist 제외). */
export function listProductionSources(srcDir: string): string[] {
  return collectTsFiles(srcDir);
}

/** 프로덕션 소스 전수의 호출부. */
export function findWiredCalls(srcDir: string): WiredCall[] {
  return listProductionSources(srcDir).flatMap((file) =>
    wiredCallsInSource(file, fs.readFileSync(file, 'utf8')),
  );
}

/** 호출부가 낼 수 있는 쌍 전수. 풀지 못한 호출부는 아무 쌍도 내지 않는다. */
export function wiredPairsOf(calls: readonly WiredCall[]): FailOpenPair[] {
  const seen = new Map<string, FailOpenPair>();
  for (const c of calls) {
    if (c.component === null || c.reasons === null) continue;
    for (const reason of c.reasons) {
      seen.set(`${c.component}\u0000${reason}`, {
        component: c.component,
        reason,
      });
    }
  }
  return sortPairs([...seen.values()]);
}

const keyOf = (p: FailOpenPair): string => `${p.component}\u0000${p.reason}`;

/**
 * 선언했지만 프로덕션 호출부가 없는 쌍. 그 라벨의 `0` 은 "정상" 이 아니라 "미계측" 이다.
 *
 * 판정을 순수 함수로 둔 것은 합성 입력 대조군으로 고정하기 위해서다. 실제 코퍼스에는
 * 미배선 쌍이 없어서 그 분기가 관측되지 않는다.
 */
export function findUnwiredPairs(
  declared: readonly FailOpenPair[],
  wired: readonly FailOpenPair[],
): FailOpenPair[] {
  const wiredKeys = new Set(wired.map(keyOf));
  return declared.filter((p) => !wiredKeys.has(keyOf(p)));
}

/**
 * 호출부가 내는데 선언에 없는 쌍. 타입이 먼저 막지만 component 인자에 유니온 타입 변수를
 * 넘기면 reason 이 모든 component 의 값으로 넓어져 타입을 지난다. 그 틈을 여기서 닫는다.
 */
export function findUndeclaredPairs(
  declared: readonly FailOpenPair[],
  wired: readonly FailOpenPair[],
): FailOpenPair[] {
  const declaredKeys = new Set(declared.map(keyOf));
  return wired.filter((p) => !declaredKeys.has(keyOf(p)));
}

/**
 * 파일 하나의 문자열 리터럴 전수 — 따옴표 문자열과 템플릿의 고정 조각.
 *
 * 가드가 어떤 경로도 읽지 않는다는 주장을 정적으로 확인할 때 쓴다. 경로는 문자열로만
 * 만들 수 있고 주석은 리터럴이 아니므로, 이력으로 적은 옛 경로는 걸리지 않는다.
 */
export function stringLiteralsOf(fileName: string, text: string): string[] {
  const sf = ts.createSourceFile(fileName, text, ts.ScriptTarget.Latest, true);
  const out: string[] = [];
  const visit = (node: ts.Node): void => {
    if (
      ts.isStringLiteral(node) ||
      ts.isNoSubstitutionTemplateLiteral(node) ||
      ts.isTemplateHead(node) ||
      ts.isTemplateMiddle(node) ||
      ts.isTemplateTail(node)
    ) {
      out.push(node.text);
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return out;
}
