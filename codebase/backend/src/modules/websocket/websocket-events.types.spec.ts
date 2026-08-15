import * as fs from 'node:fs';
import * as path from 'node:path';
import * as ts from 'typescript';

/**
 * `websocket-events.types.ts` 가 **의존성-프리**로 남는지 지키는 정적 가드.
 *
 * ## 왜 테스트로 고정하는가
 *
 * #1174 에서 `execution-event-emitter.service.ts` 가 모듈 스코프에서 `ExecutionEventType`
 * 을 읽었다가 **72 suites 가 `Cannot read properties of undefined`** 로 터졌다. 원인은
 * `websocket.service` ↔ `websocket.gateway` ↔ `event-emitter` ES-module 순환이었고,
 * 순환 위에서는 모듈 평가 시점에 enum 이 아직 `undefined` 다.
 *
 * 해소책은 "값·타입을 아무것도 import 하지 않는 모듈로 옮긴다" 였다. 그런데 그 불변식은
 * **주석으로만 존재하면 조용히 깨진다** — 이 파일에 import 한 줄을 더하는 것은 컴파일도
 * 통과하고 기존 테스트도 전부 통과한다. 순환에 다시 편입됐다는 사실은 한참 뒤 엉뚱한
 * suite 가 대량으로 터질 때에야 드러난다.
 *
 * ## 무엇을 세는가 — `import` 한 줄만 보면 한 칸 좁다
 *
 * 모듈 간선은 `import` 말고도 `export … from`(re-export) · `import x = require()` ·
 * 동적 `import()` · `require()` 로도 생긴다. 그래서 정규식이 아니라 **TypeScript 파서**로
 * 모든 module specifier 를 센다.
 */

const WS_DIR = __dirname;
const SRC_ROOT = path.resolve(__dirname, '..', '..');
const TYPES_FILE = path.join(WS_DIR, 'websocket-events.types.ts');

/** 이 모듈이 갖고 있어야 할 export — 선언이 딴 데로 옮겨가면 "간선 0" 이 공허해진다. */
const EXPECTED_EXPORTS = [
  'ExecutionChannelEvent',
  'ChatChannelRoutingInfo',
  'ExecutionRoutingContext',
  'ExecutionEventType',
  'ToolCallStartedPayload',
  'UserMessagePayload',
  'ToolCallCompletedPayload',
  'NodeEventType',
  'BackgroundRunEventType',
  'NotificationEventType',
  'NotificationNewPayload',
  'KbEventType',
];

/**
 * `websocket.service` 에서 enum **값**을 가져와도 되는 유일한 예외.
 *
 * 그 spec 은 하위호환 re-export facade 자체를 검증한다 — 여기서 빼면 facade 가 조용히
 * 끊겨도 아무도 모른다. 즉 이 한 줄은 면제가 아니라 **의도된 커버리지**다.
 */
const REEXPORT_FACADE_TEST = path.join(WS_DIR, 'websocket.service.spec.ts');

function parse(file: string): ts.SourceFile {
  return ts.createSourceFile(
    file,
    fs.readFileSync(file, 'utf8'),
    ts.ScriptTarget.Latest,
    /* setParentNodes */ true,
  );
}

/** 정적·동적을 가리지 않고 이 파일이 참조하는 모든 module specifier. */
function moduleSpecifiersOf(sf: ts.SourceFile): string[] {
  const found: string[] = [];
  const visit = (node: ts.Node): void => {
    if (
      (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
      node.moduleSpecifier &&
      ts.isStringLiteral(node.moduleSpecifier)
    ) {
      found.push(node.moduleSpecifier.text);
    } else if (
      ts.isImportEqualsDeclaration(node) &&
      ts.isExternalModuleReference(node.moduleReference) &&
      ts.isStringLiteral(node.moduleReference.expression)
    ) {
      found.push(node.moduleReference.expression.text);
    } else if (ts.isCallExpression(node)) {
      const isRequire =
        ts.isIdentifier(node.expression) && node.expression.text === 'require';
      const isDynamicImport =
        node.expression.kind === ts.SyntaxKind.ImportKeyword;
      const [arg] = node.arguments;
      if ((isRequire || isDynamicImport) && arg && ts.isStringLiteral(arg)) {
        found.push(arg.text);
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return found;
}

function allTsFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...allTsFiles(p));
    else if (entry.name.endsWith('.ts')) out.push(p);
  }
  return out;
}

describe('websocket-events.types — ES-module 순환 재편입 방지 (#1174 회귀 가드)', () => {
  it('module specifier 를 하나도 갖지 않는다 (import / export-from / require / 동적 import 전부)', () => {
    const sf = parse(TYPES_FILE);

    // 공허 방지 — 파일을 못 읽거나 빈 파일이면 "간선 0" 은 자동으로 참이 된다.
    expect(sf.statements.length).toBeGreaterThan(EXPECTED_EXPORTS.length - 1);

    expect(moduleSpecifiersOf(sf)).toEqual([]);
  });

  it('값·타입 선언이 실제로 이 모듈에 있다 (딴 데로 옮기면 위 단언이 공허해진다)', () => {
    const sf = parse(TYPES_FILE);
    const declared = new Set<string>();
    for (const st of sf.statements) {
      if (
        ts.isEnumDeclaration(st) ||
        ts.isInterfaceDeclaration(st) ||
        ts.isTypeAliasDeclaration(st)
      ) {
        declared.add(st.name.text);
      }
    }
    expect([...EXPECTED_EXPORTS].filter((n) => !declared.has(n))).toEqual([]);
  });

  it('enum 값을 `websocket.service` 경유로 가져오는 파일이 없다 (re-export facade 테스트 제외)', () => {
    const offenders: string[] = [];

    for (const file of allTsFiles(SRC_ROOT)) {
      if (file === path.join(WS_DIR, 'websocket.service.ts')) continue;
      if (file === REEXPORT_FACADE_TEST) continue;

      const sf = parse(file);
      for (const st of sf.statements) {
        if (!ts.isImportDeclaration(st)) continue;
        if (!ts.isStringLiteral(st.moduleSpecifier)) continue;
        if (!/websocket\.service$/.test(st.moduleSpecifier.text)) continue;

        // `import type { … }` 은 방출 시 사라지므로 순환 간선을 만들지 않는다.
        if (st.importClause?.isTypeOnly) continue;

        const bindings = st.importClause?.namedBindings;
        if (!bindings || !ts.isNamedImports(bindings)) continue;

        const valueImports = bindings.elements
          .filter((el) => !el.isTypeOnly)
          .map((el) => el.name.text)
          .filter((n) => n !== 'WebsocketService');

        if (valueImports.length) {
          offenders.push(
            `${path.relative(SRC_ROOT, file)} → ${valueImports.join(', ')}`,
          );
        }
      }
    }

    expect(offenders).toEqual([]);
  });

  it('facade 테스트가 실제로 존재한다 (allowlist 가 죽은 경로를 가리키면 예외가 공짜가 된다)', () => {
    expect(fs.existsSync(REEXPORT_FACADE_TEST)).toBe(true);
  });
});
