// `clemvion.redis.fail_open` 의 `component` 라벨 — 코드·spec·실배선 3자 정합 가드의 순수 로직.
//
// 소비처는 형제 파일 `redis-fail-open-catalog.spec.ts`. 배경·근거는 그 파일 헤더에 있다.
// 파서 순수 로직과 소비 spec 을 분리하는 규약은 형제 가드 `masked-reject-callers-guard.ts` 와
// 동일하다.

import * as fs from 'node:fs';
import * as path from 'node:path';
import * as ts from 'typescript';

/** 유니온 타입이 선언된 파일 (저장소 루트 기준). */
export const UNION_SOURCE =
  'codebase/backend/src/modules/metrics/business-metrics.service.ts';

/** `component` 라벨 카탈로그가 적힌 spec (저장소 루트 기준). */
export const CATALOG_SPEC = 'spec/5-system/_product-overview.md';

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
 * spec 카탈로그 행의 `component` 괄호 목록을 읽는다.
 *
 * 대상 행은 `| \`clemvion.redis.fail_open\` | Counter | \`component\` (a/b), ... |` 형태이고,
 * 여기서 `(a/b)` 를 뽑는다. 행을 못 찾으면 **빈 배열이 아니라 throw** 한다 — 못 찾은 것과
 * "비어 있다" 를 같은 값으로 돌려주면 spec 이 통째로 사라져도 가드가 조용히 통과한다.
 */
export function readCatalogComponents(repoRoot: string): string[] {
  const abs = path.join(repoRoot, CATALOG_SPEC);
  const text = fs.readFileSync(abs, 'utf8');
  const row = text
    .split('\n')
    .find((l) => l.includes('`clemvion.redis.fail_open`') && l.includes('|'));
  if (!row) {
    throw new Error(
      `${CATALOG_SPEC} 에서 \`clemvion.redis.fail_open\` 카탈로그 행을 찾지 못했다 — ` +
        '행이 사라졌거나 표기가 바뀌었다. 가드를 먼저 고쳐라.',
    );
  }
  const m = /`component`\s*\(([^)]*)\)/.exec(row);
  if (!m) {
    throw new Error(
      `카탈로그 행에서 \`component\` (…) 목록을 파싱하지 못했다: ${row.trim()}`,
    );
  }
  return m[1]
    .split('/')
    .map((s) => s.trim())
    .filter(Boolean)
    .sort();
}

/** `src/` 하위 `.ts` 전수 (spec·dist 제외). */
export function listProductionSources(srcDir: string): string[] {
  const out: string[] = [];
  const walk = (dir: string): void => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === 'node_modules' || entry.name === 'dist') continue;
        walk(full);
      } else if (
        entry.name.endsWith('.ts') &&
        !entry.name.endsWith('.spec.ts') &&
        !entry.name.endsWith('.d.ts')
      ) {
        out.push(full);
      }
    }
  };
  walk(srcDir);
  return out;
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
