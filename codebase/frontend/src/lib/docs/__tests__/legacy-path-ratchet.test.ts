import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

import { repoRoot } from "./impl-anchor-parse";
import {
  GUARD_SELF_FILES,
  OLD_SPEC_PATH,
  REMOVED_PLAN_PATH,
  collectMentionFiles,
  compareToBaseline,
  countByFile,
  countMatchingLines,
  sortedRecord,
  type RatchetDelta,
} from "./codebase-mentions";

/**
 * **codebase 주석 · 문자열 속 옛 경로가 늘지 않게 막는 래칫**(결정 D12, NERV 정본 전환
 * 단계 4g, NERV Task `CLE-T-M7K35H`).
 *
 * 옛 스펙 트리(`spec/<번호>-<영역>/…md`)는 전환 단계 5 에서 지운다. 그 경로를 적은 주석은
 * 그때 모두 갈 곳을 잃는다. 이 가드를 들인 시점의 기준값은 1,620줄 · 677개 파일이다(2026-10-03.
 * 계획의 1,990줄은 2026-09-28 값이고 4c 가 링크 43개를 키 링크로 바꾸는 등으로 줄었다). 절반쯤은 여러 NERV
 * 문서로 갈라진 옛 파일을 § 번호와 함께 가리켜 기계로 옮길 수 없다. 그래서 한꺼번에 바꾸지
 * 않고 **늘지 않게만** 막는다. 파일을 고칠 때 그 파일의 언급을 NERV 키와 절 제목으로 바꾼다.
 *
 * 지운 `plan/` 경로(116줄)도 같은 방식으로 센다. 남은 작업은 NERV Task 키로, 이력은 PR 번호로
 * 바꾼다.
 *
 * ## 판정
 *
 * 파일별 줄 수를 기준값(`legacy-path-ratchet.baseline.json`)과 견준다. 늘어도 줄어도 실패다.
 * 줄어든 것을 실패로 보는 이유는 `compareToBaseline` 주석에 있다. 줄였으면 기준값을 다시 쓴다.
 *
 * ```
 * cd codebase/frontend && LEGACY_PATH_RATCHET_UPDATE=1 pnpm exec vitest run src/lib/docs/__tests__/legacy-path-ratchet.test.ts
 * ```
 *
 * 늘어난 언급을 기준값에 올리지 않는다. 옛 경로 대신 키를 쓴다.
 */
const root = repoRoot();

const BASELINE_FILE = path.join(__dirname, "legacy-path-ratchet.baseline.json");
const BASELINE_REL = path.relative(root, BASELINE_FILE);
const UPDATE = process.env.LEGACY_PATH_RATCHET_UPDATE === "1";

/** 래칫이 세는 언급의 종류. 기준값 파일의 최상위 키와 같다. */
const CATEGORIES = {
  spec: OLD_SPEC_PATH,
  plan: REMOVED_PLAN_PATH,
} as const;
type Category = keyof typeof CATEGORIES;

/** 늘어난 언급을 고치는 방법. 종류마다 다르다. */
const HOW_TO_FIX: Record<Category, string> = {
  spec:
    "옛 스펙 경로 대신 NERV 키와 절 제목을 쓴다(예: `CLE-API-ERRCODES` 「6.5」). " +
    "키는 미러 frontmatter 의 `source_paths` 로 찾는다. 옛 § 번호는 새 문서의 번호와 " +
    "1:1 로 대응하지 않으니 옮기지 않는다",
  plan:
    "`plan/` 은 전환 단계 3 에서 지웠다. 남은 작업은 NERV Task 키(`CLE-T-…`)로 가리킨다. " +
    "리뷰 지적을 가리키던 줄이면 리뷰 인용 규약(`CLE-ENG-REVIEWCITE` 규칙 1 · 9)을 따른다. " +
    "그 밖의 끝난 일만 PR 번호나 커밋으로 가리킨다",
};

/**
 * 적용된 마이그레이션(`V*.sql` · `V*.conf`)은 고칠 수 없다. Flyway 가 체크섬을 검증하고
 * `CLE-ENG-MIGRATION` 규칙 9(append-only)가 수정을 막는다. 그래서 그 파일들의 언급은 기준값에
 * 영구히 남는다(2026-10-03 기준 옛 스펙 경로 76개 파일 · 122줄, `plan/` 33줄). 옛 트리를 지운 뒤에도
 * 기준값이 0 이 되지 않는 이유다. 이 파일이 늘었다면 새 마이그레이션이 옛 경로를 적은 것이다.
 */
