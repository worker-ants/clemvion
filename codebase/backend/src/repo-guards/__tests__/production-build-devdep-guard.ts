// 프로덕션 빌드 산출물에 devDependency 가 새지 않는지 — 스캔·판정 순수 로직.
//
// 소비처는 형제 파일 `production-build-devdep.spec.ts`. 배경·근거는 그 파일 헤더에 있다.
// 파서 순수 로직과 소비 spec 을 분리하는 규약은 형제 가드
// `masked-reject-callers-guard.ts` · `eslint-unicorn-peer-guard.ts` 와 동일하다.

import * as fs from 'node:fs';
import * as path from 'node:path';
import * as ts from 'typescript';

/** 한 건의 누출 — 어느 빌드 대상 파일이 어느 devDependency 를 끌어오는가. */
export interface DevDepLeak {
  /** backend 기준 상대 경로. */
  readonly file: string;
  /** 패키지 루트 이름(scoped 는 `@scope/name`). */
  readonly pkg: string;
}

/**
 * `tsconfig.build.json` 이 **실제로** 컴파일할 파일 목록.
 *
 * include/exclude 규칙을 손으로 재구현하지 않고 `ts.parseJsonConfigFileContent` 에 맡긴다 —
 * `nest build` 가 쓰는 것과 같은 정본 해석이라, 설정이 바뀌면 이 목록이 따라 바뀐다.
 */
export function resolveBuildFileNames(backendDir: string): string[] {
  const configPath = path.join(backendDir, 'tsconfig.build.json');
  const raw = ts.readConfigFile(configPath, ts.sys.readFile);
  if (raw.error) {
    throw new Error(
      `tsconfig.build.json 을 읽지 못했다: ${ts.flattenDiagnosticMessageText(raw.error.messageText, ' ')}`,
    );
  }
  const parsed = ts.parseJsonConfigFileContent(raw.config, ts.sys, backendDir);
  return parsed.fileNames;
}

/**
 * 한 소스가 **런타임에 끌어오는** 모듈 specifier 전부.
 *
 * 형태를 하나씩 덧대다 네 라운드를 쓴 전례가 있어(`masked-reject-callers-guard` 의
 * 정규식 → AST 전환) 처음부터 파서로 간다. 모듈 해석이 일어나는 자리는 네 곳뿐이다:
 * `import ... from`, `export ... from`, `require(...)`, 동적 `import(...)`.
 *
 * **타입 전용 import 는 세지 않는다** — `import type` 은 컴파일 시 완전히 지워져 산출물에
 * `require` 를 남기지 않는다. 세면 오탐이 나고, 오탐이 나면 다음 사람이 가드를 약화시킨다.
 */
export function collectRuntimeModuleSpecifiers(source: string): string[] {
  const sourceFile = ts.createSourceFile(
    'probe.ts',
    source,
    ts.ScriptTarget.Latest,
    false,
  );
  const found: string[] = [];

  const push = (node: ts.Expression | undefined): void => {
    if (node && ts.isStringLiteralLike(node)) found.push(node.text);
  };

  const visit = (node: ts.Node): void => {
    if (ts.isImportDeclaration(node)) {
      // `import type { X } from 'p'` — 지워진다.
      if (!node.importClause?.isTypeOnly) push(node.moduleSpecifier);
    } else if (ts.isExportDeclaration(node)) {
      if (!node.isTypeOnly) push(node.moduleSpecifier);
    } else if (ts.isImportEqualsDeclaration(node)) {
      // `import x = require('p')`
      if (ts.isExternalModuleReference(node.moduleReference)) {
        push(node.moduleReference.expression);
      }
    } else if (ts.isCallExpression(node)) {
      const isRequire =
        ts.isIdentifier(node.expression) && node.expression.text === 'require';
      const isDynamicImport =
        node.expression.kind === ts.SyntaxKind.ImportKeyword;
      if (isRequire || isDynamicImport) push(node.arguments[0]);
    }
    ts.forEachChild(node, visit);
  };

  ts.forEachChild(sourceFile, visit);
  return found;
}

/** specifier 에서 패키지 루트 이름만 — 상대·내장 모듈은 `null`. */
export function packageRootOf(specifier: string): string | null {
  if (specifier.startsWith('.') || specifier.startsWith('/')) return null;
  if (specifier.startsWith('node:')) return null;
  const segments = specifier.split('/');
  return specifier.startsWith('@')
    ? segments.slice(0, 2).join('/')
    : segments[0];
}

/**
 * 빌드 대상 파일들이 끌어오는 패키지 중 **devDependency 전용**인 것들.
 *
 * `dependencies` 에도 있으면 누출이 아니다 — 프로덕션 설치에 존재한다.
 */
export function findDevDepLeaks(backendDir: string): DevDepLeak[] {
  const pkg = JSON.parse(
    fs.readFileSync(path.join(backendDir, 'package.json'), 'utf8'),
  ) as {
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
  };
  const prod = new Set(Object.keys(pkg.dependencies ?? {}));
  const dev = new Set(Object.keys(pkg.devDependencies ?? {}));

  const leaks: DevDepLeak[] = [];
  for (const absolute of resolveBuildFileNames(backendDir)) {
    const specifiers = collectRuntimeModuleSpecifiers(
      fs.readFileSync(absolute, 'utf8'),
    );
    for (const specifier of specifiers) {
      const root = packageRootOf(specifier);
      if (root && dev.has(root) && !prod.has(root)) {
        leaks.push({
          file: path.relative(backendDir, absolute).split(path.sep).join('/'),
          pkg: root,
        });
      }
    }
  }
  return leaks;
}
