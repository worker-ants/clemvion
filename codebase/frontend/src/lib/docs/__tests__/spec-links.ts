// Shared helpers for the spec-link-integrity guard.
//
// Validates in-repo markdown links in codebase sources and governance docs:
//   - the relative path target exists, or a key link (`[text](CLE-KEY#anchor)`)
//     names a NERV spec key that has a mirror file, and
//   - any `#anchor` fragment resolves to a real heading slug in the target.
//
// The old `spec/**` narrative-doc scope (scope 1) went with the old spec tree in
// NERV cutover stage 5 (NERV Task `CLE-T-7M4C4X`). `spec/` now holds only the NERV
// mirror: NERV reads its body links as references, `pull.py --check` guards it.
//
// The heading-slug algorithm mirrors github-slugger (the renderer used by the
// in-app docs viewer): lowercase, drop punctuation but KEEP CJK + underscores,
// spaces → single hyphens (no run-collapse), duplicate headings get `-1`/`-2`.
// This port was cross-validated against 1200+ known-good in-repo anchor links.
//
// SoT for spec evidence conventions: CLE-ENG-SPECEVIDENCE.

import fs from "node:fs";
import path from "node:path";

import { walkTree, type MdFileRef } from "./tree-walk";
import { mirrorKeyPaths, SPEC_KEY_RE } from "./spec-keys";
import { fromMarkdown } from "mdast-util-from-markdown";
import { toString as mdToString } from "mdast-util-to-string";
import GithubSlugger from "github-slugger";
import type { Root, RootContent, Heading } from "mdast";

// Heading-anchor slugs are computed with the EXACT renderer pipeline the in-app
// docs viewer uses — remark/mdast parse (so emphasis, code spans, and inline
// markdown are resolved as CommonMark, e.g. `render_*` keeps its underscore but
// `_emph_` is stripped) → github-slugger (the lib behind rehype-slug). Hand-
// rolled slug regexes drift from this on edge cases (lone `_` before
// punctuation), so we delegate to the real libraries instead.

function collectHeadings(node: Root | RootContent, out: Heading[]): void {
  if (node.type === "heading") out.push(node);
  if ("children" in node && Array.isArray(node.children)) {
    for (const child of node.children) collectHeadings(child as RootContent, out);
  }
}

/**
 * GitHub-flavoured anchor slug for a single heading's text. The text is parsed
 * in heading context (so a leading `1.` is inline text, not an ordered-list
 * marker) then slugged with github-slugger.
 */
export function slugify(heading: string): string {
  const tree = fromMarkdown(`# ${heading}`);
  const headings: Heading[] = [];
  collectHeadings(tree, headings);
  const text = headings.length > 0 ? mdToString(headings[0]) : heading;
  return new GithubSlugger().slug(text);
}

/** Set of valid heading anchor slugs for a markdown file (with `-1`/`-2` dups). */
export function headingSlugs(absPath: string): Set<string> {
  let text: string;
  try {
    text = fs.readFileSync(absPath, "utf8");
  } catch {
    return new Set();
  }
  const tree = fromMarkdown(text);
  const headings: Heading[] = [];
  collectHeadings(tree, headings);
  // One slugger per file → github-slugger appends `-1`/`-2` to duplicate
  // headings exactly as rehype-slug does, in document order.
  const slugger = new GithubSlugger();
  const slugs = new Set<string>();
  for (const h of headings) {
    const slug = slugger.slug(mdToString(h));
    if (slug) slugs.add(slug);
  }
  return slugs;
}

export interface MdLink {
  line: number; // 링크가 **시작한** 줄 (멀티라인이면 첫 줄)
  raw: string; // 멀티라인 링크면 **개행을 포함**한다
  target: string; // url part only (title and surrounding ws stripped)
}

