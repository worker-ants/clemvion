// 공개 OpenAPI 문장에 실리는 저장소 내부 참조를 찾는 가드 — 순수 로직.
//
// 소비처는 형제 파일 `openapi-internal-ref.spec.ts`. 배경 · 근거는 그 파일 헤더에 있다.

import * as fs from 'node:fs';
import * as path from 'node:path';
import * as ts from 'typescript';

import { toPosixRelative } from '../../common/__test-utils__/source-scan';

/** `src` 루트. 이 파일은 `src/repo-guards/__tests__/` 에 있다. */
export const SRC_ROOT = path.resolve(__dirname, '..', '..');

/** 가드 fixture 루트. 프로덕션 스캔에서 뺀다. */
export const FIXTURE_ROOT = path.join(__dirname, 'fixtures');

/** 공개 OpenAPI 에 실리는 내부 참조 하나. */
export interface OpenApiInternalRef {
  readonly file: string;
  readonly line: number;
  /** `<클래스>.<멤버>` · `<클래스>` · `<선언 이름>` 또는 `<변수>.<속성>`. */
  readonly owner: string;
  /** `jsdoc`(파일 안의 `/** *\/` 블록) 또는 문자열 속성 이름(`description` · `summary`). */
  readonly channel: 'jsdoc' | 'description' | 'summary';
  /** 매치된 텍스트 전부(형태당 첫 매치 하나씩). */
  readonly matches: readonly string[];
}

/**
 * 내부 참조로 보는 형태. 저장소 스펙 경로(옛 트리 · 미러), 옛 스펙 파일 이름, NERV 스펙 키,
 * 요구사항 ID, 옛 요구사항 ID, 옛 plan 경로다. 키 · 요구사항 ID 모양은 프론트엔드 가이드 가드
 * (`frontend/src/lib/docs/__tests__/no-internal-refs.test.ts`)와 같다.
 *
 * - 스펙 경로는 앞이 단어 · 경로 문자가 아닐 때만 센다 — `respec/` 같은 낱말을 빼고,
 *   `../spec/` · `/spec/` 은 잡는다.
 * - `spec/` 없이 적은 옛 트리 파일 이름(`15-chat-channel.md` · `../../2-navigation/4-integration.md`)은
 *   번호로 시작하는 모양으로 잡는다.
 * - 옛 요구사항 ID 는 옛 트리 스펙의 앵커 ID 다(`WH-SC-01` · `CCH-ERR-03` · `EIA-NX-06`).
 *   대문자 묶음 둘 이상 뒤에 두세 자리 숫자가 온다(`REQ-` 로 시작하면 위 패턴 몫이다). 가이드 가드의
 *   `CCH-` · `R-` 패턴보다 넓다. `SHA-256` · `ISO-8601` 처럼 대문자 묶음이 하나면 잡지 않는다.
 */
const INTERNAL_REF_PATTERNS: readonly RegExp[] = [
  /(?<![\w.-])spec\/[\w-]/,
  /\b\d+-[a-z][\w-]*\.md\b/,
  /\bCLE-[A-Z][A-Z0-9]*(?:-[A-Z0-9]+)*\b/,
  /\bREQ-[A-Z][A-Z0-9]*(?:-[A-Z0-9]+)*-\d+\b/,
  /\b(?!REQ-)[A-Z]{2,5}(?:-[A-Z]{2,5})+-\d{2,3}[a-z]?\b/,
  /\bplan\/(?:in-progress|complete)\//,
];

/** 공개 문장으로 나가는 문자열 속성 이름. 데코레이터 인자(`@ApiProperty` · `@ApiOperation` 등)의 키다. */
const PUBLISHED_STRING_KEYS = new Set(['description', 'summary']);

/**
 * swagger 플러그인이 JSDoc 을 싣는 파일. `nest-cli.json` 의 suffix 와 같다. 이 파일들의
 * `/** *\/` 는 플러그인이 실제로 싣는 자리인지와 상관없이 한 공개 채널로 본다.
 */
export function isOpenApiSourceFile(file: string): boolean {
  return /\.(?:dto|controller)\.ts$/.test(file);
}

function findRefs(text: string): string[] {
  const out: string[] = [];
  for (const re of INTERNAL_REF_PATTERNS) {
    const m = re.exec(text);
    if (m) out.push(m[0]);
  }
  return out;
}

/** 이름 있는 선언이면 그 이름(클래스 멤버는 `<클래스>.<멤버>`). 아니면 `undefined`. */
function declarationName(node: ts.Node, sf: ts.SourceFile): string | undefined {
  if (ts.isVariableStatement(node)) {
    return node.declarationList.declarations[0]?.name.getText(sf);
  }
  const name = (node as { name?: ts.Node }).name;
  if (!name || (!ts.isDeclarationStatement(node) && !ts.isClassElement(node))) {
    return undefined;
  }
  if (ts.isClassElement(node) && ts.isClassLike(node.parent)) {
    const cls = node.parent.name?.getText(sf) ?? '<class>';
    return `${cls}.${name.getText(sf)}`;
  }
  return name.getText(sf);
}

