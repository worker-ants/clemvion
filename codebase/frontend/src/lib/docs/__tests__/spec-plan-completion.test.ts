import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { repoRoot } from "./spec-frontmatter-parse";
import {
  collectCompletePlanMarkdown,
  findDanglingSpecImpact,
  findUnparseablePlans,
  hasMalformedStarted,
  hasValidSpecImpact,
  isGateCEnforced,
  makeSpecExists,
  NONE_VALUES,
  parseFrontmatterSafe,
  rawScalar,
} from "./plan-scan";

// Gate C — plan-completion spec-consistency.
//
// When work finishes, the spec↔code consistency decision must be recorded, not
// left implicit. Every completed plan must declare `spec_impact` in its
// frontmatter:
//   spec_impact: none                      # no spec change was needed
//   spec_impact:                           # OR: the spec files this work touched
//     - spec/5-system/4-execution-engine.md
// A list entry must resolve to a real spec file (dangling-ref guard, mirrors
// spec-pending-plan-existence). `none` / `없음` asserts a conscious no-op.
//
// Grandfathered: plans `started` before the cutoff predate this gate and are
// exempt — only completions of work started on/after the cutoff are enforced,
// so the existing backlog is never retro-required (same pattern as the
// spec-only TTL in spec-status-lifecycle). SoT:
// spec/conventions/spec-impl-evidence.md + .claude/docs/plan-lifecycle.md §5.

// 수집은 `plan-scan.ts` 소관이다. 종전에는 여기 손수 DFS 사본이 있었고 필터 값이
// **우연히** 같았을 뿐 그것을 강제하는 것이 아무것도 없었다 — 한쪽만 고치면 Gate C 와
// status 가드가 서로 다른 파일 집합을 보게 된다(이 PR 이 고치고 있는 형태 그대로다).
function collectCompletePlans(root: string): string[] {
  return collectCompletePlanMarkdown(root).map((f) => f.absPath);
}

