import { describe, it, expect, beforeAll, afterAll } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  TERMINAL_PLAN_STATUSES,
  checkPlanFrontmatter,
  collectCompletePlanMarkdown,
  collectLivePlanMarkdown,
  findFrontmatterViolations,
  findNonTerminalCompletedPlans,
} from "./plan-scan";

// Negative-path fixture tests for the plan-tree scanners.
//
// 실저장소 가드(`plan-frontmatter.test.ts`)는 positive-only 다 — "위반 0건" 을 단언한다.
// 그것으로는 검사가 **작동한다**는 것을 증명할 수 없고, 리뷰가 실측으로 보여줬다:
// 158 tests 전량 GREEN 인 동안 위반 수집 분기는 한 번도 실행되지 않았다.
//
// 여기서 합성 저장소로 각 분기를 양성 단언한다. 자매 스캐너(`spec-links.test.ts`)가
// 링크 쪽에 대해 하는 것과 같은 역할이다.

function write(p: string, body: string): void {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, body);
}

const fm = (status?: string): string =>
  ["---", "title: t", ...(status === undefined ? [] : [`status: ${status}`]), "---", "", "# Doc", ""].join("\n");

describe("plan-scan", () => {
  let root: string;

  beforeAll(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), "plan-scan-fixture-"));

    // ── complete/ ─────────────────────────────────────────────────────────
    write(path.join(root, "plan/complete/done.md"), fm("complete"));
    write(path.join(root, "plan/complete/stale.md"), fm("in-progress")); // 위반
    write(path.join(root, "plan/complete/odd.md"), fm("done")); // 위반 — 미등재 어휘
    write(path.join(root, "plan/complete/superseded.md"), fm("superseded")); // 정상
    write(path.join(root, "plan/complete/no-status.md"), fm()); // 선택 필드 → 정상
    write(path.join(root, "plan/complete/nested/deep.md"), fm("in-progress")); // 위반(재귀)
    write(path.join(root, "plan/complete/archive/old.md"), fm("in-progress")); // archive → 제외
    write(path.join(root, "plan/complete/0-index.md"), fm("in-progress")); // 인덱스 → 제외
    write(path.join(root, "plan/complete/_scratch.md"), fm("in-progress")); // 인덱스 → 제외
    // 면제는 **파일명 단위**다 — 디렉터리 이름의 같은 접두는 걸러지지 않는다.
    write(path.join(root, "plan/complete/0-batch/child.md"), fm("in-progress")); // 위반(수집됨)
    write(path.join(root, "plan/complete/_wip/child.md"), fm("in-progress")); // 위반(수집됨)
    write(path.join(root, "plan/complete/broken.md"), "---\n: : bad yaml : :\n---\n"); // 파싱실패 → skip
    // `status` 가 문자열이 아닌 형태들. 이 분기(`typeof status !== "string"`)가
    // 어떤 fixture 로도 실행되지 않으면, 이 PR 이 다섯 곳에서 없앤 것과 **같은**
    // 무관측 분기를 새로 만든 셈이 된다(ai-review WARNING).
    write(path.join(root, "plan/complete/status-empty.md"), "---\nstatus:\n---\n# D\n");
    // `no` 는 **문자열** 로 파싱된다 — js-yaml 이 YAML 1.1 불리언을 뺐기 때문이다.
    // (YAML 1.1 이었다면 false 가 되어 비-문자열 skip 으로 빠졌을 것이다.) 즉 이건
    // 미등재 어휘 위반이고, gray-matter/js-yaml 상향이 그 해석을 바꾸면 여기서 드러난다.
    write(path.join(root, "plan/complete/status-yamlish.md"), "---\nstatus: no\n---\n# D\n");
    write(path.join(root, "plan/complete/status-num.md"), "---\nstatus: 123\n---\n# D\n");
    write(path.join(root, "plan/complete/status-list.md"), "---\nstatus: [complete]\n---\n# D\n");

    // ── in-progress/ ──────────────────────────────────────────────────────
    write(path.join(root, "plan/in-progress/live.md"), fm());
    write(path.join(root, "plan/in-progress/0-index.md"), fm());
    write(path.join(root, "plan/in-progress/_notes.md"), fm());
    write(path.join(root, "plan/in-progress/cluster/child.md"), fm());
  });

  afterAll(() => {
    fs.rmSync(root, { recursive: true, force: true });
  });

  it("detects a completed plan left at `status: in-progress`", () => {
    // 이 저장소가 두 번 겪은 실패 그 자체. 이 단언이 없으면 검사가 조용히 죽어도 모른다.
    const found = findNonTerminalCompletedPlans(root).map((v) => v.relPath);
    expect(found).toContain("plan/complete/stale.md");
  });

  it("detects an unregistered status vocabulary", () => {
    const byPath = new Map(
      findNonTerminalCompletedPlans(root).map((v) => [v.relPath, v.status]),
    );
    expect(byPath.get("plan/complete/odd.md")).toBe("done");
  });

  it("recurses into subdirectories but skips `archive/`", () => {
    const found = findNonTerminalCompletedPlans(root).map((v) => v.relPath);
    expect(found).toContain("plan/complete/nested/deep.md");
    expect(found).not.toContain("plan/complete/archive/old.md");
  });

  it("exempts `0-`/`_` index files, matching Gate C's scope", () => {
    const found = findNonTerminalCompletedPlans(root).map((v) => v.relPath);
    expect(found).not.toContain("plan/complete/0-index.md");
    expect(found).not.toContain("plan/complete/_scratch.md");
  });

  it("applies the index exemption to file names only, not directory names", () => {
    // 면제 근거가 "인덱스 문서는 작업 plan 이 아니다" 라 파일 단위로만 성립한다.
    // 디렉터리까지 넓히면 그 안의 진짜 plan 들이 통째로 가드 밖으로 빠진다.
    // 실 저장소에 그런 디렉터리가 없어 데이터로는 의도/사고가 안 갈리므로 여기서 고정한다.
    const found = findNonTerminalCompletedPlans(root).map((v) => v.relPath);
    expect(found).toContain("plan/complete/0-batch/child.md");
    expect(found).toContain("plan/complete/_wip/child.md");
  });

  it("accepts every terminal vocabulary and a missing status", () => {
    // `status` 는 선택 필드다 — 부재는 위반이 아니다. 그리고 `superseded` 처럼 `complete`
    // 가 아닌 종료 어휘도 통과해야 한다(일괄 `complete` 로 눕히면 그 의미가 사라진다).
    const found = findNonTerminalCompletedPlans(root).map((v) => v.relPath);
    for (const ok of [
      "plan/complete/done.md",
      "plan/complete/superseded.md",
      "plan/complete/no-status.md",
    ]) {
      expect(found).not.toContain(ok);
    }
  });

  it("skips a plan whose frontmatter does not parse", () => {
    // 깨진 YAML 은 이 검사의 관심사가 아니다(다른 가드 소관). 여기서 throw 하면 무관한
    // 이유로 게이트가 죽는다.
    expect(() => findNonTerminalCompletedPlans(root)).not.toThrow();
    expect(findNonTerminalCompletedPlans(root).map((v) => v.relPath)).not.toContain(
      "plan/complete/broken.md",
    );
  });

  it("skips a non-string `status` rather than crashing or false-reporting", () => {
    // YAML 이 `status:`(빈 값)→null, `no`→false, `123`→number, `[complete]`→array 로
    // 파싱한다. 문자열 비교 대상이 아니므로 위반이 아니고, **throw 도 아니다**.
    //
    // 이 단언이 없으면 그 분기를 지우거나 뒤집어도 아무 테스트가 안 죽는다 — 리뷰가
    // 실측으로 지적한 마지막 무관측 분기다.
    const found = findNonTerminalCompletedPlans(root).map((v) => v.relPath);
    for (const skipped of [
      "plan/complete/status-empty.md", // `status:` → null
      "plan/complete/status-num.md", // 123 → number
      "plan/complete/status-list.md", // [complete] → array
    ]) {
      expect(found).not.toContain(skipped);
    }
  });

  it("`status: no` is a STRING, not a YAML 1.1 boolean — so it violates", () => {
    // 이 단언은 파서 세대에 대한 계약이다. js-yaml 은 YAML 1.1 의 `no`→false 를 뺐으므로
    // 문자열 "no" 가 되고, 미등재 어휘라 위반이다. 의존성 상향으로 이 해석이 되돌아가면
    // 그 순간 조용히 **검사에서 빠지는** 값이 하나 생기는데, 여기서 RED 로 드러난다.
    const byPath = new Map(
      findNonTerminalCompletedPlans(root).map((v) => [v.relPath, v.status]),
    );
    expect(byPath.get("plan/complete/status-yamlish.md")).toBe("no");
  });

  it("reports exactly the planted violations (no over-reach)", () => {
    expect(findNonTerminalCompletedPlans(root).map((v) => v.relPath).sort()).toEqual([
      "plan/complete/0-batch/child.md",
      "plan/complete/_wip/child.md",
      "plan/complete/nested/deep.md",
      "plan/complete/odd.md",
      "plan/complete/stale.md",
      "plan/complete/status-yamlish.md",
    ]);
  });

  it("live-plan collection is top-level only and index-exempt", () => {
    expect(collectLivePlanMarkdown(root).map((f) => f.relPath)).toEqual([
      "plan/in-progress/live.md",
    ]);
  });

  it("complete-plan collection recurses and shares the same exemptions", () => {
    const rels = collectCompletePlanMarkdown(root).map((f) => f.relPath);
    expect(rels).toContain("plan/complete/nested/deep.md");
    expect(rels).not.toContain("plan/complete/archive/old.md");
    expect(rels).not.toContain("plan/complete/0-index.md");
  });

  it("TERMINAL_PLAN_STATUSES pins the four accepted values", () => {
    // 어휘를 늘리는 것은 판단이 필요한 일이다 — 이 단언이 그 순간을 마주치게 한다.
    expect([...TERMINAL_PLAN_STATUSES].sort()).toEqual([
      "applied",
      "complete",
      "implemented",
      "superseded",
    ]);
  });

  it("returns nothing on a tree with no plan/ directory", () => {
    const empty = fs.mkdtempSync(path.join(os.tmpdir(), "plan-scan-empty-"));
    try {
      expect(findNonTerminalCompletedPlans(empty)).toEqual([]);
      expect(collectLivePlanMarkdown(empty)).toEqual([]);
    } finally {
      fs.rmSync(empty, { recursive: true, force: true });
    }
  });
});

