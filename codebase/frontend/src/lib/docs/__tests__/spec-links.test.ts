import { describe, it, expect, beforeAll, afterAll } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  collectLivePlanMarkdown,
  findBrokenLinks,
  findBrokenPlanLinks,
  findBrokenSpecLinksInSources,
} from "./spec-links";

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

// ---------------------------------------------------------------------------
// findBrokenPlanLinks — 세 번째 진입점(살아있는 plan).
//
// 실저장소 가드(`plan-frontmatter.test.ts`)는 위 둘과 같은 이유로 positive-only 다 —
// "위반 0건" 은 스캐너가 **작동한다**는 증거가 아니다. 자매 진입점이 이미 갖고 있던
// negative-path 픽스처를 여기에도 맞춘다 (ai-review WARNING #2).
//
// 특히 **코드펜스 무시**를 고정하는 것이 이 진입점의 존재 이유와 직결된다: 초판은
// `plan-frontmatter.test.ts` 안에 자체 정규식을 썼고 그것이 펜스 안 링크까지 검사해,
// plan 문서가 예시 스니펫에 없는 경로를 적는 순간 거짓 양성으로 push 를 막을 수 있었다.
describe("findBrokenPlanLinks (living plans)", () => {
  let root: string;

  beforeAll(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), "plan-links-fixture-"));
    const dir = path.join(root, "plan", "in-progress");
    fs.mkdirSync(dir, { recursive: true });
    fs.mkdirSync(path.join(root, "plan", "complete"), { recursive: true });
    fs.writeFileSync(path.join(root, "plan", "complete", "moved.md"), "# Moved\n");

    fs.writeFileSync(
      path.join(dir, "live.md"),
      [
        "# Live Plan",
        "",
        mkLink("moved sibling", "../complete/moved.md"), // 정상
        mkLink("stale sibling", "./moved.md"), // DEAD — 이동 후 그대로 남은 형태
        // **없는** 헤딩을 가리켜야 한다 — `#live-plan` 처럼 실재하는 헤딩을 쓰면
        // `checkSelfAnchors` 를 `true` 로 뒤집어도 위반이 안 나서 아래 단언이
        // 제3상태에서 참인 vacuous 테스트가 된다(뮤테이션으로 실증: M2 가 살아남았다).
        mkLink("ignored self", "#no-such-heading"), // checkSelfAnchors:false → 무시
        "",
        "```md",
        mkLink("inside a fence", "./does-not-exist.md"), // 펜스 안 → 무시돼야 한다
        "```",
      ].join("\n"),
    );

    // 하위 그룹 폴더와 `0-`/`_` 접두 인덱스는 스코프 밖이다.
    fs.mkdirSync(path.join(dir, "cluster"), { recursive: true });
    fs.writeFileSync(
      path.join(dir, "cluster", "child.md"),
      mkLink("subfolder dead", "./nope.md"),
    );
    fs.writeFileSync(path.join(dir, "0-index.md"), mkLink("index dead", "./nope.md"));
    fs.writeFileSync(path.join(dir, "_scratch.md"), mkLink("underscore dead", "./nope.md"));
  });

  afterAll(() => {
    fs.rmSync(root, { recursive: true, force: true });
  });

  it("reports the DEAD sibling link a plan move leaves behind", () => {
    expect(fingerprint(findBrokenPlanLinks(root))).toEqual(["DEAD ./moved.md"]);
  });

  it("ignores links inside fenced code blocks", () => {
    // 펜스 안의 `./does-not-exist.md` 가 결과에 없어야 한다. 이것이 무너지면 plan 문서의
    // 예시 스니펫이 거짓 양성을 만든다.
    expect(
      findBrokenPlanLinks(root).some((v) => v.target.includes("does-not-exist")),
    ).toBe(false);
  });

  it("ignores same-file anchors (checkSelfAnchors: false)", () => {
    expect(findBrokenPlanLinks(root).some((v) => v.target.startsWith("#"))).toBe(false);
  });

  it("scans top level only — subfolders and 0-/_ index files are exempt", () => {
    const scanned = collectLivePlanMarkdown(root).map((f) => f.relPath);
    expect(scanned).toEqual(["plan/in-progress/live.md"]);
    // 위 세 파일 전부 깨진 링크를 갖고 있으므로, 스코프가 새면 즉시 위반으로 드러난다.
    expect(findBrokenPlanLinks(root).map((v) => v.source)).toEqual([
      "plan/in-progress/live.md",
    ]);
  });

  it("returns no violations when every live-plan link resolves", () => {
    const clean = fs.mkdtempSync(path.join(os.tmpdir(), "plan-links-clean-"));
    try {
      const d = path.join(clean, "plan", "in-progress");
      fs.mkdirSync(d, { recursive: true });
      fs.mkdirSync(path.join(clean, "plan", "complete"), { recursive: true });
      fs.writeFileSync(path.join(clean, "plan", "complete", "done.md"), "# Done\n");
      fs.writeFileSync(path.join(d, "a.md"), mkLink("ok", "../complete/done.md"));
      expect(findBrokenPlanLinks(clean)).toEqual([]);
    } finally {
      fs.rmSync(clean, { recursive: true, force: true });
    }
  });
});
