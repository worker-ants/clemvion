// `User` 엔티티 전체를 관계로 싣는 자리를 세는 가드 — 스캔·판정 순수 로직.
//
// 소비처는 형제 파일 `user-entity-exposure.spec.ts`. 배경·근거는 그 파일 헤더에 있다.
// 파서 순수 로직과 소비 spec 을 분리하는 규약은 형제 가드 `nullable-type-lie-cast-guard.ts`·
// `swagger-dto-contract-guard.ts` 와 동일하다.

import * as fs from 'node:fs';
import * as path from 'node:path';
import * as ts from 'typescript';

import { toPosixRelative } from '../../common/__test-utils__/source-scan';

/** `src` 루트. 이 파일은 `src/repo-guards/__tests__/` 에 있다. */
export const SRC_ROOT = path.resolve(__dirname, '..', '..');

/**
 * `User` 엔티티 전체를 싣는 한 자리.
 *
 * `key` 는 **줄 번호를 쓰지 않는다** — 위쪽에 줄이 하나만 들어가도 베이스라인이 통째로
 * 낡는다. 대신 `<상대경로>#<감싸는 메서드/함수 이름>` 으로 고정한다. 같은 메서드 안에서
 * 두 번 로드하면 `#2` 가 붙는다.
 */
export interface UserRelationLoad {
  readonly file: string;
  readonly method: string;
  readonly kind: 'relations' | 'joinAndSelect';
  /** 보고용. 베이스라인 키에는 **들어가지 않는다**. */
  readonly line: number;
  readonly key: string;
}

/** 관계 경로가 `User` 를 가리키는가 — `'user'` 또는 `'x.user'` (대소문자 무시). */
function isUserRelationPath(value: string): boolean {
  const last = value.split('.').pop() ?? value;
  return last.toLowerCase() === 'user';
}

/**
 * 감싸는 **메서드/함수** 이름. 없으면 감싸는 변수 이름, 그것도 없으면 `'<module>'`.
 *
 * **메서드를 변수보다 먼저 본다.** 실제 코드는 `const stored = await repo.findOne({…})`
 * 형태라, 가까운 것부터 집으면 `#stored` 가 나온다 — 같은 파일에 `stored` 가 둘이면
 * 베이스라인 키가 겹쳐 `#2` 로 접히고, **어느 자리가 남았는지 사람이 읽을 수 없다**.
 * 메서드 이름은 그 자체로 무엇을 하는 자리인지 말한다.
 */
function enclosingName(node: ts.Node, sf: ts.SourceFile): string {
  let fallback: string | null = null;
  let cur: ts.Node | undefined = node.parent;
  while (cur) {
    if (
      (ts.isMethodDeclaration(cur) ||
        ts.isFunctionDeclaration(cur) ||
        ts.isGetAccessorDeclaration(cur)) &&
      cur.name
    ) {
      return cur.name.getText(sf);
    }
    if (
      fallback === null &&
      ts.isVariableDeclaration(cur) &&
      ts.isIdentifier(cur.name)
    ) {
      fallback = cur.name.text;
    }
    cur = cur.parent;
  }
  return fallback ?? '<module>';
}

/**
 * `files` 에서 `User` 엔티티 **전체**를 싣는 자리를 전부 찾는다.
 *
 * 두 형태를 본다:
 *
 * 1. `relations: [... 'user' ...]` — 객체 리터럴의 `relations` 속성이 배열이고, 그 안에
 *    `User` 를 가리키는 문자열이 있는 경우. `find`/`findOne` 어느 쪽이든 같다.
 * 2. `leftJoinAndSelect('x.user', …)` / `innerJoinAndSelect(…)` — QueryBuilder 로
 *    관계를 **투영 없이** 통째로 싣는 형태. 감사 로그 유출이 정확히 이 모양이었고,
 *    지금은 그 자리가 `leftJoin` + 컬럼 3개 `addSelect` 로 바뀌어 있다.
 *
 * **`leftJoin`(AndSelect 없음)은 대상이 아니다** — 그것은 조인만 하고 컬럼을 안 싣는다.
 * 투영해 쓰는 정상 형태이므로 세면 오탐이 된다.
 */
export function findUserRelationLoads(
  files: readonly string[],
  srcRoot: string,
): UserRelationLoad[] {
  const out: UserRelationLoad[] = [];
  for (const file of files) {
    const sf = ts.createSourceFile(
      file,
      fs.readFileSync(file, 'utf8'),
      ts.ScriptTarget.Latest,
      true,
    );
    const rel = toPosixRelative(srcRoot, file);
    const seen = new Map<string, number>();

    const push = (node: ts.Node, kind: UserRelationLoad['kind']): void => {
      const method = enclosingName(node, sf);
      const base = `${rel}#${method}`;
      const n = (seen.get(base) ?? 0) + 1;
      seen.set(base, n);
      out.push({
        file: rel,
        method,
        kind,
        line: sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1,
        key: n === 1 ? base : `${base}#${n}`,
      });
    };

    const visit = (node: ts.Node): void => {
      // (1) `relations: [...]`
      if (
        ts.isPropertyAssignment(node) &&
        node.name.getText(sf) === 'relations' &&
        ts.isArrayLiteralExpression(node.initializer)
      ) {
        for (const el of node.initializer.elements) {
          if (ts.isStringLiteralLike(el) && isUserRelationPath(el.text)) {
            push(node, 'relations');
            break;
          }
        }
      }

      // (2) `*.leftJoinAndSelect('x.user', …)` / `*.innerJoinAndSelect(…)`
      if (
        ts.isCallExpression(node) &&
        ts.isPropertyAccessExpression(node.expression)
      ) {
        const fn = node.expression.name.text;
        if (fn === 'leftJoinAndSelect' || fn === 'innerJoinAndSelect') {
          const [first] = node.arguments;
          if (
            first &&
            ts.isStringLiteralLike(first) &&
            isUserRelationPath(first.text)
          ) {
            push(node, 'joinAndSelect');
          }
        }
      }

      ts.forEachChild(node, visit);
    };
    visit(sf);
  }
  return out;
}
