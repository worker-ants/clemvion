import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { repoRoot } from "./impl-anchor-parse";
import {
  collectImplLocationDocs,
  extractImplLocationSection,
  findMissingImplLocations,
  implLocationCandidates,
  resolvesInRepo,
  type MissingImplLocation,
} from "./impl-locations";

// Guard: 미러 스펙 문서의 `## 구현 위치` 절이 가리키는 저장소 경로가 실재한다.
// 옛 트리 frontmatter `code:` 를 보던 `spec-code-paths` 를 전환 단계 5(NERV Task
// `CLE-T-7M4C4X`)에서 이 가드로 바꿨다. 판정 규칙의 기준은 CLE-ENG-SPECEVIDENCE 규칙 19 · 20,
// 이유는 R-16.
//
// 경로를 옮기는 코드 변경이 이 가드에 걸리면 그 문서의 NERV 초안을 고쳐 승인받고 같은 PR 에서
// 미러를 받는다(`pull.py --task <CLE-T-…>`, 규칙 22). 미러 파일은 손으로 고치지 않는다.

function fmt(missing: MissingImplLocation[]): string {
  const lines = [
    `${missing.length} implementation location(s) in the spec mirror point at nothing.`,
    "Fix the doc through a NERV spec draft and re-pull the mirror (pull.py --task), " +
      "or restore the path. Do not edit the mirror file by hand.",
  ];
  for (const m of missing) lines.push(`  ${m.doc}:${m.line} -> ${m.path}`);
  return lines.join("\n");
}

// 2026-10-03 실측: 미러 181편 중 136편에 절이 있고 저장소 경로 961개. 하한은 절반 언저리로 둔다.
// 대상이 0 이면 아래 위반 0 단언이 공허하게 초록이 된다(옛 `spec-code-paths` 가 그렇게 꺼질 뻔했다).
const MIN_DOCS = 60;
const MIN_PATHS = 400;

describe("spec-impl-locations guard (real repo)", () => {
  const root = repoRoot();
  const docs = collectImplLocationDocs(root);

  it("collects a non-trivial set of mirror docs and paths (guard against vacuous pass)", () => {
    expect(docs.length).toBeGreaterThan(MIN_DOCS);
    const paths = docs.reduce((n, d) => n + d.paths.length, 0);
    expect(paths).toBeGreaterThan(MIN_PATHS);
  });

  it("every implementation location resolves to a real path", () => {
    const missing = findMissingImplLocations(root);
    expect(missing, fmt(missing)).toEqual([]);
  });
});

describe("extractImplLocationSection", () => {
  it("returns the body up to the next level-2 heading, keeping level-3 subsections", () => {
    const text = [
      "# Doc",
      "",
      "## 개요",
      "`codebase/outside.ts`",
      "## 구현 위치",
      "- `codebase/a.ts`",
      "### 하위",
      "- `codebase/b.ts`",
      "## Rationale",
      "- `codebase/after.ts`",
    ].join("\n");
    const section = extractImplLocationSection(text);
    expect(section?.body).toContain("codebase/a.ts");
    expect(section?.body).toContain("codebase/b.ts");
    expect(section?.body).not.toContain("codebase/after.ts");
    expect(section?.body).not.toContain("codebase/outside.ts");
    // 절 본문의 첫 줄은 원문 6번째 줄이다(헤딩 다음 줄).
    expect(section?.firstLine).toBe(6);
  });

  it("runs to the end of the file when no heading follows", () => {
    const section = extractImplLocationSection("## 구현 위치\n- `codebase/a.ts`\n");
    expect(section?.body).toContain("codebase/a.ts");
  });

  it("returns null when the doc has no such section", () => {
    expect(extractImplLocationSection("# Doc\n\n## 개요\n본문\n")).toBeNull();
  });

  it("does not treat a heading inside a code fence as the section", () => {
    const text = ["```md", "## 구현 위치", "- `codebase/x.ts`", "```"].join("\n");
    expect(extractImplLocationSection(text)).toBeNull();
  });

  it("closes a fence only with the same marker, at least as long", () => {
    // 종류 · 길이를 가리지 않고 토글하면 안쪽 줄에서 펜스가 닫혀 뒤의 진짜 절을 놓친다.
    for (const fence of [
      ["```", "~~~", "```"],
      ["````", "```", "````"],
    ]) {
      const text = [...fence, "## 구현 위치", "- `codebase/a.ts`"].join("\n");
      expect(extractImplLocationSection(text)?.body, fence.join(" ")).toContain("codebase/a.ts");
    }
  });
});