// ── frontmatter 필수 3필드 ──────────────────────────────────────────────────
//
// 이 판정은 원래 `plan-frontmatter.test.ts` 루프 안에 인라인이었다. 실저장소 plan 들이
// 마침 전부 정상이라 **위반 분기가 CI 에서 한 번도 실행된 적이 없었다** — 정규식을 통째로
// 지워도 스위트가 초록인 상태(ai-review WARNING). 여기서 각 분기를 양성으로 겨눈다.

const frontmatter = (fields: Record<string, string>): string =>
  ["---", ...Object.entries(fields).map(([k, v]) => `${k}: ${v}`), "---", "", "# Doc", ""].join("\n");

const VALID = { worktree: "my-task-abc123", started: "2026-08-10", owner: "developer" };

describe("checkPlanFrontmatter", () => {
  const kindsFor = (fields: Record<string, string>): string[] =>
    checkPlanFrontmatter(frontmatter(fields), "p.md").map((v) => v.kind);

  it("accepts a well-formed block", () => {
    expect(kindsFor(VALID)).toEqual([]);
  });

  it("accepts the `(unstarted)` sentinel but rejects legacy placeholders", () => {
    expect(kindsFor({ ...VALID, worktree: '"(unstarted)"' })).toEqual([]);
    for (const bad of ["TBD", "미정", "pending", "assigned at impl-start", "착수 시 지정"]) {
      expect(
        kindsFor({ ...VALID, worktree: `"${bad}"` }),
        `placeholder "${bad}" must be rejected`,
      ).toEqual(["worktree-placeholder"]);
    }
  });

  it("rejects a missing or empty `worktree`/`owner`", () => {
    const { worktree: _w, ...noWorktree } = VALID;
    expect(kindsFor(noWorktree)).toEqual(["worktree-missing"]);
    expect(kindsFor({ ...VALID, worktree: '""' })).toEqual(["worktree-missing"]);
    const { owner: _o, ...noOwner } = VALID;
    expect(kindsFor(noOwner)).toEqual(["owner-missing"]);
    expect(kindsFor({ ...VALID, owner: '""' })).toEqual(["owner-missing"]);
  });

  it("rejects whitespace-only `worktree`/`owner`", () => {
    // 길이가 0 이 아니라서 `length === 0` 검사를 통과하던 값이다 — 이 가드가 막으려는
    // 것이 정확히 "살아있어 보이지만 죽은 값" 이라 그냥 두면 존재 이유를 침해한다.
    for (const blank of ['"   "', '"\t"', '"\\n"']) {
      expect(
        kindsFor({ ...VALID, worktree: blank }),
        `worktree=${blank} must be rejected`,
      ).toEqual(["worktree-missing"]);
      expect(
        kindsFor({ ...VALID, owner: blank }),
        `owner=${blank} must be rejected`,
      ).toEqual(["owner-missing"]);
    }
  });

  it("rejects dates that pass the shape check but are not real days", () => {
    // 종전 검사는 자리수만 봤다. 그리고 `new Date()` 의 NaN 여부로 갈음할 수도 없다 —
    // `2026-02-30`·`2026-04-31` 은 **다음 달로 굴러가** 유효해 보이기 때문이다(실측).
    for (const bad of ["2026-13-32", "2026-00-10", "2026-02-30", "2026-04-31"]) {
      expect(
        kindsFor({ ...VALID, started: bad }),
        `${bad} must be rejected as a calendar date`,
      ).toEqual(["started-invalid"]);
    }
  });

  it("rejects malformed or non-date `started` values", () => {
    for (const bad of ['"not-a-date"', '"2026-8-10"', '"26-08-10"', "123", "[2026-08-10]"]) {
      expect(kindsFor({ ...VALID, started: bad }), `${bad} must be rejected`).toEqual([
        "started-invalid",
      ]);
    }
    const { started: _s, ...noStarted } = VALID;
    expect(kindsFor(noStarted)).toEqual(["started-invalid"]);
  });

  it("accepts a leap day and a js-yaml Date (unquoted YYYY-MM-DD)", () => {
    // js-yaml 이 따옴표 없는 날짜를 `Date` 객체로 파싱한다 — 문자열 경로만 검증하면
    // 실저장소 plan 전부가 그 분기를 안 타므로 여기서 고정한다.
    expect(kindsFor({ ...VALID, started: "2028-02-29" })).toEqual([]);
    expect(kindsFor({ ...VALID, started: '"2028-02-29"' })).toEqual([]);
    expect(kindsFor({ ...VALID, started: "2027-02-29" })).toEqual(["started-invalid"]);
  });

  it("reports every violated field at once", () => {
    expect(kindsFor({ worktree: "TBD", started: '"nope"', owner: '""' })).toEqual([
      "worktree-placeholder",
      "started-invalid",
      "owner-missing",
    ]);
  });

  it("stops at the block level when there is no parseable frontmatter", () => {
    // 필드 판정은 의미가 없으므로 한 건만 나와야 한다 — 세 필드 위반이 함께 쏟아지면
    // 실패 메시지가 원인을 가린다.
    expect(checkPlanFrontmatter("# 제목만 있는 문서\n", "p.md").map((v) => v.kind)).toEqual([
      "missing-block",
    ]);
    expect(
      checkPlanFrontmatter("---\n: : bad yaml : :\n---\n", "p.md").map((v) => v.kind),
    ).toEqual(["unparseable"]);
  });
});

