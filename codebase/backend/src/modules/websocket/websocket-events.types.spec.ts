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
 * 통과하고 기존 테스트도 전부 통과한다.
 *
 * ## 간선을 세는 곳은 **하나뿐이다** — 그게 이 파일의 설계다
 *
 * 처음엔 열거가 두 벌이었다: 완전한 쪽과, 손으로 다시 짠 좁은 쪽. 그랬더니 리뷰가
 * **네 라운드 연속** 좁은 쪽이 놓친 형태를 하나씩 찾아냈다 —
 * `export … from`(`20_05_17`) → 별칭 오판정(`20_27_08`) → `require()`(`20_50_49`).
 * 매번 그 한 형태만 덧대면 다섯 번째가 온다.
 *
 * 그래서 {@link moduleRefs} **하나**가 모든 형태를 반환하고, 각 테스트는 그 결과를
 * **거르기만** 한다. 새 문법이 생겨도 고칠 곳은 한 곳이다.
 *
 * ## eager vs lazy — 무엇이 결함이고 무엇이 아닌가
 *
 * 이 가드가 막는 건 "모듈 평가 시점에 아직 안 채워진 값을 읽는 것" 이다. 따라서 판별 기준은
 * **즉시 해석되는가**다:
 *
 * | 형태 | 판정 |
 * |---|---|
 * | `import` · `export … from` · `import x = require()` | eager |
 * | top-level `require()` | eager |
 * | 함수 본문 안 `require()` · 동적 `import()` | **lazy — 결함 아님** |
 *
 * lazy 를 결함으로 세면 정당한 지연 로드를 오탐한다(저장소에 선례가 있다).
 * 단, **타입 모듈 자신**은 어떤 형태로도 간선이 없어야 하므로 거기서는 lazy 도 센다.
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

/** 순환 위의 모듈. 여기로 향하는 **eager 값** 간선이 #1174 를 되살린다. */
const SERVICE_MODULE = /websocket\.service$/;

/**
 * 이벤트 값·타입이 **나오는** 경로 전부 — 타입 모듈과 그 re-export facade 둘 다.
 *
 * `websocket.service` 가 여기 함께 있는 건 오타가 아니다. facade 를 경유해도 같은 심볼을
 * 꺼내므로 "타입 전용 심볼에 `type` 을 붙였는가" 규칙은 양쪽에 똑같이 적용돼야 한다.
 */
const EVENT_MODULES = /websocket-events\.types$|websocket\.service$/;

/** 한 모듈 참조. {@link moduleRefs} 가 반환하는 유일한 형태다. */
interface ModuleRef {
  specifier: string;
  /** 문법 형태 — `WebsocketService` 예외를 어디에 적용할지 가른다. */
  form: 'import' | 'export' | 'import=require' | 'require' | 'dynamic-import';
  /** 모듈 평가 시점에 즉시 해석되는가. lazy 면 순환 평가 순서를 깨지 않는다. */
  eager: boolean;
  /**
   * 방출 후에도 남는 값 간선인가. 판정은 {@link importLeavesValueEdge} /
   * {@link exportLeavesValueEdge} — 인라인 `type` 태그와 default 바인딩까지 본다.
   */
  value: boolean;
  /** 저쪽 모듈에서 꺼낸 **원** 식별자들. `*`/side-effect 는 빈 배열. */
  names: string[];
}

function parse(file: string): ts.SourceFile {
  return ts.createSourceFile(
    file,
    fs.readFileSync(file, 'utf8'),
    ts.ScriptTarget.Latest,
    /* setParentNodes */ true,
  );
}

/**
 * **원 export 식별자**. `{ A as B }` 에서 알고 싶은 건 로컬 이름 `B` 가 아니라 저쪽 모듈에서
 * 무엇을 꺼냈는지(`A`)다.
 *
 * `20_27_08` testing W2 — 처음엔 로컬 바인딩으로 비교해 양쪽으로 틀렸다. 실측으로 둘 다 재현:
 * - FP `import { WebsocketService as WS }` → 'WS' 라서 예외를 못 타고 오탐
 * - **FN `import { ExecutionEventType as WebsocketService }` → 예외를 타서 미검출.**
 *   이건 #1174 재발 그 자체인데 가드가 통과시켰다
 */
