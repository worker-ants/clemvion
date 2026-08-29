import { describe, it, expect, beforeAll, afterAll } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  collectLivePlanMarkdown,
  findBrokenLinks,
  findBrokenPlanLinks,
  findBrokenSpecLinksInSources,
  extractLinks,
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

/**
 * `extractLinks` 의 **사전 필터**가 링크를 놓치지 않는지.
 *
 * 필터의 존재 이유는 성능이다 — codebase 소스 2077개 중 링크를 가진 것은 35개(1.7%)뿐이라
 * 나머지의 라인 스캔이 통째로 낭비였다(전수 114ms → 56ms 실측). 문제는 **성능 최적화가
 * 가드를 조용히 멈추게 하는 것**이고, 이 폴더가 반복해 데인 형태가 정확히 그것이다.
 *
 * 순진한 필요조건(닫는 대괄호 + 여는 소괄호가 붙어 있을 것)은 **틀렸다**: 스캔은 인라인
 * 코드를 먼저 지우므로 `[a]` + 백틱코드 + `(b)` 는 그 조건 없이도 링크가 된다. 아래 세
 * 번째 케이스가 그 자리를 겨눈다 — 필터를 그 조건 단독으로 좁히면 빨개진다.
 */
describe("extractLinks — 사전 필터가 링크를 놓치지 않는다", () => {
  let root: string;

  beforeAll(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), "extract-links-"));
  });
  afterAll(() => fs.rmSync(root, { recursive: true, force: true }));

  const writeDoc = (name: string, body: string): string => {
    const p = path.join(root, name);
    fs.writeFileSync(p, body);
    return p;
  };

  it("링크 표기가 아예 없으면 빈 배열", () => {
    expect(extractLinks(writeDoc("none.md", "# T\n\n본문뿐이다.\n"))).toEqual([]);
  });

  it("보통 링크는 그대로 찾는다", () => {
    const p = writeDoc("plain.md", `# T\n\n${mkLink("t", "./a.md")}\n`);
    expect(extractLinks(p).map((l) => l.target)).toEqual(["./a.md"]);
  });

  it("인라인 코드 제거로 **생기는** 링크도 찾는다 (원문엔 링크 표기가 없다)", () => {
    // 원문은 `]` 다음이 백틱이라 순진한 조건을 통과하지 못한다 — 그런데 인라인 코드가
    // 지워지면 온전한 링크가 된다. 사전 필터가 이 파일을 떨구면 링크 무결성 가드가 이
    // 문서를 **영영 안 본다**.
    const bt = "`";
    const body = `# T\n\n[a]${bt}code${bt}(./b.md)\n`;
    // 전제 자체를 고정한다 — 이 문자열이 순진한 조건을 통과하면 테스트가 무의미해진다.
    expect(body.includes("]" + "(")).toBe(false);
    expect(
      extractLinks(writeDoc("codespan.md", body)).map((l) => l.target),
    ).toEqual(["./b.md"]);
  });
});

/**
 * **링크 텍스트가 줄을 넘는 형태**를 `extractLinks` 가 보는지.
 *
 * 종전 구현은 `text.split(/\r?\n/)` 로 자른 뒤 **줄마다** `LINK_RE` 를 돌렸다. 그래서
 * `[` 와 `](` 가 서로 다른 줄에 있으면 링크가 **아예 수집되지 않았고**, 존재·앵커 검증이
 * 통째로 건너뛰어졌다 — 가드가 실패가 아니라 **침묵으로 통과**한다. 깨진 앵커가 있어도
 * 아무도 모르는 형태이고, 이 폴더가 반복해 데인 "성능/단순화가 가드를 조용히 멈추게 한다"
 * 와 같은 계열이다.
 *
 * 실측(2026-08-11, CommonMark 파서 기준): `spec/**.md` 에 6건 / 6파일,
 * 거버넌스 스코프(루트 `*.md` + `.claude/**.md`)에 2건이 이 형태로 숨어 있었다.
 *
 * 아래는 **양방향**으로 고정한다 — 넓히는 방향(멀티라인 텍스트를 본다)만 잠그면
 * "전부 링크로 본다" 는 반대 오류가 통과하므로, 목적지가 줄을 넘는 경우와 코드펜스를
 * 사이에 둔 경우는 링크가 **아니어야** 한다는 것도 함께 단언한다.
 */
