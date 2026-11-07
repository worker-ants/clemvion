// 요청 본문의 참조 id 필드가 저장 전 소속 검사를 거치는지 세는 가드 — 스캔 · 판정 순수 로직.
//
// 소비처는 형제 파일 `reference-scope.spec.ts`. 배경 · 근거 · 한계는 그 파일 헤더에 있다.
// 파서 순수 로직과 소비 spec 을 나누는 규약은 형제 가드 `endpoint-path-conflict-wrap-guard.ts` 와 같다.

import * as fs from 'node:fs';
import * as path from 'node:path';
import * as ts from 'typescript';

import { toPosixRelative } from '../../common/__test-utils__/source-scan';

/** `src` 루트. 이 파일은 `src/repo-guards/__tests__/` 에 있다. */
export const SRC_ROOT = path.resolve(__dirname, '..', '..');

/**
 * 참조 id 필드 이름 술어 — `id` 이거나 `Id` · `Ids` 로 끝난다.
 *
 * `id` 를 넣은 이유: 캔버스 저장의 `nodes[].id` 도 [참조의 소속] 표의 참조다(이 워크플로에 없는 id 는 어느 행도 쓰지 않아야
 * 한다). 이름이 이 모양이 아닌 참조(`botTokenRef` 같은 문자열 참조, 노드 `config` JSONB 안의 `integrationId`)는 모집단 밖이다.
 */
export const REFERENCE_FIELD_PATTERN = /^id$|Ids?$/;

/**
 * 소속 검사로 보는 호출과, 그 호출이 **어느 필드**를 검사하는지 읽는 규칙.
 *
 * - `fieldArg`: 세 번째 인자(`field`) 문자열. `assertReferenceInScope(repo, where, field, message)` 의 시그니처다.
 * - `fieldProps`: 호출을 감싸는 함수 안의 `field: '<경로>'` 리터럴. `throwInvalidReferences(items)` 는 항목 배열만 받으므로
 *   그 배열을 만드는 함수에서 필드를 읽는다.
 * - `firstArg`: 첫 인자의 이름(`dto.llmConfigId` → `llmConfigId`). 검사 대상 id 를 첫 인자로 받는 검증기다.
 *
 * `firstArg` 넷은 스펙 「참조의 소속」 의 거부 응답 예외 1~3 이다. 공용 헬퍼를 쓰지 않고 도메인 코드로 거부한다.
 * - `findEntity` · `resolveConfig`: 모델 설정 참조(예외 1, 404 `MODEL_CONFIG_NOT_FOUND`).
 * - `assertAuthConfigInWorkspace`: 트리거 `authConfigId`(예외 2, 400 `AUTH_CONFIG_NOT_FOUND`).
 * - `ensureWorkflowBelongsToWorkspace`: 어시스턴트 세션 생성 `workflowId`(예외 3, 404 `WORKFLOW_NOT_FOUND`).
 *
 * 이 가드는 **검사를 부르는가**만 본다. 검사 함수가 소속 조건을 제대로 싣는지는 각 서비스의 단위 테스트와
 * `test/cross-workspace-references.e2e-spec.ts` 가 본다.
 */
export const SCOPE_CHECK_CALLEES = {
  assertReferenceInScope: 'fieldArg',
  throwInvalidReferences: 'fieldProps',
  findEntity: 'firstArg',
  resolveConfig: 'firstArg',
  assertAuthConfigInWorkspace: 'firstArg',
  ensureWorkflowBelongsToWorkspace: 'firstArg',
} as const satisfies Record<string, 'fieldArg' | 'fieldProps' | 'firstArg'>;

type ScopeCheckCallee = keyof typeof SCOPE_CHECK_CALLEES;

