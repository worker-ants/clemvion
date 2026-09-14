// 트리거 응답에서 지워야 할 **비밀 컬럼 목록** 3중 사본 정합 가드 — 읽기 순수 로직.
//
// 소비처는 형제 파일 `trigger-secret-columns.spec.ts`. 배경·근거는 그 파일 헤더에 있다.
// 파서 순수 로직과 소비 spec 을 분리하는 규약은 형제 가드
// `redis-fail-open-catalog-guard.ts` · `masked-reject-callers-guard.ts` 와 동일하다.

import * as fs from 'node:fs';
import * as path from 'node:path';
import * as ts from 'typescript';

/** 정본 — 서비스가 응답 경계에서 실제로 지우는 컬럼 목록. `export` 가 아니다(의도). */
export const CANONICAL_SOURCE =
  'codebase/backend/src/modules/triggers/triggers.service.ts';
export const CANONICAL_CONST = 'TRIGGER_RESPONSE_STRIP_COLUMNS';

/**
 * 사본 — 테스트 헬퍼 둘. 실패 메시지가 *무엇이* 샜는지 말하게 하려고 이름을 다시 적는다.
 *
 * **이 가드가 보는 것은 여기 적힌 자리뿐이다.** 네 번째 사본이 생겨도 이 배열에 넣지 않으면
 * 감시 범위 밖이다 — 정적 목록 대조의 태생적 한계이고, 사본을 «전수 탐지» 하려면 이름이
 * 다른 상수까지 찾아야 해서 문제가 무한해진다. 새 사본을 만들면 여기 추가할 것.
 */
export const MIRROR_SOURCES = [
  'codebase/backend/src/shared/testing/schedule-trigger-ref.ts',
  'codebase/backend/src/shared/testing/trigger-workflow-ref.ts',
] as const;
export const MIRROR_CONST = 'TRIGGER_SECRET_COLUMNS';

/**
 * `const X = ['a', 'b'] as const` 에서 문자열 리터럴을 순서대로 뽑는다.
 *
 * **정규식이 아니라 AST 로 읽는다** — 세 파일 다 목록 바로 위에 긴 JSDoc 이 있고 그 안에
 * 컬럼 이름이 산문으로 등장한다(`notification_secret_v2` 등). 정규식이면 주석의 이름이
 * 값으로 잡혀 **가드가 자기 오판을 사실로 굳힌다.** 형제 가드
 * `redis-fail-open-catalog-guard.ts` 가 같은 이유로 AST 를 쓴다.
 *
 * **래퍼를 «전부» 벗긴다.** 세 선언의 형태가 서로 다르다 — 정본은
 * `[...] as const satisfies readonly (keyof Trigger)[]` 이고 헬퍼 둘은 `[...] as const` 다.
 * `AsExpression` 하나만 벗기는 리더는 **정본에서 `null`** 을 낸다 — `satisfies` 노드에서
 * 멈추므로 배열 리터럴에 도달하지 못한다(첫 판 JSDoc 에 *"빈 배열"* 이라 적었는데 뮤턴트
 * 실측이 `null` 로 반증했다). 그래서 `as`·`satisfies`·괄호를 루프로 벗긴다.
 *
 * @returns 리터럴 값 배열. 선언이 없거나 형태가 다르면 `null` — 호출부가 그것을 결함으로
 *   보고한다. **빈 배열과 `null` 을 가른다**: 전자는 "목록이 비었다", 후자는 "못 읽었다".
 */
export function readStringArrayConst(
  repoRoot: string,
  relPath: string,
  constName: string,
): string[] | null {
  const abs = path.join(repoRoot, relPath);
  // 파일이 사라지면 raw `ENOENT` 가 나서 «가드가 깨졌다» 인지 «대상이 리네임됐다» 인지
  // 구분되지 않는다. 이 가드는 경로를 상수로 박고 있으므로 후자가 실제 시나리오다.
  if (!fs.existsSync(abs)) {
    throw new Error(
      `${relPath} 가 없다 — 파일이 옮겨졌거나 이름이 바뀌었다. ` +
        `trigger-secret-columns-guard.ts 의 경로 상수를 함께 고칠 것.`,
    );
  }
  const sf = ts.createSourceFile(
    abs,
    fs.readFileSync(abs, 'utf8'),
    ts.ScriptTarget.Latest,
    true,
  );

  let found: string[] | null = null;
  const unwrap = (e: ts.Expression): ts.Expression => {
    let cur = e;
    for (;;) {
      if (ts.isAsExpression(cur) || ts.isSatisfiesExpression(cur)) {
        cur = cur.expression;
      } else if (ts.isParenthesizedExpression(cur)) {
        cur = cur.expression;
      } else {
        return cur;
      }
    }
  };

  const visit = (node: ts.Node): void => {
    if (
      found === null &&
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.name.text === constName &&
      node.initializer
    ) {
      const inner = unwrap(node.initializer);
      if (ts.isArrayLiteralExpression(inner)) {
        const out: string[] = [];
        for (const el of inner.elements) {
          // 문자열 리터럴이 아닌 원소(스프레드·식별자)가 섞이면 «못 읽었다» 로 낸다 —
          // 조용히 건너뛰면 목록이 짧아진 채로 세 사본이 "같다" 고 통과할 수 있다.
          if (!ts.isStringLiteralLike(el)) return;
          out.push(el.text);
        }
        found = out;
      }
      return;
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return found;
}

/** 정본 + 사본 둘을 한 번에 읽는다. 키는 저장소 상대경로. */
export function readAllTriggerSecretColumnLists(
  repoRoot: string,
): Record<string, string[] | null> {
  const out: Record<string, string[] | null> = {
    [CANONICAL_SOURCE]: readStringArrayConst(
      repoRoot,
      CANONICAL_SOURCE,
      CANONICAL_CONST,
    ),
  };
  for (const rel of MIRROR_SOURCES) {
    out[rel] = readStringArrayConst(repoRoot, rel, MIRROR_CONST);
  }
  return out;
}
