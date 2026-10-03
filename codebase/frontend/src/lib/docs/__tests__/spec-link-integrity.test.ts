import { describe, it, expect, beforeAll, afterAll } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { repoRoot } from "./impl-anchor-parse";
import { mirrorKeyPaths } from "./spec-keys";
import {
  collectCodebaseSources,
  collectGovernanceMarkdown,
  findBrokenGovernanceLinks,
  findBrokenSpecLinksInSources,
  slugify,
  type LinkViolation,
} from "./spec-links";

// Guard: in-repo markdown links must resolve.
//   - DEAD: the relative `[..](path)` target file does not exist.
//   - ANCHOR: the `#fragment` does not match any heading slug in the target.
// Scopes (numbers kept as CLE-ENG-SPECEVIDENCE cites them):
//   1. (gone) `spec/**.md` narrative docs. It went with the old spec tree in NERV
//      cutover stage 5 (NERV Task `CLE-T-7M4C4X`). `spec/` holds only the NERV
//      mirror now: NERV reads its body links as references and `pull.py --check`
//      guards its integrity.
//   2. Codebase `.ts`/`.tsx` sources under `codebase/{backend,frontend,
//      channel-web-chat,packages}` (`backend/test` · `frontend/e2e` included
//      besides `src`) — spec cross-refs only. They are key links
//      (`[글](CLE-KEY#앵커)`): the key must have a mirror file (KEY) and the
//      anchor must be a heading in it (ANCHOR). A relative `spec/**.md` path link
//      is PATH — hand-counted `../` depths drifted silently and the old tree goes
//      in stage 5. NERV cutover stage 4c (`CLE-T-9AM31N`) converted them.
//   3. Governance docs — root-level `*.md` (`CLAUDE.md`, `PROJECT.md`, …) and
//      `.claude/**.md`. Added 2026-08-27; four links were already broken the
//      first time it ran, one of them an anchor that never existed. Replaces
//      `scripts/check-doc-links.py`, which no CI or hook ever invoked. Relative
//      links are checked by path; key links are checked against the mirror too.
// Scope (2) looks only at key links and `spec/**.md` path links. Scope (3) has no
// exemption — governance docs are live.
// SoT: CLE-ENG-SPECEVIDENCE 「빌드 가드 — 스펙 문서 저장소 무결성」 (R-14 for key links).

function fmt(violations: LinkViolation[]): string {
  const count = (kind: LinkViolation["kind"]): number =>
    violations.filter((v) => v.kind === kind).length;
  const lines = [
    `${violations.length} broken in-repo spec link(s): ` +
      `${count("DEAD")} dead path, ${count("ANCHOR")} broken anchor, ` +
      `${count("KEY")} unknown key, ${count("PATH")} path link in code (use a key link).`,
  ];
  for (const v of violations) {
    lines.push(`  [${v.kind}] ${v.source}:${v.line} -> ${v.target}`);
  }
  return lines.join("\n");
}

// `.claude/**.md` 실측 52개(2026-08-27). 스코프가 조용히 좁아지면 걸리도록 여유를 두되
// **0 이 아닌** 하한을 둔다 — 이름 없는 리터럴이면 왜 이 값인지 다음 사람이 모른다.
const MIN_CLAUDE_DOCS = 20;

// 2026-10-03 미러 181편. 키 링크(범위 2 · 3)는 미러 파일로 확인하므로 미러가 비면 모든 키가
// `KEY` 위반이 되어 드러나지만, 하한을 따로 두어 실패 이유를 바로 보이게 한다.
const MIN_MIRROR_DOCS = 90;

describe("spec-link-integrity guard", () => {
  const root = repoRoot();

  it("resolves a real repo root with a non-trivial NERV mirror (key links resolve against it)", () => {
    // Guard against repoRoot() misresolving → empty mirror → every key link KEY.
    expect(fs.existsSync(path.join(root, "spec")), `repoRoot missing spec/: ${root}`).toBe(true);
    expect(mirrorKeyPaths(path.join(root, "spec")).size).toBeGreaterThan(MIN_MIRROR_DOCS);
  });

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
    // 두 e2e 루트가 각각 비어 있지 않아야 한다. `src` 만 세면 한쪽이 빠져도 위 하한을 넘는다.
    for (const dir of ["codebase/backend/test/", "codebase/frontend/e2e/"]) {
      expect(
        sources.some((f) => f.relPath.startsWith(dir)),
        `no source collected under ${dir}`,
      ).toBe(true);
    }
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
    expect(rel.filter((p) => p.startsWith(".claude/")).length).toBeGreaterThan(
      MIN_CLAUDE_DOCS,
    );
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
    w(".claude/node_modules/pkg/readme.md", "# 의존성\n[깨짐](./gone.md)\n");
  });

  afterAll(() => {
    fs.rmSync(fixture, { recursive: true, force: true });
  });

  it("세 제외 대상이 실제로 존재한다 (전제)", () => {
    expect(fs.existsSync(path.join(fixture, ".claude", "worktrees", "copy"))).toBe(true);
    expect(fs.existsSync(path.join(fixture, ".claude", "node_modules", "pkg"))).toBe(true);
    expect(fs.existsSync(path.join(fixture, "nested", "deep.md"))).toBe(true);
  });

  it("루트는 비재귀 · `worktrees`/`node_modules` 는 스킵한다", () => {
    const rel = collectGovernanceMarkdown(fixture).map((f) => f.relPath).sort();
    expect(rel).toEqual([".claude/docs/policy.md", "README.md"]);
  });

  it("제외된 영역의 깨진 링크는 위반으로 올라오지 않는다", () => {
    const violations = findBrokenGovernanceLinks(fixture);
    expect(violations, fmt(violations)).toEqual([]);
  });

  /**
   * **양성 검출** — 위 세 케이스는 전부 *"안 잡힌다"* 를 단언한다. 그것만으로는
   * 진입점이 **아무것도 못 잡는 상태**여도 전부 통과한다 (스코프를 빈 배열로 만들면
   * 세 케이스가 다 초록이다). 스코프 **안**의 깨진 링크가 실제로 올라오는지 함께 못박는다.
   */
  it("[양성] 스코프 안의 깨진 링크는 DEAD 로 검출된다", () => {
    const broken = path.join(fixture, "BROKEN.md");
    fs.writeFileSync(broken, "# 루트\n[깨짐](./no-such-file.md)\n", "utf8");
    try {
      const violations = findBrokenGovernanceLinks(fixture);
      expect(violations.length).toBe(1);
      expect(violations[0].kind).toBe("DEAD");
      expect(violations[0].source).toBe("BROKEN.md");
    } finally {
      fs.rmSync(broken, { force: true });
    }
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
