// 마커 SoT 미러 재발 가드 (backend 트리거) — 스캔·판정 순수 로직.
//
// 소비처는 형제 파일 `masked-marker-mirror.spec.ts`. 배경·근거는 그 파일 헤더에 있다.
//
// **왜 frontend 쪽 동명 가드와 둘인가**: CI 경로 게이팅 때문이다. `frontend-checks` 는
// `codebase/backend/**` 변경 때 검사를 생략하므로, frontend vitest 에만 둔 가드는 backend 가
// 마커를 재선언하는 방향에 **무력**하다(`11_27_29` architecture W1 — 이 PR 이 없애려던 갭을
// 가드 배치로 재도입할 뻔했다). 두 스택이 각자 자기 워크플로에서 도는 사본을 갖고, 둘 다
// 저장소 전체를 훑는다 — 어느 쪽이 바뀌든 최소 하나는 실행된다.
//
// 값의 미러와 달리 **탐지 로직의 중복은 구멍을 만들지 않는다**. 한 사본이 낡아도 다른 사본이
// 같은 불변식을 자기 트리거에서 계속 지킨다.

import * as fs from 'node:fs';
import * as path from 'node:path';
import * as ts from 'typescript';

/** SoT 패키지 — 여기 안에서는 당연히 선언한다. */
export const SOT_DIR = 'codebase/packages/masked-markers';

/** SoT 가 소유하는 심볼. 패키지 밖에서 새로 선언하면 미러가 되살아난 것이다. */
export const SOT_SYMBOLS: readonly string[] = [
  'MASKED_MARKERS',
  'isMaskedMarker',
  'VALUE_MASK_MARKER',
  'KEY_MASK_MARKER',
  'DEPTH_MASK_MARKER',
  'MAX_MASK_DEPTH',
];

/** 스캔 대상 — 저장소 전체(스택 무관). */
export const SCAN_DIRS: readonly string[] = [
  'codebase/backend/src',
  'codebase/frontend/src',
  'codebase/channel-web-chat/src',
];

/** 한 건의 재선언. */
export interface MirrorRedeclaration {
  readonly file: string;
  readonly symbol: string;
}

/** `.ts`/`.tsx` 전수 (node_modules·dist 제외). */
export function listSourceFiles(absDir: string): string[] {
  if (!fs.existsSync(absDir)) return [];
  const out: string[] = [];
  const walk = (dir: string): void => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === 'node_modules' || entry.name === 'dist') continue;
        walk(full);
      } else if (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx')) {
        out.push(full);
      }
    }
  };
  walk(absDir);
  return out;
}

/**
 * 이 소스가 **새로 선언하는** SoT 심볼들.
 *
 * ## 왜 리터럴이 아니라 심볼인가
 *
 * 마커 리터럴(`'***'` 등)을 **정당하게 독립 사용**하는 마스커가 이 저장소에 최소 다섯이다
 * (HTTP 쿼리 파라미터 가림 · 응답 헤더 가림 · 이메일 로컬파트 가림 · 통합 핸들러 응답 가림 ·
 * 로직 노드 값 가림). spec 은 그중 일부의 **합성을 명시적으로 금지**한다 — 리터럴 일치는
 * 우연이지 계약이 아니다. 리터럴로 잡으면 오탐 기계가 되고, 오탐 나는 가드는 약화된다.
 *
 * 변수·함수·클래스 **선언**만 센다. AST 로 보므로 주석·문자열 안의 같은 이름은 애초에
 * 식별자가 아니고, import 바인딩과 재export 도 선언 노드가 아니라 걸리지 않는다.
 */
export function findRedeclaredSymbols(source: string): string[] {
  if (!SOT_SYMBOLS.some((s) => source.includes(s))) return [];

  const sourceFile = ts.createSourceFile(
    'probe.tsx',
    source,
    ts.ScriptTarget.Latest,
    false,
    ts.ScriptKind.TSX,
  );

  const found = new Set<string>();
  const record = (name: ts.Node | undefined): void => {
    if (name && ts.isIdentifier(name) && SOT_SYMBOLS.includes(name.text)) {
      found.add(name.text);
    }
  };

  const visit = (node: ts.Node): void => {
    if (ts.isVariableDeclaration(node)) record(node.name);
    else if (ts.isFunctionDeclaration(node)) record(node.name);
    else if (ts.isClassDeclaration(node)) record(node.name);
    ts.forEachChild(node, visit);
  };
  ts.forEachChild(sourceFile, visit);
  return [...found].sort();
}

/** SoT 심볼을 재선언하는 자리 전부 (SoT 패키지 자신은 제외). */
export function findMirrorRedeclarations(
  repoRoot: string,
): MirrorRedeclaration[] {
  const out: MirrorRedeclaration[] = [];
  for (const rel of SCAN_DIRS) {
    for (const absolute of listSourceFiles(path.join(repoRoot, rel))) {
      const relPath = path
        .relative(repoRoot, absolute)
        .split(path.sep)
        .join('/');
      if (relPath.startsWith(SOT_DIR)) continue;
      for (const symbol of findRedeclaredSymbols(
        fs.readFileSync(absolute, 'utf8'),
      )) {
        out.push({ file: relPath, symbol });
      }
    }
  }
  return out.sort((a, b) =>
    a.file === b.file
      ? a.symbol.localeCompare(b.symbol)
      : a.file.localeCompare(b.file),
  );
}
