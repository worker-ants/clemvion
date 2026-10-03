import { describe, it, expect, beforeAll, afterAll } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  findBrokenGovernanceLinks,
  findBrokenSpecLinksInSources,
  extractLinks,
  type LinkViolation,
} from "./spec-links";

// Negative-path fixture tests for the shared findBrokenLinksInFiles core,
// exercised through both public entry points on a synthetic temp repo.
//
// The real-repo guard (spec-link-integrity.test.ts) is positive-only — it
// asserts ZERO violations against the live tree, which cannot prove the
// detection logic actually fires (a broken scanner would pass vacuously). These
// fixtures assert the DEAD/ANCHOR paths report correctly, and pin the two
// LinkScanOptions knobs:
//   - checkSelfAnchors: true  (findBrokenGovernanceLinks)   → same-file #anchors validated
//   - checkSelfAnchors: false (findBrokenSpecLinksInSources) → same-file #anchors ignored
//   - targetFilter (sources) → only spec/**.md links are checked
//
// The DEAD/ANCHOR/line/multiline cases ran through the `spec/**.md` entry point
// (`findBrokenLinks`, scope 1) until that scope went with the old spec tree in NERV
// cutover stage 5 (`CLE-T-7M4C4X`). They now run through the governance entry point,
// which uses the same core with `checkSelfAnchors: true` — the fixture doc sits at
// the repo root (governance scans root `*.md`).
//
// `mkLink` assembles the markdown links so no literal `[text](url)` appears in
// THIS file's source — otherwise findBrokenSpecLinksInSources would resolve
// these fixture URLs when it scans the repo. (A template literal is also
// stripped as inline code by extractLinks, so it is doubly safe.)
const mkLink = (text: string, url: string): string => `[${text}](${url})`;

function fingerprint(v: { kind: string; target: string }[]): string[] {
  return v.map((x) => `${x.kind} ${x.target}`).sort();
}

/** 한 원본 파일의 위반만. 같은 픽스처의 다른 문서가 섞이지 않게 한다. */
function violationsFrom(source: string, v: LinkViolation[]): LinkViolation[] {
  return v.filter((x) => x.source === source);
}