/** 요청 DTO 의 참조 id 필드 하나. */
export interface RequestReferenceField {
  /** `src` 기준 POSIX 상대 경로. */
  readonly file: string;
  readonly dto: string;
  readonly field: string;
  /** `<DTO 클래스>.<필드>` — 카탈로그 키. 파일 경로를 넣지 않아 파일을 옮겨도 키가 그대로다. */
  readonly key: string;
}

/** 한 메서드에서 닿는 소속 검사 호출 하나가 검사하는 필드. */
export interface ScopeCheckBinding {
  readonly field: string;
  readonly callee: ScopeCheckCallee;
  /** 그 호출이 있는 메서드 이름 — 진단 메시지용. */
  readonly via: string;
}

/** DTO 를 매개변수로 받는 공개 메서드 하나. */
export interface DtoConsumer {
  /** `<상대경로>#<메서드>` */
  readonly key: string;
  readonly dto: string;
}

function parse(file: string): ts.SourceFile {
  return ts.createSourceFile(
    file,
    fs.readFileSync(file, 'utf8'),
    ts.ScriptTarget.Latest,
    true,
  );
}

/**
 * 테스트 전용 경로인가 — `__tests__` · `__test-utils__` 처럼 `__` 로 시작하는 디렉터리 아래다.
 *
 * 이 가드의 fixture 가 `__tests__/fixtures/reference-scope/dto/` 에 요청 DTO 모양으로 있어서, 빼지 않으면 프로덕션 스캔이
 * fixture 를 모집단에 넣는다.
 */
export function isTestPath(rel: string): boolean {
  return rel
    .split('/')
    .slice(0, -1)
    .some((segment) => segment.startsWith('__'));
}

/**
 * 요청 DTO 파일인가 — 경로에 `dto` 디렉터리가 있고 응답 DTO 가 아니다.
 *
 * 응답 DTO 는 `dto/responses/` 아래에 두거나 파일 이름에 `response` 를 넣는다(`background-run-response.dto.ts`).
 * 요청 DTO 를 `dto/` 밖에 두면 이 판정에 잡히지 않는다. 그런 DTO 를 만들면 이 함수의 규칙을 함께 고친다.
 */
export function isRequestDtoPath(rel: string): boolean {
  if (isTestPath(rel)) return false;
  const segments = rel.split('/');
  if (!segments.slice(0, -1).includes('dto')) return false;
  if (segments.includes('responses')) return false;
  return !/response/i.test(segments[segments.length - 1]);
}

/** `files` 가운데 요청 DTO 파일의 클래스 프로퍼티 중 이름이 참조 id 모양인 것을 전부 돌려준다. */
export function findRequestReferenceFields(
  files: readonly string[],
  srcRoot: string,
): RequestReferenceField[] {
  const out: RequestReferenceField[] = [];
  for (const file of files) {
    const rel = toPosixRelative(srcRoot, file);
    if (!isRequestDtoPath(rel)) continue;
    const sf = parse(file);
    for (const stmt of sf.statements) {
      if (!ts.isClassDeclaration(stmt) || !stmt.name) continue;
      const dto = stmt.name.text;
      for (const member of stmt.members) {
        if (!ts.isPropertyDeclaration(member)) continue;
        if (!ts.isIdentifier(member.name)) continue;
        const field = member.name.text;
        if (!REFERENCE_FIELD_PATTERN.test(field)) continue;
        out.push({ file: rel, dto, field, key: dtoFieldKey(dto, field) });
      }
    }
  }
  return out.sort((a, b) => a.key.localeCompare(b.key));
}

/** `node` 안의 타입 참조 이름과 식별자 이름. 상속 절(`extends PartialType(X)`)은 식 안의 식별자로 본다. */
function namesIn(node: ts.Node): string[] {
  const out: string[] = [];
  const walk = (n: ts.Node): void => {
    if (ts.isTypeReferenceNode(n) && ts.isIdentifier(n.typeName)) {
      out.push(n.typeName.text);
    } else if (ts.isIdentifier(n)) {
      out.push(n.text);
    }
    ts.forEachChild(n, walk);
  };
  walk(node);
  return out;
}

