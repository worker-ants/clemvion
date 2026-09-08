// `User` 엔티티 전체를 관계로 싣는 자리를 세는 가드 — 스캔·판정 순수 로직.
//
// 소비처는 형제 파일 `user-entity-exposure.spec.ts`. 배경·근거는 그 파일 헤더에 있다.
// 파서 순수 로직과 소비 spec 을 분리하는 규약은 형제 가드 `nullable-type-lie-cast-guard.ts`·
// `swagger-dto-contract-guard.ts` 와 동일하다.

import * as fs from 'node:fs';
import * as path from 'node:path';
import * as ts from 'typescript';

import {
  enclosingScopeName,
  toPosixRelative,
} from '../../common/__test-utils__/source-scan';

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
  /** 어떤 관계 이름으로 걸렸나 — `user` · `creator` · `owner` 등. */
  readonly relation: string;
  readonly key: string;
}

/** `User` · `User | null` · `User[]` — 어느 형태든 `User` 를 가리키는가. */
function referencesUserType(type: ts.TypeNode): boolean {
  if (ts.isTypeReferenceNode(type)) {
    return type.typeName.getText() === 'User';
  }
  if (ts.isArrayTypeNode(type)) {
    return referencesUserType(type.elementType);
  }
  if (ts.isUnionTypeNode(type)) {
    return type.types.some((t) => referencesUserType(t));
  }
  return false;
}

/**
 * `*.entity.ts` 를 훑어 **타입이 `User` 인 속성**마다 콜백을 부른다.
 *
 * 두 축(`collectUserRelationNames` · `findEagerUserRelations`)이 같은 순회를 필요로 한다.
 * 순회를 각자 복제하면 한쪽만 고쳐지는 자리가 생긴다 — 이 가드가 다른 곳에서 강조한
 * *"출처를 바꿔라"* 를 순회 로직 자체에는 안 쓴 셈이었다
 * (`review/code/2026/09/06/11_55_36` W5).
 */
function forEachUserTypedProperty(
  entityFiles: readonly string[],
  visit: (
    node: ts.PropertyDeclaration,
    sf: ts.SourceFile,
    file: string,
  ) => void,
): void {
  for (const file of entityFiles) {
    const sf = ts.createSourceFile(
      file,
      fs.readFileSync(file, 'utf8'),
      ts.ScriptTarget.Latest,
      true,
    );
    const walk = (node: ts.Node): void => {
      if (
        ts.isPropertyDeclaration(node) &&
        node.type &&
        referencesUserType(node.type)
      ) {
        visit(node, sf, file);
      }
      ts.forEachChild(node, walk);
    };
    walk(sf);
  }
}

/**
 * `@ManyToOne(() => User, { eager: true })` 처럼 **엔티티 선언만으로 항상 로드되는**
 * `User` 관계. `<파일>#<속성명>` 키로 돌려준다.
 *
 * ## 왜 별도 축인가
 *
 * eager 관계는 **호출부에 아무 텍스트도 남기지 않는다** — `relations` 옵션도
 * `*JoinAndSelect` 도 없이 TypeORM 이 자동으로 조인해 전 컬럼을 싣는다. 호출부만 훑는
 * `findUserRelationLoads` 는 원리적으로 볼 수 없고, 그래서 이 자리에 성능 목적의
 * `eager: true` 가 하나 붙으면 검출망이 **영구히** 놓친다
 * (`review/code/2026/09/06/11_27_53` W1).
 *
 * 실측(2026-09-06): 현재 저장소에 `User` 를 가리키는 eager 관계는 **0건**이다. 0을
 * 유지하는 것이 이 축의 계약이다 — 붙이려면 그때 투영 전략을 함께 정해야 한다.
 *
 * > **0건이라는 사실과 이 함수가 실제로 잡는다는 사실은 다른 주장이다.** 첫 판은 전자만
 * > 확인했고, `hasEagerDecorator` 를 `return false` 로 무력화해도 스위트가 **15/15 초록**
 * > 이었다 (`review/code/2026/09/06/11_55_36` W1 — 리뷰어가 직접 뮤테이션해 확인). 지금은
 * > `fixtures/user-eager-relation.fixture.ts` 가 양성/음성을 모두 물어 검출력을 고정한다.
 */
