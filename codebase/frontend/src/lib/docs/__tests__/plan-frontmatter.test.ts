import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import { repoRoot } from "./spec-frontmatter-parse";
import { collectLivePlanMarkdown, findBrokenPlanLinks } from "./spec-links";

// Guard: every top-level in-progress plan carries the lifecycle frontmatter
// (worktree / started / owner) so plan-coherence collision-detection and the
// stale-audit operate on real data. SoT: .claude/docs/plan-lifecycle.md §4.
//
// Scope = `plan/in-progress/*.md` (top level only). Grouped subfolders hold
// working material under a cluster index and are exempt. `0-`/`_`-prefixed
// index files are exempt.
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

function collectTopLevelPlans(root: string): string[] {
  const dir = path.join(root, "plan", "in-progress");
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .filter(
      (e) =>
        e.isFile() &&
        e.name.endsWith(".md") &&
        !e.name.startsWith("0-") &&
        !e.name.startsWith("_"),
    )
    .map((e) => path.join(dir, e.name))
    .sort();
}

/** `plan/complete/**` 의 `.md` 전수 (archive 제외 — 옛 memory/user_memo 보관소다). */
function collectCompletedPlans(root: string): string[] {
  const dir = path.join(root, "plan", "complete");
  if (!fs.existsSync(dir)) return [];
  const out: string[] = [];
  const walk = (d: string) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const full = path.join(d, e.name);
      if (e.isDirectory()) {
        if (e.name !== "archive") walk(full);
      } else if (e.name.endsWith(".md")) {
        out.push(full);
      }
    }
  };
  walk(dir);
  return out.sort();
}

// `complete/` 에서 정당한 종료 상태. `in-progress` 는 **디렉터리와 정면으로 모순**이라
// 여기 없다 — 그것이 두 번 발생한 실패 그 자체다.
//
// `complete` 외의 셋은 실측으로 발견된 기존 어휘다(2026-08-09, 각 1~3건). spec draft 계열이
// "적용됨/구현됨", 대체된 plan 이 "superseded" 를 쓰고 있었다. 일괄 `complete` 로 눕히면
// **`superseded`(대체됨 — 완료가 아니다)의 의미가 사라지므로** 등재로 보존한다. 새 값이
// 필요하면 여기 추가하는 순간이 "이게 정말 종료 상태인가" 를 판단할 자리다.
const TERMINAL_STATUSES = new Set(["complete", "implemented", "applied", "superseded"]);

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
    // 스캐너가 조용히 빈 집합을 돌려주면 위 단언은 아무것도 안 지키면서 영원히 초록이다.
    // 위반 0건이 정상 상태이므로 "위반 수" 로는 살아있음을 알 수 없다 — 파일 수집 쪽을 본다.
    expect(collectLivePlanMarkdown(root).length).toBeGreaterThan(5);
  });
});

// ── (a) 완료 plan 의 status 가 디렉터리와 모순되지 않는가 ────────────────────
describe("completed plans declare a terminal status", () => {
  const root = repoRoot();
  const completed = collectCompletedPlans(root);

  it("finds completed plans to validate", () => {
    // discovery 가 죽으면 아래 단언이 통째로 vacuous 해진다.
    expect(completed.length, `no plans found under plan/complete/`).toBeGreaterThan(20);
  });

  it("no completed plan still declares `status: in-progress`", () => {
    const wrong: string[] = [];
    for (const abs of completed) {
      const rel = path.relative(root, abs).split(path.sep).join("/");
      let data: Record<string, unknown> = {};
      try {
        data = matter(fs.readFileSync(abs, "utf8")).data ?? {};
      } catch {
        continue; // frontmatter 파싱 실패는 이 검사의 관심사가 아니다
      }
      const status = data.status;
      // `status` 는 **선택 필드**다 (plan-lifecycle.md §4 — 필수는 worktree/started/owner
      // 셋뿐). 선언하지 않은 문서는 위반이 아니다. 선언했는데 디렉터리와 모순되는 것만 잡는다.
      if (typeof status !== "string") continue;
      if (!TERMINAL_STATUSES.has(status)) {
        wrong.push(`${rel}: status: ${status}`);
      }
    }
    expect(
      wrong,
      `complete/ 에 있으면서 종료 상태가 아닌 plan ${wrong.length}건:\n  ${wrong.join("\n  ")}\n` +
        "이동 시 `status:` 를 함께 갱신하거나, 새 종료 어휘라면 TERMINAL_STATUSES 에 등재할 것.",
    ).toEqual([]);
  });
});
