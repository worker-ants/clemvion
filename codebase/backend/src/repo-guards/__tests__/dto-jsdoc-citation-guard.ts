// 응답 DTO 의 `/** */` JSDoc 안에 리뷰 인용이 들어갔는지 세는 가드 — 순수 로직.
//
// 소비처는 형제 파일 `dto-jsdoc-citation.spec.ts`. 배경·근거는 그 파일 헤더에 있다.

import * as fs from 'node:fs';
import * as path from 'node:path';
import * as ts from 'typescript';

import { toPosixRelative } from '../../common/__test-utils__/source-scan';
// 응답 DTO 판정은 **한 곳이 소유한다.** 같은 이름·같은 로직을 여기 다시 쓰면 한쪽만
// 바뀌었을 때 두 가드의 판정이 조용히 갈린다 (`review/consistency/2026/09/06/12_53_29` W4).
import { isResponseDtoFile } from './swagger-dto-contract-guard';

export { isResponseDtoFile };

/** `src` 루트. 이 파일은 `src/repo-guards/__tests__/` 에 있다. */
export const SRC_ROOT = path.resolve(__dirname, '..', '..');

/** JSDoc 안에서 발견된 리뷰 인용 한 건. */
export interface JsDocCitation {
  readonly file: string;
  /** 인용을 담은 선언의 이름 — 클래스명 또는 `<클래스>.<필드>`. */
  readonly owner: string;
  /**
   * 매치된 텍스트 **전부**. 실패 메시지가 무엇을 지워야 하는지 말하게 한다.
   *
   * 첫 매치만 돌려주던 판은 두 가지를 동시에 망쳤다 — 한 JSDoc 에 두 형태가 섞이면
   * (a) 진단이 하나만 보여 주고, (b) **뒤 형태가 영영 관측되지 않는다.** 실제로 그래서
   * "날짜+시각" 정규식을 통째로 지워도 스위트가 초록이었다
   * (`review/code/2026/09/06/12_53_28` W1 · INFO#9 — 같은 뿌리의 두 지적).
   */
  readonly citations: readonly string[];
  readonly key: string;
}

/**
 * 리뷰 인용으로 보는 형태.
 *
 * NERV `CLE-ENG-REVIEWCITE` 「인용 형식」 표의 옛 산출물 세 형태(전체 경로 · 날짜+시각 ·
 * bare 시각)와 NERV 발견 인용(규칙 9)이다. **bare 시각까지 포함하는 것이 중요하다**: 규약이
 * 금지하는 형태라고 해서 이 가드가 안 봐도 되는 것은 아니다. 오히려 JSDoc 에 남을 확률이
 * 그쪽이 높다.
 *
 * NERV 발견 인용은 전환 단계 4g(NERV Task `CLE-T-M7K35H`)에서 더했다. 전환 단계 2 뒤의 리뷰는
 * 이 형식만 남기므로 옛 세 형태만 세면 새 인용이 통째로 빠진다. 줄인 ID(`finding <앞 8자>`)도
 * 함께 잡는다. 로컬 산출물 경로(`.review/**`, 규칙 10)는 첫 패턴에 앞 경계가 없어 여기서도
 * 걸리지만, codebase 전체에서 0 을 요구하는 것은 프런트 docs 가드 `review-citation-form` 이다.
 */
const CITATION_PATTERNS: readonly RegExp[] = [
  /review\/(?:code|consistency|merge)\/\d{4}\/\d{2}\/\d{2}\/\d{2}_\d{2}_\d{2}/,
  /\d{4}-\d{2}-\d{2}\s+\d{2}_\d{2}_\d{2}/,
  // bare 시각 — **백틱을 요구하지 않는다.** 종전 판은 `` `hh_mm_ss` `` 만 봐서 백틱 없이
  // 쓴 인용을 통째로 놓쳤고, 그러면서 위 docstring 은 "세 형태" 를 센다고 적고 있었다
  // (`review/code/2026/09/06/16_58_14` W4 — 무수정 프로브로 재현). JSDoc 에 남을 확률은
  // 오히려 백틱 없는 쪽이 높다.
  //
  // 경계는 **단어·경로 문자**로만 막는다: 앞뒤가 `\w`·`-` 면 다른 토큰의 일부이고,
  // 앞이 `/` 면 전체 경로라 위 첫 패턴이 이미 잡는다. 백틱·공백·괄호는 통과시킨다.
  /(?<![\w/-])\d{2}_\d{2}_\d{2}(?![\w-])/,
  // NERV 발견 인용. 전체 ID(UUID)면 통째로, 줄인 ID 면 앞 8자를 잡는다.
  /\bfinding\s+[0-9a-f]{8}(?:-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})?\b/,
];

/** 텍스트에서 인용 형태 **전부**를 찾는다. 형태당 첫 매치 하나씩. */
function findCitations(text: string): string[] {
  const out: string[] = [];
  for (const re of CITATION_PATTERNS) {
    const m = re.exec(text);
    if (m) out.push(m[0]);
  }
  return out;
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
 * 클래스 선언과 프로퍼티 선언 둘 다 본다. 프로퍼티 JSDoc 은 swagger CLI 플러그인이 필드
 * `description` 으로 싣는다. 클래스 JSDoc 은 지금 플러그인이 싣지 않지만 규약이 같은 규칙을 둔다
 * — 응답 DTO 파일의 `/** *\/` 를 공개 문서 채널 하나로 다룬다(`review-citations.md §3`).
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
      const citations = findCitations(jsDocText(node));
      if (citations.length > 0) {
        out.push({ file: rel, owner, citations, key: `${rel}#${owner}` });
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
