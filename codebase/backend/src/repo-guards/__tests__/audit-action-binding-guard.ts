// `recordAudit` helper 의 `action` 파라미터가 **리소스에 묶인** 타입인지 검사하는 가드의
// 순수 로직.
//
// 소비처는 형제 파일 `audit-action-binding.spec.ts`. 배경·근거는 그 파일 헤더에 있다.
// 파서 순수 로직과 소비 spec 을 분리하는 규약은 형제 가드
// `engine-error-code-anchor-guard.ts` 와 동일하다.

import * as fs from 'node:fs';
import * as path from 'node:path';
import * as ts from 'typescript';

/** 검사 대상 디렉터리 (저장소 루트 기준). */
export const MODULES_DIR = 'codebase/backend/src/modules';

/**
 * 감사 기록 helper 로 인정하는 메서드 이름.
 *
 * 이름을 상수로 두는 이유: 오탈자가 조용히 "0건 검사" 를 만들면 가드가 통과처럼 보인다.
 * spec 이 이 상수로 최소 개수를 함께 단언한다.
 */
export const AUDIT_HELPER_NAMES = new Set(['recordAudit']);

/** 리소스 바인딩으로 인정하는 타입 생성자 이름. */
export const BOUND_TYPE_NAME = 'AuditActionFor';

export interface AuditHelperSite {
  /** 저장소 루트 기준 경로. */
  file: string;
  /** 1-based 줄 번호 — 사람이 바로 열 수 있게. */
  line: number;
  /** 메서드 이름 (`recordAudit`). */
  method: string;
  /** `action` 프로퍼티의 타입을 소스 그대로. 없으면 `null`. */
  actionType: string | null;
}

/** 대상 디렉터리의 `.ts` 소스를 모은다 (`.spec.ts`·`.d.ts` 제외). */
export function collectSourceFiles(repoRoot: string): string[] {
  const root = path.join(repoRoot, MODULES_DIR);
  const out: string[] = [];
  const walk = (dir: string): void => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
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
  walk(root);
  return out.sort();
}

/**
 * 한 소스에서 감사 helper 선언을 찾아 `action` 프로퍼티의 **선언된 타입**을 뽑는다.
 *
 * **값이 아니라 형태로 판정한다** — 액션 문자열이 무엇인지는 보지 않고, 파라미터 객체
 * 타입에 `action` 이 어떤 타입으로 선언됐는지만 본다. 값으로 판정하면 새 액션이 추가될
 * 때마다 가드를 고쳐야 하고, 정작 "묶이지 않았다" 는 구조적 사실은 놓친다.
 */
export function findAuditHelpers(
  sourceText: string,
  fileLabel: string,
): AuditHelperSite[] {
  const sf = ts.createSourceFile(
    fileLabel,
    sourceText,
    ts.ScriptTarget.Latest,
    true,
  );
  const found: AuditHelperSite[] = [];

  const visit = (node: ts.Node): void => {
    if (
      ts.isMethodDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      AUDIT_HELPER_NAMES.has(node.name.text)
    ) {
      const line = sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1;
      found.push({
        file: fileLabel,
        line,
        method: node.name.text,
        actionType: extractActionType(node),
      });
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return found;
}

/**
 * `recordAudit(params: { action: T; ... })` 의 `T` 를 소스 문자열로 돌려준다.
 *
 * 파라미터가 없거나 `action` 프로퍼티가 없으면 `null` — 그것도 "묶이지 않음" 으로 다룬다
 * (가드가 조용히 넘기면 안 되는 형태다).
 */
function extractActionType(node: ts.MethodDeclaration): string | null {
  const first = node.parameters[0];
  if (!first?.type || !ts.isTypeLiteralNode(first.type)) return null;
  for (const member of first.type.members) {
    if (
      ts.isPropertySignature(member) &&
      ts.isIdentifier(member.name) &&
      member.name.text === 'action' &&
      member.type
    ) {
      return member.type.getText();
    }
  }
  return null;
}

/** 리소스에 묶이지 않은 helper 만 남긴다. */
export function findUnboundHelpers(
  sites: AuditHelperSite[],
): AuditHelperSite[] {
  return sites.filter((s) => !s.actionType?.startsWith(`${BOUND_TYPE_NAME}<`));
}