const MIGRATION_FILE = /^codebase\/backend\/migrations\/V\d+__[^/]+\.(?:sql|conf)$/;

/** 파일 자리에 따라 안내를 가른다. 마이그레이션과 생성기 산출물은 손으로 고치는 자리가 다르다. */
function fixHint(cat: Category, file: string): string {
  if (MIGRATION_FILE.test(file)) {
    return (
      "새 마이그레이션 주석에는 옛 경로 대신 NERV 키와 절 제목을 쓴다. " +
      "이미 적용된 마이그레이션은 고치지 않는다(`CLE-ENG-MIGRATION` 규칙 9)"
    );
  }
  if (file.startsWith("codebase/api-catalogs/")) {
    return (
      `${HOW_TO_FIX[cat]}. 생성기 산출물이면 그 파일 대신 생성기` +
      "(`codebase/api-catalogs/<vendor>/_generator.py`)를 고쳐 다시 만든다"
    );
  }
  return HOW_TO_FIX[cat];
}

interface Baseline {
  _note: string;
  spec: Record<string, number>;
  plan: Record<string, number>;
}

const NOTE =
  "legacy-path-ratchet.test.ts 의 기준값. 손으로 고치지 말고 그 파일 머리의 명령으로 다시 쓴다.";

function readBaseline(): Baseline {
  if (!fs.existsSync(BASELINE_FILE)) {
    throw new Error(
      `래칫 기준값 ${BASELINE_REL} 이 없다. LEGACY_PATH_RATCHET_UPDATE=1 로 만든다.`,
    );
  }
  return JSON.parse(fs.readFileSync(BASELINE_FILE, "utf8")) as Baseline;
}

function fmt(deltas: readonly RatchetDelta[]): string {
  return deltas.map((d) => `  ${d.file}: ${d.baseline} → ${d.actual}`).join("\n");
}

/** 늘어난 파일마다 기준값 → 실측과 고치는 방법. */
function fmtGrown(cat: Category, deltas: readonly RatchetDelta[]): string {
  return deltas
    .map((d) => `  ${d.file}: ${d.baseline} → ${d.actual}\n    ${fixHint(cat, d.file)}.`)
    .join("\n");
}

describe("주석 속 옛 경로 래칫", () => {
  // 가드 자신의 파일(합성 입력과 이 기준값)은 `collectMentionFiles` 가 뺀다(`GUARD_SELF_FILES`).
  const files = collectMentionFiles(root);
  const actual: Record<Category, Record<string, number>> = {
    spec: sortedRecord(countByFile(files, CATEGORIES.spec)),
    plan: sortedRecord(countByFile(files, CATEGORIES.plan)),
  };

  if (UPDATE) {
    const next: Baseline = { _note: NOTE, ...actual };
    fs.writeFileSync(BASELINE_FILE, `${JSON.stringify(next, null, 2)}\n`);
  }
  const baseline = readBaseline();

  it("codebase 텍스트 파일을 실제로 훑는다 (vacuity floor)", () => {
    expect(files.length).toBeGreaterThan(2000); // 2026-10-03 실측 수천 개
    expect(files.some((f) => f.relPath.endsWith(".sql"))).toBe(true);
    expect(files.some((f) => f.relPath.startsWith("codebase/backend/src/"))).toBe(true);
    expect(files.every((f) => !f.relPath.includes("/node_modules/"))).toBe(true);
  });

  it("옛 경로 언급을 실제로 센다 (vacuity floor)", () => {
    const total = (rec: Record<string, number>): number =>
      Object.values(rec).reduce((a, b) => a + b, 0);
    expect(total(actual.spec)).toBeGreaterThan(1000); // 2026-10-03 기준값 1,620
    expect(total(actual.plan)).toBeGreaterThan(50); // 2026-10-03 실측 116
  });

  for (const cat of Object.keys(CATEGORIES) as Category[]) {
    it(`[${cat}] 기준값보다 늘어난 파일이 없다`, () => {
      const { grown } = compareToBaseline(actual[cat], baseline[cat]);
      if (grown.length > 0) {
        throw new Error(
          `옛 ${cat} 경로 언급이 늘었다(파일: 기준값 → 실측).\n${fmtGrown(cat, grown)}`,
        );
      }
    });

    it(`[${cat}] 줄어든 파일은 기준값에 반영돼 있다`, () => {
      const { shrunk } = compareToBaseline(actual[cat], baseline[cat]);
      if (shrunk.length > 0) {
        throw new Error(
          `옛 ${cat} 경로 언급이 줄었는데 기준값이 그대로다(파일: 기준값 → 실측).\n${fmt(shrunk)}\n` +
            "기준값을 낮춘다: cd codebase/frontend && LEGACY_PATH_RATCHET_UPDATE=1 " +
            "pnpm exec vitest run src/lib/docs/__tests__/legacy-path-ratchet.test.ts",
        );
      }
    });
  }

  it("세지 않는 가드 자신의 파일이 모두 실재한다 (빈 이름으로 다른 파일을 빼지 않는다)", () => {
    for (const f of GUARD_SELF_FILES) {
      expect(fs.existsSync(path.join(root, f)), f).toBe(true);
    }
  });

  it("기준값 파일은 정렬돼 있고 0 인 항목이 없다", () => {
    for (const cat of Object.keys(CATEGORIES) as Category[]) {
      const rec = baseline[cat];
      expect(Object.keys(rec)).toEqual(Object.keys(sortedRecord(rec)));
      expect(Object.values(rec).every((n) => Number.isInteger(n) && n > 0)).toBe(true);
    }
  });
});

