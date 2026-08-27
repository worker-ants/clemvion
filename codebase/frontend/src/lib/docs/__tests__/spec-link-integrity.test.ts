import { describe, it, expect, beforeAll, afterAll } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { repoRoot } from "./spec-frontmatter-parse";
import {
  collectCodebaseSources,
  collectGovernanceMarkdown,
  collectSpecMarkdown,
  findBrokenGovernanceLinks,
  findBrokenLinks,
  findBrokenSpecLinksInSources,
  slugify,
  type LinkViolation,
} from "./spec-links";

// Guard: in-repo markdown links must resolve.
//   - DEAD: the relative `[..](path)` target file does not exist.
//   - ANCHOR: the `#fragment` does not match any heading slug in the target.
// Two scopes:
//   1. All `spec/**.md` narrative docs (EXCEPT generated `*-api-catalog/`).
//   2. Codebase `.ts`/`.tsx` sources under `codebase/{backend,frontend,
//      channel-web-chat,packages}` — but only for links that target a
//      `spec/**.md` file (JSDoc spec cross-refs, whose hand-counted `../`
//      depth drifts silently).
//   3. Governance docs — root-level `*.md` (`CLAUDE.md`, `PROJECT.md`, …) and
//      `.claude/**.md`. Added 2026-08-27; four links were already broken the
//      first time it ran, one of them an anchor that never existed. Replaces
//      `scripts/check-doc-links.py`, which no CI or hook ever invoked.
// Scope (1) applies no target filter: a `plan/**` link written in a spec doc IS
// checked here and breaks the build when the plan file moves (e.g. in-progress →
// complete). Only scope (2) filters to `spec/**.md` targets. What plan-coherence-
// checker owns is link hygiene *inside* `plan/**` docs — not spec→plan links.
// SoT: spec/conventions/spec-impl-evidence.md §4.2.

function fmt(violations: LinkViolation[]): string {
  const dead = violations.filter((v) => v.kind === "DEAD");
  const anchor = violations.filter((v) => v.kind === "ANCHOR");
  const lines = [
    `${violations.length} broken in-repo spec link(s): ` +
      `${dead.length} dead path, ${anchor.length} broken anchor.`,
  ];
  for (const v of violations) {
    lines.push(`  [${v.kind}] ${v.source}:${v.line} -> ${v.target}`);
  }
  return lines.join("\n");
}

describe("spec-link-integrity guard", () => {
  const root = repoRoot();

  it("resolves a real repo root and scans a non-trivial spec set", () => {
    // Guard against repoRoot() misresolving → empty scan → vacuous pass.
    expect(fs.existsSync(path.join(root, "spec")), `repoRoot missing spec/: ${root}`).toBe(true);
    const files = collectSpecMarkdown(root);
    expect(files.length).toBeGreaterThan(100);
    expect(files.some((f) => f.relPath === "spec/0-overview.md")).toBe(true);
  });

  it("excludes generated API catalogs from scope", () => {
    const files = collectSpecMarkdown(root);
    // Exclusion must be non-trivial: catalog field files must actually exist…
    const catalogDir = path.join(root, "spec", "conventions", "cafe24-api-catalog");
    expect(
      fs.existsSync(catalogDir),
      "expected cafe24-api-catalog/ to exist so the exclusion is meaningful",
    ).toBe(true);
    // …yet none of them may appear in scope.
    expect(files.every((f) => !f.relPath.includes("-api-catalog/"))).toBe(true);
  });

  // Scans the whole in-repo spec set synchronously. It completes in ~2-3s
  // standalone but can exceed the 5s default under parallel-suite CPU
  // contention (flaky timeout, not a real failure) — give it real headroom.
  it("has no broken in-repo links or heading anchors", () => {
    const violations = findBrokenLinks(root);
    expect(violations, fmt(violations)).toEqual([]);
  }, 30_000);

  it("scans a non-trivial codebase source set (guard against vacuous pass)", () => {
    const sources = collectCodebaseSources(root);
    expect(sources.length).toBeGreaterThan(100);
    // Sanity: at least one known EIA source with a spec cross-ref is in scope.
    expect(
      sources.some(
        (f) =>
          f.relPath ===
          "codebase/channel-web-chat/src/lib/eia-types.ts",
      ),
    ).toBe(true);
    // Build output must be excluded.
    expect(sources.every((f) => !f.relPath.includes("/dist/"))).toBe(true);
    expect(sources.every((f) => !f.relPath.includes("/node_modules/"))).toBe(
      true,
    );
  });

  it("has no broken spec links in codebase `.ts`/`.tsx` sources", () => {
    const violations = findBrokenSpecLinksInSources(root);
    expect(violations, fmt(violations)).toEqual([]);
  }, 30_000);

  // ── Scope 3: governance docs ───────────────────────────────────────────
  it("scans both governance roots (guard against vacuous pass)", () => {
    const rel = collectGovernanceMarkdown(root).map((f) => f.relPath);
    // 루트 레벨과 `.claude/` 가 **각각** 비어 있지 않아야 한다 — 합계만 세면 한쪽이
    // 통째로 빠져도 통과한다.
    expect(rel).toContain("CLAUDE.md");
    expect(rel).toContain("PROJECT.md");
    expect(rel.filter((p) => p.startsWith(".claude/")).length).toBeGreaterThan(20);
  });

  it("has no broken in-repo links or heading anchors in governance docs", () => {
    const violations = findBrokenGovernanceLinks(root);
    expect(violations, fmt(violations)).toEqual([]);
  }, 30_000);
});