function originalName(el: ts.ImportSpecifier | ts.ExportSpecifier): string {
  return (el.propertyName ?? el.name).text;
}

/** 네임드 바인딩에서 **값으로 남는** 원 식별자들. import·export 가 공유한다. */
function namedBindingValueNames(
  named: ts.NamedImports | ts.NamedExports,
): string[] {
  return named.elements.filter((el) => !el.isTypeOnly).map(originalName);
}

/**
 * `import …` 이 방출 후에도 값 간선을 남기는가.
 *
 * ## 불리언을 세는 대신 **AST 형태를 소진**한다
 *
 * `21_14_51` 은 선언 레벨 `isTypeOnly` 만 봐서 인라인 `type` 을 오탐했고(FP), 그걸 고치며
 * "네임드 바인딩 유무 + 값 이름 수" 로 갈랐더니 이번엔 `21_49_51` 이 **default 바인딩을
 * 놓친 FN** 을 찾아냈다 — `import Def, { type Bar } from '…'` 가 "네임드 있음 + 값 이름 0" 이라
 * 통과했다. **내 FP 수정이 새 FN 을 만든 것이다.**
 *
 * 조건을 하나씩 덧대는 한 이 진자는 멈추지 않는다. `ImportClause` 는 부분이 **셋뿐**이므로
 * (default `name` · `namedBindings` · 그리고 clause 자체의 부재) 전수로 소진할 수 있다.
 * 아래는 그 세 부분을 빠짐없이 훑는다 — 새 경우가 생기려면 TS 문법이 바뀌어야 한다.
 */
function importLeavesValueEdge(clause: ts.ImportClause | undefined): boolean {
  if (!clause) return true; // `import '…'` — side-effect 는 순수 값 간선
  if (clause.isTypeOnly) return false; // `import type { … }`

  if (clause.name) return true; // default 바인딩
  const bindings = clause.namedBindings;
  if (!bindings) return true; // 방어적 — 파서상 도달 불가
  if (ts.isNamespaceImport(bindings)) return true; // `* as ns`
  return namedBindingValueNames(bindings).length > 0; // 인라인 `type` 은 여기서 걸러진다
}

/** `export … from` 쪽. 형태가 셋(`*` · `* as ns` · 네임드)이라 역시 소진 가능하다. */
function exportLeavesValueEdge(decl: ts.ExportDeclaration): boolean {
  if (decl.isTypeOnly) return false;
  const clause = decl.exportClause;
  if (!clause) return true; // `export * from`
  if (ts.isNamespaceExport(clause)) return true; // `export * as ns from`
  return namedBindingValueNames(clause).length > 0;
}

/** 함수 안에 있으면 lazy — 모듈 평가 시점에 실행되지 않는다. */
function insideFunction(node: ts.Node): boolean {
  for (let p = node.parent; p; p = p.parent) {
    if (ts.isFunctionLike(p)) return true;
  }
  return false;
}

