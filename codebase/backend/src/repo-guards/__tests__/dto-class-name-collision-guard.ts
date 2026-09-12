// `*.dto.ts` 의 `export class` 이름이 **저장소 안에서 유일한지** 세는 가드 — 순수 로직.
//
// 소비처는 형제 파일 `dto-class-name-collision.spec.ts`. 배경·근거는 그 파일 헤더에 있다.

import * as fs from 'node:fs';
import * as ts from 'typescript';

import { toPosixRelative } from '../../common/__test-utils__/source-scan';

/** 같은 이름을 쓰는 DTO 클래스 묶음 한 건. */
export interface DtoClassCollision {
  /** 충돌한 클래스 이름 — 이것이 곧 OpenAPI `components.schemas` 의 키다. */
  readonly name: string;
  /** 그 이름을 선언한 파일들 (`src` 기준 POSIX 상대경로, 정렬). */
  readonly files: readonly string[];
}

/**
 * 파일 하나에서 `export class` 이름을 뽑는다.
 *
 * **정규식이 아니라 AST 로 읽는다** — 주석·문자열 안의 `export class` 를 세면 가드가 자기
 * 오탐으로 죽고, 이 저장소는 *"대상에 진짜 문법과 정본 파서가 있으면 파서가 이긴다"* 를
 * 이미 결정해 뒀다. `typescript` 는 다른 가드들이 이미 쓰는 의존이다.
 */
export function exportedClassNames(file: string): string[] {
  const source = ts.createSourceFile(
    file,
    fs.readFileSync(file, 'utf8'),
    ts.ScriptTarget.Latest,
    true,
  );
  const out: string[] = [];
  for (const stmt of source.statements) {
    if (!ts.isClassDeclaration(stmt) || !stmt.name) continue;
    const exported = stmt.modifiers?.some(
      (m) => m.kind === ts.SyntaxKind.ExportKeyword,
    );
    if (exported) out.push(stmt.name.text);
  }
  return out;
}

/**
 * `*.dto.ts` 들에서 **이름이 겹치는** 클래스를 찾는다.
 *
 * @param files 스캔 대상 절대경로 목록. 호출자가 `collectTsFiles` 로 모은다.
 * @param srcRoot 보고 경로를 상대화할 기준.
 */
export function findDtoClassCollisions(
  files: readonly string[],
  srcRoot: string,
): DtoClassCollision[] {
  const byName = new Map<string, string[]>();
  for (const file of files) {
    if (!file.endsWith('.dto.ts')) continue;
    for (const name of exportedClassNames(file)) {
      const rel = toPosixRelative(srcRoot, file);
      const bucket = byName.get(name);
      if (bucket) bucket.push(rel);
      else byName.set(name, [rel]);
    }
  }
  return [...byName.entries()]
    .filter(([, paths]) => paths.length > 1)
    .map(([name, paths]) => ({ name, files: [...paths].sort() }))
    .sort((a, b) => a.name.localeCompare(b.name));
}