describe("findBrokenLinksInFiles core (via public entry points)", () => {
  let root: string;

  beforeAll(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), "spec-links-fixture-"));

    // 루트 문서 — findBrokenGovernanceLinks 가 훑는다(checkSelfAnchors: true).
    fs.mkdirSync(path.join(root, "spec"), { recursive: true });
    fs.writeFileSync(
      path.join(root, "DOC.md"),
      [
        "# Heading One",
        "",
        mkLink("ok self", "#heading-one"), // valid self-anchor → no violation
        mkLink("bad self", "#nope"), // ANCHOR → no such heading
        mkLink("dead", "./missing.md"), // DEAD → file absent
        mkLink("ok rel", "./real.md#good-anchor"), // valid cross-file anchor
        // 멀티라인 ANCHOR — 링크 **텍스트**가 두 줄에 걸친다. 통합층은 지금까지 멀티라인을
        // DEAD 로만 검증했다(`15_01_34` INFO #17 · `15_55_00` INFO #8). 스캐너가 줄 단위로
        // 퇴행하면 이 링크는 **아예 안 보이고** ANCHOR 판정도 함께 사라진다.
        "[multiline anchor",
        'text](./real.md#no-such-anchor)',
        // 코드펜스 안 링크는 무시돼야 한다 — 문서의 예시 스니펫은 없는 경로를 적을 수
        // 있어야 한다. 아래 `toEqual` 이 정확한 목록이라 펜스 무시가 무너지면
        // `DEAD ./does-not-exist.md` 가 끼어들어 실패한다. (NERV 전환 단계 3 에서 지운
        // plan 링크 진입점 fixture 가 이 계약을 고정하던 자리를 옮겼다.)
        "",
        "```md",
        mkLink("inside a fence", "./does-not-exist.md"),
        "```",
      ].join("\n"),
    );
    fs.writeFileSync(path.join(root, "real.md"), "# Good Anchor\n");
    // 코드 소스와 GOV.md 의 경로 링크가 가리키는 자리.
    fs.writeFileSync(path.join(root, "spec", "real.md"), "# Good Anchor\n");

    // NERV 미러 — 키 링크(`CLE-…`)가 가리키는 자리. 영역 폴더 안에 둔다.
    fs.mkdirSync(path.join(root, "spec", "CLE-OK"), { recursive: true });
    fs.writeFileSync(
      path.join(root, "spec", "CLE-OK", "CLE-OK-DOC.md"),
      "# Good Anchor\n",
    );

    // codebase source tree — scanned by findBrokenSpecLinksInSources
    // (checkSelfAnchors: false + spec-md targetFilter + key links).
    const srcDir = path.join(root, "codebase", "backend", "src");
    fs.mkdirSync(srcDir, { recursive: true });
    fs.writeFileSync(
      path.join(srcDir, "fake.ts"),
      [
        "// " + mkLink("ignored self", "#anywhere"), // self-anchor → ignored (code has no headings)
        "// " + mkLink("ignored nonspec", "../helper.ts"), // non-spec target → ignored
        // spec/**.md 경로 링크는 실재 여부와 무관하게 PATH 다 — 코드는 키 링크로 적는다.
        "// " + mkLink("dead spec", "../../../spec/missing.md"),
        "// " + mkLink("ok spec", "../../../spec/real.md#good-anchor"),
        "// " + mkLink("ok key", "CLE-OK-DOC#good-anchor"), // valid
        "// " + mkLink("ok key no anchor", "CLE-OK-DOC"), // valid
        "// " + mkLink("missing key", "CLE-NO-SUCH"), // KEY
        "// " + mkLink("bad key anchor", "CLE-OK-DOC#no-such"), // ANCHOR
      ].join("\n"),
    );

    // 거버넌스 문서 — 경로 링크는 그대로 보고, 키 링크도 미러로 확인한다.
    fs.writeFileSync(
      path.join(root, "GOV.md"),
      [
        "# Gov",
        "",
        mkLink("ok rel", "./spec/real.md#good-anchor"), // valid path link
        mkLink("ok key", "CLE-OK-DOC#good-anchor"), // valid
        mkLink("missing key", "CLE-NO-SUCH#x"), // KEY
        mkLink("bad key anchor", "CLE-OK-DOC#nope"), // ANCHOR
      ].join("\n"),
    );
  });

  afterAll(() => {
    fs.rmSync(root, { recursive: true, force: true });
  });

  it("checkSelfAnchors: true reports DEAD + broken self-anchor, passes valid links", () => {
    // #heading-one and real.md#good-anchor resolve; #nope and ./missing.md do not.
    expect(fingerprint(violationsFrom("DOC.md", findBrokenGovernanceLinks(root)))).toEqual([
      "ANCHOR #nope",
      "ANCHOR ./real.md#no-such-anchor",
      "DEAD ./missing.md",
    ]);
  });

  // `LinkViolation.line` 은 단위 층 5곳이 이미 잠근다(시작 줄 · 멀티 2개 · 혼재 3개 ·
  // 3줄 스팬). 통합층이 더하는 것은 **"전달이 끊기지 않았는가"** 하나다 — 코어가 줄을
  // 옳게 세도 공개 진입점이 그것을 떨구면 사용자는 위치 없는 위반만 본다. (`15_55_00` W1)
  it("통합 경로가 line 을 그대로 전달한다 — 멀티라인 ANCHOR 는 **시작** 줄", () => {
    const byTarget = new Map(
      violationsFrom("DOC.md", findBrokenGovernanceLinks(root)).map((v) => [v.target, v.line]),
    );

    // [전제] 세 위반이 다 잡혔다 — 아니면 아래 단언이 vacuous 하다.
    expect([...byTarget.keys()].sort()).toEqual([
      "#nope",
      "./missing.md",
      "./real.md#no-such-anchor",
    ]);

    expect(byTarget.get("#nope")).toBe(4);
    expect(byTarget.get("./missing.md")).toBe(5);
    // 멀티라인은 **시작** 줄이지 닫는 줄이 아니다.
    expect(byTarget.get("./real.md#no-such-anchor")).toBe(7);
  });

  it("findBrokenSpecLinksInSources: 경로 링크는 PATH, 키 링크는 미러로 확인한다", () => {
    // Same-file anchor and the non-spec ../helper.ts link are both ignored.
    // 경로 링크는 실재하든 아니든 PATH 다(살아 있는 경로라도 키로 바꿔야 한다).
    // 키 링크는 키 실재(KEY)와 미러 문서의 제목(ANCHOR)을 본다.
    expect(fingerprint(findBrokenSpecLinksInSources(root))).toEqual([
      "ANCHOR CLE-OK-DOC#no-such",
      "KEY CLE-NO-SUCH",
      "PATH ../../../spec/missing.md",
      "PATH ../../../spec/real.md#good-anchor",
    ]);
  });

  it("findBrokenGovernanceLinks: 경로 링크와 함께 키 링크도 미러로 확인한다", () => {
    expect(fingerprint(violationsFrom("GOV.md", findBrokenGovernanceLinks(root)))).toEqual([
      "ANCHOR CLE-OK-DOC#nope",
      "KEY CLE-NO-SUCH#x",
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
      fs.writeFileSync(
        path.join(clean, "A.md"),
        ["# Title", "", mkLink("self", "#title"), mkLink("rel", "./B.md")].join(
          "\n",
        ),
      );
      fs.writeFileSync(path.join(clean, "B.md"), "# B\n");
      // 전제 — 두 문서를 실제로 훑어야 아래 빈 배열이 공허하지 않다.
      expect(extractLinks(path.join(clean, "A.md")).length).toBe(2);
      expect(findBrokenGovernanceLinks(clean)).toEqual([]);
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
 * 링크 검사 진입점도 못 보고, 깨진 타깃이 조용히 통과한다.
 */
describe("멀티라인 링크의 깨진 타깃도 잡힌다", () => {
  let root: string;

  beforeAll(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), "ml-broken-"));
    fs.writeFileSync(
      path.join(root, "A.md"),
      // 텍스트가 두 줄에 걸치고, 목적지 파일은 존재하지 않는다.
      "# A\n\n[첫 줄\n둘째 줄](./nope.md)\n",
    );
  });
  afterAll(() => fs.rmSync(root, { recursive: true, force: true }));

  it("DEAD 로 보고된다 (종전에는 침묵 통과)", () => {
    expect(fingerprint(findBrokenGovernanceLinks(root))).toEqual(["DEAD ./nope.md"]);
  });
});
