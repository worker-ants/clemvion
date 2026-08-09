import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import { repoRoot } from "./spec-frontmatter-parse";
import { extractLinks, findBrokenPlanLinks } from "./spec-links";
import {
  collectCompletePlanMarkdown,
  collectLivePlanMarkdown,
  findNonTerminalCompletedPlans,
} from "./plan-scan";

// Guard: every top-level in-progress plan carries the lifecycle frontmatter
// (worktree / started / owner) so plan-coherence collision-detection and the
// stale-audit operate on real data. SoT: .claude/docs/plan-lifecycle.md §4.
//
// Scope = `plan/in-progress/*.md` (top level only). Grouped subfolders hold
// working material under a cluster index and are exempt. `0-`/`_`-prefixed
// index files are exempt. 그 규칙의 **단일 구현**은 `plan-scan.ts` 의
// `collectLivePlanMarkdown` 이고, 이 파일의 두 검사(frontmatter · 링크)가 함께 그것을 쓴다.
// (`spec-links.ts` 도 같은 이름을 export 하지만 그건 **하위호환 re-export** 다 — 링크
//  모듈이 plan 트리 규칙까지 갖고 있으면 그 규칙이 두 곳으로 갈린다.)
//
// > 이 주석은 추출 직후 `spec-links.ts` 를 정본으로 적은 채 남아 있었다. 같은 PR 이
// > `spec-impl-evidence.md §4.2` 를 "판정 로직은 `plan-scan.ts` 소관" 으로 갱신했으므로
// > **문서끼리 정면으로 어긋난 상태**였다(ai-review documentation WARNING).
//
// `worktree` accepts a real `<task>-<slug>` name OR the explicit sentinel
// `(unstarted)` for plans with no live worktree yet. Legacy placeholders
// (TBD, "assigned at impl-start", "미정", …) are rejected — they defeat the
// collision check by looking like real-but-dead worktrees.
//
// ── 2026-08-09: 이동(`in-progress/` → `complete/`)이 남기는 두 갭을 함께 막는다 ──
//
// plan 이동은 `plan-lifecycle.md §3` 이 **인접 PR 에 싣도록** 규정해 자주 일어나는데,
// 그때 조용히 틀어지는 두 곳에 아무 게이트도 없었다. 둘 다 실측으로 확인한 갭이다:
//
//   (a) `status:` 가 디렉터리와 모순 — `complete/` 에 있으면서 `status: in-progress`.
//       **두 번 놓쳤다** (`#1108` 3차 ai-review INFO 18 · `#1117`). 뮤테이션으로
//       확인했더니 spec/plan 문서 가드 18파일 / 2821 tests 가 전부 GREEN 이었다 —
//       이 필드는 게이트가 아니라 사람의 규율에만 기대고 있었다.
//   (b) `plan/**` ↔ `plan/**` 상대링크가 깨짐 — 이동하면 형제 plan 을 가리키던
//       상대경로가 그대로 남는다. `spec-link-integrity` 는 이름대로 `spec/**` 기준이라
//       이 축을 보지 않는다(이 역시 뮤테이션으로 확인된 갭).
//
// 두 검사의 **스코프가 다르다**:
//   - (a) 는 `plan/complete/**` 를 본다 — 위반이 거기서만 성립한다.
//   - (b) 는 위 `collectTopLevelPlans` 와 **같은 top-level 스코프**다. `complete/**` 는
//     시점 기록이라 옛 경로 유지가 정상이고(`plan-lifecycle.md §3` 인입 참조 규칙),
//     실측 135건이 대부분 그 성격이다. 하위 그룹 폴더도 기존 면제 규칙을 따른다.

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const WORKTREE_PLACEHOLDER =
  /\bTBD\b|assigned at impl|미정|착수\s*시|^pending$/i;
const WORKTREE_SENTINEL = "(unstarted)";