describe("옛 경로 판정 (합성 입력)", () => {
  it("옛 스펙 트리 경로를 센다", () => {
    for (const s of [
      "근거: spec/5-system/3-error-handling.md §1.4",
      // 링크 모양(`[글](경로)`)으로 쓰면 `spec-link-integrity` 범위 2 가 이 파일을 PATH 로 막는다.
      "상대 경로 ../../../spec/conventions/migrations.md#6",
      "`spec/data-flow/9-observability.md`",
      "(spec/2-navigation/_product-overview.md)",
    ]) {
      expect(OLD_SPEC_PATH.test(s), s).toBe(true);
    }
  });

  it("미러 경로 · 다른 낱말 · 글로브 · .mdx 는 세지 않는다", () => {
    for (const s of [
      "spec/CLE-API/CLE-API-ERRCODES.md",
      "spec/CLE-VISION.md",
      "spec/README.md",
      "e2e-spec/foo.md",
      "foo.spec.ts",
      "spec/4-nodes/**.md",
      "spec/guide.mdx",
    ]) {
      expect(OLD_SPEC_PATH.test(s), s).toBe(false);
    }
  });

  it("지운 plan 경로를 센다", () => {
    expect(REMOVED_PLAN_PATH.test("plan/in-progress/x.md")).toBe(true);
    expect(REMOVED_PLAN_PATH.test("`plan/complete/2026/y.md`")).toBe(true);
    expect(REMOVED_PLAN_PATH.test("execution-plan/in-progress/")).toBe(false);
    expect(REMOVED_PLAN_PATH.test("plan/other/")).toBe(false);
  });

  it("한 줄에 여러 번 나와도 1 줄로 센다", () => {
    const text = "spec/a/b.md 와 spec/c/d.md\n없음\nspec/e/f.md";
    expect(countMatchingLines(text, OLD_SPEC_PATH)).toBe(2);
  });

  it("마이그레이션 · 카탈로그 생성기 산출물에는 다른 안내를 한다", () => {
    expect(fixHint("spec", "codebase/backend/migrations/V099__x.sql")).toMatch(
      /이미 적용된 마이그레이션은 고치지 않는다/,
    );
    expect(fixHint("plan", "codebase/backend/migrations/V099__x.conf")).toMatch(/규칙 9/);
    expect(fixHint("spec", "codebase/backend/migrations/README.md")).toBe(HOW_TO_FIX.spec);
    expect(fixHint("spec", "codebase/api-catalogs/cafe24/store.md")).toMatch(/_generator\.py/);
    expect(fixHint("spec", "codebase/backend/src/a.ts")).toBe(HOW_TO_FIX.spec);
  });

  it("기준값과 견줘 늘어난 파일과 줄어든 파일을 가른다", () => {
    const { grown, shrunk } = compareToBaseline(
      { "a.ts": 2, "new.ts": 1, "same.ts": 3 },
      { "a.ts": 1, "gone.ts": 4, "same.ts": 3 },
    );
    expect(grown).toEqual([
      { file: "a.ts", baseline: 1, actual: 2 },
      { file: "new.ts", baseline: 0, actual: 1 },
    ]);
    expect(shrunk).toEqual([{ file: "gone.ts", baseline: 4, actual: 0 }]);
  });
});
