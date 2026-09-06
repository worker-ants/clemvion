// 응답 DTO 의 `/** */` JSDoc 안에 리뷰 인용이 들어갔는지 세는 가드 — 순수 로직.
//
// 소비처는 형제 파일 `dto-jsdoc-citation.spec.ts`. 배경·근거는 그 파일 헤더에 있다.

import * as fs from 'node:fs';
import * as path from 'node:path';
import * as ts from 'typescript';

import { toPosixRelative } from '../../common/__test-utils__/source-scan';

/** `src` 루트. 이 파일은 `src/repo-guards/__tests__/` 에 있다. */
export const SRC_ROOT = path.resolve(__dirname, '..', '..');

/** JSDoc 안에서 발견된 리뷰 인용 한 건. */
export interface JsDocCitation {
  readonly file: string;
  /** 인용을 담은 선언의 이름 — 클래스명 또는 `<클래스>.<필드>`. */
  readonly owner: string;
  /** 실제로 매치된 텍스트. 실패 메시지가 무엇을 지웠는지 말하게 한다. */
  readonly citation: string;
  readonly key: string;
}

/**
 * 리뷰 인용으로 보는 형태.
 *
 * `review-citations.md §2` 가 정한 세 형태를 그대로 옮긴다 — 전체 경로 · 날짜+시각 ·
 * bare 시각. **bare 시각까지 포함하는 것이 중요하다**: 규약이 금지하는 형태라고 해서
 * 이 가드가 안 봐도 되는 것은 아니다. 오히려 JSDoc 에 남을 확률이 그쪽이 높다.
 */
const CITATION_PATTERNS: readonly RegExp[] = [
  /review\/(?:code|consistency|merge)\/\d{4}\/\d{2}\/\d{2}\/\d{2}_\d{2}_\d{2}/,
  /\d{4}-\d{2}-\d{2}\s+\d{2}_\d{2}_\d{2}/,
  /`\d{2}_\d{2}_\d{2}`/,
];

function findCitation(text: string): string | null {
  for (const re of CITATION_PATTERNS) {
    const m = re.exec(text);
    if (m) return m[0];
  }
  return null;
}

/** 응답 DTO 파일인가 — `swagger-dto-contract-guard` 와 같은 판정. */
export function isResponseDtoFile(file: string): boolean {
  return file.replace(/\\/g, '/').includes('/dto/responses/');
}

/**
 * `node` 에 **붙은** JSDoc 블록들의 텍스트.
 *
 * `//` 주석은 대상이 아니다 — 그것이 규약이 처방하는 **회피처**다. TypeScript 는 `//` 를
 * JSDoc 으로 파싱하지 않으므로 `ts.getJSDocCommentsAndTags` 가 자연히 갈라 준다.
 */
function jsDocText(node: ts.Node): string {
  return ts
    .getJSDocCommentsAndTags(node)
    .map((d) => d.getFullText())
    .join('\n');
}

/**
 * 응답 DTO 파일에서 **JSDoc 안의 리뷰 인용**을 전부 찾는다.
 *
 * 클래스 선언과 프로퍼티 선언 둘 다 본다 — 둘 다 OpenAPI 로 나간다(클래스는 스키마
 * description, 프로퍼티는 필드 description).
 */
export function findDtoJsDocCitations(
  files: readonly string[],
  srcRoot: string,
): JsDocCitation[] {
  const out: JsDocCitation[] = [];
  for (const file of files) {
    if (!isResponseDtoFile(file)) continue;
    const sf = ts.createSourceFile(
      file,
      fs.readFileSync(file, 'utf8'),
      ts.ScriptTarget.Latest,
      true,
    );
    const rel = toPosixRelative(srcRoot, file);

    const push = (owner: string, node: ts.Node): void => {
      const citation = findCitation(jsDocText(node));
      if (citation) {
        out.push({ file: rel, owner, citation, key: `${rel}#${owner}` });
      }
    };

    const visit = (node: ts.Node): void => {
      if (ts.isClassDeclaration(node) && node.name) {
        const className = node.name.getText(sf);
        push(className, node);
        for (const member of node.members) {
          if (ts.isPropertyDeclaration(member) && member.name) {
            push(`${className}.${member.name.getText(sf)}`, member);
          }
        }
      }
      ts.forEachChild(node, visit);
    };
    visit(sf);
  }
  return out.sort((a, b) => a.key.localeCompare(b.key));
}
