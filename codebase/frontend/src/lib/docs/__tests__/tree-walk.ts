// 문서 가드들이 공유하는 디렉터리 순회 — **손수 짠 DFS 를 여기 하나로 모은다.**
//
// ## 왜 모으나
//
// 이 폴더의 가드들이 스택 기반 DFS 를 **여섯 벌** 갖고 있었다. 형태는 똑같고(스택 ·
// `readdirSync(withFileTypes)` · 상대경로 계산 · 정렬) 다른 것은 **필터뿐**이었는데, 필터
// 차이는 데이터가 그 형태를 갖는 순간에만 드러나므로 **조용히 갈린다**.
//
// 실제로 갈려 있었다 — `plan-scan.ts` 는 `_` 접두를 **파일명**에 적용하고
// `impl-anchor-parse.ts` 는 같은 접두를 **디렉터리명**에 적용한다. 둘 다 자기 자리에서는
// 옳지만, 한 폴더의 가드가 "밑줄 접두는 제외" 라는 같은 문장을 서로 다른 대상에 적용하고
// 있다는 사실은 어느 주석에도 없었다. 여기 모으면 그 차이가 **호출부 한 줄로 보인다**.
//
// ## 무엇을 안 모았나
//
// `spec-frontmatter-parse.ts` 의 glob 존재 프로브는 **수집기가 아니다** — 첫 매치에
// `return true` 로 빠져나오고 `readdirSync` 실패를 삼킨다. 전량 수집 후 판정으로 바꾸면
// 조기 종료가 사라져 성격이 달라지므로 그대로 둔다.
//
// ## 통합이 집합을 바꾸지 않는다는 증거
//
// `tree-walk.test.ts` 가 여섯 수집기의 산출을 **원소 단위로** 고정한다. 통합의 유일한
// 위험은 "합치면서 조용히 스코프가 바뀌는 것" 이고, 그건 개수가 아니라 집합으로 봐야
// 잡힌다(개수가 같은 채로 원소가 바뀔 수 있다).

import fs from "node:fs";
import path from "node:path";

/**
 * 순회가 찾은 파일 한 건. 도메인 중립 이름이다 — spec 뿐 아니라 plan `.md`,
 * codebase `.ts`, 유저 가이드 `.mdx` 를 모두 담는다.
 *
 * (종전 이름은 `SpecMdFile` 이었는데 `collectCodebaseSources(): SpecMdFile[]` 처럼
 * spec 도 markdown 도 아닌 것에 쓰이고 있었다.)
 */
export interface MdFileRef {
  absPath: string;
  relPath: string;
}

export interface WalkOptions {
  /**
   * `true` 를 돌려주면 그 디렉터리와 **하위 전체**를 건너뛴다.
   * 인자는 (디렉터리 basename, `root` 기준 상대경로).
   */
  skipDir?: (name: string, relPath: string) => boolean;
  /**
   * `true` 를 돌려준 파일만 수집한다. 인자는 (파일 basename, `root` 기준 상대경로).
   *
   * **basename 과 relPath 를 둘 다 주는 것은 의도다** — 기존 여섯 walker 가 접두 판정은
   * basename 으로(`0-`/`_`), 경로 판정은 상대경로로(`-api-catalog/`) 하고 있었고 그 둘은
   * 서로 대체되지 않는다. 하나만 주면 호출부가 `path.basename` 을 다시 부르거나
   * `relPath.includes` 로 뭉개게 된다.
   */
  includeFile: (name: string, relPath: string) => boolean;
  /** `false` 면 `bases` 자신의 항목만 본다(하위 디렉터리 미진입). 기본 `true`. */
  recurse?: boolean;
}

/**
 * `bases` 각각을 순회해 `includeFile` 을 통과한 파일을 상대경로 오름차순으로 돌려준다.
 *
 * - `relPath` 는 항상 `root` 기준이고 구분자를 `/` 로 정규화한다.
 * - 존재하지 않는 base 는 조용히 건너뛴다(가드가 옵션 디렉터리를 볼 수 있다).
 * - 정렬은 `relPath` 의 `localeCompare` — 여섯 walker 중 다섯이 이미 쓰던 기준이다.
 */
export function walkTree(
  root: string,
  bases: string[],
  options: WalkOptions,
): MdFileRef[] {
  const recurse = options.recurse ?? true;
  const out: MdFileRef[] = [];
  const rel = (full: string): string =>
    path.relative(root, full).split(path.sep).join("/");

  for (const base of bases) {
    const dir = path.isAbsolute(base) ? base : path.join(root, base);
    if (!fs.existsSync(dir)) continue;
    const stack = [dir];
    while (stack.length > 0) {
      const cur = stack.pop()!;
      for (const entry of fs.readdirSync(cur, { withFileTypes: true })) {
        const full = path.join(cur, entry.name);
        if (entry.isDirectory()) {
          if (!recurse) continue;
          if (options.skipDir?.(entry.name, rel(full))) continue;
          stack.push(full);
        } else if (entry.isFile()) {
          const relPath = rel(full);
          if (options.includeFile(entry.name, relPath)) {
            out.push({ absPath: full, relPath });
          }
        }
      }
    }
  }
  out.sort((a, b) => a.relPath.localeCompare(b.relPath));
  return out;
}