/**
 * 두 **제외** 규칙(`.claude/worktrees/` 스킵 · 루트 비재귀)은 실 저장소에 대고 단언하면
 * **공허하다** — 이 체크아웃에도 CI 체크아웃에도 `.claude/worktrees/` 가 없어서
 * `startsWith(".claude/worktrees/") === false` 가 규칙과 무관하게 참이 된다
 * (그 디렉토리는 gitignored 이고 실제로는 **main checkout 에만** 존재한다).
 *
 * 그래서 두 제외 대상이 **실재하는** 트리를 만들어 놓고 판정한다.
 *
 * **커밋된 fixture 로는 안 된다 (실측)**: `.git/info/exclude` 에 `.claude/worktrees/` 를
 * **모든 깊이**에서 매치하는 규칙이 있어, `fixtures-governance` 아래에 만들어도 커밋되지
 * 않는다. 로컬에서만 초록이고 CI 에서는 파일이 없어 전제가 무너진다. 그래서 `mkdtemp` 로
 * **런타임에** 세운다 — gitignore 와 무관하고 자기완결적이다.
 */
describe("governance scope — 제외 규칙", () => {
  let fixture: string;

  beforeAll(() => {
    fixture = fs.mkdtempSync(path.join(os.tmpdir(), "gov-scope-"));
    const w = (rel: string, body: string): void => {
      const abs = path.join(fixture, rel);
      fs.mkdirSync(path.dirname(abs), { recursive: true });
      fs.writeFileSync(abs, body, "utf8");
    };
    // 스코프 안 — 루트 레벨 + `.claude/` 하위
    w("README.md", "# 루트\n[이웃](.claude/docs/policy.md)\n");
    w(".claude/docs/policy.md", "# 정책\n본문.\n");
    // 스코프 밖 — 각각 **깨진 링크**를 담고 있어 제외가 풀리면 관측된다
    w("nested/deep.md", "# 재귀하면 잡힌다\n[깨짐](./nope.md)\n");
    w(".claude/worktrees/copy/.claude/docs/policy.md", "# 사본\n[깨짐](./gone.md)\n");
  });

  afterAll(() => {
    fs.rmSync(fixture, { recursive: true, force: true });
  });

  it("두 제외 대상이 실제로 존재한다 (전제)", () => {
    expect(fs.existsSync(path.join(fixture, ".claude", "worktrees", "copy"))).toBe(true);
    expect(fs.existsSync(path.join(fixture, "nested", "deep.md"))).toBe(true);
  });

  it("루트는 비재귀 · `.claude/worktrees/` 는 스킵한다", () => {
    const rel = collectGovernanceMarkdown(fixture).map((f) => f.relPath).sort();
    expect(rel).toEqual([".claude/docs/policy.md", "README.md"]);
  });

  it("제외된 영역의 깨진 링크는 위반으로 올라오지 않는다", () => {
    const violations = findBrokenGovernanceLinks(fixture);
    expect(violations, fmt(violations)).toEqual([]);
  });
});

// Pin the slug algorithm so future edits don't silently drift it (which would
// turn real broken anchors into false greens). Cases cover the subtleties the
// port was validated against: CJK retention, numbered headings, emphasis vs
// intra-word underscores, and code-span underscores.
describe("slugify (github-slugger parity)", () => {
  const cases: Array<[string, string]> = [
    ["## 1. Condition 구조", "1-condition-구조"],
    ["### 3.4 신뢰성 / 보안", "34-신뢰성--보안"],
    ["#### 3.1 어댑터 라이프사이클", "31-어댑터-라이프사이클"],
    ["api_label 규약", "api_label-규약"],
    ["_계획·미구현_", "계획미구현"],
    ["`_dryRun` 모드", "_dryrun-모드"],
    // lone `_` before punctuation is kept (not emphasis) — regression guard for
    // the hand-rolled slugger bug that stripped it.
    ["AI render_* presentations[] 발화", "ai-render_-presentations-발화"],
    ["4.4 상세 (`execution.waiting_for_input`)", "44-상세-executionwaiting_for_input"],
  ];
  for (const [heading, expected] of cases) {
    it(`${heading} -> ${expected}`, () => {
      // strip the leading #'s the way headingSlugs does
      const title = heading.replace(/^#{1,6}\s+/, "");
      expect(slugify(title)).toBe(expected);
    });
  }
});
