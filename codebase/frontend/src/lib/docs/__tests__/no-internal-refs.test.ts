import fs from "node:fs";
import path from "node:path";
import { describe, it, expect } from "vitest";
import { collectMdxFiles, repoRoot } from "./impl-anchor-parse";

// Guard: user-guide MDX body must not leak internal SoT identifiers.
// SoT invariants: PROJECT.md §유저 가이드 파일 컨벤션 §자주 누락되는 작성 패턴
// (internal-SoT leak row) + spec/conventions/i18n-userguide.md Principle 6.
//
// "Body" excludes: frontmatter, HTML/MDX comments, and <ImplAnchor /> tags —
// those are not rendered to end users. The remaining text is what readers
// actually see, and that surface must reference user-visible concepts only.
//
// Forbidden classes (see PR #332 retrospective):
//   - spec/<area>/... or /spec/<area>/... paths
//   - plan/in-progress/... or plan/complete/... paths
//   - The phrase "별 plan" / "별도 plan" / "separate plan" used to point
//     at internal work units
//   - Internal identifiers shaped like CCH-XX-NN or R-XX-N (Chat Channel /
//     Rationale anchor codes the user cannot dereference)
//   - Internal i18n mapping table names (ERROR_KO / WARNING_KO / LABEL_KO
//     / HINT_KO / GROUP_KO / ITEM_LABEL_KO / OPTION_LABEL_KO)
//   - The backend-labels.ts filename
//
// If you legitimately need to reference one of these in writing, the right
// move is to translate it into a user-facing concept — never to suppress
// this guard.

interface ForbiddenPattern {
  name: string;
  regex: RegExp;
  hint: string;
}

const FORBIDDEN: ForbiddenPattern[] = [
  {
    name: "spec/ path leak",
    // Matches `spec/0-overview`, `spec/2-navigation`, `spec/conventions/...`
    // either bare or as the path portion of a markdown link. The negative
    // look-behind keeps unrelated tokens like `respec/...` out.
    regex: /(?<![\w/.])\/?spec\/(?:0-overview|conventions\/|[1-9]\d*-)/g,
    hint: "본문은 사용자가 열람할 수 없는 spec/ 경로를 노출하지 말 것. frontmatter 의 `spec:` 필드는 빌드 검증용 metadata 라 사용자에게 렌더링되지 않으므로 별개. 본문에는 같은 사실을 사용자 가시 표현으로 다시 적어요.",
  },
  {
    name: "plan/ path leak",
    regex: /\bplan\/(?:in-progress|complete)\//g,
    hint: "본문은 사용자가 열람할 수 없는 plan/ 경로를 노출하지 말 것. 진행 중·완료된 내부 작업 단위는 가이드에서 언급하지 않아요.",
  },
  {
    name: "internal-plan reference phrase",
    // "별 plan", "별도 plan", "별도의 plan", "separate plan" — pointing at
    // an internal work unit by name is exactly what we banned in PR #332.
    regex: /(?:별\s*plan|별도(?:의)?\s*plan|separate\s+plan)\b/gi,
    hint: "본문에서 'plan' 단어로 내부 작업 단위를 가리키지 말 것. 현재 동작하는 상태만 서술하고, 앞으로 진행 예정인 변경은 가이드에 적지 않아요.",
  },
  {
    name: "internal anchor id (CCH-XX-NN / R-XX-N)",
    regex: /\b(?:CCH|R)-[A-Z]+-[0-9]+\b/g,
    hint: "내부 식별자(`CCH-...`, `R-...`)는 사용자 가이드 본문에 노출하지 말 것. 사용자에게 의미 있는 동작 설명으로 바꿔요.",
  },
  {
    name: "internal i18n mapping table name",
    regex:
      /\b(?:ERROR_KO|WARNING_KO|LABEL_KO|HINT_KO|GROUP_KO|ITEM_LABEL_KO|OPTION_LABEL_KO)\b/g,
    hint: "프론트 i18n 매핑 테이블 이름(ERROR_KO 등)은 사용자 가이드 본문에 노출하지 말 것. 매핑은 내부 구현이라 사용자 안내에는 등장할 이유가 없어요.",
  },
  {
    name: "backend-labels.ts filename",
    regex: /\bbackend-labels\.ts\b/g,
    hint: "내부 매핑 파일 이름(backend-labels.ts)을 본문에 노출하지 말 것. 사용자가 손댈 수 없는 내부 구현 파일이에요.",
  },
];

function stripNonUserVisible(text: string): string {
  // 1) Frontmatter — leading `---\n...\n---\n`. Anchored at start so we
  //    never strip a `---` divider that happens later in the file.
  let body = text.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n/, "");
  // 2) MDX expression comments `{/* ... */}`
  body = body.replace(/\{\/\*[\s\S]*?\*\/\}/g, "");
  // 3) HTML comments `<!-- ... -->`
  body = body.replace(/<!--[\s\S]*?-->/g, "");
  // 4) <ImplAnchor ... /> components — these carry `file=` with a repo
  //    path on purpose, but they don't render to end users.
  body = body.replace(/<ImplAnchor\b[\s\S]*?\/>/g, "");
  return body;
}

describe("user-guide body — no internal SoT leak", () => {
  const root = repoRoot();
  const guideDocsRoot = "codebase/frontend/src/content/docs";
  const allMdx = collectMdxFiles(root, guideDocsRoot);

  it("collects MDX files (precondition — sanity)", () => {
    expect(allMdx.length).toBeGreaterThan(0);
  });

  for (const mdxPath of allMdx) {
    const mdxRel = path.relative(root, mdxPath);
    describe(mdxRel, () => {
      const raw = fs.readFileSync(mdxPath, "utf8");
      const body = stripNonUserVisible(raw);

      for (const pat of FORBIDDEN) {
        it(`body has no ${pat.name}`, () => {
          pat.regex.lastIndex = 0;
          const matches: string[] = [];
          let m: RegExpExecArray | null;
          while ((m = pat.regex.exec(body)) !== null) {
            matches.push(m[0]);
            // Defensive: zero-width matches would infinite-loop.
            if (m.index === pat.regex.lastIndex) pat.regex.lastIndex++;
          }
          if (matches.length > 0) {
            throw new Error(
              `${mdxRel} 본문에 ${pat.name} 패턴이 노출돼 있어요. 발견된 토큰: ${[
                ...new Set(matches),
              ]
                .slice(0, 8)
                .map((s) => `"${s}"`)
                .join(", ")}\n→ ${pat.hint}`,
            );
          }
          expect(matches).toEqual([]);
        });
      }
    });
  }
});
