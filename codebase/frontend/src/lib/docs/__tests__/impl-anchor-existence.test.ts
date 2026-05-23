import fs from "node:fs";
import path from "node:path";
import { describe, it, expect } from "vitest";
import {
  collectMdxFiles,
  isValidKind,
  parseImplAnchors,
  repoRoot,
} from "./impl-anchor-parse";

// Guard: every <ImplAnchor> in user-guide MDX must reference a real file
// AND its `symbol` must grep-match inside that file. SoT:
// spec/conventions/user-guide-evidence.md §2.
//
// Failure here means a guide promised a UI / API / e2e anchor that no
// longer exists — exactly the class of drift this convention catches.

describe("ImplAnchor existence guard", () => {
  const root = repoRoot();
  const guideDocsRoot = "codebase/frontend/src/content/docs";
  const allMdx = collectMdxFiles(root, guideDocsRoot);

  it("collects MDX files (precondition — sanity)", () => {
    expect(allMdx.length).toBeGreaterThan(0);
  });

  for (const mdxPath of allMdx) {
    const mdxRel = path.relative(root, mdxPath);
    describe(mdxRel, () => {
      const text = fs.readFileSync(mdxPath, "utf8");
      const anchors = parseImplAnchors(text);

      if (anchors.length === 0) {
        it("no <ImplAnchor> — skip", () => {
          expect(anchors.length).toBe(0);
        });
        return;
      }

      for (const a of anchors) {
        const label = `anchor file=${a.file} symbol=${a.symbol}`;
        it(`${label} — kind enum is valid`, () => {
          expect(isValidKind(a.kind)).toBe(true);
        });
        it(`${label} — file exists in repo`, () => {
          const abs = path.join(root, a.file);
          expect(fs.existsSync(abs)).toBe(true);
        });
        it(`${label} — symbol grep-matches in file`, () => {
          const abs = path.join(root, a.file);
          const fileText = fs.readFileSync(abs, "utf8");
          expect(fileText.includes(a.symbol)).toBe(true);
        });
      }
    });
  }
});