/**
 * 참조 필드를 나르는 요청 DTO 와, 각각이 나르는 «필드를 선언한 DTO» 의 집합.
 *
 * 필드를 직접 선언한 DTO 는 자기 자신을 나른다. 그 밖에 두 가지로 나른다.
 * - 프로퍼티 타입이 그런 DTO 다: `SaveCanvasDto.nodes: SaveCanvasNodeDto[]`.
 * - 그런 DTO 를 상속한다: `class UpdateXDto extends PartialType(CreateXDto)`. 상속받은 필드는 선언이 없어 모집단에 안 잡히지만
 *   같은 참조를 나른다.
 *
 * 클래스 이름으로 잇는다. 요청 DTO 클래스 이름이 저장소에서 겹치지 않는 것은 형제 가드 `dto-class-name-collision` 이 지킨다.
 */
export function findReferenceBearingDtos(
  files: readonly string[],
  srcRoot: string,
): Map<string, ReadonlySet<string>> {
  const declared = new Set(
    findRequestReferenceFields(files, srcRoot).map((f) => f.dto),
  );
  const refs = new Map<string, Set<string>>();
  for (const file of files) {
    if (!isRequestDtoPath(toPosixRelative(srcRoot, file))) continue;
    const sf = parse(file);
    for (const stmt of sf.statements) {
      if (!ts.isClassDeclaration(stmt) || !stmt.name) continue;
      const names = new Set<string>();
      for (const clause of stmt.heritageClauses ?? []) {
        for (const name of namesIn(clause)) names.add(name);
      }
      for (const member of stmt.members) {
        if (ts.isPropertyDeclaration(member) && member.type) {
          for (const name of namesIn(member.type)) names.add(name);
        }
      }
      refs.set(stmt.name.text, names);
    }
  }

  const carried = new Map<string, Set<string>>();
  for (const name of refs.keys()) {
    carried.set(name, declared.has(name) ? new Set([name]) : new Set());
  }
  let changed = true;
  while (changed) {
    changed = false;
    for (const [name, inner] of refs) {
      const mine = carried.get(name)!;
      for (const ref of inner) {
        for (const dto of carried.get(ref) ?? []) {
          if (!mine.has(dto)) {
            mine.add(dto);
            changed = true;
          }
        }
      }
    }
  }
  return new Map([...carried].filter(([, dtos]) => dtos.size > 0));
}

/** 경로 리터럴의 마지막 조각 — `nodes[1].containerId` → `containerId`, `nodes[${i}].id` → `id`. */
function lastPathSegment(text: string): string | null {
  const tail = text.split('.').pop() ?? '';
  const name = tail.replace(/\[[^\]]*\]$/, '');
  return /^[A-Za-z_$][\w$]*$/.test(name) ? name : null;
}

/** 문자열 · 템플릿 리터럴이 가리키는 필드 이름. 리터럴이 아니면 `null`. */
function fieldOfLiteral(expr: ts.Expression | undefined): string | null {
  if (!expr) return null;
  if (ts.isStringLiteral(expr) || ts.isNoSubstitutionTemplateLiteral(expr)) {
    return lastPathSegment(expr.text);
  }
  if (ts.isTemplateExpression(expr)) {
    const spans = expr.templateSpans;
    const tail = spans[spans.length - 1]?.literal.text ?? '';
    return tail === '' ? null : lastPathSegment(tail);
  }
  return null;
}

/** 첫 인자가 가리키는 필드 이름 — `dto.x` · `rest.x` · `x` · `dto.x!`. 그 밖의 식은 `null`. */
function fieldOfArgument(expr: ts.Expression | undefined): string | null {
  let cur = expr;
  while (cur && ts.isNonNullExpression(cur)) cur = cur.expression;
  if (!cur) return null;
  if (ts.isPropertyAccessExpression(cur)) return cur.name.text;
  if (ts.isIdentifier(cur)) return cur.text;
  return null;
}