export function findEagerUserRelations(
  entityFiles: readonly string[],
  srcRoot: string,
): string[] {
  const out: string[] = [];
  forEachUserTypedProperty(entityFiles, (node, sf, file) => {
    if (hasEagerDecorator(node, sf)) {
      out.push(`${toPosixRelative(srcRoot, file)}#${node.name.getText(sf)}`);
    }
  });
  return out.sort();
}

/** 관계 데코레이터 인자에 `eager: true` 가 있는가. */
function hasEagerDecorator(
  node: ts.PropertyDeclaration,
  sf: ts.SourceFile,
): boolean {
  for (const dec of ts.getDecorators(node) ?? []) {
    if (!ts.isCallExpression(dec.expression)) continue;
    for (const arg of dec.expression.arguments) {
      const inner = unwrap(arg);
      if (!ts.isObjectLiteralExpression(inner)) continue;
      for (const prop of inner.properties) {
        if (
          ts.isPropertyAssignment(prop) &&
          propKeyText(prop.name, sf) === 'eager' &&
          prop.initializer.kind === ts.SyntaxKind.TrueKeyword
        ) {
          return true;
        }
      }
    }
  }
  return false;
}

/**
 * `*.entity.ts` 에서 **타입이 `User` 인 관계 속성 이름**을 전부 모은다.
 *
 * ## 왜 이름을 손으로 적지 않는가
 *
 * 첫 판은 관계 경로의 마지막 세그먼트가 `'user'` 인지만 봤다. 그래서
 * `WorkflowVersion.creator`(`@ManyToOne(() => User)`)를 통째로 싣는 자리를 **놓쳤고**, 그
 * 자리는 실제로 `GET /api/workflows/:wfId/versions/:versionId` 로 `User` 전 컬럼을
 * 내보내고 있었다 (`review/code/2026/09/06/10_13_22` Critical 1).
 *
 * 목록을 `['user','creator','owner']` 로 **늘리는** 것은 같은 결함의 다음 판이다 — 다음에
 * 누가 `approver: User` 를 만들면 또 놓친다. 목록을 넓히지 말고 **출처를 바꾼다**:
 * 엔티티 선언이 SoT 이고 이 함수가 거기서 파생시킨다.
 *
 * 판정 축은 **속성의 타입 주석**이다 — 데코레이터 인자(`() => User`)가 아니다. 엔티티가
 * 그 타입을 실제로 약속하는 자리가 타입 주석이고, 배열·nullable 형태까지 같은 술어로
 * 덮인다.
 */
export function collectUserRelationNames(
  entityFiles: readonly string[],
): string[] {
  const names = new Set<string>();
  forEachUserTypedProperty(entityFiles, (node, sf) => {
    names.add(node.name.getText(sf));
  });
  return [...names].sort();
}

/**
 * 프로퍼티 이름 텍스트에서 따옴표를 벗긴다 — `creator` 도 `'creator'` 도 같은 키다.
 *
 * 종전에는 두 함수가 각자 인라인으로 벗겼고, `relations`/`select` 키를 비교하는 자리
 * 둘은 아예 안 벗겼다 (`review/code/2026/09/06/12_28_02` INFO#2·#12).
 */