describe("Gate C — plan-completion spec-consistency", () => {
  const root = repoRoot();
  const plans = collectCompletePlans(root);
  const specExists = makeSpecExists(root);

  // 파싱은 `plan-scan.ts` 의 단일 진입점을 쓴다 — gray-matter 캐시 우회 관용구가 여기
  // 손으로 복제돼 있으면 다음 호출부에서 조용히 빠진다(이 PR 이 실제로 겪었다).
  // 한 번만 읽어 아래 두 단계가 공유한다(종전에는 같은 plan 을 두 번 파싱했다).
  const parsedPlans = plans.map((abs) => ({
    abs,
    rel: path.relative(root, abs).split(path.sep).join("/"),
    parsed: parseFrontmatterSafe(fs.readFileSync(abs, "utf8")),
  }));

  // Plans started on/after the cutoff that must carry a spec_impact decision.
  // 컷오프 판정은 `isGateCEnforced` 소관이다 — 종전에는 같은 식이 여기 인라인으로
  // 복제돼 있었고, 그 predicate 는 단위 테스트에서만 불려 **실제 게이트와 갈릴 수
  // 있었다**(이 PR 이 반복해 경계하는 판정 이중화 그 자체).
  const enforced = parsedPlans.filter(
    (p) => p.parsed !== null && isGateCEnforced(p.parsed.block),
  );

  it("resolves a real repo root with a complete plan dir", () => {
    // Guard against repoRoot() misresolving → empty scan → vacuous pass of the
    // (currently all-grandfathered) enforcement set.
    expect(
      fs.existsSync(path.join(root, "plan", "complete")),
      `repoRoot missing plan/complete/: ${root}`,
    ).toBe(true);
    expect(plans.length).toBeGreaterThan(10);
  });

  it("every completed plan has parseable frontmatter", () => {
    // **파싱 실패는 Gate C 를 통째로 우회한다** — `enforced` 필터도, malformed-started
    // 검사도, status 종료값 검사도 전부 `parsed === null` 을 건너뛴다. 완료 시점에
    // `spec_impact`/`status` 를 손으로 넣다가 YAML 을 깨뜨리면 이 PR 이 막으려던 "조용한
    // 면제" 가 그대로 일어나는데 어떤 테스트도 빨개지지 않았다(ai-review WARNING).
    //
    // `plan-scan.ts` 는 파싱 실패를 "다른 가드의 소관" 이라 위임하지만 `plan/complete/**`
    // 를 보는 그 가드는 **존재하지 않았다** — `checkPlanFrontmatter` 는 top-level
    // in-progress 전용이다. 여기가 그 자리다.
    const unparseable = findUnparseablePlans(root);
    expect(
      unparseable,
      `frontmatter 파싱 실패 ${unparseable.length}건 — Gate C 를 조용히 우회한다`,
    ).toEqual([]);
  });

  it("no completed plan declares a `started` that is not a real calendar date", () => {
    // **이것이 없으면 Gate C 는 조용히 면제된다.** 망가진 `started` 는 컷오프 비교에서
    // `null`(판정 불가) 또는 js-yaml 의 롤오버 결과(`2026-00-10` → `2025-12-10`)로 변해
    // 강제 대상에서 빠진다 — 실측으로 두 경로 모두 확인했다. `plan/complete/**` 는
    // `checkPlanFrontmatter`(in-progress 전용)의 보호를 받지 못해 여기가 유일한 방어선이다.
    const malformed = parsedPlans
      .filter((p) => p.parsed !== null && hasMalformedStarted(p.parsed.block))
      .map((p) => `${p.rel}: started=${JSON.stringify(rawScalar(p.parsed!.block, "started"))}`);
    expect(
      malformed,
      `달력상 실재하지 않는 started ${malformed.length}건 — Gate C 를 조용히 면제받는다`,
    ).toEqual([]);
  });

  for (const { rel, parsed } of enforced) {
    describe(rel, () => {
      // `enforced` 를 통과한 plan 만 오므로 파싱은 이미 성공했다.
      const impact = parsed!.data.spec_impact;

      it("declares `spec_impact`", () => {
        // 판정은 `hasValidSpecImpact` 소관이다. 종전에는 여기서 "비어있지 않은 문자열"
        // 이면 통과시켜 **`spec_impact: maybe` 같은 아무 문자열이나 게이트를 지나갔다**
        // — 그 predicate 는 `none` 어휘만 인정하는데 단위 테스트에서만 불려서, 게이트가
        // 실제로는 더 느슨하다는 사실이 드러나지 않았다(판정 이중화의 전형).
        // 실데이터 실측: none류 72 · 리스트 233 · 그 외 0건이라 조여도 안전하다.
        const ok = hasValidSpecImpact(impact, specExists);
        expect(
          ok,
          `${rel}: completed plan must declare frontmatter spec_impact (spec path list, or "none")`,
        ).toBe(true);
      });

      it("each `spec_impact` spec path exists (if a list)", () => {
        if (!Array.isArray(impact)) return;
        const dangling = findDanglingSpecImpact(impact, specExists);
        expect(
          dangling,
          `${rel}: spec_impact references missing spec file(s) or non-string entries: ${dangling
            .map((p) => JSON.stringify(p))
            .join(", ")}`,
        ).toEqual([]);
      });

      it("string `spec_impact` is an explicit no-op assertion", () => {
        if (Array.isArray(impact)) return;
        if (typeof impact !== "string") return;
        expect(
          NONE_VALUES.has(impact.trim().toLowerCase()),
          `${rel}: string spec_impact must be "none"/"없음" (else use a spec path list)`,
        ).toBe(true);
      });
    });
  }
});