describe("implLocationCandidates", () => {
  it("reads code spans under the four repo roots and nothing else", () => {
    const body = [
      "- `codebase/backend/migrations/**` (마이그레이션 파일, `Dockerfile`, `README.md`)",
      "- `scripts/check-migration-versions.py`",
      "- `.github/workflows/migration-check.yml`",
      "- `.claude/tools/nerv-mirror/pull.py` (`--check`)",
      "시행 코드 — `.review/` 아래 경로가 0 인지 본다. `FooService` · `package.json`",
      "- `spec/CLE-ENG/CLE-ENG.md`",
    ].join("\n");
    expect(implLocationCandidates(body, 10).map((c) => [c.path, c.line])).toEqual([
      ["codebase/backend/migrations/**", 10],
      ["scripts/check-migration-versions.py", 11],
      [".github/workflows/migration-check.yml", 12],
      [".claude/tools/nerv-mirror/pull.py", 13],
    ]);
  });

  it("skips code spans inside a code fence in the section (rule 20)", () => {
    const body = [
      "- `codebase/a.ts`",
      "```md",
      "- `codebase/in-fence.ts`",
      "~~~",
      "- `codebase/still-in-fence.ts`",
      "```",
      "- `codebase/b.ts`",
    ].join("\n");
    expect(implLocationCandidates(body, 1).map((c) => [c.path, c.line])).toEqual([
      ["codebase/a.ts", 1],
      ["codebase/b.ts", 7],
    ]);
  });
});