/** 호출식의 이름 — `foo(...)` 와 `a.b.foo(...)` 둘 다 `foo`. */
function calleeName(call: ts.CallExpression): string | null {
  const callee = call.expression;
  if (ts.isIdentifier(callee)) return callee.text;
  if (ts.isPropertyAccessExpression(callee)) return callee.name.text;
  return null;
}

function isScopeCheckCallee(name: string | null): name is ScopeCheckCallee {
  return name !== null && Object.hasOwn(SCOPE_CHECK_CALLEES, name);
}

/** `node` 를 감싸는 가장 가까운 메서드 · 함수 선언. 화살표 함수는 넘어간다(`forEach` 콜백 안에서 항목을 모으는 형태). */
function enclosingDeclaration(node: ts.Node): ts.Node {
  for (let cur = node.parent; cur; cur = cur.parent) {
    if (
      ts.isMethodDeclaration(cur) ||
      ts.isFunctionDeclaration(cur) ||
      ts.isConstructorDeclaration(cur)
    ) {
      return cur;
    }
  }
  return node.getSourceFile();
}

/** `scope` 안의 `field: <리터럴>` 프로퍼티가 가리키는 필드 이름들. */
function fieldPropsIn(scope: ts.Node): string[] {
  const out: string[] = [];
  const walk = (n: ts.Node): void => {
    if (
      ts.isPropertyAssignment(n) &&
      ts.isIdentifier(n.name) &&
      n.name.text === 'field'
    ) {
      const field = fieldOfLiteral(n.initializer);
      if (field) out.push(field);
    }
    ts.forEachChild(n, walk);
  };
  walk(scope);
  return out;
}

function bindingsOfCall(
  call: ts.CallExpression,
  callee: ScopeCheckCallee,
): string[] {
  switch (SCOPE_CHECK_CALLEES[callee]) {
    case 'fieldArg': {
      const field = fieldOfLiteral(call.arguments[2]);
      return field ? [field] : [];
    }
    case 'firstArg': {
      const field = fieldOfArgument(call.arguments[0]);
      return field ? [field] : [];
    }
    case 'fieldProps':
      return fieldPropsIn(enclosingDeclaration(call));
  }
}

/** `this.<이름>(...)` 호출이면 그 이름. */
function thisMethodCallName(call: ts.CallExpression): string | null {
  const callee = call.expression;
  if (
    ts.isPropertyAccessExpression(callee) &&
    callee.expression.kind === ts.SyntaxKind.ThisKeyword
  ) {
    return callee.name.text;
  }
  return null;
}

/** 클래스의 본문 있는 메서드를 이름으로 모은다(오버로드 선언은 본문이 없어 빠진다). */
function methodsOf(
  cls: ts.ClassDeclaration,
): Map<string, ts.MethodDeclaration> {
  const out = new Map<string, ts.MethodDeclaration>();
  for (const member of cls.members) {
    if (
      ts.isMethodDeclaration(member) &&
      member.body &&
      ts.isIdentifier(member.name)
    ) {
      out.set(member.name.text, member);
    }
  }
  return out;
}

/**
 * `file` 의 `method` 에서 닿는 소속 검사 호출이 검사하는 필드를 전부 돌려준다. 메서드가 없으면 `null`.
 *
 * **같은 클래스의 `this.<메서드>()` 호출을 따라간다.** 검사는 대개 `create` 가 부르는 private 메서드
 * (`assertFolderInWorkspace` 등)에 있다. 따라가지 않으면 그 메서드를 부르는 줄을 지워도 모른다. 다른 클래스로 가는 호출
 * (`this.modelConfigService.findEntity(...)`)은 따라가지 않고 이름만 본다.
 *
 * 같은 이름의 메서드가 파일 안 두 클래스에 있으면 어느 쪽인지 정할 수 없으므로 던진다.
 */