// 스캔 소스는 `collectLivePlanMarkdown` **하나**다. 종전에는 여기서 같은 순회를 손으로
// 재구현했는데, 그 사본이 `0-`/`_` 접두 필터에서 조용히 어긋나 있었다 — 이 파일 상단이
// 경고하는 "두 곳이 조용히 틀어진다" 를 이 파일 자신이 재현한 셈이다(ai-review WARNING #1).
// 접두 면제 규칙은 이제 그 함수가 갖고, 여기서는 절대경로만 뽑는다.
function collectTopLevelPlans(root: string): string[] {
  return collectLivePlanMarkdown(root).map((f) => f.absPath);
}

describe("plan-frontmatter guard", () => {
  const root = repoRoot();
  const plans = collectTopLevelPlans(root);

  it("finds top-level in-progress plans to validate", () => {
    // Guard against repoRoot() misresolving → empty scan → vacuous pass.
    expect(
      fs.existsSync(path.join(root, "plan", "in-progress")),
      `repoRoot missing plan/in-progress/: ${root}`,
    ).toBe(true);
    // 하한은 "discovery 가 살아있는가" 만 본다 — in-progress plan 수는 grooming 으로
    // 정상적으로 줄어드는 값이라 실제 개수에 가깝게 잡으면 plan 을 닫을 때마다 깨진다
    // (2026-07-17: 종전 `> 20` 이 grooming 후 정확히 20 이 되어 발화).
    expect(plans.length).toBeGreaterThan(5);
    // 특정 plan 파일명에 의존하지 않는다 — 그 파일이 complete/ 로 이동하면 테스트가
    // 깨지는 fragility 회피(ai-review WARNING#1). discovery 가 plan/in-progress 의
    // 실제 .md 만 반환하는지로 sanity (잘못된 디렉토리 스캔 → vacuous pass 방지).
    expect(
      plans.every(
        (p) =>
          p.endsWith(".md") &&
          p.includes(`${path.sep}plan${path.sep}in-progress${path.sep}`),
      ),
      "discovered plans must be .md files under plan/in-progress",
    ).toBe(true);
  });

  for (const abs of plans) {
    const rel = path.relative(root, abs).split(path.sep).join("/");
    describe(rel, () => {
      const raw = fs.readFileSync(abs, "utf8");
      let data: Record<string, unknown> = {};
      let parseOk = true;
      try {
        data = matter(raw).data ?? {};
      } catch {
        parseOk = false;
      }

      it("has a parseable frontmatter block", () => {
        expect(parseOk, `${rel}: frontmatter failed to parse`).toBe(true);
        expect(
          raw.startsWith("---"),
          `${rel}: missing frontmatter block`,
        ).toBe(true);
      });

      it("`worktree` is set and not a legacy placeholder", () => {
        const wt = data.worktree;
        expect(typeof wt === "string" && wt.length > 0, `${rel}: worktree missing`).toBe(true);
        const wtStr = String(wt);
        if (wtStr !== WORKTREE_SENTINEL) {
          expect(
            WORKTREE_PLACEHOLDER.test(wtStr),
            `${rel}: worktree "${wtStr}" is a placeholder — use a real name or the "${WORKTREE_SENTINEL}" sentinel`,
          ).toBe(false);
        }
      });

      it("`started` is an ISO date", () => {
        const s = data.started;
        // js-yaml parses an unquoted YYYY-MM-DD as a Date.
        const ok =
          s instanceof Date ||
          (typeof s === "string" && ISO_DATE.test(s));
        expect(ok, `${rel}: started must be an ISO date (got ${JSON.stringify(s)})`).toBe(true);
      });

      it("`owner` is set", () => {
        const o = data.owner;
        expect(
          typeof o === "string" && o.length > 0,
          `${rel}: owner missing`,
        ).toBe(true);
      });
    });
  }

  // ── (b) 살아있는 plan 의 상대링크 무결성 ────────────────────────────────
  //
  // 스캐너는 `spec-links.ts` 의 공유 구현(`findBrokenPlanLinks`)을 쓴다. 초판은 여기에
  // 정규식을 새로 짰는데 그것은 **코드펜스 안의 링크도 실제 링크로 취급**했다 — plan 문서가
  // 예시 스니펫에 없는 경로를 적는 순간 거짓 양성으로 push 가 막힌다(ai-review WARNING #1).
  // 같은 저장소에 펜스 제외·링크 타이틀 처리가 이미 된 스캐너가 있는데 더 약한 사본을 만든
  // 셈이라, 그쪽에 세 번째 진입점을 추가하고 여기서는 부른다.
  it("top-level in-progress plans have no broken relative links", () => {
    const violations = findBrokenPlanLinks(root);
    const rendered = violations.map((v) => `${v.source}:${v.line} → ${v.target}`);
    expect(
      rendered,
      `깨진 상대링크 ${rendered.length}건:\n  ${rendered.join("\n  ")}\n` +
        "plan 을 complete/ 로 옮기면 형제 plan 을 가리키던 상대경로가 그대로 남는다 — " +
        "`../complete/<name>` 로 정정할 것.",
    ).toEqual([]);
  });

  it("the plan link scanner actually sees links (non-vacuity)", () => {
    // 위 단언은 "위반 0건" 을 기대하므로, 스캐너가 조용히 빈 집합을 돌려줘도 영원히 초록이다.
    //
    // **파일 수만 세면 그 캐너리가 이름값을 못 한다** — `extractLinks` 가 항상 `[]` 를
    // 반환해도 파일은 발견되기 때문이다(ai-review testing WARNING). 그래서 discovery 가
    // 아니라 **추출 단계**를 센다: 살아있는 plan 들에서 실제로 뽑힌 링크 수.
    const links = collectLivePlanMarkdown(root).reduce(
      (n, f) => n + extractLinks(f.absPath).length,
      0,
    );
    expect(links, "no links extracted from live plans — the extractor is dead").toBeGreaterThan(50);
  });
});

