// `triggerRepository.save()` 호출이 `endpoint_path` UNIQUE 충돌 래핑을 갖췄는지 세는 가드
// — 스캔·판정 순수 로직.
//
// 소비처는 형제 파일 `endpoint-path-conflict-wrap.spec.ts`. 배경·근거는 그 파일 헤더에 있다.
// 파서 순수 로직과 소비 spec 을 분리하는 규약은 형제 가드 `user-entity-exposure-guard.ts`·
// `swagger-dto-contract-guard.ts` 와 동일하다.

import * as fs from 'node:fs';
import * as path from 'node:path';
import * as ts from 'typescript';

import { toPosixRelative } from '../../common/__test-utils__/source-scan';

/** `src` 루트. 이 파일은 `src/repo-guards/__tests__/` 에 있다. */
export const SRC_ROOT = path.resolve(__dirname, '..', '..');

/** 래핑 여부를 판정하는 헬퍼 이름. 오탈자가 fail-open 방향으로 죽지 않도록 상수로 둔다. */
export const CONFLICT_WRAPPER = 'rethrowEndpointPathConflict';

/** 스캔 대상 리포지토리 프로퍼티 이름. */
export const TRIGGER_REPOSITORY = 'triggerRepository';

/** 한 `save()` 호출 자리. */
export interface TriggerSaveSite {
  readonly file: string;
  readonly method: string;
  /** `.catch(… rethrowEndpointPathConflict …)` 로 감싸였는가. */
  readonly wrapped: boolean;
  /**
   * `<상대경로>#<감싸는 메서드 이름>` — **줄 번호를 쓰지 않는다.** 위쪽에 줄이 하나만
   * 들어가도 베이스라인이 통째로 낡는다. 한 메서드 안에서 두 번 저장하면 `#2` 가 붙는다.
   */
  readonly key: string;
}

/**
 * `node` 를 감싸는 가장 가까운 메서드/함수 이름. 없으면 `<top-level>`.
 *
 * > **`const x = ...` 을 이름으로 삼지 않는다.** 첫 판이 `VariableDeclaration` 을 무조건
 * > 받아들여, 저장소의 두 정답 사이트(`const saved = await repo.save(t).catch(...)`)가
 * > 메서드 이름이 아니라 **`saved`** 로 키가 잡혔다 — 베이스라인을 그대로 굳혔으면
 * > `create`/`update` 를 지목하지 못하는 목록이 됐다. 변수 선언은 **초기자가 함수일 때만**
 * > 함수의 이름이다.
 */
function enclosingMethodName(node: ts.Node, sf: ts.SourceFile): string {
  for (let cur: ts.Node | undefined = node.parent; cur; cur = cur.parent) {
    if (ts.isMethodDeclaration(cur) || ts.isMethodSignature(cur)) {
      return cur.name.getText(sf);
    }
    if (ts.isFunctionDeclaration(cur) && cur.name) {
      return cur.name.getText(sf);
    }
    if (
      (ts.isPropertyDeclaration(cur) || ts.isVariableDeclaration(cur)) &&
      cur.name &&
      cur.initializer &&
      (ts.isArrowFunction(cur.initializer) ||
        ts.isFunctionExpression(cur.initializer))
    ) {
      return cur.name.getText(sf);
    }
  }
  return '<top-level>';
}

/**
 * `expr` 가 `<무언가>.<prop>` 형태의 프로퍼티 접근인가.
 *
 * `?.` (optional chaining) 도 같은 노드 종류이므로 함께 걸린다 — 저장 호출이
 * `repo?.save(...)` 로 쓰여도 놓치지 않는다.
 */
function isPropertyAccessNamed(expr: ts.Expression, prop: string): boolean {
  return ts.isPropertyAccessExpression(expr) && expr.name.getText() === prop;
}

/**
 * `save()` 호출을 감싸는 `.catch(...)` 가 충돌 래퍼를 부르는가.
 *
 * **텍스트로 확인한다 — 이름 해석을 하지 않는다.** 이 가드는 단일 파일 AST 만 보므로
 * `this.rethrowEndpointPathConflict` 가 실제로 무엇인지 따라갈 수 없다. 이름이 나타나는지만
 * 묻는 **좁고 눈먼 술어**다 (형제 가드 `hasProjectionFor` 와 같은 규율). 이름을 바꾸면 이
 * 상수도 함께 바꿔야 하고, 안 바꾸면 전부 미래핑으로 잡혀 **fail-safe 방향으로** 시끄러워진다.
 */
function isWrappedByConflictCatch(
  saveCall: ts.CallExpression,
  sf: ts.SourceFile,
): boolean {
  // `repo.save(x).catch(cb)` — save 호출이 `.catch` 프로퍼티 접근의 수신자다.
  for (let cur: ts.Node | undefined = saveCall.parent; cur; cur = cur.parent) {
    if (
      ts.isCallExpression(cur) &&
      isPropertyAccessNamed(cur.expression, 'catch')
    ) {
      return cur.getText(sf).includes(CONFLICT_WRAPPER);
    }
    // 체인을 벗어나면(문장 경계) 더 볼 것이 없다.
    if (ts.isStatement(cur)) return false;
  }
  return false;
}

/**
 * `files` 안의 **`triggerRepository.save(...)` 호출을 전부** 찾아 래핑 여부와 함께 돌려준다.
 *
 * `await` 유무·`.catch` 체인 유무와 무관하게 **모든** 호출을 센다 — 그것이 이 가드의 요점이다
 * (아래 spec 헤더 참조).
 */
export function findTriggerRepositorySaves(
  files: readonly string[],
  srcRoot: string,
): TriggerSaveSite[] {
  const out: TriggerSaveSite[] = [];
  const seen = new Map<string, number>();

  for (const file of files) {
    const sf = ts.createSourceFile(
      file,
      fs.readFileSync(file, 'utf8'),
      ts.ScriptTarget.Latest,
      true,
    );
    const rel = toPosixRelative(srcRoot, file);

    const walk = (node: ts.Node): void => {
      if (
        ts.isCallExpression(node) &&
        isPropertyAccessNamed(node.expression, 'save')
      ) {
        const receiver = (node.expression as ts.PropertyAccessExpression)
          .expression;
        if (receiver.getText(sf).includes(TRIGGER_REPOSITORY)) {
          const method = enclosingMethodName(node, sf);
          const base = `${rel}#${method}`;
          const n = (seen.get(base) ?? 0) + 1;
          seen.set(base, n);
          out.push({
            file: rel,
            method,
            wrapped: isWrappedByConflictCatch(node, sf),
            key: n === 1 ? base : `${base}#${n}`,
          });
        }
      }
      ts.forEachChild(node, walk);
    };
    walk(sf);
  }
  return out.sort((a, b) => a.key.localeCompare(b.key));
}

/** 래핑되지 않은 자리의 키 목록. */
export function findUnwrappedTriggerSaves(
  files: readonly string[],
  srcRoot: string,
): string[] {
  return findTriggerRepositorySaves(files, srcRoot)
    .filter((s) => !s.wrapped)
    .map((s) => s.key);
}