// 링크 **텍스트**는 줄을 넘을 수 있고(`[^\]]*` 가 개행을 포함한다), **목적지**는 넘지
// 못한다(`[^)\n]+`). 후자는 의도된 좁힘이다 — CommonMark 도 `<...>` 형태가 아니면 목적지에
// 개행을 허용하지 않고, 넓히면 본문 괄호가 URL 로 오인될 여지가 생긴다.
const LINK_RE = /\[([^\]]*)\]\(([^)\n]+)\)/g;
const FENCE_RE = /^(\s*)(```|~~~)/;

/**
 * 마크다운 링크 표기가 **있을 수 없는** 파일인가. 참이면 라인 스캔을 통째로 건너뛴다.
 *
 * `LINK_RE` 는 `]` 바로 뒤에 `(` 를 요구하므로 `"]("` 가 없으면 매치도 없다 — **다만
 * 그것만 보면 안 된다.** 아래 스캔은 인라인 코드를 먼저 지우므로, 원문 `` [a]`x`(b) `` 는
 * `"]("` 를 갖지 않는데 제거 후 링크가 된다. `]` 를 `(` 옆으로 데려올 수 있는 유일한 경로가
 * 인라인 코드 제거이고, 그러려면 원문에 **`]` 바로 뒤 백틱**이 있어야 한다.
 *
 * 그래서 필요조건은 두 개다. 순진한 `"]("` 단독이면 저 형태의 링크를 가진 파일이 가드에서
 * **조용히 빠진다** — 성능 최적화가 가드를 침묵시키는 형태이고, 이 저장소가 반복해 데인
 * 것이 그것이다.
 *
 * 실측(codebase 소스 2077개): `"]("` 35개(1.7%) → 통과 **247개(11.9%)**. 정확한 조건도
 * 88%를 걸러낸다. 마크다운 문서(거버넌스)는 원래 링크 문서라 대부분 통과한다.
 *
 * 절대 개수는 트리가 커지면 따라 움직인다 — **비율**이 요점이고, 첫 판이 1~2건 어긋난 것도
 * 파일을 더 추가하기 전 중간 상태에서 쟀기 때문이다(ai-review documentation).
 */
function cannotContainLink(text: string): boolean {
  return !text.includes("](") && !text.includes("]`");
}

/** 마스킹된 전문 + 그 안의 오프셋을 원본 줄로 되돌리는 지도. */
interface MaskedDoc {
  /** 펜스·인라인 코드를 처리한 뒤 개행으로 다시 이은 전문. */
  body: string;
  /** 각 마스킹 줄이 `body` 안에서 시작하는 오프셋 (오름차순). */
  startOf: number[];
  /** 각 마스킹 줄이 원본 몇 번째 줄인가 (1-based). */
  srcLineOf: number[];
}

/**
 * 원문을 링크 매칭용으로 마스킹한다 — `extractLinks` 의 §1~§4 를 이 함수가 담당한다
 * (인라인 코드 삭제 · 줄 지도 · 펜스 차단 · **빈 줄 차단**).
 *
 * 펜스(경계 줄과 내부 줄을 **같이**) 는 `]` 한 글자로 바꾼다. 그냥 지우면 앞뒤 줄이 붙어
 * **없던 링크가 생기고**, 공백으로 두면 링크 텍스트가 펜스를 건너뛰어 이어진다. `]` 는
 * 열린 `[` 텍스트를 즉시 끊고, 뒤가 개행이라 `](` 도 될 수 없다.
 */