// ── (a) 완료 plan 의 status 가 디렉터리와 모순되지 않는가 ────────────────────
describe("completed plans declare a terminal status", () => {
  const root = repoRoot();

  it("finds completed plans to validate (discovery only)", () => {
    // **이 단언이 증명하는 것은 discovery 뿐이다** — 이름에 그렇게 적어 둔다. status 판정
    // 로직이 실제로 위반을 잡는다는 것은 `plan-scan.test.ts` 가 합성 fixture 로 증명한다
    // (위반 3건을 심고 정확히 그 3건만 잡히는지까지 단언).
    //
    // 하한은 낮게 잡는다 — 실제 개수에 가깝게 잡으면 grooming 으로 정상적으로 줄어들 때마다
    // 깨진다(in-progress 쪽이 정확히 그렇게 발화한 전례가 있다).
    expect(collectCompletePlanMarkdown(root).length).toBeGreaterThan(5);
  });

  it("no completed plan declares a non-terminal status", () => {
    // 판정 로직은 `plan-scan.ts` 에 있고 `plan-scan.test.ts` 가 합성 fixture 로 **실제
    // 탐지**를 증명한다. 여기(실저장소)는 positive-only 라 그것만으로는 검사가 작동한다는
    // 증거가 되지 못한다 — 자매 검사(링크)와 같은 구조로 맞췄다(ai-review WARNING).
    const wrong = findNonTerminalCompletedPlans(root).map(
      (v) => `${v.relPath}: status: ${v.status}`,
    );
    expect(
      wrong,
      `complete/ 에 있으면서 종료 상태가 아닌 plan ${wrong.length}건:\n  ${wrong.join("\n  ")}\n` +
        "이동 시 `status:` 를 함께 갱신하거나, 새 종료 어휘라면 plan-scan.ts 의 " +
        "TERMINAL_PLAN_STATUSES 에 등재할 것.",
    ).toEqual([]);
  });
});