describe("extractLinks — 링크 텍스트가 줄을 넘어도 본다", () => {
  let root: string;

  beforeAll(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), "extract-links-ml-"));
  });
  afterAll(() => fs.rmSync(root, { recursive: true, force: true }));

  const writeDoc = (name: string, body: string): string => {
    const p = path.join(root, name);
    fs.writeFileSync(p, body);
    return p;
  };

  /** 링크 텍스트가 두 줄에 걸친 마크다운 링크. */
  const mkMultiLink = (l1: string, l2: string, url: string): string =>
    `[${l1}\n${l2}](${url})`;

  it("텍스트가 두 줄에 걸친 링크를 찾는다", () => {
    const body = `# T\n\n${mkMultiLink("첫 줄", "둘째 줄", "./a.md")}\n`;
    expect(extractLinks(writeDoc("ml.md", body)).map((l) => l.target)).toEqual([
      "./a.md",
    ]);
  });

  it("실제 저장소에 있던 형태 — 인용부호와 인라인 코드가 섞인 두 줄", () => {
    const bt = "`";
    // `.claude/skills/**/SKILL.md` 에 실재하던 모양: 텍스트 첫 줄이 인라인 코드로 끝나고
    // 다음 줄이 `> ` 인용으로 시작한다.
    const body = `# T\n\n[${bt}a.py${bt}\n> ${bt}b()${bt}](./t.md)\n`;
    expect(extractLinks(writeDoc("ml-quote.md", body)).map((l) => l.target)).toEqual(
      ["./t.md"],
    );
  });

  it("줄 번호는 링크가 **시작한** 줄이다", () => {
    const body = `# T\n\n본문\n\n${mkMultiLink("첫 줄", "둘째 줄", "./a.md")}\n`;
    expect(extractLinks(writeDoc("ml-line.md", body)).map((l) => l.line)).toEqual([
      5,
    ]);
  });

  it("목적지(URL)는 줄을 넘지 못한다", () => {
    // `](` 뒤에서 줄이 바뀌면 링크로 보지 않는다 — CommonMark 도 `<...>` 형태가 아니면
    // 목적지에 줄바꿈을 허용하지 않는다. 넓히는 쪽으로 실수하면 여기가 빨개진다.
    const body = "# T\n\n[t](./a\n.md)\n";
    expect(extractLinks(writeDoc("ml-url.md", body))).toEqual([]);
  });

  it("한 문서에 멀티라인 링크가 **둘 이상**이어도 각자 제 줄에 귀속된다", () => {
    // 줄 귀속은 오프셋→줄 이진 탐색으로 계산한다. 링크가 하나뿐이면 그 탐색이 항상
    // 0번 줄 근처를 맞혀 **off-by-one 이 숨는다** — 두 개 이상이어야 관측된다.
    const body =
      `# T\n` + // 1
      `\n` + // 2
      `${mkMultiLink("첫 링크", "둘째 줄", "./a.md")}\n` + // 3~4
      `\n` + // 5
      `사이 본문\n` + // 6
      `\n` + // 7
      `${mkMultiLink("둘째 링크", "둘째 줄", "./b.md")}\n`; // 8~9
    expect(extractLinks(writeDoc("ml-two.md", body))).toMatchObject([
      { line: 3, target: "./a.md" },
      { line: 8, target: "./b.md" },
    ]);
  });

  it("단일라인과 멀티라인이 섞여도 순서·줄이 맞는다", () => {
    const body =
      `# T\n` + // 1
      `\n` + // 2
      `${mkLink("한 줄", "./one.md")}\n` + // 3
      `\n` + // 4
      `${mkMultiLink("두 줄", "이어서", "./multi.md")}\n` + // 5~6
      `\n` + // 7
      `${mkLink("또 한 줄", "./two.md")}\n`; // 8
    expect(extractLinks(writeDoc("ml-mixed.md", body))).toMatchObject([
      { line: 3, target: "./one.md" },
      { line: 5, target: "./multi.md" },
      { line: 8, target: "./two.md" },
    ]);
  });

  it("세 줄 이상 걸친 링크도 첫 줄에 귀속된다", () => {
    const body = `# T\n\n본문\n\n[첫 줄\n둘째 줄\n셋째 줄](./deep.md)\n`;
    expect(extractLinks(writeDoc("ml-three.md", body))).toMatchObject([
      { line: 5, target: "./deep.md" },
    ]);
  });

  it("**빈 줄**(문단 경계)을 넘는 텍스트는 링크가 아니다", () => {
    // CommonMark 는 링크 텍스트가 문단 경계를 넘는 것을 허용하지 않는다 —
    // `mdast-util-from-markdown`(이 파일이 헤딩 슬러그에 쓰는 그 파서)로 확인했다:
    //   `[t\n둘째 줄](u)`     → 링크
    //   `[t\n\n다른 문단](u)` → **링크 아님**
    // 끊지 않으면 문단을 건너뛰어 **없는 링크를 만들어 낸다**. 이 축을 잠그지 않은 채
    // "양방향으로 안전하다" 고 적었던 것을 리뷰가 잡았다.
    const body = "# T\n\n[열린 텍스트\n\n다른 문단](./a.md)\n";
    expect(extractLinks(writeDoc("ml-blank.md", body))).toEqual([]);
  });

  it("코드펜스를 사이에 둔 `[` 와 `](` 는 링크가 아니다", () => {
    // 펜스 안은 건너뛰므로 앞뒤가 붙어 **없던 링크가 생기면** 안 된다.
    //
    // **빈 줄을 넣지 않는다.** 처음엔 펜스 앞뒤에 빈 줄이 있었는데, 그러면 이 케이스가
    // 펜스 마스킹이 아니라 **빈 줄 마스킹**만으로 통과한다 — 펜스 조건을 통째로 지워도
    // GREEN 인 상태였고 리뷰가 뮤테이션으로 잡았다(`15_30_59` W3). 두 축이 한 fixture 에
    // 겹치면 무엇이 잡았는지 모른다.
    const body = "# T\n[열린 텍스트\n```\ncode\n```\n](./a.md)\n";
    expect(extractLinks(writeDoc("ml-fence.md", body))).toEqual([]);
  });
});

/**
 * 위 사각지대의 **실제 피해**를 통합 경로로 고정한다 — `extractLinks` 가 놓치면
 * `findBrokenLinks` 도 못 보고, 깨진 타깃이 조용히 통과한다.
 */
describe("멀티라인 링크의 깨진 타깃도 잡힌다", () => {
  let root: string;

  beforeAll(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), "ml-broken-"));
    fs.mkdirSync(path.join(root, "spec"), { recursive: true });
    fs.writeFileSync(
      path.join(root, "spec", "a.md"),
      // 텍스트가 두 줄에 걸치고, 목적지 파일은 존재하지 않는다.
      "# A\n\n[첫 줄\n둘째 줄](./nope.md)\n",
    );
  });
  afterAll(() => fs.rmSync(root, { recursive: true, force: true }));

  it("DEAD 로 보고된다 (종전에는 침묵 통과)", () => {
    expect(fingerprint(findBrokenLinks(root))).toEqual(["DEAD ./nope.md"]);
  });
});