/** 이 파일이 참조하는 **모든** 모듈 — 문법 형태를 가리지 않는다. */
function moduleRefs(sf: ts.SourceFile): ModuleRef[] {
  const refs: ModuleRef[] = [];

  const visit = (node: ts.Node): void => {
    if (
      ts.isImportDeclaration(node) &&
      ts.isStringLiteral(node.moduleSpecifier)
    ) {
      const bindings = node.importClause?.namedBindings;
      refs.push({
        specifier: node.moduleSpecifier.text,
        form: 'import',
        eager: true,
        value: importLeavesValueEdge(node.importClause),
        names:
          bindings && ts.isNamedImports(bindings)
            ? namedBindingValueNames(bindings)
            : [],
      });
    } else if (
      ts.isExportDeclaration(node) &&
      node.moduleSpecifier &&
      ts.isStringLiteral(node.moduleSpecifier)
    ) {
      const clause = node.exportClause;
      refs.push({
        specifier: node.moduleSpecifier.text,
        form: 'export',
        eager: true,
        value: exportLeavesValueEdge(node),
        names:
          clause && ts.isNamedExports(clause)
            ? namedBindingValueNames(clause)
            : [],
      });
    } else if (
      ts.isImportEqualsDeclaration(node) &&
      ts.isExternalModuleReference(node.moduleReference) &&
      ts.isStringLiteral(node.moduleReference.expression)
    ) {
      refs.push({
        specifier: node.moduleReference.expression.text,
        form: 'import=require',
        eager: true,
        value: true,
        names: [],
      });
    } else if (ts.isCallExpression(node)) {
      const isRequire =
        ts.isIdentifier(node.expression) && node.expression.text === 'require';
      const isDynamic = node.expression.kind === ts.SyntaxKind.ImportKeyword;
      const [arg] = node.arguments;
      if ((isRequire || isDynamic) && arg && ts.isStringLiteral(arg)) {
        refs.push({
          specifier: arg.text,
          form: isRequire ? 'require' : 'dynamic-import',
          // 동적 import 는 항상 lazy. require 는 top-level 일 때만 eager.
          eager: isRequire && !insideFunction(node),
          value: true,
          names: destructuredKeys(node),
        });
      }
    }
    ts.forEachChild(node, visit);
  };

  visit(sf);
  return refs;
}

/**
 * `const { A: b } = require('…')` 에서 꺼낸 **프로퍼티 키**(`A`). 별칭이 아니라 키로 읽는 이유는
 * import 쪽과 같다 — 이름을 바꿔 다는 것으로 예외를 타면 안 된다.
 */
