// 마커 SoT 미러 재발 가드 — 스캔·판정 순수 로직.
//
// 소비처는 형제 파일 `masked-marker-mirror.test.ts`. 배경·근거는 그 파일 헤더에 있다.
// 파서 순수 로직과 소비 spec 을 분리하는 규약은 형제 가드
// `internal-package-registration-guard.ts` · `typescript-toolchain-guard.ts` 와 동일하다.

import fs from "node:fs";
import path from "node:path";
import ts from "typescript";

import { ROOT } from "./_shared";

/** SoT 패키지 — 여기 안에서는 당연히 선언한다. */
export const SOT_DIR = path.join("codebase", "packages", "masked-markers");

/**
 * SoT 가 소유하는 심볼. **이 이름들을 패키지 밖에서 새로 선언하면 미러가 되살아난 것**이다.
 *
 * 재export(`export { X } from …`)와 지역 별칭(`export const MAX_REDACT_DEPTH = MAX_MASK_DEPTH`)
 * 은 선언이 아니므로 통과한다 — 그게 이관 후 두 스택이 쓰는 정상 형태다.
 */
export const SOT_SYMBOLS: readonly string[] = [
  "MASKED_MARKERS",
  "isMaskedMarker",
  "VALUE_MASK_MARKER",
  "KEY_MASK_MARKER",
  "DEPTH_MASK_MARKER",
  "MAX_MASK_DEPTH",
];

/** 스캔 대상 — 두 스택의 소스. */
export const SCAN_DIRS: readonly string[] = [
  path.join("codebase", "backend", "src"),
  path.join("codebase", "frontend", "src"),
  path.join("codebase", "channel-web-chat", "src"),
];

/** 한 건의 재선언. */
export interface MirrorRedeclaration {
  /** 저장소 루트 기준 상대 경로. */
  readonly file: string;
  /** 재선언된 심볼 이름. */
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
        if (entry.name === "node_modules" || entry.name === "dist") continue;
        walk(full);
      } else if (entry.name.endsWith(".ts") || entry.name.endsWith(".tsx")) {
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
 * 처음엔 *"패키지 밖에 마커 리터럴(`'***'` 등)이 재등장하면 RED"* 로 잡으려 했다. 실측하니
 * **오탐 기계**가 될 설계였다 — 이 저장소에는 같은 리터럴을 **정당하게 독립 사용**하는
 * 마스커가 최소 다섯이다(HTTP 노드 쿼리 파라미터 가림, 응답 헤더 가림, 이메일 로컬파트
 * 가림, 통합 핸들러 응답 가림, 로직 노드 값 가림). spec 은 그중 일부의 **합성을 명시적으로
 * 금지**한다 — 리터럴 일치는 우연이지 계약이 아니다.
 *
 * 오탐 나는 가드는 약화되거나 무시된다. 그래서 **재선언되면 곧 미러**인 심볼 이름만 본다.
 *
 * ## 무엇이 "선언" 인가
 *
 * 변수 선언(`const X = …`)·함수 선언(`function X()`)·클래스 선언만 센다. AST 로 보므로
 * 주석·문자열 안의 같은 이름은 애초에 식별자가 아니고, import 로 들여온 **바인딩**도
 * 선언 노드가 아니라서 걸리지 않는다.
 */
export function findRedeclaredSymbols(source: string): string[] {
  // 값싼 선별 — 이름이 문자열로조차 없으면 어떤 AST 노드도 가질 수 없다.
  if (!SOT_SYMBOLS.some((s) => source.includes(s))) return [];

  const sourceFile = ts.createSourceFile(
    "probe.tsx",
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

/** 두 스택에서 SoT 심볼을 재선언하는 자리 전부 (SoT 패키지 자신은 제외). */
export function findMirrorRedeclarations(repoRoot: string): MirrorRedeclaration[] {
  const out: MirrorRedeclaration[] = [];
  for (const rel of SCAN_DIRS) {
    for (const absolute of listSourceFiles(path.join(repoRoot, rel))) {
      const relPath = path
        .relative(repoRoot, absolute)
        .split(path.sep)
        .join("/");
      if (relPath.startsWith(SOT_DIR.split(path.sep).join("/"))) continue;
      for (const symbol of findRedeclaredSymbols(
        fs.readFileSync(absolute, "utf8"),
      )) {
        out.push({ file: relPath, symbol });
      }
    }
  }
  return out.sort((a, b) =>
    a.file === b.file ? a.symbol.localeCompare(b.symbol) : a.file.localeCompare(b.file),
  );
}

export { ROOT };
