import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { repoRoot } from "./spec-frontmatter-parse";
import { collectCompletePlanMarkdown, parseFrontmatterSafe } from "./plan-scan";

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

const GATE_C_CUTOFF = new Date("2026-06-04T00:00:00Z");
const NONE_VALUES = new Set(["none", "없음", "n/a", "na"]);

function startedDate(data: Record<string, unknown>): Date | null {
  const s = data.started;
  if (s instanceof Date) return s;
  if (typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s)) {
    return new Date(`${s}T00:00:00Z`);
  }
  return null;
}

// Pure enforcement predicates — unit-tested below so the gate is provably live
// even while every real plan is still grandfathered (enforced set empty).
export function isGateCEnforced(data: Record<string, unknown>): boolean {
  const d = startedDate(data);
  return d !== null && d.getTime() >= GATE_C_CUTOFF.getTime();
}

export function hasValidSpecImpact(
  impact: unknown,
  specExists: (p: string) => boolean,
): boolean {
  if (typeof impact === "string") {
    return NONE_VALUES.has(impact.trim().toLowerCase());
  }
  if (Array.isArray(impact)) {
    return (
      impact.length > 0 &&
      impact.every((p) => typeof p === "string" && specExists(p))
    );
  }
  return false;
}

/**
 * `spec_impact` 리스트에서 **게이트를 통과하면 안 되는** 원소들.
 *
 * 비-문자열 원소도 위반이다 — 종전 필터는 `typeof p === "string" && !exists(...)` 라
 * **문자열이 아닌 원소를 조용히 통과**시켰다(`spec_impact: [123]` 이 dangling 목록에서
 * 빠진다, fail-open). "선언은 있는데 무엇을 건드렸는지 아무도 모르는 상태" 를 막는
 * 게이트라 그 구멍이 곧 게이트의 부재다.
 *
 * **순수 함수로 뺀 이유**: 실제 강제 경로는 실저장소 데이터만 보는데 거기엔 비-문자열
 * `spec_impact` 가 없다 — 인라인으로 두면 이 판정을 되돌려도 스위트가 초록이다(뮤테이션
 * 실측: 되돌린 뮤턴트가 **생존**했다). 합성 fixture 로 겨눌 수 있어야 한다.
 */
export function danglingSpecImpact(root: string, impact: unknown[]): unknown[] {
  return impact.filter(
    (p) => typeof p !== "string" || !fs.existsSync(path.join(root, p)),
  );
}

// 수집은 `plan-scan.ts` 소관이다. 종전에는 여기 손수 DFS 사본이 있었고 필터 값이
// **우연히** 같았을 뿐 그것을 강제하는 것이 아무것도 없었다 — 한쪽만 고치면 Gate C 와
// status 가드가 서로 다른 파일 집합을 보게 된다(이 PR 이 고치고 있는 형태 그대로다).
function collectCompletePlans(root: string): string[] {
  return collectCompletePlanMarkdown(root).map((f) => f.absPath);
}

describe("Gate C — plan-completion spec-consistency", () => {
  const root = repoRoot();
  const plans = collectCompletePlans(root);

  // Plans started on/after the cutoff that must carry a spec_impact decision.
  const enforced = plans.filter((abs) => {
    // 파싱은 `plan-scan.ts` 의 단일 진입점을 쓴다 — gray-matter 캐시 우회 관용구가 여기
    // 손으로 복제돼 있으면 다음 호출부에서 조용히 빠진다(이 PR 이 실제로 겪었다).
    // 이 가드는 같은 plan 을 두 번 파싱한다(여기 필터 단계 + 아래 per-plan describe).
    const parsed = parseFrontmatterSafe(fs.readFileSync(abs, "utf8"));
    if (parsed === null) return false;
    // 컷오프 판정은 `isGateCEnforced` 소관이다 — 종전에는 같은 식이 여기 인라인으로
    // 복제돼 있었고, 그 predicate 는 단위 테스트에서만 불려 **실제 게이트와 갈릴 수
    // 있었다**(이 PR 이 반복해 경계하는 판정 이중화 그 자체).
    return isGateCEnforced(parsed.data);
  });

  it("resolves a real repo root with a complete plan dir", () => {
    // Guard against repoRoot() misresolving → empty scan → vacuous pass of the
    // (currently all-grandfathered) enforcement set.
    expect(
      fs.existsSync(path.join(root, "plan", "complete")),
      `repoRoot missing plan/complete/: ${root}`,
    ).toBe(true);
    expect(plans.length).toBeGreaterThan(10);
  });

  for (const abs of enforced) {
    const rel = path.relative(root, abs).split(path.sep).join("/");
    describe(rel, () => {
      // `enforced` 를 통과한 plan 만 오므로 파싱은 이미 성공했다 — `?? {}` 는 타입 좁히기용.
      const data = parseFrontmatterSafe(fs.readFileSync(abs, "utf8"))?.data ?? {};
      const impact = data.spec_impact;

      it("declares `spec_impact`", () => {
        const ok =
          (typeof impact === "string" && impact.trim().length > 0) ||
          (Array.isArray(impact) && impact.length > 0);
        expect(
          ok,
          `${rel}: completed plan must declare frontmatter spec_impact (spec path list, or "none")`,
        ).toBe(true);
      });

      it("each `spec_impact` spec path exists (if a list)", () => {
        if (!Array.isArray(impact)) return;
        const dangling = danglingSpecImpact(root, impact);
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

  it("grandfathers plans started before the cutoff", () => {
    expect(isGateCEnforced({ started: "2026-06-03" })).toBe(false);
    expect(isGateCEnforced({ started: new Date("2026-01-01T00:00:00Z") })).toBe(false);
  });
  it("enforces plans started on/after the cutoff", () => {
    expect(isGateCEnforced({ started: "2026-06-04" })).toBe(true);
    expect(isGateCEnforced({ started: "2026-12-31" })).toBe(true);
  });
  it("missing/invalid `started` is not enforced (can't determine)", () => {
    expect(isGateCEnforced({})).toBe(false);
    expect(isGateCEnforced({ started: "nope" })).toBe(false);
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

  it("flags non-string `spec_impact` entries as dangling, not just missing paths", () => {
    // 실제 강제 경로는 실저장소 데이터만 보고 거기엔 비-문자열 원소가 없다 — 그래서 이
    // 판정은 합성 fixture 로만 관측된다(뮤테이션 실측: 인라인이던 시절 되돌린 뮤턴트가
    // 생존했다). `[123]` 같은 값이 Gate C 를 그냥 지나가면 게이트가 있으나 마나다.
    const root = repoRoot();
    expect(danglingSpecImpact(root, ["spec/conventions/spec-impl-evidence.md"])).toEqual([]);
    expect(danglingSpecImpact(root, [123])).toEqual([123]);
    expect(danglingSpecImpact(root, [null])).toEqual([null]);
    expect(danglingSpecImpact(root, [["spec/nested.md"]])).toEqual([["spec/nested.md"]]);
    expect(danglingSpecImpact(root, ["spec/does-not-exist.md"])).toEqual([
      "spec/does-not-exist.md",
    ]);
  });
});