function destructuredKeys(call: ts.CallExpression): string[] {
  const decl = call.parent;
  if (!decl || !ts.isVariableDeclaration(decl)) return [];
  if (!ts.isObjectBindingPattern(decl.name)) return [];
  return decl.name.elements
    .map((el) => el.propertyName ?? el.name)
    .filter(ts.isIdentifier)
    .map((id) => id.text);
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

/** 모든 소스 파일을 한 번만 파싱해 술어에 넘긴다 (테스트마다 재파싱하지 않는다). */
function collectOffenders(
  probe: (sf: ts.SourceFile, file: string) => string[],
): string[] {
  const offenders: string[] = [];
  for (const file of allTsFiles(SRC_ROOT)) {
    for (const hit of probe(parse(file), file)) {
      offenders.push(`${path.relative(SRC_ROOT, file)} → ${hit}`);
    }
  }
  return offenders;
}

describe('websocket-events.types — ES-module 순환 재편입 방지 (#1174 회귀 가드)', () => {
  it('모듈 참조를 하나도 갖지 않는다 (eager·lazy 를 가리지 않고 전부)', () => {
    const sf = parse(TYPES_FILE);

    // 공허 방지 — 파일을 못 읽거나 빈 파일이면 "간선 0" 은 자동으로 참이 된다.
    expect(sf.statements.length).toBeGreaterThanOrEqual(
      EXPECTED_EXPORTS.length,
    );

    expect(moduleRefs(sf).map((r) => `${r.form} ${r.specifier}`)).toEqual([]);
  });

  it('값·타입 선언이 실제로 이 모듈에서 export 된다 (딴 데로 옮기면 위 단언이 공허해진다)', () => {
    const sf = parse(TYPES_FILE);
    const exported = new Set<string>();
    for (const st of sf.statements) {
      if (
        !ts.isEnumDeclaration(st) &&
        !ts.isInterfaceDeclaration(st) &&
        !ts.isTypeAliasDeclaration(st)
      ) {
        continue;
      }
      // 선언 **존재**가 아니라 `export` 여부까지 본다 (`21_49_51` INFO4).
      const isExported = ts
        .getModifiers(st)
        ?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword);
      if (isExported) exported.add(st.name.text);
    }
    expect([...EXPECTED_EXPORTS].filter((n) => !exported.has(n))).toEqual([]);
  });

  /**
   * 세 번째 테스트의 `WebsocketService` 예외는 **네임드 바인딩**만 면제한다. 그 모듈에
   * `export default` 가 생기면 `import Anything from '…/websocket.service'` 로 무엇이든
   * 값으로 끌어올 수 있고, 그건 예외가 아니라 새 우회로다.
   *
   * 지금은 둘 다 default export 가 없다 — 그 **전제를 캐너리로 고정**한다
   * (`21_49_51` testing W1 이 제안).
   */
  it('두 모듈 어디에도 `export default` 가 없다 (있으면 예외 판정의 전제가 무너진다)', () => {
    for (const file of [
      TYPES_FILE,
      path.join(WS_DIR, 'websocket.service.ts'),
    ]) {
      const hasDefault = parse(file).statements.some(
        (st) =>
          ts.isExportAssignment(st) ||
          ts
            .getModifiers(st as ts.HasModifiers)
            ?.some((m) => m.kind === ts.SyntaxKind.DefaultKeyword),
      );
      expect({ file: path.basename(file), hasDefault }).toEqual({
        file: path.basename(file),
        hasDefault: false,
      });
    }
  });

  it('`websocket.service` 로의 eager 값 간선이 없다 (re-export facade 테스트 제외)', () => {
    const offenders = collectOffenders((sf, file) => {
      if (file === path.join(WS_DIR, 'websocket.service.ts')) return [];
      if (file === REEXPORT_FACADE_TEST) return [];

      return moduleRefs(sf)
        .filter((r) => r.eager && r.value && SERVICE_MODULE.test(r.specifier))
        .filter((r) => {
          // 서비스를 **주입하려면** 클래스를 import 할 수밖에 없다 — DI 의 불가피함이다.
          // 그래서 `import { WebsocketService }` 만 예외다.
          //
          // 재-수출(`export … from`)에는 그런 불가피함이 없다. 오히려 제3 모듈에 우회
          // 경로를 만들어 이 가드를 무력화하므로 **일부러 예외를 두지 않았다.**
          // 비대칭은 의도다.
          if (r.form !== 'import') return true;
          if (!r.names.length) return true; // side-effect / default / `* as`
          return r.names.some((n) => n !== 'WebsocketService');
        })
        .map((r) => `${r.form} ${r.names.join(', ') || '(no names)'}`);
    });

    expect(offenders).toEqual([]);
  });

  it('facade 테스트가 실제로 존재한다 (allowlist 가 죽은 경로를 가리키면 예외가 공짜가 된다)', () => {
    expect(fs.existsSync(REEXPORT_FACADE_TEST)).toBe(true);
  });

  /**
   * 위 세 번째 테스트의 판별 기준이 `value`(= `isTypeOnly` 의 부정)다. 타입 전용 심볼을
   * `type` 표시 없이 import 하면 그 신호가 흐려진다 — 값 간선이 아닌데 값 간선처럼 보인다.
   *
   * 리뷰 두 라운드 연속(`20_05_17` W1 · `20_27_08` W1) 같은 지적이 나왔다. 지목된 곳만
   * 고치면 세 번째가 온다. **인스턴스가 아니라 부류를 고정한다.**
   *
   * 무엇이 값이고 무엇이 타입인지는 하드코딩하지 않는다 — 타입 모듈을 파싱해서 얻는다.
   */
  it('타입 전용 심볼을 `type` 표시 없이 import 하는 곳이 없다', () => {
    const typesSf = parse(TYPES_FILE);
    const typeOnly = new Set<string>();
    for (const st of typesSf.statements) {
      if (ts.isInterfaceDeclaration(st) || ts.isTypeAliasDeclaration(st)) {
        typeOnly.add(st.name.text);
      }
    }
    // 공허 방지 — 하나도 못 모으면 아래 순회가 자동으로 통과한다.
    expect(typeOnly.size).toBeGreaterThan(0);

    const offenders = collectOffenders((sf) =>
      moduleRefs(sf)
        .filter(
          (r) =>
            r.form === 'import' && r.value && EVENT_MODULES.test(r.specifier),
        )
        .map((r) => r.names.filter((n) => typeOnly.has(n)))
        .filter((bare) => bare.length)
        .map((bare) => bare.join(', ')),
    );

    expect(offenders).toEqual([]);
  });
});