// Synthetic coverage so the gate logic is verified even when no real plan is
// past the cutoff yet (otherwise the per-plan block above is vacuous).
describe("Gate C enforcement logic", () => {
  const exists = (p: string) => p === "spec/5-system/4-execution-engine.md";

  // 판정은 **frontmatter 원문 블록**을 받는다 — 파싱 결과로는 아래 malformed 케이스를
  // 구분할 수 없다(js-yaml 이 무효 날짜를 유효한 `Date` 로 굴려 버린다).
  const block = (started: string): string => `\nstarted: ${started}\nowner: dev`;

  it("grandfathers plans started before the cutoff", () => {
    expect(isGateCEnforced(block("2026-06-03"))).toBe(false);
    expect(isGateCEnforced(block("2026-01-01"))).toBe(false);
  });
  it("enforces plans started on/after the cutoff", () => {
    expect(isGateCEnforced(block("2026-06-04"))).toBe(true);
    expect(isGateCEnforced(block("2026-12-31"))).toBe(true);
    expect(isGateCEnforced(block('"2026-12-31"'))).toBe(true); // 따옴표도 같은 답
  });
  it("missing/invalid `started` is not enforced (can't determine)", () => {
    expect(isGateCEnforced("\nowner: dev")).toBe(false);
    expect(isGateCEnforced(block("nope"))).toBe(false);
  });

  it("a malformed `started` is surfaced, not silently exempted", () => {
    // 종전에는 이 값들이 컷오프 비교에서 빠져 **Gate C 를 통째로 면제**받았다(실측:
    // `"2026-13-32"` → Invalid Date, `2026-00-10` → js-yaml 이 2025-12-10 으로 굴림).
    for (const bad of ["2026-13-32", "2026-00-10", "2026-02-30", "2026-06-31", "nope"]) {
      expect(hasMalformedStarted(block(bad)), `${bad} must be flagged`).toBe(true);
      expect(isGateCEnforced(block(bad)), `${bad} must not be enforced`).toBe(false);
    }
    // `2026-06-31` 은 이 목록에서 **유일하게** 두 구현을 가른다 — 롤오버 결과(7/1)가
    // 컷오프를 넘어서 `isIsoDate` 없이는 **강제 대상으로 오판**된다. 나머지는 Invalid 이거나
    // 롤오버해도 컷오프 이전이라(2/30 → 3/2) 어느 구현이든 같은 답이 나온다 —
    // 뮤테이션으로 발각했다(그 fixture 만 있을 때 `isIsoDate` 제거 뮤턴트가 생존했다).
    expect(hasMalformedStarted(block("2026-06-04"))).toBe(false);
    // 선언 자체가 없으면 위반이 아니다 — 판정 불가와 무효를 가른다.
    expect(hasMalformedStarted("\nowner: dev")).toBe(false);
  });
  it("accepts `none`/`없음` and existing spec-path lists; rejects empty/dangling/absent", () => {
    expect(hasValidSpecImpact("none", exists)).toBe(true);
    expect(hasValidSpecImpact("없음", exists)).toBe(true);
    expect(hasValidSpecImpact(["spec/5-system/4-execution-engine.md"], exists)).toBe(true);
    expect(hasValidSpecImpact(undefined, exists)).toBe(false);
    expect(hasValidSpecImpact([], exists)).toBe(false);
    expect(hasValidSpecImpact(["spec/does-not-exist.md"], exists)).toBe(false);
    expect(hasValidSpecImpact("maybe", exists)).toBe(false);
  });

  it("normalises the `none` vocabulary — case, surrounding space, and the n/a forms", () => {
    // **`NONE_VALUES` 의 나머지 어휘와 `.trim()`/`.toLowerCase()` 가 관측되지 않고 있었다** —
    // 위 케이스는 `"none"`/`"없음"` 만 겨눠서, `"n/a"`/`"na"` 를 집합에서 빼거나 정규화를
    // 통째로 지워도 스위트가 초록이었다(리뷰어 직접 뮤테이션 확인).
    //
    // 실저장소 plan 들이 마침 소문자 무공백 `none` 만 쓰기 때문이다 — 이 폴더가 반복해서
    // 데인 "실데이터가 우연히 한 형태라 분기가 안 돌아간다" 그 형태다.
    expect(hasValidSpecImpact("n/a", exists)).toBe(true);
    expect(hasValidSpecImpact("na", exists)).toBe(true);
    expect(hasValidSpecImpact("NONE", exists)).toBe(true); // toLowerCase
    expect(hasValidSpecImpact("  none  ", exists)).toBe(true); // trim
    expect(hasValidSpecImpact("N/A", exists)).toBe(true); // 둘 다
    // 어휘 밖은 여전히 거절한다 — 정규화가 판정을 넓히지 않는다.
    expect(hasValidSpecImpact("nope", exists)).toBe(false);
  });

  it("flags non-string `spec_impact` entries as dangling, not just missing paths", () => {
    // 실제 강제 경로는 실저장소 데이터만 보고 거기엔 비-문자열 원소가 없다 — 그래서 이
    // 판정은 합성 fixture 로만 관측된다(뮤테이션 실측: 인라인이던 시절 되돌린 뮤턴트가
    // 생존했다). `[123]` 같은 값이 Gate C 를 그냥 지나가면 게이트가 있으나 마나다.
    //
    // `specExists` 를 주입받으므로 **실 파일시스템에 결합되지 않는다** — 자매 함수
    // `hasValidSpecImpact` 와 같은 패턴이다. 종전에는 `fs.existsSync` 를 인라인으로 갖고
    // 있어 실 저장소 파일이 이동하면 로직과 무관한 이유로 깨졌다(ai-review WARNING).
    expect(findDanglingSpecImpact(["spec/5-system/4-execution-engine.md"], exists)).toEqual([]);
    expect(findDanglingSpecImpact([123], exists)).toEqual([123]);
    expect(findDanglingSpecImpact([null], exists)).toEqual([null]);
    expect(findDanglingSpecImpact([["spec/nested.md"]], exists)).toEqual([["spec/nested.md"]]);
    expect(findDanglingSpecImpact(["spec/does-not-exist.md"], exists)).toEqual([
      "spec/does-not-exist.md",
    ]);
  });

  it("`makeSpecExists` requires a real file — not the repo root, not a directory", () => {
    // `fs.existsSync(path.join(root, p))` 만으로는 **빈 문자열이 통과한다** — `path.join`
    // 이 `root` 로 정규화하고 저장소 루트는 늘 존재하기 때문이다(실측). 디렉터리 경로도
    // 마찬가지였다. 헤더 주석은 "실재 spec **파일**" 이라 못박는데 구현이 더 넓었다.
    const real = makeSpecExists(repoRoot());
    expect(real("spec/conventions/spec-impl-evidence.md")).toBe(true);
    expect(real(""), "빈 문자열이 저장소 루트로 정규화돼 통과하면 안 된다").toBe(false);
    expect(real("   ")).toBe(false);
    expect(real("spec"), "디렉터리는 spec 파일이 아니다").toBe(false);
    expect(real("spec/conventions")).toBe(false);
    expect(real("spec/does-not-exist.md")).toBe(false);
    // **실재하지만 spec 이 아닌 파일** — 존재 여부만 보던 시절 이것들이 통과했다.
    // 이 게이트는 "어느 spec 을 건드렸나" 를 기록하게 하는 것이라 곧 무력화였다.
    expect(real("CLAUDE.md"), "spec 밖 파일은 spec_impact 가 될 수 없다").toBe(false);
    expect(real("codebase/frontend/package.json")).toBe(false);
    expect(real("PROJECT.md")).toBe(false);
    // **`..` 로 빠져나가는 형태** — 문자열 접두 검사만 하던 시절 전부 통과했다.
    // 경로에 대한 술어는 정규화 뒤에 물어야 한다는 것이 여기서 드러난 교훈이다.
    expect(real("spec/../CLAUDE.md"), "`..` 로 spec 밖을 가리키면 안 된다").toBe(false);
    expect(real("spec/conventions/../../PROJECT.md")).toBe(false);
    expect(real("spec/../spec/conventions/spec-impl-evidence.md")).toBe(true); // 되돌아오면 OK
  });
});
