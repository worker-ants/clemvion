import fs from "node:fs";
import path from "node:path";
import { describe, it, expect } from "vitest";
import {
  collectMdxFiles,
  findGuiFlowSections,
  parseImplAnchors,
  repoRoot,
} from "./impl-anchor-parse";

// Guard: every "GUI flow" section in 06-integrations-and-config/*.mdx must
// contain at least one <ImplAnchor kind="ui-entry">. SoT:
// spec/conventions/user-guide-evidence.md §2.
//
// Catches the Telegram-class gap: integration guide promises a UI entry
// point that no actual UI code provides.

describe("integrations coverage — GUI flow → ImplAnchor(ui-entry)", () => {
  const root = repoRoot();
  const integrationsDir = "codebase/frontend/src/content/docs/06-integrations-and-config";
  const files = collectMdxFiles(root, integrationsDir);

  it("collects integrations MDX files (precondition)", () => {
    expect(files.length).toBeGreaterThan(0);
  });

  for (const mdxPath of files) {
    const mdxRel = path.relative(root, mdxPath);
    describe(mdxRel, () => {
      const text = fs.readFileSync(mdxPath, "utf8");
      const sections = findGuiFlowSections(text);

      if (sections.length === 0) {
        it("no GUI section — skip", () => {
          expect(sections.length).toBe(0);
        });
        return;
      }

      for (const sec of sections) {
        it(`section "${sec.heading}" — has ≥1 <ImplAnchor kind="ui-entry">`, () => {
          const anchors = parseImplAnchors(sec.body).filter(
            (a) => a.kind === "ui-entry",
          );
          expect(anchors.length).toBeGreaterThan(0);
        });
      }
    });
  }
});
