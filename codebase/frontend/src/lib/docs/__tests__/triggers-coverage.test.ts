import fs from "node:fs";
import path from "node:path";
import { describe, it, expect } from "vitest";
import {
  findGuiFlowSections,
  parseImplAnchors,
  repoRoot,
} from "./impl-anchor-parse";

// Guard: GUI flow sections in 02-nodes/triggers.mdx (and .en.mdx) must
// contain at least one <ImplAnchor kind="ui-entry">. SoT:
// spec/conventions/user-guide-evidence.md §2.
//
// Mirror of integrations-coverage but scoped to the trigger node guide —
// where provider-specific flows (Telegram, future Slack etc.) tend to
// promise UI surfaces.

describe("triggers coverage — GUI flow → ImplAnchor(ui-entry)", () => {
  const root = repoRoot();
  const triggersFiles = [
    "codebase/frontend/src/content/docs/02-nodes/triggers.mdx",
    "codebase/frontend/src/content/docs/02-nodes/triggers.en.mdx",
  ];

  for (const relPath of triggersFiles) {
    describe(relPath, () => {
      const abs = path.join(root, relPath);
      const exists = fs.existsSync(abs);

      it("file exists (precondition)", () => {
        expect(exists).toBe(true);
      });

      if (!exists) return;

      const text = fs.readFileSync(abs, "utf8");
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
