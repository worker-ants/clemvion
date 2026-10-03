import { describe, it, expect, beforeAll, afterAll } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { repoRoot } from "./impl-anchor-parse";
import {
  GUARD_SELF_FILES,
  MIN_SWEPT_FILES,
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
 * 옛 스펙 트리(`spec/<번호>-<영역>/`, `spec/conventions/`, `spec/data-flow/`, 루트
 * `spec/<번호>-<이름>.md`)는 전환 단계 5 에서 지운다. 그 경로를 적은 주석은 그때 모두 갈 곳을
 * 잃는다. 이 가드를 들인 시점의 기준값은 1,729줄 · 722개 파일이다(2026-10-03. 확장자 없는 인용
 * 까지 센 값이다. 계획의 1,990줄은 2026-09-28 에 `.md` 로 끝나는 경로만 센 값이고 4c 가 링크 43개를
 * 키 링크로 바꾸는 등으로 줄었다). 절반쯤은 여러 NERV 문서로 갈라진 옛 파일을 § 번호와 함께
 * 가리켜 기계로 옮길 수 없다. 그래서 한꺼번에 바꾸지 않고 **늘지 않게만** 막는다. 파일을 고칠 때
 * 그 파일의 언급을 NERV 키와 절 제목으로 바꾼다.
 *
 * 지운 `plan/` 경로(116줄)도 같은 방식으로 센다. 남은 작업은 NERV Task 키로, 이력은 PR 번호로
 * 바꾼다.
 *
 * 세는 범위는 `codebase-mentions.ts` 의 `OLD_SPEC_PATH` · `REMOVED_PLAN_PATH` 와 텍스트 파일
 * 확장자 목록이 정한다. `spec/` 없이 파일 이름만 적은 언급(`review-citations.md §3`)과 목록에 없는
 * 확장자의 파일은 세지 않는다.
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
 * 갱신 모드는 줄어든 값만 받는다. 늘어난 파일이 있으면 쓰지 않고 실패한다. 파일을 옮기거나
 * 나눠 언급이 다른 파일로 넘어간 경우에만 `LEGACY_PATH_RATCHET_UPDATE=grow` 로 늘어난 값까지
 * 쓰고, PR 본문에 그 이유를 적는다. 새로 적은 옛 경로를 기준값에 올리지 않는다. 옛 경로 대신
 * 키를 쓴다.
 *
 * 형제 래칫 `hardcoded-korean-ratchet.test.ts` 와 같이 CI 에서는 갱신을 거부하고, 파일 IO 는
 * `beforeAll` 에서 한다. 환경 변수 이름을 따로 둔 것은 `BASELINE_UPDATE=1` 로 전체 테스트를
 * 돌릴 때 이 기준값까지 함께 다시 쓰지 않게 하려는 것이다.
 */
const root = repoRoot();

const BASELINE_FILE = path.join(__dirname, "legacy-path-ratchet.baseline.json");
const BASELINE_REL = path.relative(root, BASELINE_FILE);
const UPDATE_ENV = process.env.LEGACY_PATH_RATCHET_UPDATE;
const UPDATE_MODE: "off" | "lower" | "grow" =
  UPDATE_ENV === "1" ? "lower" : UPDATE_ENV === "grow" ? "grow" : "off";
const UPDATE_COMMAND =
  "cd codebase/frontend && LEGACY_PATH_RATCHET_UPDATE=1 pnpm exec vitest run " +
  "src/lib/docs/__tests__/legacy-path-ratchet.test.ts";

/** 래칫이 세는 언급의 종류. 기준값 파일의 최상위 키와 같다. */
const CATEGORIES = {
  spec: OLD_SPEC_PATH,
  plan: REMOVED_PLAN_PATH,
} as const;
type Category = keyof typeof CATEGORIES;
const CATEGORY_NAMES = Object.keys(CATEGORIES) as Category[];

/** 늘어난 언급을 고치는 방법. 종류마다 다르다. */
const HOW_TO_FIX: Record<Category, string> = {
  spec:
    "옛 스펙 경로 대신 NERV 키와 절 제목을 쓴다(예: `CLE-API-ERRCODES` 「워크플로우 실행: 엔진 수준」). " +
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
 * 영구히 남는다(2026-10-03 기준 옛 스펙 경로 76개 파일 · 122줄, `plan/` 33개 파일 · 33줄). 옛
 * 트리를 지운 뒤에도 기준값이 0 이 되지 않는 이유다. 이 파일이 늘었다면 새 마이그레이션이 옛
 * 경로를 적은 것이다.
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

type Counts = Record<Category, Record<string, number>>;

interface Baseline extends Counts {
  _note: string;
}

const NOTE =
  "legacy-path-ratchet.test.ts 의 기준값. 손으로 고치지 말고 그 파일 머리의 명령으로 다시 쓴다.";

function countAll(): { fileCount: number; counts: Counts } {
  // 가드 자신의 파일(합성 입력과 이 기준값)은 `collectMentionFiles` 가 뺀다(`GUARD_SELF_FILES`).
  const files = collectMentionFiles(root);
  const counts = Object.fromEntries(
    CATEGORY_NAMES.map((cat) => [cat, sortedRecord(countByFile(files, CATEGORIES[cat]))]),
  ) as Counts;
  return { fileCount: files.length, counts };
}

function readBaseline(): Baseline {
  if (!fs.existsSync(BASELINE_FILE)) {
    throw new Error(`래칫 기준값 ${BASELINE_REL} 이 없다. LEGACY_PATH_RATCHET_UPDATE=1 로 만든다.`);
  }
  return JSON.parse(fs.readFileSync(BASELINE_FILE, "utf8")) as Baseline;
}

/** 마이그레이션 파일의 언급 합계. 영구히 남는 몫이라 줄지 않는다. */
function migrationTotal(rec: Readonly<Record<string, number>>): number {
  return Object.entries(rec)
    .filter(([file]) => MIGRATION_FILE.test(file))
    .reduce((sum, [, n]) => sum + n, 0);
}

function fmtDeltas(deltas: readonly RatchetDelta[]): string {
  return deltas.map((d) => `  ${d.file}: ${d.baseline} → ${d.actual}`).join("\n");
}

/** 늘어난 파일마다 기준값 → 실측과 고치는 방법. */
function fmtGrown(cat: Category, deltas: readonly RatchetDelta[]): string {
  return deltas
    .map((d) => `  ${d.file}: ${d.baseline} → ${d.actual}\n    ${fixHint(cat, d.file)}.`)
    .join("\n");
}

describe.runIf(UPDATE_MODE !== "off")("주석 속 옛 경로 래칫 기준값 갱신", () => {
  let counts: Counts;

  beforeAll(() => {
    // CI 에서 갱신 스위치가 켜지면 방금 쓴 값과 견주게 되어 래칫이 조용히 꺼진다.
    if (process.env.CI) {
      throw new Error(
        "LEGACY_PATH_RATCHET_UPDATE 는 로컬 전용이다. CI 에서는 기준값을 다시 쓰지 않는다. " +
          "로컬에서 다시 쓴 기준값을 커밋한다.",
      );
    }
    counts = countAll().counts;
    if (UPDATE_MODE === "lower" && fs.existsSync(BASELINE_FILE)) {
      const baseline = readBaseline();
      const grown = CATEGORY_NAMES.flatMap((cat) =>
        compareToBaseline(counts[cat], baseline[cat]).grown.map((d) => `[${cat}] ${d.file}`),
      );
      if (grown.length > 0) {
        throw new Error(
          `늘어난 파일이 있어 기준값을 쓰지 않았다. 옛 경로 대신 키를 쓴다.\n  ${grown.join("\n  ")}\n` +
            "파일을 옮기거나 나눈 것이면 LEGACY_PATH_RATCHET_UPDATE=grow 로 쓰고 PR 본문에 이유를 적는다.",
        );
      }
    }
    const next: Baseline = { _note: NOTE, ...counts };
    fs.writeFileSync(BASELINE_FILE, `${JSON.stringify(next, null, 2)}\n`);
  });

  it(`기준값을 다시 썼다 (${BASELINE_REL})`, () => {
    expect(readBaseline().spec).toEqual(counts.spec);
  });
});

describe.runIf(UPDATE_MODE === "off")("주석 속 옛 경로 래칫", () => {
  let fileCount = 0;
  let actual: Counts;
  let baseline: Baseline;

  // 수집 단계(`describe` 본문)에서 IO 가 터지면 테스트가 아니라 파일 전체가 깨진다.
  beforeAll(() => {
    ({ fileCount, counts: actual } = countAll());
    baseline = readBaseline();
  });

  it("codebase 텍스트 파일을 실제로 훑는다 (vacuity floor)", () => {
    expect(fileCount).toBeGreaterThan(MIN_SWEPT_FILES);
  });

  // 하한은 줄지 않는 몫(적용된 마이그레이션)에 건다. 전체 합계에 걸면 언급을 줄이는 정상
  // 작업이 쌓였을 때 이 테스트가 거짓으로 실패한다.
  it("옛 경로 언급을 실제로 센다 (vacuity floor, 적용된 마이그레이션의 영구 잔존분)", () => {
    expect(migrationTotal(actual.spec)).toBeGreaterThan(50); // 2026-10-03 실측 122줄
    expect(migrationTotal(actual.plan)).toBeGreaterThan(20); // 2026-10-03 실측 33줄
  });

  for (const cat of CATEGORY_NAMES) {
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
          `옛 ${cat} 경로 언급이 줄었는데 기준값이 그대로다(파일: 기준값 → 실측).\n` +
            `${fmtDeltas(shrunk)}\n기준값을 낮춘다: ${UPDATE_COMMAND}`,
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
    for (const cat of CATEGORY_NAMES) {
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
      "spec/1-data-model.md",
      // 확장자 없는 인용 · 줄 끝에서 끊긴 경로 · 영역 이름만 · 글로브도 옛 트리를 가리킨다.
      "SoT: spec/5-system/13-replay-rerun §7.2",
      "ConversationThread 에는 직접 mutate 하지 않는다 (spec/conventions/",
      "위젯 SPA (spec/7-channel-web-chat).",
      "spec/4-nodes/**.md",
    ]) {
      expect(OLD_SPEC_PATH.test(s), s).toBe(true);
    }
  });

  it("미러 경로 · 다른 낱말 · 옛 트리 밖 이름은 세지 않는다", () => {
    for (const s of [
      "spec/CLE-API/CLE-API-ERRCODES.md",
      "spec/CLE-VISION.md",
      "spec/README.md",
      "e2e-spec/5-system/foo.md",
      "foo.spec/conventions/x",
      "foo.spec.ts",
      "spec/guide.mdx",
      "spec/real.md",
      "spec/conventionsX/a.md",
      "spec/data-flowy",
      "review-citations.md §3",
    ]) {
      expect(OLD_SPEC_PATH.test(s), s).toBe(false);
    }
  });

  it("지운 plan 경로를 센다", () => {
    expect(REMOVED_PLAN_PATH.test("plan/in-progress/x.md")).toBe(true);
    expect(REMOVED_PLAN_PATH.test("`plan/complete/2026/y.md`")).toBe(true);
    expect(REMOVED_PLAN_PATH.test("plan/research/z.md")).toBe(true);
    expect(REMOVED_PLAN_PATH.test("execution-plan/in-progress/")).toBe(false);
    expect(REMOVED_PLAN_PATH.test("plan/other/")).toBe(false);
  });

  it("한 줄에 여러 번 나와도 1 줄로 센다", () => {
    const text = "spec/4-nodes/a.md 와 spec/5-system/b.md\n없음\nspec/conventions/c.md";
    expect(countMatchingLines(text, OLD_SPEC_PATH)).toBe(2);
  });

  it("전역 · sticky 정규식은 줄 단위 판정에 받지 않는다 (lastIndex 가 줄 사이에 남는다)", () => {
    expect(() => countMatchingLines("a\na", /a/g)).toThrow(/g · y 플래그/);
    expect(() => countMatchingLines("a\na", /a/y)).toThrow(/g · y 플래그/);
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

  it("마이그레이션 잔존분은 마이그레이션 파일만 더한다", () => {
    expect(
      migrationTotal({
        "codebase/backend/migrations/V001__a.sql": 2,
        "codebase/backend/migrations/V002__b.conf": 1,
        "codebase/backend/migrations/README.md": 5,
        "codebase/backend/src/a.ts": 7,
      }),
    ).toBe(3);
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

describe("훑는 파일 (임시 트리)", () => {
  let tmp = "";

  beforeAll(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), "codebase-mentions-"));
    for (const rel of [
      "codebase/a/b.md",
      "codebase/a/Dockerfile",
      "codebase/a/.env.example",
      "codebase/backend/migrations/V001__x.conf",
      "codebase/a/c.png",
      "codebase/a/d.lock",
      "codebase/node_modules/x.md",
      "codebase/.next/y.md",
      "codebase/dist/z.ts",
      "codebase/a/coverage/w.ts",
      [...GUARD_SELF_FILES][0],
      "codebase/frontend/src/lib/docs/__tests__/other.test.ts",
      "outside/q.md",
    ]) {
      const abs = path.join(tmp, rel);
      fs.mkdirSync(path.dirname(abs), { recursive: true });
      fs.writeFileSync(abs, "spec/4-nodes/x.md\n");
    }
  });

  afterAll(() => {
    if (tmp) fs.rmSync(tmp, { recursive: true, force: true });
  });

  it("텍스트 확장자 · Dockerfile 만 읽고 산출물 · 점 디렉터리 · 가드 자신의 파일 · codebase 밖은 뺀다", () => {
    const rels = collectMentionFiles(tmp)
      .map((f) => f.relPath)
      .sort();
    expect(rels).toEqual(
      [
        "codebase/a/.env.example",
        "codebase/a/Dockerfile",
        "codebase/a/b.md",
        "codebase/backend/migrations/V001__x.conf",
        "codebase/frontend/src/lib/docs/__tests__/other.test.ts",
      ].sort(),
    );
  });
});