describe("resolvesInRepo", () => {
  let root: string;
  const touch = (rel: string): void => {
    const abs = path.join(root, rel);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, "x\n");
  };

  beforeAll(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), "impl-locations-"));
    touch("codebase/a/file.ts");
    touch("codebase/a/nested/deep.ts");
    touch("codebase/app/(main)/w/[slug]/page.tsx");
    touch("codebase/app/(main)/w/s/page.tsx");
    touch("codebase/i18n/ko/triggers.ts");
    touch("codebase/i18n/en/triggers.ts");
    touch("codebase/i18n-half/ko/triggers.ts");
    touch("codebase/migrations/V117__entity_index.sql");
    touch("codebase/migrations/V117__entity_index.conf");
    touch("codebase/migrations/V1170__other.sql");
    touch("codebase/g/xb.ts");
    touch("codebase/h/b.ts");
  });

  afterAll(() => fs.rmSync(root, { recursive: true, force: true }));

  it("plain file and directory paths must exist (trailing slash allowed)", () => {
    expect(resolvesInRepo(root, "codebase/a/file.ts")).toBe(true);
    expect(resolvesInRepo(root, "codebase/a/")).toBe(true);
    expect(resolvesInRepo(root, "codebase/a/missing.ts")).toBe(false);
  });

  it("a glob must match at least one file", () => {
    expect(resolvesInRepo(root, "codebase/a/**")).toBe(true);
    expect(resolvesInRepo(root, "codebase/a/*.ts")).toBe(true);
    expect(resolvesInRepo(root, "codebase/a/**/*.tsx")).toBe(false);
    expect(resolvesInRepo(root, "codebase/none/**")).toBe(false);
  });

  it("`**/` spans zero or more whole folders, never part of a name", () => {
    expect(resolvesInRepo(root, "codebase/h/**/b.ts")).toBe(true);
    expect(resolvesInRepo(root, "codebase/a/**/deep.ts")).toBe(true);
    // `**/` 를 `.*` 로 옮기면 `codebase/g/xb.ts` 에 맞아 거짓 통과한다.
    expect(resolvesInRepo(root, "codebase/g/**/b.ts")).toBe(false);
  });

  it("a `..` segment never resolves, even when the target exists", () => {
    expect(resolvesInRepo(root, "codebase/../codebase/a/file.ts")).toBe(false);
    expect(resolvesInRepo(root, "codebase/a/../a/file.ts")).toBe(false);
    expect(resolvesInRepo(root, "codebase/../codebase/a/**")).toBe(false);
  });

  it("square brackets are literal (Next.js dynamic segments), not a character class", () => {
    expect(resolvesInRepo(root, "codebase/app/(main)/w/[slug]/**")).toBe(true);
    expect(resolvesInRepo(root, "codebase/app/(main)/w/[slug]/page.tsx")).toBe(true);
    // 문자 클래스로 읽으면 `s` 한 글자 폴더에 매치해 거짓 통과한다.
    fs.rmSync(path.join(root, "codebase/app/(main)/w/[slug]"), { recursive: true });
    try {
      expect(resolvesInRepo(root, "codebase/app/(main)/w/[slug]/**")).toBe(false);
    } finally {
      touch("codebase/app/(main)/w/[slug]/page.tsx");
    }
  });

  it("every brace alternative must exist", () => {
    expect(resolvesInRepo(root, "codebase/i18n/{ko,en}/triggers.ts")).toBe(true);
    expect(resolvesInRepo(root, "codebase/i18n-half/{ko,en}/triggers.ts")).toBe(false);
  });

  it("a trailing `V<n>` migration segment means that migration's files", () => {
    expect(resolvesInRepo(root, "codebase/migrations/V117")).toBe(true);
    expect(resolvesInRepo(root, "codebase/migrations/V118")).toBe(false);
    // 접두 일치를 넓게 잡으면 `V11` 이 `V117__…` · `V1170__…` 에 걸려 거짓 통과한다.
    expect(resolvesInRepo(root, "codebase/migrations/V11")).toBe(false);
  });
});

describe("findMissingImplLocations (synthetic mirror)", () => {
  let root: string;
  const write = (rel: string, body: string): void => {
    const abs = path.join(root, rel);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, body);
  };

  beforeAll(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), "impl-locations-mirror-"));
    write("codebase/real.ts", "x\n");
    write(
      "spec/CLE-AREA/CLE-AREA-DOC.md",
      ["---", 'id: "CLE-AREA-DOC"', "---", "# Doc", "", "## 구현 위치", "", "- `codebase/real.ts`", "- `codebase/gone.ts`", ""].join("\n"),
    );
    write("spec/CLE-TOP.md", "# Top\n\n## 구현 위치\n\n- `codebase/also-gone/**`\n");
    // 절이 없는 미러 문서와 미러가 아닌 파일은 대상이 아니다.
    write("spec/CLE-AREA/CLE-AREA.md", "# Area\n\n## 문서\n\n- `codebase/not-a-location.ts`\n");
    write("spec/README.md", "# 미러 안내\n\n## 구현 위치\n\n- `codebase/readme-gone.ts`\n");
    write("spec/notes/other.md", "# x\n\n## 구현 위치\n\n- `codebase/other-gone.ts`\n");
  });

  afterAll(() => fs.rmSync(root, { recursive: true, force: true }));

  it("collects only mirror docs that have the section", () => {
    expect(collectImplLocationDocs(root).map((d) => d.doc)).toEqual([
      "spec/CLE-AREA/CLE-AREA-DOC.md",
      "spec/CLE-TOP.md",
    ]);
  });

  it("reports each missing path with the doc and its source line", () => {
    expect(findMissingImplLocations(root)).toEqual([
      { doc: "spec/CLE-AREA/CLE-AREA-DOC.md", line: 9, path: "codebase/gone.ts" },
      { doc: "spec/CLE-TOP.md", line: 5, path: "codebase/also-gone/**" },
    ]);
  });
});