describe("findFrontmatterViolations", () => {
  let root: string;

  beforeAll(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), "plan-fm-fixture-"));
    write(path.join(root, "plan/in-progress/good.md"), frontmatter(VALID));
    write(path.join(root, "plan/in-progress/bad.md"), frontmatter({ ...VALID, worktree: "TBD" }));
    // 스코프 면제가 frontmatter 검사에도 걸리는지 — 셋 다 위반을 심어 둔다.
    write(path.join(root, "plan/in-progress/0-index.md"), frontmatter({ title: "i" }));
    write(path.join(root, "plan/in-progress/_notes.md"), frontmatter({ title: "n" }));
    write(path.join(root, "plan/in-progress/cluster/child.md"), frontmatter({ title: "c" }));
  });

  afterAll(() => {
    fs.rmSync(root, { recursive: true, force: true });
  });

  it("finds the planted violation and exempts index/cluster files", () => {
    const rels = findFrontmatterViolations(root).map((v) => v.relPath);
    expect(rels).toContain("plan/in-progress/bad.md");
    expect(rels).not.toContain("plan/in-progress/good.md");
    for (const exempt of [
      "plan/in-progress/0-index.md",
      "plan/in-progress/_notes.md",
      "plan/in-progress/cluster/child.md",
    ]) {
      expect(rels, `${exempt} must stay exempt`).not.toContain(exempt);
    }
  });
});