export function findScopeChecksReachableFrom(
  file: string,
  method: string,
): ScopeCheckBinding[] | null {
  const sf = parse(file);
  const owners = sf.statements
    .filter(ts.isClassDeclaration)
    .map(methodsOf)
    .filter((methods) => methods.has(method));
  if (owners.length === 0) return null;
  if (owners.length > 1) {
    throw new Error(
      `${siteKey(path.basename(file), method)}: 같은 이름의 메서드가 클래스 ${owners.length}개에 있다`,
    );
  }
  const methods = owners[0];

  const out: ScopeCheckBinding[] = [];
  const visited = new Set<string>();
  const queue = [method];
  while (queue.length > 0) {
    const name = queue.shift()!;
    if (visited.has(name)) continue;
    visited.add(name);
    const decl = methods.get(name);
    if (!decl?.body) continue;
    const walk = (n: ts.Node): void => {
      if (ts.isCallExpression(n)) {
        const callee = calleeName(n);
        if (isScopeCheckCallee(callee)) {
          for (const field of bindingsOfCall(n, callee)) {
            out.push({ field, callee, via: name });
          }
        }
        const next = thisMethodCallName(n);
        if (next && methods.has(next)) queue.push(next);
      }
      ts.forEachChild(n, walk);
    };
    walk(decl.body);
  }
  return out;
}

function isNonPublic(member: ts.MethodDeclaration): boolean {
  return (
    ts.isPrivateIdentifier(member.name) ||
    (ts.getCombinedModifierFlags(member) &
      (ts.ModifierFlags.Private | ts.ModifierFlags.Protected)) !==
      0
  );
}

/** `typeNode` 안에 `names` 의 타입 참조가 있으면 그 이름들. `Partial<X>` · `X[]` · `X | null` 도 본다. */
function referencedTypeNames(
  typeNode: ts.TypeNode,
  names: ReadonlySet<string>,
): string[] {
  const out: string[] = [];
  const walk = (n: ts.Node): void => {
    if (
      ts.isTypeReferenceNode(n) &&
      ts.isIdentifier(n.typeName) &&
      names.has(n.typeName.text)
    ) {
      out.push(n.typeName.text);
    }
    ts.forEachChild(n, walk);
  };
  walk(typeNode);
  return out;
}

/**
 * `files` 에서 `dtoNames` 의 DTO 를 매개변수 타입으로 받는 **공개** 메서드를 전부 돌려준다.
 *
 * 컨트롤러(`*.controller.ts`), `dto` 디렉터리 아래 파일, 테스트 경로는 뺀다. 컨트롤러는 본문을 서비스에 넘기고 저장하지
 * 않는다. private · protected 메서드는 공개 메서드에서 닿으므로 따로 세지 않는다.
 */
export function findPublicDtoConsumers(
  files: readonly string[],
  srcRoot: string,
  dtoNames: ReadonlySet<string>,
): DtoConsumer[] {
  const out: DtoConsumer[] = [];
  for (const file of files) {
    const rel = toPosixRelative(srcRoot, file);
    if (rel.endsWith('.controller.ts') || isTestPath(rel)) continue;
    if (rel.split('/').slice(0, -1).includes('dto')) continue;
    const sf = parse(file);
    for (const stmt of sf.statements) {
      if (!ts.isClassDeclaration(stmt)) continue;
      for (const member of stmt.members) {
        if (!ts.isMethodDeclaration(member) || !member.body) continue;
        if (!ts.isIdentifier(member.name) || isNonPublic(member)) continue;
        const dtos = new Set<string>();
        for (const param of member.parameters) {
          if (!param.type) continue;
          for (const name of referencedTypeNames(param.type, dtoNames)) {
            dtos.add(name);
          }
        }
        for (const dto of dtos) {
          out.push({ key: siteKey(rel, member.name.text), dto });
        }
      }
    }
  }
  return out.sort((a, b) =>
    `${a.dto} ${a.key}`.localeCompare(`${b.dto} ${b.key}`),
  );
}

