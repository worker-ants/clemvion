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
  /** `<클래스>.<멤버>` 또는 `<변수>.<속성>`. */
  readonly owner: string;
  /** `jsdoc`(속성 · 메서드 JSDoc) 또는 문자열 속성 이름(`description` · `summary`). */
  readonly channel: 'jsdoc' | 'description' | 'summary';
  /** 매치된 텍스트 전부(형태당 첫 매치 하나씩). */
  readonly matches: readonly string[];
}

/**
 * 내부 참조로 보는 형태. 저장소 스펙 경로(옛 트리 · 미러), NERV 스펙 키, 요구사항 ID,
 * 옛 plan 경로다. 키 · 요구사항 ID 모양은 프론트엔드 가이드 가드
 * (`frontend/src/lib/docs/__tests__/no-internal-refs.test.ts`)와 같다.
 *
 * 스펙 경로는 앞이 단어 · 경로 문자가 아닐 때만 센다 — `respec/` 같은 낱말을 빼고,
 * `../spec/` · `/spec/` 은 잡는다. `spec/` 없이 적은 옛 트리 파일 이름
 * (`15-chat-channel.md` · `../../2-navigation/4-integration.md`)은 번호로 시작하는 모양으로 잡는다.
 */
const INTERNAL_REF_PATTERNS: readonly RegExp[] = [
  /(?<![\w.-])spec\/[\w-]/,
  /\bCLE-[A-Z][A-Z0-9]*(?:-[A-Z0-9]+)*\b/,
  /\bREQ-[A-Z][A-Z0-9]*(?:-[A-Z0-9]+)*-\d+\b/,
  /\bplan\/(?:in-progress|complete)\//,
  /\b\d+-[a-z][\w-]*\.md\b/,
];

/** 공개 문장으로 나가는 문자열 속성 이름. 데코레이터 인자(`@ApiProperty` · `@ApiOperation` 등)의 키다. */
const PUBLISHED_STRING_KEYS = new Set(['description', 'summary']);

/** swagger 플러그인이 JSDoc 을 싣는 파일. `nest-cli.json` 의 suffix 와 같다. */
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

/** 노드에 붙은 `/** *\/` 블록의 텍스트. `//` 주석은 JSDoc 이 아니라 빠진다(회피처). */
function jsDocText(node: ts.Node): string {
  return ts
    .getJSDocCommentsAndTags(node)
    .map((d) => d.getFullText())
    .join('\n');
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
 * - `*.dto.ts` 클래스 **속성**의 JSDoc(필드 `description`)
 * - `*.controller.ts` 클래스 **메서드**의 JSDoc(operation summary · description)
 * - 두 파일 종류의 `description` · `summary` 문자열 속성(데코레이터 인자)
 *
 * 클래스 JSDoc 은 플러그인이 싣지 않아 보지 않는다.
 */
export function findOpenApiInternalRefs(
  files: readonly string[],
  srcRoot: string,
): OpenApiInternalRef[] {
  const out: OpenApiInternalRef[] = [];
  for (const file of files) {
    if (!isOpenApiSourceFile(file)) continue;
    const sf = ts.createSourceFile(
      file,
      fs.readFileSync(file, 'utf8'),
      ts.ScriptTarget.Latest,
      true,
    );
    const rel = toPosixRelative(srcRoot, file);
    const isDto = file.endsWith('.dto.ts');
    const lineOf = (node: ts.Node): number =>
      sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1;

    const visit = (node: ts.Node): void => {
      if (ts.isClassDeclaration(node) && node.name) {
        const className = node.name.getText(sf);
        for (const member of node.members) {
          const published = isDto
            ? ts.isPropertyDeclaration(member)
            : ts.isMethodDeclaration(member);
          if (!published || !member.name) continue;
          const matches = findRefs(jsDocText(member));
          if (matches.length > 0) {
            out.push({
              file: rel,
              line: lineOf(member),
              owner: `${className}.${member.name.getText(sf)}`,
              channel: 'jsdoc',
              matches,
            });
          }
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