function buildMaskedDoc(text: string): MaskedDoc {
  const lines = text.split(/\r?\n/);
  const masked: string[] = [];
  const srcLineOf: number[] = [];
  let inFence = false;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const isFenceBoundary = FENCE_RE.test(line);
    if (isFenceBoundary) inFence = !inFence;
    // 세 경우 모두 `]` 로 끊는다:
    //   - 펜스 경계 줄 / 펜스 내부 줄 — 스캔 대상이 아니다.
    //   - **빈 줄** — CommonMark 에서 링크 텍스트는 **문단 경계를 넘지 못한다.**
    //     `mdast-util-from-markdown`(이 파일이 헤딩 슬러그에 쓰는 그 파서)로 확인:
    //     `[t\n둘째 줄](u)` → 링크 / `[t\n\n다른 문단](u)` → **링크 아님**.
    //     끊지 않으면 문단을 건너뛰어 **없는 링크를 만들어 낸다**(false positive).
    const isBlank = line.trim() === "";
    masked.push(
      isFenceBoundary || inFence || isBlank ? "]" : line.replace(/`[^`]*`/g, ""),
    );
    srcLineOf.push(i + 1);
  }

  const startOf: number[] = [];
  let acc = 0;
  for (const l of masked) {
    startOf.push(acc);
    acc += l.length + 1; // +1 = join 에 쓰는 개행
  }
  return { body: masked.join("\n"), startOf, srcLineOf };
}

/** `body` 안의 오프셋이 속한 **원본** 줄 번호 (1-based). */
function lineForOffset(doc: MaskedDoc, offset: number): number {
  let lo = 0;
  let hi = doc.startOf.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (doc.startOf[mid] <= offset) lo = mid;
    else hi = mid - 1;
  }
  return doc.srcLineOf[lo];
}

/**
 * Extract markdown links outside fenced/inline code.
 *
 * ## 왜 줄 단위로 매칭하지 않는가
 *
 * 종전 구현은 줄로 자른 뒤 **줄마다** `LINK_RE` 를 돌렸다. 그래서 링크 **텍스트**가 줄을
 * 넘으면 — `[` 와 `](` 가 다른 줄에 있으면 — 그 링크는 **아예 수집되지 않았다.** 존재·앵커
 * 검증이 통째로 건너뛰어지고, 가드는 실패가 아니라 **침묵으로 통과**한다. 깨진 앵커가
 * 있어도 아무도 모르는 형태다(2026-08-11 실측: `spec/**.md` 6건/6파일 + 거버넌스 스코프
 * 2건이 그렇게 숨어 있었다).
 *
 * 그래서 **마스킹된 전문(全文)** 을 만들어 한 번에 매칭한다.
 *
 * ## 마스킹이 네 가지를 동시에 지켜야 한다
 *
 * 1. **인라인 코드는 지운다 (공백으로 채우지 않는다).** `` [a]`code`(b) `` 는 코드를
 *    지워야 비로소 링크가 된다 — 공백으로 채우면 `](` 인접성이 깨져 그 링크를 놓친다.
 *    이건 기존 동작이고 전용 회귀 테스트가 있다.
 * 2. **줄 번호는 원본 기준이어야 한다.** 1 때문에 오프셋이 밀리므로, 마스킹 텍스트의 각
 *    줄이 원본 몇 번째 줄인지를 `srcLineOf` 에 따로 들고 간다.
 * 3. **펜스를 사이에 두고 링크가 새로 생기면 안 된다.** 펜스 줄을 그냥 건너뛰면 앞뒤가
 *    붙어 없던 링크가 생긴다. 그래서 건너뛴 자리마다 `]` 를 남긴다 — `]` 는 `[^\]]*`
 *    (링크 텍스트)를 즉시 끝내고, 뒤에 오는 것은 개행이라 `](` 도 될 수 없다.
 * 4. **빈 줄(문단 경계)도 같은 이유로 끊는다.** CommonMark 에서 링크 텍스트는 문단을
 *    넘지 못한다. 안 끊으면 문단을 건너뛰어 **없는 링크를 만들어 낸다**(false positive) —
 *    이 축을 빠뜨린 채 "양방향으로 안전하다" 고 적었던 것을 리뷰가 잡았다.
 *
 * ## 왜 여기만 정규식인가 (같은 파일의 `headingSlugs` 는 AST 파서를 쓴다)
 *
 * 링크 추출을 `fromMarkdown` AST 순회로 바꾸면 위 §1~§4 를 파서가 대신 지킨다 — 그게
 * 원칙적으로 옳고, 백로그에 올려 뒀다(`harness-review-gate-followups.md`). 지금 안 바꾸는
 * 이유는 **이 스캐너가 CommonMark 와 의도적으로 다른 지점이 있어서**다: `` [a]`code`(b) ``
 * 를 CommonMark 는 링크로 보지 않지만 이 가드는 **본다**(인라인 코드를 지운 뒤 판정 —
 * 전용 회귀 테스트가 그 동작을 고정한다). AST 로 옮기는 것은 그 판정을 바꾸는 결정이라
 * 버그 수정이 아니라 **설계 변경**이고, 그 자체로 한 PR 이다.
 */
export function extractLinks(absPath: string): MdLink[] {
  const text = fs.readFileSync(absPath, "utf8");
  // 링크가 있을 수 없으면 스캔 전체가 낭비다 — 전수 스캔 114ms → 56ms(실측).
  // 멀티라인 링크에서도 `](` 는 **붙어 있다**(줄이 넘는 것은 텍스트 쪽이다). 따라서 이
  // 사전 필터는 그대로 유효하다.
  if (cannotContainLink(text)) return [];

  const doc = buildMaskedDoc(text);
  const out: MdLink[] = [];
  LINK_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = LINK_RE.exec(doc.body)) !== null) {
    const rawTarget = m[2].trim();
    // Strip an optional title:  (url "title")
    const tm = /^(\S+)(\s+"[^"]*")?$/.exec(rawTarget);
    const url = tm ? tm[1] : rawTarget.split(/\s+/)[0];
    // 링크가 **시작한** 줄을 보고한다 — 여러 줄에 걸치면 첫 줄이 사람이 찾는 자리다.
    out.push({ line: lineForOffset(doc, m.index), raw: m[0], target: url });
  }
  return out;
}

export function isExternal(target: string): boolean {
  const t = target.toLowerCase();
  return (
    t.startsWith("http://") ||
    t.startsWith("https://") ||
    t.startsWith("mailto:") ||
    t.startsWith("tel:") ||
    /^[a-z][a-z0-9+.\-]*:\/\//.test(t)
  );
}

// 종전 `SpecMdFile` 은 **지웠다**. 그 이름이 실제 용도보다 좁았고
// (`collectCodebaseSources(): MdFileRef[]` — spec 도 markdown 도 아니다),
// `@deprecated` 별칭으로 남기려던 근거("외부 호출부를 한 번에 못 바꾼다")는 **거짓이었다**
// — 전수 grep 결과 외부 소비처 0건이고 유일한 사용처가 이 파일 안 한 곳이었다(리뷰 실측).
// 근거가 반증된 별칭은 남길 이유가 없다.

/**
 * - `DEAD`: 상대 경로 링크의 대상 파일이 없다.
 * - `ANCHOR`: `#앵커` 가 대상 마크다운의 제목 slug 에 없다(키 링크면 미러 문서의 제목).
 * - `KEY`: 키 링크(`[글](CLE-KEY#앵커)`)의 키가 미러에 없다.
 * - `PATH`: 코드 소스가 `spec/**.md` 를 경로로 링크했다. 코드는 키 링크로 적는다.
 */
export type LinkViolationKind = "DEAD" | "ANCHOR" | "KEY" | "PATH";

/**
 * 키 링크의 대상 — NERV 스펙 키와 선택적 `#앵커`. 키 모양은 `SPEC_KEY_RE` 를 그대로 쓴다.
 * NERV 본문의 링크 표기(`[글](CLE-KEY)`)와 같아서 코드 주석에서도 그대로 쓴다. 미러 경로와
 * 달리 문서가 다른 영역으로 옮겨도 바뀌지 않는다.
 */
const KEY_LINK_RE = new RegExp(`^(${SPEC_KEY_RE.source.slice(1, -1)})(?:#(.*))?$`);

export interface LinkViolation {
  kind: LinkViolationKind;
  source: string; // relPath
  line: number; // 링크가 **시작한** 줄 (멀티라인이면 첫 줄)
  target: string;
}

interface LinkScanOptions {
  /**
   * Validate pure same-file `#anchor` links against the file's own headings.
   * Spec markdown docs self-reference their own headings; code sources have no
   * headings, so their same-file anchors are skipped.
   */
  checkSelfAnchors: boolean;
  /**
   * Restrict path-target links to those whose path part (sans `#fragment`)
   * matches this predicate. Omit to check every in-repo relative link.
   */
  targetFilter?: (pathPart: string) => boolean;
  /**
   * 미러 키 → 미러 파일 절대 경로. 주면 키 링크(`KEY_LINK_RE`)를 이 맵으로 확인한다
   * (없는 키는 `KEY`, 없는 앵커는 `ANCHOR`). 안 주면 키 링크도 상대 경로로 해석된다.
   */
  keyLinks?: ReadonlyMap<string, string>;
  /**
   * `targetFilter` 를 통과한 경로 링크를 해석하지 않고 `PATH` 로 보고한다. 코드 소스가
   * 스펙을 경로로 가리키지 못하게 막을 때 쓴다(키 링크만 허용).
   */
  forbidPathTargets?: boolean;
}

/**
 * Shared DEAD/ANCHOR scan over a set of files. A link is broken when its
 * relative path target does not exist (DEAD) or its `#anchor` does not resolve
 * to a heading slug in the target markdown file (ANCHOR). The two public entry
 * points below (governance docs · codebase sources) differ only in the file set
 * and the `options` knobs.
 */
function findBrokenLinksInFiles(
  files: MdFileRef[],
  options: LinkScanOptions,
): LinkViolation[] {
  const violations: LinkViolation[] = [];
  const slugCache = new Map<string, Set<string>>();
  const slugsFor = (absPath: string): Set<string> => {
    let slugs = slugCache.get(absPath);
    if (!slugs) {
      slugs = headingSlugs(absPath);
      slugCache.set(absPath, slugs);
    }
    return slugs;
  };

  for (const f of files) {
    for (const link of extractLinks(f.absPath)) {
      const { target } = link;

      // Pure same-file anchor.
      if (target.startsWith("#")) {
        if (!options.checkSelfAnchors) continue;
        const anchor = target.slice(1);
        if (anchor === "") continue;
        if (!slugsFor(f.absPath).has(decodeAnchor(anchor))) {
          violations.push({
            kind: "ANCHOR",
            source: f.relPath,
            line: link.line,
            target,
          });
        }
        continue;
      }

      if (isExternal(target)) continue;

      const keyMatch = options.keyLinks ? KEY_LINK_RE.exec(target) : null;
      if (keyMatch && options.keyLinks) {
        const mirrorFile = options.keyLinks.get(keyMatch[1]);
        if (!mirrorFile) {
          violations.push({ kind: "KEY", source: f.relPath, line: link.line, target });
        } else if (keyMatch[2] && !slugsFor(mirrorFile).has(decodeAnchor(keyMatch[2]))) {
          violations.push({ kind: "ANCHOR", source: f.relPath, line: link.line, target });
        }
        continue;
      }

      const hashIdx = target.indexOf("#");
      const pathPart = hashIdx === -1 ? target : target.slice(0, hashIdx);
      const anchor = hashIdx === -1 ? null : target.slice(hashIdx + 1);
      if (pathPart === "") continue;
      if (options.targetFilter && !options.targetFilter(pathPart)) continue;
      if (options.forbidPathTargets) {
        violations.push({ kind: "PATH", source: f.relPath, line: link.line, target });
        continue;
      }

      const resolved = path.resolve(path.dirname(f.absPath), pathPart);
      if (!fs.existsSync(resolved)) {
        violations.push({
          kind: "DEAD",
          source: f.relPath,
          line: link.line,
          target,
        });
        continue;
      }

      if (anchor && resolved.toLowerCase().endsWith(".md")) {
        if (!slugsFor(resolved).has(decodeAnchor(anchor))) {
          violations.push({
            kind: "ANCHOR",
            source: f.relPath,
            line: link.line,
            target,
          });
        }
      }
    }
  }

  violations.sort(
    (a, b) => a.source.localeCompare(b.source) || a.line - b.line,
  );
  return violations;
}

// ---------------------------------------------------------------------------
// 거버넌스 문서 (루트 `*.md` + `.claude/**.md`)
// ---------------------------------------------------------------------------

/**
 * `.claude/worktrees/` 는 **저장소 전체의 사본**이다 (`.gitignore` 에 있고, main
 * checkout 에서는 실제로 십수 개가 들어 있다). 훑으면 spec/codebase 전부를 사본 수만큼
 * 중복 스캔한다 — 느려지는 정도가 아니라 사본 안의 옛 링크까지 위반으로 올라온다.
 * 이 가드는 **어느 체크아웃에서 돌든** 같은 결과를 내야 하므로 무조건 제외한다.
 */
const GOVERNANCE_SKIP_DIRS = new Set(["worktrees", "node_modules"]);

/**
 * 루트 `*.md`(비재귀) + `.claude/**.md`.
 *
 * 루트는 `recurse: false` 다 — 재귀하면 `spec/`·`codebase/` 가 전부 딸려 들어와
 * 다른 가드들과 스코프가 겹친다. 깨진 링크가 정상 상태였던 `plan/complete/**` ·
 * `review/**` 트리도 같은 이유로 제외했었다(NERV 전환 단계 3 에서 둘 다 지웠다).
 */
export function collectGovernanceMarkdown(root: string): MdFileRef[] {
  const rootLevel = walkTree(root, ["."], {
    recurse: false,
    includeFile: (name) => name.endsWith(".md"),
  });
  const claudeDir = walkTree(root, [".claude"], {
    skipDir: (name) => GOVERNANCE_SKIP_DIRS.has(name),
    includeFile: (name) => name.endsWith(".md"),
  });
  return [...rootLevel, ...claudeDir];
}

/**
 * 거버넌스 문서(`CLAUDE.md`·`PROJECT.md`·`.claude/**`)의 in-repo 링크·앵커 검증.
 *
 * **왜 필요한가**: 이 문서들은 규약의 SoT 인데 종전까지 **어떤 기계도 안 봤다**.
 * 넓혀서 처음 돌렸을 때 실제로 4건이 깨져 있었고 (2026-08-27 실측), 그중
 * `PROJECT.md` 의 `CLAUDE.md#worktree-기반-작업-정책` 은 **존재한 적 없는 앵커**였다.
 *
 * 종전에는 배선되지 않은 `scripts/check-doc-links.py` 가 이 역할을 표방했으나
 * (a) 아무 CI·hook 도 호출하지 않았고 (b) `origin/main` 에서 이미 exit 1 이었으며
 * (c) 그 2건은 산문 속 링크 문법 예시를 링크로 오파싱한 **오탐**이었다. 이 가드로
 * 대체하고 그 스크립트는 삭제했다.
 */
export function findBrokenGovernanceLinks(root: string): LinkViolation[] {
  return findBrokenLinksInFiles(collectGovernanceMarkdown(root), {
    checkSelfAnchors: true,
    keyLinks: mirrorKeyPaths(path.join(root, "spec")),
  });
}

// ---------------------------------------------------------------------------
// Codebase-source spec links.
//
// `.ts`/`.tsx` sources (JSDoc, comments) link to specs with a key link
// (`[글](CLE-KEY#앵커)`, the same notation NERV bodies use). The key is checked
// against the mirror file name and the anchor against that file's headings.
// A relative path link to a `spec/**.md` file is reported as PATH whether or not
// it resolves: hand-counted `../` depths drifted silently, the old spec tree
// went in NERV cutover stage 5 (`CLE-T-7M4C4X`), and a mirror path changes
// when a doc moves to another area. NERV cutover stage 4c (`CLE-T-9AM31N`)
// converted the 43 path links to key links. Non-spec relative links are out of
// scope — this guard only catches spec-link rot.
// ---------------------------------------------------------------------------

// `backend/test`(e2e 스펙)와 `frontend/e2e`(Playwright)도 소스다. 두 곳은 `src` 밖이라 처음엔
// 빠져 있었고 `backend/test` 에 옛 경로 링크가 하나 남은 채 통과했다.
const CODEBASE_SOURCE_ROOTS = [
  "codebase/backend/src",
  "codebase/backend/test",
  "codebase/frontend/src",
  "codebase/frontend/e2e",
  "codebase/channel-web-chat/src",
  "codebase/packages",
];
const CODEBASE_SKIP_DIRS = new Set(["node_modules", "dist", "build", ".next"]);
// A relative link whose path part targets a spec markdown file.
const SPEC_MD_TARGET_RE = /(^|\/)spec\/.+\.md$/;

/** All `.ts`/`.tsx` under the codebase source roots (build output dirs excluded). */
export function collectCodebaseSources(root: string): MdFileRef[] {
  return walkTree(root, CODEBASE_SOURCE_ROOTS, {
    skipDir: (name) => CODEBASE_SKIP_DIRS.has(name),
    includeFile: (name) => name.endsWith(".ts") || name.endsWith(".tsx"),
  });
}

/**
 * Validate spec links in codebase `.ts`/`.tsx` sources. KEY = a key link's key
 * has no mirror file. ANCHOR = its `#fragment` does not resolve to a heading in
 * that mirror file. PATH = a relative link targets a `spec/**.md` file (write a
 * key link instead). Other links — and same-file `#anchor` links, since code has
 * no headings — are ignored.
 */
export function findBrokenSpecLinksInSources(root: string): LinkViolation[] {
  return findBrokenLinksInFiles(collectCodebaseSources(root), {
    checkSelfAnchors: false,
    keyLinks: mirrorKeyPaths(path.join(root, "spec")),
    targetFilter: (pathPart) => SPEC_MD_TARGET_RE.test(pathPart),
    forbidPathTargets: true,
  });
}

// Anchors in these specs are written raw (CJK, not %-encoded); decode defensively
// in case a link percent-encodes a fragment.
function decodeAnchor(anchor: string): string {
  try {
    return decodeURIComponent(anchor);
  } catch {
    return anchor;
  }
}