/** `<DTO>.<필드>` 키를 만든다. `splitDtoFieldKey` 와 한 쌍이다. */
function dtoFieldKey(dto: string, field: string): string {
  return `${dto}.${field}`;
}

/** `<DTO>.<필드>` 키를 나눈다. */
function splitDtoFieldKey(key: string): { dto: string; field: string } {
  const at = key.indexOf('.');
  return { dto: key.slice(0, at), field: key.slice(at + 1) };
}

/** `<상대경로>#<메서드>` 키를 만든다. `splitSite` 와 한 쌍이다. */
function siteKey(rel: string, method: string): string {
  return `${rel}#${method}`;
}

/** `<상대경로>#<메서드>` 를 나눈다. */
function splitSite(site: string): { rel: string; method: string } {
  const at = site.lastIndexOf('#');
  return { rel: site.slice(0, at), method: site.slice(at + 1) };
}

/**
 * 검사한다고 적힌 자리 중 그 필드를 검사하는 호출에 닿지 않는 것을 돌려준다. 비어 있으면 통과다.
 *
 * `checkedAt` 은 `<DTO>.<필드>` → `<상대경로>#<메서드>` 목록이다. 자리마다 `findScopeChecksReachableFrom` 이 돌려준 필드에
 * 그 필드 이름이 있어야 한다. 파일이나 메서드가 없어도 위반으로 센다(이름을 바꾸면 목록도 따라 고치게 한다).
 */
export function findUnboundSites(
  srcRoot: string,
  checkedAt: ReadonlyMap<string, readonly string[]>,
): string[] {
  const out: string[] = [];
  const cache = new Map<string, ScopeCheckBinding[] | null>();
  for (const [key, sites] of checkedAt) {
    const { field } = splitDtoFieldKey(key);
    for (const site of sites) {
      const { rel, method } = splitSite(site);
      const file = path.join(srcRoot, rel);
      if (!fs.existsSync(file)) {
        out.push(`${site}: 파일이 없다 (${key})`);
        continue;
      }
      let bindings = cache.get(site);
      if (bindings === undefined) {
        bindings = findScopeChecksReachableFrom(file, method);
        cache.set(site, bindings);
      }
      if (bindings === null) {
        out.push(`${site}: 메서드가 없다 (${key})`);
      } else if (!bindings.some((b) => b.field === field)) {
        out.push(`${site}: ${key} 를 검사하는 호출에 닿지 않는다`);
      }
    }
  }
  return out.sort();
}

/**
 * 검사 대상 필드를 나르는 DTO 를 받으면서 그 필드의 검사 자리 목록에도, 예외 목록에도 없는 공개 메서드를 돌려준다.
 *
 * `bearing` 은 `findReferenceBearingDtos` 의 결과, `checkedAt` 은 `findUnboundSites` 와 같은 목록, `exempt` 는 저장하지
 * 않는다고 사유를 적은 `<상대경로>#<메서드>` 다. 결과 항목은 `<메서드 키> ← <DTO>.<필드>` 꼴이다.
 */
export function findUncheckedConsumers(
  consumers: readonly DtoConsumer[],
  bearing: ReadonlyMap<string, ReadonlySet<string>>,
  checkedAt: ReadonlyMap<string, readonly string[]>,
  exempt: ReadonlySet<string>,
): string[] {
  const out = new Set<string>();
  for (const consumer of consumers) {
    if (exempt.has(consumer.key)) continue;
    for (const dto of bearing.get(consumer.dto) ?? []) {
      for (const [key, sites] of checkedAt) {
        if (splitDtoFieldKey(key).dto !== dto) continue;
        if (!sites.includes(consumer.key)) out.add(`${consumer.key} ← ${key}`);
      }
    }
  }
  return [...out].sort();
}
