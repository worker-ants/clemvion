import { describe, it, expect, beforeAll, afterAll } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { findBrokenLinks, findBrokenSpecLinksInSources } from "./spec-links";

// Negative-path fixture tests for the shared findBrokenLinksInFiles core,
// exercised through both public entry points on a synthetic temp repo.
//
// The real-repo guard (spec-link-integrity.test.ts) is positive-only — it
// asserts ZERO violations against the live tree, which cannot prove the
// detection logic actually fires (a broken scanner would pass vacuously). These
// fixtures assert the DEAD/ANCHOR paths report correctly, and pin the two
// LinkScanOptions knobs:
//   - checkSelfAnchors: true  (findBrokenLinks)            → same-file #anchors validated
//   - checkSelfAnchors: false (findBrokenSpecLinksInSources) → same-file #anchors ignored
//   - targetFilter (sources) → only spec/**.md links are checked
//
// `mkLink` assembles the markdown links so no literal `[text](url)` appears in
// THIS file's source — otherwise findBrokenSpecLinksInSources would resolve
// these fixture URLs when it scans the repo. (A template literal is also
// stripped as inline code by extractLinks, so it is doubly safe.)
const mkLink = (text: string, url: string): string => `[${text}](${url})`;

function fingerprint(v: { kind: string; target: string }[]): string[] {
  return v.map((x) => `${x.kind} ${x.target}`).sort();
}

describe("findBrokenLinksInFiles core (via public entry points)", () => {
  let root: string;

  beforeAll(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), "spec-links-fixture-"));

    // spec/ tree — scanned by findBrokenLinks (checkSelfAnchors: true).
    fs.mkdirSync(path.join(root, "spec"), { recursive: true });
    fs.writeFileSync(
      path.join(root, "spec", "doc.md"),
      [
        "# Heading One",
        "",
        mkLink("ok self", "#heading-one"), // valid self-anchor → no violation
        mkLink("bad self", "#nope"), // ANCHOR → no such heading
        mkLink("dead", "./missing.md"), // DEAD → file absent
        mkLink("ok rel", "./real.md#good-anchor"), // valid cross-file anchor
      ].join("\n"),
    );
    fs.writeFileSync(path.join(root, "spec", "real.md"), "# Good Anchor\n");

    // codebase source tree — scanned by findBrokenSpecLinksInSources
    // (checkSelfAnchors: false + spec-md targetFilter).
    const srcDir = path.join(root, "codebase", "backend", "src");
    fs.mkdirSync(srcDir, { recursive: true });
    fs.writeFileSync(
      path.join(srcDir, "fake.ts"),
      [
        "// " + mkLink("ignored self", "#anywhere"), // self-anchor → ignored (code has no headings)
        "// " + mkLink("ignored nonspec", "../helper.ts"), // non-spec target → ignored
        "// " + mkLink("dead spec", "../../../spec/missing.md"), // DEAD
        "// " + mkLink("bad anchor", "../../../spec/real.md#no-such"), // ANCHOR
        "// " + mkLink("ok spec", "../../../spec/real.md#good-anchor"), // valid
      ].join("\n"),
    );
  });

  afterAll(() => {
    fs.rmSync(root, { recursive: true, force: true });
  });

  it("findBrokenLinks reports DEAD + broken self-anchor, passes valid links", () => {
    // checkSelfAnchors: true — #heading-one and real.md#good-anchor resolve;
    // #nope and ./missing.md do not.
    expect(fingerprint(findBrokenLinks(root))).toEqual([
      "ANCHOR #nope",
      "DEAD ./missing.md",
    ]);
  });

  it("findBrokenSpecLinksInSources reports DEAD + broken spec anchor only", () => {
    // Same-file anchor and the non-spec ../helper.ts link are both ignored;
    // the two spec-targeting breaks are caught.
    expect(fingerprint(findBrokenSpecLinksInSources(root))).toEqual([
      "ANCHOR ../../../spec/real.md#no-such",
      "DEAD ../../../spec/missing.md",
    ]);
  });

  it("checkSelfAnchors: false — same-file #anchors in code sources never violate", () => {
    expect(
      findBrokenSpecLinksInSources(root).some((v) => v.target.startsWith("#")),
    ).toBe(false);
  });

  it("returns no violations when every link resolves (non-vacuous healthy path)", () => {
    const clean = fs.mkdtempSync(path.join(os.tmpdir(), "spec-links-clean-"));
    try {
      fs.mkdirSync(path.join(clean, "spec"), { recursive: true });
      fs.writeFileSync(
        path.join(clean, "spec", "a.md"),
        ["# Title", "", mkLink("self", "#title"), mkLink("rel", "./b.md")].join(
          "\n",
        ),
      );
      fs.writeFileSync(path.join(clean, "spec", "b.md"), "# B\n");
      expect(findBrokenLinks(clean)).toEqual([]);
    } finally {
      fs.rmSync(clean, { recursive: true, force: true });
    }
  });
});
