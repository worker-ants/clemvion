import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { repoRoot } from "./spec-frontmatter-parse";
import { collectSpecMarkdown, extractLinks } from "./spec-links";

// Guard: every spec "area" folder keeps a complete table of contents — each
// sibling spec must be linked from at least one of the folder's index docs, so
// a new spec dropped into an area can't become an unlisted, hard-to-find page.
//
// Index docs = basename matches `_*overview.md` | `_layout.md` | `0-*.md` |
// `README.md`. Siblings = the other `.md` files (excluding `_`-prefixed
// fragments). A folder with <2 siblings needs no TOC.
//
// `spec/conventions/` is a FLAT reference collection (no entry/index doc by
// design) and is exempt. Generated `*-api-catalog/` trees are exempt.
// SoT: spec/conventions/spec-impl-evidence.md.

const INDEX_RE = /^(_.*overview|_layout|0-.*|README)\.md$/;
const isIndex = (basename: string) => INDEX_RE.test(basename);

function basenameOf(linkPath: string): string {
  const noAnchor = linkPath.split("#")[0];
  return path.posix.basename(noAnchor);
}

interface Area {
  rel: string;
  absDir: string;
  indexAbs: string[];
  siblings: string[]; // basenames
}

function collectAreas(root: string): Area[] {
  const files = collectSpecMarkdown(root); // excludes catalogs
  const byDir = new Map<string, string[]>(); // absDir -> basenames
  for (const f of files) {
    const dir = path.dirname(f.absPath);
    const arr = byDir.get(dir) ?? [];
    arr.push(path.basename(f.absPath));
    byDir.set(dir, arr);
  }
  const areas: Area[] = [];
  for (const [absDir, names] of byDir) {
    const rel = path.relative(root, absDir).split(path.sep).join("/");
    if (rel === "spec/conventions") continue; // flat reference, no index
    const siblings = names.filter((n) => !isIndex(n) && !n.startsWith("_"));
    if (siblings.length < 2) continue;
    const indexAbs = names
      .filter((n) => isIndex(n))
      .map((n) => path.join(absDir, n));
    areas.push({ rel, absDir, indexAbs, siblings });
  }
  areas.sort((a, b) => a.rel.localeCompare(b.rel));
  return areas;
}

describe("spec-area-index guard", () => {
  const root = repoRoot();
  const areas = collectAreas(root);

  it("discovers multiple spec areas", () => {
    // Guard against repoRoot() misresolving → empty scan → vacuous pass.
    expect(fs.existsSync(path.join(root, "spec")), `repoRoot missing spec/: ${root}`).toBe(true);
    expect(areas.length).toBeGreaterThan(5);
    expect(areas.some((a) => a.rel === "spec/5-system")).toBe(true);
  });

  for (const area of areas) {
    describe(area.rel, () => {
      it("has at least one index/entry doc", () => {
        expect(
          area.indexAbs.length,
          `${area.rel}: no index doc (expected one of _*overview.md / _layout.md / 0-*.md / README.md)`,
        ).toBeGreaterThan(0);
      });

      it("index docs link every sibling spec", () => {
        const linked = new Set<string>();
        for (const idx of area.indexAbs) {
          for (const link of extractLinks(idx)) {
            if (/^[a-z]+:\/\//i.test(link.target)) continue;
            linked.add(basenameOf(link.target));
          }
        }
        const missing = area.siblings.filter((s) => !linked.has(s));
        expect(
          missing,
          `${area.rel}: index doc(s) do not link these siblings: ${missing.join(", ")}`,
        ).toEqual([]);
      });
    });
  }
});
