// 통합 가시성 판정을 거치지 않는 경로의 경계 캐너리 — 스캔 · 판정 순수 로직.
//
// 소비처는 형제 파일 `integration-visibility-bypass.spec.ts`. 배경 · 근거는 그 파일 헤더에 있다.

import * as fs from 'node:fs';
import * as ts from 'typescript';
import {
  collectTsFiles,
  toPosixRelative,
} from '../../common/__test-utils__/source-scan';

/** 가시성 판정 자체이거나 판정을 SQL 에 거는 호출. 이것을 부르는 메서드는 판정을 거친 것으로 본다. */
const VISIBILITY_GUARDS = new Set([
  'requireVisible',
  'requireModifiable',
  'integrationVisibilityClause',
]);

const REPOSITORY_READS = new Set([
  'findOne',
  'findOneBy',
  'findOneOrFail',
  'findOneByOrFail',
  'find',
  'findBy',
  'findAndCount',
  'count',
  'exists',
  'exist',
  'createQueryBuilder',
]);

const RAW_INTEGRATION_READ = /\bFROM\s+"?integration"?(?=[\s,)]|$)/i;

interface MethodFacts {
  isPrivate: boolean;
  readsRows: boolean;
  guarded: boolean;
  calls: Set<string>;
}

function calleeName(call: ts.CallExpression): string | null {
  const callee = call.expression;
  if (ts.isIdentifier(callee)) return callee.text;
  if (ts.isPropertyAccessExpression(callee)) return callee.name.text;
  return null;
}

function isThisMember(expr: ts.Expression, name: string): boolean {
  return (
    ts.isPropertyAccessExpression(expr) &&
    expr.expression.kind === ts.SyntaxKind.ThisKeyword &&
    expr.name.text === name
  );
}

function readsIntegrationRows(call: ts.CallExpression): boolean {
  const callee = call.expression;
  if (!ts.isPropertyAccessExpression(callee)) return false;
  const method = callee.name.text;
  if (
    REPOSITORY_READS.has(method) &&
    isThisMember(callee.expression, 'integrationRepository')
  ) {
    return true;
  }
  const [first] = call.arguments;
  return (
    first !== undefined &&
    ts.isIdentifier(first) &&
    first.text === 'Integration' &&
    (REPOSITORY_READS.has(method) || method === 'getRepository')
  );
}

function methodFacts(body: ts.Block): MethodFacts {
  const facts: MethodFacts = {
    isPrivate: false,
    readsRows: false,
    guarded: false,
    calls: new Set(),
  };
  const visit = (node: ts.Node): void => {
    if (ts.isCallExpression(node)) {
      const name = calleeName(node);
      if (name !== null && VISIBILITY_GUARDS.has(name)) facts.guarded = true;
      if (readsIntegrationRows(node)) facts.readsRows = true;
      if (
        ts.isPropertyAccessExpression(node.expression) &&
        node.expression.expression.kind === ts.SyntaxKind.ThisKeyword
      ) {
        facts.calls.add(node.expression.name.text);
      }
    }
    if (
      (ts.isStringLiteral(node) ||
        ts.isNoSubstitutionTemplateLiteral(node) ||
        ts.isTemplateHead(node)) &&
      RAW_INTEGRATION_READ.test(node.text)
    ) {
      facts.readsRows = true;
    }
    ts.forEachChild(node, visit);
  };
  visit(body);
  return facts;
}

/**
 * `className` 클래스의 공개 메서드 가운데 통합 행을 읽으면서 가시성 판정을 거치지 않는 것(정렬).
 *
 * 같은 클래스의 비공개 메서드 호출은 따라간다. 판정 메서드(`requireVisible` 등)에 닿으면 그 갈래는 판정을 거친 것으로 보고 더
 * 따라가지 않는다. 그래서 판정 메서드 안의 조회는 세지 않는다.
 */
export function findUnguardedRowReaders(
  source: string,
  className: string,
): string[] {
  const sf = ts.createSourceFile(
    'probe.ts',
    source,
    ts.ScriptTarget.Latest,
    /* setParentNodes */ true,
  );
  const methods = new Map<string, MethodFacts>();
  ts.forEachChild(sf, (node) => {
    if (!ts.isClassDeclaration(node) || node.name?.text !== className) return;
    for (const member of node.members) {
      if (!ts.isMethodDeclaration(member) || !member.body) continue;
      const facts = methodFacts(member.body);
      facts.isPrivate = (ts.getModifiers(member) ?? []).some(
        (m) => m.kind === ts.SyntaxKind.PrivateKeyword,
      );
      methods.set(member.name.getText(sf), facts);
    }
  });

  const reach = (name: string, seen: Set<string>): void => {
    if (seen.has(name) || VISIBILITY_GUARDS.has(name)) return;
    seen.add(name);
    for (const callee of methods.get(name)?.calls ?? []) reach(callee, seen);
  };

  const out: string[] = [];
  for (const [name, facts] of methods) {
    if (facts.isPrivate) continue;
    const reached = new Set<string>();
    reach(name, reached);
    const reachable = [...reached].map((n) => methods.get(n));
    const reads = reachable.some((m) => m?.readsRows);
    const guarded = reachable.some(
      (m) =>
        m?.guarded || [...(m?.calls ?? [])].some((c) => VISIBILITY_GUARDS.has(c)),
    );
    if (reads && !guarded) out.push(name);
  }
  return out.sort();
}

/** `srcDir` 아래 운영 코드(`.spec.ts` 제외)에서 `.<methodName>(…)` 을 부르는 파일(저장소 루트 상대 경로, 정렬). */
export function listCallerFiles(
  repoRoot: string,
  srcDir: string,
  methodName: string,
): string[] {
  return collectTsFiles(srcDir)
    .filter((file) => {
      const source = fs.readFileSync(file, 'utf8');
      if (!source.includes(methodName)) return false;
      const sf = ts.createSourceFile(
        'probe.ts',
        source,
        ts.ScriptTarget.Latest,
        /* setParentNodes */ false,
      );
      let found = false;
      const visit = (node: ts.Node): void => {
        if (found) return;
        if (
          ts.isCallExpression(node) &&
          ts.isPropertyAccessExpression(node.expression) &&
          node.expression.name.text === methodName
        ) {
          found = true;
          return;
        }
        ts.forEachChild(node, visit);
      };
      visit(sf);
      return found;
    })
    .map((file) => toPosixRelative(repoRoot, file))
    .sort();
}