function propKeyText(name: ts.PropertyName, sf: ts.SourceFile): string {
  return name.getText(sf).replace(/['"]/g, '');
}

/** 관계 경로가 `User` 관계를 가리키는가 — `'creator'` 또는 `'x.creator'`. */
function isUserRelationPath(
  value: string,
  names: ReadonlySet<string>,
): boolean {
  const last = value.split('.').pop() ?? value;
  return names.has(last.toLowerCase());
}

/**
 * `as`·`satisfies`·괄호를 벗겨 **안쪽 식**을 돌려준다.
 *
 * 캐스트가 한 겹만 있어도 `ts.isObjectLiteralExpression` 이 거짓이 되어 술어가 통째로
 * 눈을 감는다 — fixture 에 `as unknown as Record<…>` 를 쓰자마자 중첩 객체 위반이
 * 검출되지 않는 것을 실측으로 확인했다 (`review/code/2026/09/06/10_53_48` W2 대응 중).
 * 실제 코드도 TypeORM 타입을 맞추려 캐스트를 쓰므로 같은 구멍이 프로덕션에도 열린다.
 *
 * **두 형태만 벗긴다.** 처음엔 괄호(`ts.isParenthesizedExpression`)와 구식 단언
 * (`<T>expr`)도 벗겼는데, 그 두 분기는 **fixture 로 관측할 수 없다**
 * (`review/code/2026/09/06/12_28_02` W1):
 *
 * - 괄호 — prettier 가 불필요한 괄호를 지운다. fixture 에 써도 포맷 단계에서 사라진다.
 * - `<T>expr` — 저장소 전체에 **0건**이고 lint 가 `as` 를 권한다.
 *
 * 관측할 수 없는 분기는 지워져도 아무도 모른다. 남기면 "덮었다" 는 인상만 주므로 잘라냈다 —
 * 필요해지면 그때 fixture 와 함께 되살린다.
 */
function unwrap(expr: ts.Expression): ts.Expression {
  let cur = expr;
  while (ts.isAsExpression(cur) || ts.isSatisfiesExpression(cur)) {
    cur = cur.expression;
  }
  return cur;
}

/** `relations` 초기자에서 처음 발견되는 `User` 관계 이름. 없으면 `null`. */
function userRelationInInitializer(
  rawInit: ts.Expression,
  sf: ts.SourceFile,
  names: ReadonlySet<string>,
): string | null {
  const init = unwrap(rawInit);
  // 형태 1 — 배열 리터럴.
  if (ts.isArrayLiteralExpression(init)) {
    for (const el of init.elements) {
      if (ts.isStringLiteralLike(el) && isUserRelationPath(el.text, names)) {
        return el.text.split('.').pop() ?? el.text;
      }
    }
    return null;
  }
  // 형태 2 — 객체 리터럴 (TypeORM 0.3). **중첩까지 내려간다** —
  // `relations: { workflow: { creator: true } }` 도 `creator` 를 통째로 싣는다.
  // 최상위만 보면 배열 형태의 `'member.user'` 는 잡으면서 객체 형태의 같은 중첩은
  // 놓친다 — 이 가드가 막으려는 결함 클래스를 자신이 반복하는 자리였다
  // (`review/code/2026/09/06/10_53_48` W2).
  if (ts.isObjectLiteralExpression(init)) {
    for (const prop of init.properties) {
      if (!prop.name) continue;
      const key = propKeyText(prop.name, sf);
      if (names.has(key.toLowerCase())) return key;
      if (ts.isPropertyAssignment(prop)) {
        const inner = unwrap(prop.initializer);
        if (ts.isObjectLiteralExpression(inner)) {
          const nested = userRelationInInitializer(inner, sf, names);
          if (nested !== null) return nested;
        }
      }
    }
    return null;
  }
  return null;
}

/**
 * 같은 옵션 객체에 그 관계를 **실제로 좁히는** `select` 가 있는가.
 *
 * `select: { creator: { id: true, … } }` 가 있으면 컬럼이 좁혀졌으므로 위반이 아니다 —
 * 이것을 안 보면 `findByWorkflow` 처럼 **처음부터 옳게 짜인 자리**가 베이스라인을 채워
 * 래칫이 무엇을 막는지 흐려진다.
 *
 * **값이 불리언이면 투영이 아니다.** `select: { creator: true }` 는 키는 있지만 컬럼을
 * 하나도 좁히지 않는다 — `relations: { creator: true }` 단독과 같은 오버페치다. 키 존재만
 * 보면 *"겉은 투영인데 실은 전체 노출"* 을 통과시키는데, 그것이 정확히 이 가드가 막으려는
 * 결함 클래스다 (`review/code/2026/09/06/11_27_53` W2).
 *
 * **왜 "객체인가" 가 아니라 "불리언이 아닌가" 인가**: 처음엔 `isObjectLiteralExpression`
 * 을 요구했는데, 그러자 `select: { creator: CREATOR_PROJECTION }` 처럼 **이름 있는 상수**를
 * 쓰는 정상 형태가 위반으로 잡혔다(이 저장소가 실제로 쓰는 형태다). 식별자를 따라가려면
 * 타입 체커가 필요하고 이 가드는 단일 파일 AST 만 본다. 결함의 실제 형태는 **불리언**이므로
 * 그것만 배제한다 — 모르는 것을 통과시키되 아는 결함은 확실히 잡는, 좁고 눈먼 술어다.
 */
function hasProjectionFor(
  relationsProp: ts.PropertyAssignment,
  relation: string,
  sf: ts.SourceFile,
): boolean {
  const options = relationsProp.parent;
  if (!ts.isObjectLiteralExpression(options)) return false;
  for (const prop of options.properties) {
    if (
      !ts.isPropertyAssignment(prop) ||
      propKeyText(prop.name, sf) !== 'select' ||
      !ts.isObjectLiteralExpression(prop.initializer)
    ) {
      continue;
    }
    for (const sel of prop.initializer.properties) {
      if (!sel.name) continue;
      const key = propKeyText(sel.name, sf);
      if (key.toLowerCase() !== relation.toLowerCase()) continue;
      if (!ts.isPropertyAssignment(sel)) return true;
      const value = unwrap(sel.initializer);
      // `true`/`false` 는 컬럼을 안 좁힌다. 그 밖(객체·식별자·스프레드)은 좁힌 것으로 본다.
      return (
        value.kind !== ts.SyntaxKind.TrueKeyword &&
        value.kind !== ts.SyntaxKind.FalseKeyword
      );
    }
  }
  return false;
}

/**
 * `files` 에서 `User` 관계를 **투영 없이 통째로** 싣는 자리를 전부 찾는다.
 *
 * 세 형태를 본다 — TypeORM 이 관계를 지정하는 방식이 셋이기 때문이다:
 *
 * 1. `relations: [… 'creator' …]` — 배열 리터럴.
 * 2. `relations: { creator: true }` — **0.3 객체 형태.** 첫 판이 이것을 빠뜨렸는데, 하필
 *    실제 유출 지점의 자매 메서드가 이 형태를 쓰고 있었다.
 * 3. `leftJoinAndSelect('x.creator', …)` / `innerJoinAndSelect(…)` — QueryBuilder.
 *
 * **`select` 로 투영한 자리는 대상이 아니다.** `leftJoin`(AndSelect 없음)도 같은 이유로
 * 대상이 아니다 — 조인만 하고 컬럼을 싣지 않는다.
 *
 * @param userRelationNames `collectUserRelationNames` 가 엔티티에서 파생시킨 집합.
 */
export function findUserRelationLoads(
  files: readonly string[],
  srcRoot: string,
  userRelationNames: readonly string[],
): UserRelationLoad[] {
  const names = new Set(userRelationNames.map((n) => n.toLowerCase()));
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

    const push = (
      node: ts.Node,
      kind: UserRelationLoad['kind'],
      relation: string,
    ): void => {
      const method = enclosingScopeName(node, sf);
      const base = `${rel}#${method}`;
      const n = (seen.get(base) ?? 0) + 1;
      seen.set(base, n);
      out.push({
        file: rel,
        method,
        kind,
        relation,
        key: n === 1 ? base : `${base}#${n}`,
      });
    };

    const visit = (node: ts.Node): void => {
      if (
        ts.isPropertyAssignment(node) &&
        propKeyText(node.name, sf) === 'relations'
      ) {
        const relation = userRelationInInitializer(node.initializer, sf, names);
        if (relation !== null && !hasProjectionFor(node, relation, sf)) {
          push(node, 'relations', relation);
        }
      }

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
            isUserRelationPath(first.text, names)
          ) {
            push(node, 'joinAndSelect', first.text.split('.').pop() ?? '');
          }
        }
      }

      ts.forEachChild(node, visit);
    };
    visit(sf);
  }
  return out;
}
