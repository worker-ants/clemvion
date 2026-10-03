// `clemvion.redis.fail_open` 의 `component` 라벨 — 코드 유니온·실배선 정합 가드의 순수 로직.
//
// 소비처는 형제 파일 `redis-fail-open-catalog.spec.ts`. 배경·근거는 그 파일 헤더에 있다.
// 파서 순수 로직과 소비 spec 을 분리하는 규약은 형제 가드 `masked-reject-callers-guard.ts` 와
// 동일하다.

import * as fs from 'node:fs';
import * as path from 'node:path';
import * as ts from 'typescript';
import { collectTsFiles } from '../../common/__test-utils__/source-scan';

/** 유니온 타입이 선언된 파일 (저장소 루트 기준). */
export const UNION_SOURCE =
  'codebase/backend/src/modules/metrics/business-metrics.service.ts';

/** 유니온 타입 이름. 오탈자가 조용히 "0건" 을 만들지 않도록 상수로 둔다. */
export const UNION_TYPE_NAME = 'RedisFailOpenComponent';

/** 계측 메서드 이름 — 실배선 여부를 이 호출로 센다. */
export const RECORDER_FN = 'recordRedisFailOpen';

/**
 * `export type RedisFailOpenComponent = 'a' | 'b'` 에서 리터럴 값을 뽑는다.
 *
 * **정규식이 아니라 AST 로 읽는다** — 주석 안의 예시(`// 예: 'foo' | 'bar'`)나 JSDoc 의
 * 문자열이 값으로 잡히면 가드가 자기 오판을 사실로 굳힌다. 형제 가드
 * `masked-reject-callers-guard.ts` 가 정규식→AST 로 옮긴 것과 같은 이유다.
 */
export function readUnionMembers(repoRoot: string): string[] {
  const abs = path.join(repoRoot, UNION_SOURCE);
  const sf = ts.createSourceFile(
    abs,
    fs.readFileSync(abs, 'utf8'),
    ts.ScriptTarget.Latest,
    true,
  );
  const out: string[] = [];
  const visit = (node: ts.Node): void => {
    if (ts.isTypeAliasDeclaration(node) && node.name.text === UNION_TYPE_NAME) {
      const collect = (t: ts.TypeNode): void => {
        if (ts.isUnionTypeNode(t)) {
          t.types.forEach(collect);
          return;
        }
        if (ts.isLiteralTypeNode(t) && ts.isStringLiteral(t.literal)) {
          out.push(t.literal.text);
        }
      };
      collect(node.type);
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return out.sort();
}

/**
 * 유니온 값 중 프로덕션 호출부가 없는 것을 낸다. 해석하지 못한 호출부(`component: null`)는
 * 어떤 값도 배선한 것으로 치지 않는다.
 *
 * 판정을 순수 함수로 둔 것은 합성 입력 대조군으로 고정하기 위해서다. 실제 코퍼스에는
 * 미배선 값이 없어서 그 분기가 관측되지 않는다.
 */
export function findUnwiredMembers(
  unionMembers: readonly string[],
  wired: readonly { component: string | null }[],
): string[] {
  const wiredSet = new Set(wired.map((w) => w.component));
  return unionMembers.filter((m) => !wiredSet.has(m));
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

/** `src/` 하위 `.ts` 전수 (spec·dist 제외). */
export function listProductionSources(srcDir: string): string[] {
  return collectTsFiles(srcDir);
}

/**
 * `recordRedisFailOpen(<component>, …)` 의 **프로덕션 호출부**에서 첫 인자로 넘기는
 * component 값을 모은다. 값이 문자열 리터럴이 아니면(상수 참조 등) 그 상수의 초기값을
 * 같은 파일에서 한 단계 따라간다 — `idempotency.interceptor.ts` 가 `METRICS_COMPONENT`
 * 상수를 쓰기 때문이다. 한 단계로 못 풀면 `null` 을 담아 호출부가 판정할 수 있게 한다.
 */
export function findWiredComponents(
  srcDir: string,
): { file: string; component: string | null }[] {
  const found: { file: string; component: string | null }[] = [];
  for (const file of listProductionSources(srcDir)) {
    const text = fs.readFileSync(file, 'utf8');
    if (!text.includes(RECORDER_FN)) continue;
    const sf = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true);

    /** 같은 파일 안의 `const X = 'literal'` 초기값 표. */
    const consts = new Map<string, string>();
    const collectConsts = (node: ts.Node): void => {
      if (
        ts.isVariableDeclaration(node) &&
        ts.isIdentifier(node.name) &&
        node.initializer &&
        ts.isStringLiteral(node.initializer)
      ) {
        consts.set(node.name.text, node.initializer.text);
      }
      ts.forEachChild(node, collectConsts);
    };
    collectConsts(sf);

    const visit = (node: ts.Node): void => {
      if (
        ts.isCallExpression(node) &&
        ts.isPropertyAccessExpression(node.expression) &&
        node.expression.name.text === RECORDER_FN
      ) {
        const arg = node.arguments[0];
        let component: string | null = null;
        if (arg && ts.isStringLiteral(arg)) component = arg.text;
        else if (arg && ts.isIdentifier(arg))
          component = consts.get(arg.text) ?? null;
        found.push({ file, component });
      }
      ts.forEachChild(node, visit);
    };
    visit(sf);
  }
  return found;
}
