// `recordAudit` helper 의 `action` 파라미터가 **리소스에 묶인** 타입인지 검사하는 가드의
// 순수 로직.
//
// 소비처는 형제 파일 `audit-action-binding.spec.ts`. 배경·근거는 그 파일 헤더에 있다.
// 파서 순수 로직과 소비 spec 을 분리하는 규약은 형제 가드
// `engine-error-code-anchor-guard.ts` 와 동일하다.

import * as path from 'node:path';
import * as ts from 'typescript';
import { collectTsFiles } from '../../common/__test-utils__/source-scan';

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
  /**
   * `AuditActionFor<X>` 의 `X` 를 **리터럴 값으로 정규화**한 것. 묶이지 않았거나 해석 불가면 `null`.
   *
   * `typeof TRIGGER_RESOURCE_TYPE` 과 `'trigger'` 를 같은 값으로 본다 — 표기 형태로 갈리면
   * 선언 문법을 바꾸는 것만으로 검사를 빠져나간다.
   */
  boundResource: string | null;
  /** helper 가 `record()` 에 실제로 넘기는 `resourceType` 을 같은 방식으로 정규화한 값. */
  recordedResource: string | null;
}

/** 대상 디렉터리의 `.ts` 소스를 모은다 (`.spec.ts`·`.d.ts` 제외). */
export function collectSourceFiles(repoRoot: string): string[] {
  return collectTsFiles(path.join(repoRoot, MODULES_DIR));
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
  const consts = collectStringConsts(sf);

  const visit = (node: ts.Node): void => {
    // **두 선언 형태를 모두 본다.** 메서드(`recordAudit(params) {}`)와 화살표 함수 클래스
    // 필드(`recordAudit = (params) => {}`) — 후자는 NestJS 서비스에서 `this` 바인딩용으로
    // 흔하다. 메서드만 보면 화살표 형태는 **존재하지 않는 것처럼 통과**해, 이 가드가 막으려는
    // 결함(리소스에 안 묶인 `action`)이 그 형태로 조용히 재도입된다.
    const decl = auditHelperParams(node);
    if (decl) {
      const line = sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1;
      found.push({
        file: fileLabel,
        line,
        method: decl.name,
        actionType: extractActionType(decl.params),
        boundResource: normalizeResource(
          extractBoundResourceText(decl.params),
          consts,
        ),
        recordedResource: normalizeResource(
          extractRecordedResourceText(decl.body),
          consts,
        ),
      });
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return found;
}

/**
 * 감사 helper 선언이면 그 파라미터 목록을, 아니면 `null`.
 *
 * 메서드 선언과 화살표 함수 클래스 필드를 같은 형태로 정규화한다 — 판정 로직이 선언
 * 문법에 따라 갈리면 새 문법이 등장할 때마다 사각지대가 생긴다.
 */
function auditHelperParams(node: ts.Node): AuditHelperDecl | null {
  if (
    ts.isMethodDeclaration(node) &&
    ts.isIdentifier(node.name) &&
    AUDIT_HELPER_NAMES.has(node.name.text)
  ) {
    return { name: node.name.text, params: node.parameters, body: node.body };
  }
  if (
    ts.isPropertyDeclaration(node) &&
    ts.isIdentifier(node.name) &&
    AUDIT_HELPER_NAMES.has(node.name.text) &&
    node.initializer &&
    (ts.isArrowFunction(node.initializer) ||
      ts.isFunctionExpression(node.initializer))
  ) {
    return {
      name: node.name.text,
      params: node.initializer.parameters,
      body: node.initializer.body,
    };
  }
  return null;
}

/** helper 선언에서 판정에 필요한 두 조각 — 파라미터 목록과 본문. */
interface AuditHelperDecl {
  /** helper 이름 — 선언 형태를 이미 좁힌 이 자리에서 꺼낸다. */
  name: string;
  params: ts.NodeArray<ts.ParameterDeclaration>;
  body: ts.Node | undefined;
}

/**
 * `recordAudit(params: { action: T; ... })` 의 `T` 를 소스 문자열로 돌려준다.
 *
 * 파라미터가 없거나 `action` 프로퍼티가 없으면 `null` — 그것도 "묶이지 않음" 으로 다룬다
 * (가드가 조용히 넘기면 안 되는 형태다).
 */
function extractActionType(
  params: ts.NodeArray<ts.ParameterDeclaration>,
): string | null {
  const first = params[0];
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

/**
 * **엉뚱한** 리소스에 묶인 helper 만 남긴다 — `AuditActionFor<X>` 의 `X` 가 그 helper 가
 * `record()` 에 실제로 넘기는 `resourceType` 과 다른 경우.
 *
 * `findUnboundHelpers` 는 "무언가에 묶였는가" 까지만 본다. 그 술어는 이 가드가 지키려는
 * 불변식보다 **한 칸 좁다** — `AuthConfigsService.recordAudit` 의 `action` 을
 * `AuditActionFor<'workflow'>` 로 선언해도 접두 검사는 통과하고, `resourceType='auth_config'`
 * 인데 action 은 workflow 인 **모순된 감사 행**이 그대로 만들어진다.
 *
 * **컴파일러가 오늘 이것을 잡기는 한다 — 단 호출부를 통해서다.** `auth-configs` helper 를
 * `AuditActionFor<'workflow'>` 로 바꾼 뮤턴트는 `tsc` 에서 **5건**의 에러를 내는데, 그 5건은
 * 전부 helper *선언부*가 아니라 액션을 넘기는 *호출부*다. `_NoCrossDomain` 캐너리를 함께
 * 제거해도 5건 그대로였다 — 즉 잡는 주체는 그 캐너리가 아니라 **호출부의 액션 리터럴**이다.
 *
 * 그래서 이 가드가 닫는 것은 그 간접 방어가 **닿지 않는 자리**다: 호출부가 아직 없는 helper
 * (선언을 먼저 만든 경우), 그리고 호출부의 액션이 두 리소스 모두에 유효해 갈리지 않는 경우.
 * 덤으로 실패가 선언 한 줄로 보인다 — 호출부 N곳의 대입 에러로 흩어지지 않는다.
 * (5차 리뷰 architecture·testing 이 이 표면을 지목했다. 다만 두 리뷰어가 근거로 댄
 * "뮤턴트가 0 에러로 통과한다" 는 호출부 없는 스크래치 재현이라 실제 저장소에서는 반증됐다 —
 * 표면은 실재하되 이유가 다르다.)
 *
 * 양쪽 값을 **리터럴로 정규화한 뒤** 비교한다. 한쪽이 해석되지 않으면(로컬 상수가 아닌
 * import 등) 판정하지 않는다 — 모르는 것을 위반으로 세면 가드가 거짓 경보로 죽는다.
 */
export function findMisboundHelpers(
  sites: AuditHelperSite[],
): AuditHelperSite[] {
  return sites.filter(
    (s) =>
      s.boundResource !== null &&
      s.recordedResource !== null &&
      s.boundResource !== s.recordedResource,
  );
}

/**
 * 같은 파일의 `const X = 'literal'` 선언을 이름→값으로 모은다.
 *
 * `AuditActionFor<typeof TRIGGER_RESOURCE_TYPE>` 과 `resourceType: TRIGGER_RESOURCE_TYPE` 을
 * 같은 값으로 보려면 상수를 풀어야 한다. 문자열 표기만 비교하면 한쪽을 리터럴로 바꾸는
 * 것만으로 거짓 경보가 난다.
 */
function collectStringConsts(sf: ts.SourceFile): Map<string, string> {
  const out = new Map<string, string>();
  const visit = (node: ts.Node): void => {
    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.initializer &&
      ts.isStringLiteral(node.initializer)
    ) {
      out.set(node.name.text, node.initializer.text);
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return out;
}

/** `AuditActionFor<X>` 의 `X` 를 소스 문자열로. 묶이지 않았으면 `null`. */
function extractBoundResourceText(
  params: ts.NodeArray<ts.ParameterDeclaration>,
): string | null {
  const first = params[0];
  if (!first?.type || !ts.isTypeLiteralNode(first.type)) return null;
  for (const member of first.type.members) {
    if (
      !ts.isPropertySignature(member) ||
      !ts.isIdentifier(member.name) ||
      member.name.text !== 'action' ||
      !member.type
    ) {
      continue;
    }
    const t = member.type;
    if (
      ts.isTypeReferenceNode(t) &&
      ts.isIdentifier(t.typeName) &&
      t.typeName.text === BOUND_TYPE_NAME &&
      t.typeArguments?.length === 1
    ) {
      return t.typeArguments[0].getText();
    }
    return null;
  }
  return null;
}

/**
 * helper 본문이 `record()` 에 넘기는 객체 리터럴의 `resourceType` 값을 소스 문자열로.
 *
 * 본문 전체를 훑어 **처음 만나는** `resourceType` 프로퍼티를 쓴다 — helper 는 정의상
 * 자기 리소스 하나만 기록한다. 없으면 `null`(판정 보류).
 */
function extractRecordedResourceText(body: ts.Node | undefined): string | null {
  if (!body) return null;
  let found: string | null = null;
  const visit = (node: ts.Node): void => {
    if (found !== null) return;
    if (
      ts.isPropertyAssignment(node) &&
      ts.isIdentifier(node.name) &&
      node.name.text === 'resourceType'
    ) {
      found = node.initializer.getText();
      return;
    }
    ts.forEachChild(node, visit);
  };
  visit(body);
  return found;
}

/**
 * 타입 위치의 `typeof X` 와 값 위치의 `X`, 그리고 양쪽의 `'literal'` 을 하나의 값으로 접는다.
 * 로컬 상수로 해석되지 않으면 `null` — 모르는 것을 위반으로 세지 않는다.
 */
function normalizeResource(
  raw: string | null,
  consts: Map<string, string>,
): string | null {
  if (raw === null) return null;
  const text = raw.trim().replace(/^typeof\s+/, '');
  const quoted = /^(['"`])(.*)\1$/.exec(text);
  if (quoted) return quoted[2];
  return consts.get(text) ?? null;
}

// ─── 인라인 `record()` 호출 ─────────────────────────────────────────────────
//
// 위 검사는 `recordAudit` helper **선언**만 본다. 그런데 helper 를 두지 않고
// `this.auditLogsService.record({ action, resourceType, ... })` 를 직접 부르는 자리가 더 많다.
// 거기서 `action` 은 `AuditAction` 합집합 전체를 받으므로 `resourceType` 과 접두가 어긋나도
// 컴파일러가 잡지 못한다. 아래 검사가 그 자리를 같은 불변식(액션 접두 = resourceType)으로 본다.

/** `AUDIT_ACTIONS` 정의 파일 (저장소 루트 기준). */
export const AUDIT_ACTION_CONST_FILE =
  'codebase/backend/src/modules/audit-logs/audit-action.const.ts';

/** 인라인 호출에서 액션 상수를 꺼낼 때 쓰는 객체 이름. */
const AUDIT_ACTIONS_NAME = 'AUDIT_ACTIONS';

/**
 * `audit-action.const.ts` 의 `AUDIT_ACTIONS` 객체 리터럴을 키→액션 문자열로 읽는다.
 *
 * 모듈을 import 하지 않고 파싱하는 이유: 가드의 다른 입력과 같은 방식(소스 파싱)으로 읽어야
 * fixture 로 같은 함수를 검증할 수 있다. 객체를 찾지 못하거나 비어 있으면 던진다.
 * 빈 맵을 돌려주면 모든 `AUDIT_ACTIONS.X` 가 "모르는 키" 가 되거나 조용히 판정에서 빠진다.
 */
export function parseAuditActionsConst(
  sourceText: string,
  fileLabel: string,
): Map<string, string> {
  const sf = ts.createSourceFile(
    fileLabel,
    sourceText,
    ts.ScriptTarget.Latest,
    true,
  );
  let literal: ts.ObjectLiteralExpression | null = null;
  const visit = (node: ts.Node): void => {
    if (literal) return;
    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.name.text === AUDIT_ACTIONS_NAME &&
      node.initializer
    ) {
      const init = unwrapExpression(node.initializer);
      if (ts.isObjectLiteralExpression(init)) literal = init;
      return;
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  if (!literal) {
    throw new Error(
      `${fileLabel}: ${AUDIT_ACTIONS_NAME} 객체 리터럴을 찾지 못했다`,
    );
  }
  const out = new Map<string, string>();
  for (const prop of (literal as ts.ObjectLiteralExpression).properties) {
    if (
      ts.isPropertyAssignment(prop) &&
      ts.isIdentifier(prop.name) &&
      ts.isStringLiteralLike(prop.initializer)
    ) {
      out.set(prop.name.text, prop.initializer.text);
    }
  }
  if (out.size === 0) {
    throw new Error(
      `${fileLabel}: ${AUDIT_ACTIONS_NAME} 에서 액션을 하나도 읽지 못했다`,
    );
  }
  return out;
}

/** `{...} as const` · `satisfies` · 괄호를 벗겨 안쪽 식을 돌려준다. */
function unwrapExpression(expr: ts.Expression): ts.Expression {
  let cur = expr;
  while (
    ts.isAsExpression(cur) ||
    ts.isSatisfiesExpression(cur) ||
    ts.isParenthesizedExpression(cur)
  ) {
    cur = cur.expression;
  }
  return cur;
}

export interface AuditRecordCallSite {
  /** 저장소 루트 기준 경로. */
  file: string;
  /** 1-based 줄 번호 (`record(` 호출 위치). */
  line: number;
  /** `action` 값을 소스 그대로. */
  actionText: string;
  /** 해석한 액션 문자열. 해석할 수 없으면 `null`(판정 보류). */
  action: string | null;
  /** 해석한 `resourceType`. 해석할 수 없으면 `null`(판정 보류). */
  resourceType: string | null;
}

/**
 * 한 소스에서 인라인 감사 기록 호출 `X.record({ action, resourceType, ... })` 을 찾는다.
 *
 * **이름이 아니라 인자 형태로 고른다.** `.record(` 를 부르는 곳은 로그인 이력 · LLM 사용량 ·
 * 메트릭 히스토그램처럼 감사와 무관한 곳이 많다. 인자가 객체 리터럴 하나이고 그 안에
 * `action` 과 `resourceType` 이 함께 있을 때만 감사 기록으로 본다.
 *
 * `action` 은 문자열 리터럴과 `AUDIT_ACTIONS.<KEY>` 만 푼다. `params.action` 처럼 helper 가
 * 넘겨받은 값은 `null` 로 남긴다(그 자리는 위의 helper 선언 검사가 맡는다). `AUDIT_ACTIONS`
 * 에 없는 키는 던진다. 조용히 `null` 로 두면 오탈자나 이름 변경이 판정에서 빠진다.
 */
export function findInlineAuditRecords(
  sourceText: string,
  fileLabel: string,
  auditActions: Map<string, string>,
): AuditRecordCallSite[] {
  const sf = ts.createSourceFile(
    fileLabel,
    sourceText,
    ts.ScriptTarget.Latest,
    true,
  );
  const consts = collectStringConsts(sf);
  const found: AuditRecordCallSite[] = [];

  const visit = (node: ts.Node): void => {
    const arg = auditRecordArgument(node);
    if (arg) {
      const line = sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1;
      const actionExpr = propertyValue(arg, 'action');
      const resourceExpr = propertyValue(arg, 'resourceType');
      found.push({
        file: fileLabel,
        line,
        actionText: actionExpr?.getText(sf) ?? '(shorthand)',
        action: resolveAction(actionExpr, auditActions, `${fileLabel}:${line}`),
        resourceType: normalizeResource(
          resourceExpr?.getText(sf) ?? null,
          consts,
        ),
      });
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return found;
}

/** 감사 기록 호출이면 그 객체 리터럴 인자를, 아니면 `null`. */
function auditRecordArgument(node: ts.Node): ts.ObjectLiteralExpression | null {
  if (
    !ts.isCallExpression(node) ||
    !ts.isPropertyAccessExpression(node.expression) ||
    node.expression.name.text !== 'record' ||
    node.arguments.length !== 1
  ) {
    return null;
  }
  const arg = node.arguments[0];
  if (!ts.isObjectLiteralExpression(arg)) return null;
  if (!hasProperty(arg, 'action') || !hasProperty(arg, 'resourceType')) {
    return null;
  }
  return arg;
}

function hasProperty(obj: ts.ObjectLiteralExpression, name: string): boolean {
  return obj.properties.some(
    (p) =>
      (ts.isPropertyAssignment(p) || ts.isShorthandPropertyAssignment(p)) &&
      ts.isIdentifier(p.name) &&
      p.name.text === name,
  );
}

/** `name: <expr>` 의 `<expr>`. shorthand(`{ action }`)면 `null`(값을 모른다). */
function propertyValue(
  obj: ts.ObjectLiteralExpression,
  name: string,
): ts.Expression | null {
  for (const p of obj.properties) {
    if (
      ts.isPropertyAssignment(p) &&
      ts.isIdentifier(p.name) &&
      p.name.text === name
    ) {
      return p.initializer;
    }
  }
  return null;
}

/** 문자열 리터럴과 `AUDIT_ACTIONS.<KEY>` 를 액션 문자열로. 그 밖에는 `null`. */
function resolveAction(
  expr: ts.Expression | null,
  auditActions: Map<string, string>,
  where: string,
): string | null {
  if (!expr) return null;
  if (ts.isStringLiteralLike(expr)) return expr.text;
  if (
    ts.isPropertyAccessExpression(expr) &&
    ts.isIdentifier(expr.expression) &&
    expr.expression.text === AUDIT_ACTIONS_NAME
  ) {
    const key = expr.name.text;
    const value = auditActions.get(key);
    if (value === undefined) {
      throw new Error(
        `${where}: ${AUDIT_ACTIONS_NAME}.${key} 는 ${AUDIT_ACTIONS_NAME} 에 없는 키다`,
      );
    }
    return value;
  }
  return null;
}

/**
 * 액션 접두(첫 `.` 앞)가 `resourceType` 과 다른 호출만 남긴다. 한쪽이라도 해석되지
 * 않았으면 판정하지 않는다. 모르는 것을 위반으로 세면 가드가 거짓 경보로 죽는다.
 */
export function findMisboundRecordCalls(
  sites: AuditRecordCallSite[],
): AuditRecordCallSite[] {
  return sites.filter(
    (s) =>
      s.action !== null &&
      s.resourceType !== null &&
      s.action.split('.')[0] !== s.resourceType,
  );
}
