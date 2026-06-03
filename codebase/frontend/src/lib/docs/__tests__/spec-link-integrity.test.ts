import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { repoRoot } from "./spec-frontmatter-parse";
import {
  collectSpecMarkdown,
  findBrokenLinks,
  slugify,
  type LinkViolation,
} from "./spec-links";

// Guard: in-repo markdown links in `spec/**` narrative docs must resolve.
//   - DEAD: the relative `[..](path)` target file does not exist.
//   - ANCHOR: the `#fragment` does not match any heading slug in the target.
// Scope = all `spec/**.md` EXCEPT generated `*-api-catalog/` reference files.
// Plan-side link hygiene is handled by plan-coherence-checker, not this gate.
// SoT: spec/conventions/spec-impl-evidence.md.

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

  it("has no broken in-repo links or heading anchors", () => {
    const violations = findBrokenLinks(root);
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