/** 문자열 리터럴과 `+` 로 이은 리터럴들의 텍스트. 그 밖의 식은 볼 수 없어 빈 문자열이다. */
function stringText(expr: ts.Expression): string {
  if (ts.isStringLiteralLike(expr)) return expr.text;
  if (ts.isParenthesizedExpression(expr)) return stringText(expr.expression);
  if (ts.isTemplateExpression(expr)) {
    return (
      expr.head.text + expr.templateSpans.map((s) => s.literal.text).join('')
    );
  }
  if (
    ts.isBinaryExpression(expr) &&
    expr.operatorToken.kind === ts.SyntaxKind.PlusToken
  ) {
    return stringText(expr.left) + stringText(expr.right);
  }
  return '';
}

/** 속성 할당을 감싼 선언의 이름(`<클래스>` · `<변수>`). 없으면 `<literal>`. */
function enclosingName(node: ts.Node, sf: ts.SourceFile): string {
  for (let p: ts.Node | undefined = node.parent; p; p = p.parent) {
    if ((ts.isClassDeclaration(p) || ts.isVariableDeclaration(p)) && p.name) {
      return p.name.getText(sf);
    }
    if (ts.isMethodDeclaration(p) || ts.isPropertyDeclaration(p)) {
      const cls = p.parent;
      const clsName =
        ts.isClassDeclaration(cls) && cls.name
          ? cls.name.getText(sf)
          : '<class>';
      return `${clsName}.${p.name.getText(sf)}`;
    }
  }
  return '<literal>';
}

/**
 * 공개 채널에서 내부 참조를 찾는다.
 *
 * - `*.dto.ts` · `*.controller.ts` 안의 모든 `/** *\/` 블록. 플러그인은 DTO 속성 JSDoc 을 필드
 *   `description` 으로, 컨트롤러 메서드 JSDoc 을 operation 설명으로 싣는다. 클래스 JSDoc 처럼
 *   싣지 않는 자리도 같은 채널로 센다. 쓰는 사람이 플러그인 동작을 보고 자리마다 판단하지 않게
 *   하고, `@ApiSchema({ description })` 로 옮겨 적을 때 참조가 딸려 나가지 않게 한다
 *   (리뷰 인용 규약이 응답 DTO 파일의 `/** *\/` 를 한 채널로 본 것과 같은 이유).
 * - 두 파일 종류의 `description` · `summary` 문자열 속성(데코레이터 인자)
 *
 * `//` 주석과 `/* *\/` 주석은 보지 않는다. 근거를 옮겨 적는 자리다.
 */
export function findOpenApiInternalRefs(
  files: readonly string[],
  srcRoot: string,
): OpenApiInternalRef[] {
  const out: OpenApiInternalRef[] = [];
  for (const file of files) {
    if (!isOpenApiSourceFile(file)) continue;
    const text = fs.readFileSync(file, 'utf8');
    const sf = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true);
    const rel = toPosixRelative(srcRoot, file);
    const lineAt = (pos: number): number =>
      sf.getLineAndCharacterOfPosition(pos).line + 1;
    const lineOf = (node: ts.Node): number => lineAt(node.getStart(sf));
    // 한 주석은 그 주석을 앞에 둔 노드 여럿(선언 · 데코레이터 · 첫 토큰)의 leading comment 다.
    // 바깥 노드를 먼저 방문하므로 처음 본 노드가 주인이다.
    const seen = new Set<number>();

    const visit = (node: ts.Node): void => {
      const ranges =
        node.kind === ts.SyntaxKind.SourceFile
          ? undefined
          : ts.getLeadingCommentRanges(text, node.getFullStart());
      for (const r of ranges ?? []) {
        if (seen.has(r.pos)) continue;
        seen.add(r.pos);
        const comment = text.slice(r.pos, r.end);
        if (!comment.startsWith('/**')) continue;
        const matches = findRefs(comment);
        if (matches.length > 0) {
          out.push({
            file: rel,
            line: lineAt(r.pos),
            owner:
              declarationName(node, sf) ??
              `${enclosingName(node, sf)}.<${ts.SyntaxKind[node.kind]}>`,
            channel: 'jsdoc',
            matches,
          });
        }
      }
      if (
        ts.isPropertyAssignment(node) &&
        PUBLISHED_STRING_KEYS.has(node.name.getText(sf))
      ) {
        const matches = findRefs(stringText(node.initializer));
        if (matches.length > 0) {
          const key = node.name.getText(sf) as 'description' | 'summary';
          out.push({
            file: rel,
            line: lineOf(node),
            owner: `${enclosingName(node, sf)}.${key}`,
            channel: key,
            matches,
          });
        }
      }
      ts.forEachChild(node, visit);
    };
    visit(sf);
  }
  return out.sort(
    (a, b) =>
      a.owner.localeCompare(b.owner) ||
      a.file.localeCompare(b.file) ||
      a.line - b.line,
  );
}
