import { describe, it, expect, beforeAll, afterAll } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  TERMINAL_STATUSES,
  collectCompletePlanMarkdown,
  collectLivePlanMarkdown,
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
    write(path.join(root, "plan/complete/broken.md"), "---\n: : bad yaml : :\n---\n"); // 파싱실패 → skip

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

  it("reports exactly the three planted violations (no over-reach)", () => {
    expect(findNonTerminalCompletedPlans(root).map((v) => v.relPath).sort()).toEqual([
      "plan/complete/nested/deep.md",
      "plan/complete/odd.md",
      "plan/complete/stale.md",
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

  it("TERMINAL_STATUSES pins the four accepted values", () => {
    // 어휘를 늘리는 것은 판단이 필요한 일이다 — 이 단언이 그 순간을 마주치게 한다.
    expect([...TERMINAL_STATUSES].sort()).toEqual([
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
