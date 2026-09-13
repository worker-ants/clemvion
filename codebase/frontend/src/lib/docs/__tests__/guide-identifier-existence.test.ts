import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

import { walkTree } from "./tree-walk";
import { collectMdxFiles, repoRoot } from "./impl-anchor-parse";
import {
  scanIdentifierCitations,
  collectSourceTokens,
  collectEnvDeclarations,
  collectQuotedLiterals,
  collectMessagePrefixes,
  collectCatalogCodes,
  isMessagePrefixOnly,
  computeNonEmittedOffenders,
  GUIDE_EXTERNAL_VOCABULARY,
  GUIDE_NON_EMITTED_VOCABULARY,
  type CitationAxis,
} from "./guide-identifier-scan";

/** 허용목록 상한 — 넘으면 통과가 아니라 **결정**을 강제한다. */
const EXTERNAL_VOCABULARY_CAP = 5;

/**
 * 발행-예외 목록 상한. 거울상 목록과 **같은 값**으로 둔다 — 두 목록은 제약이 반대일
 * 뿐 "예외가 늘면 설계를 다시 본다" 는 성격이 같다.
 */
const NON_EMITTED_VOCABULARY_CAP = 5;

/**
 * **유저 가이드가 이름 붙인 식별자는 실재해야 한다.**
 *
 * 에러 코드(`MAKESHOP_API_ERROR` 류)와 **환경변수**(`MCP_INSECURE_URL_ALLOWED` 류) 둘 다가
 * 대상이다. 후자는 `#1328` 이 손으로 고친 뒤 4개월간 아무도 몰랐던 클래스이고,
 * `#1330` 의 문맥-게이팅 축은 **그것을 못 잡았다**(스캐너 상단의 실측표).
 *
 * 가족·위치의 근거는 `spec/conventions/user-guide-evidence.md` 인데 **이 가드는 아직
 * 그 문서 §2 표에 없다**(등재는 planner 트래커 항목). 자매
 * `impl-anchor-existence.test.ts` 와 **방향이 같고(가이드 → 코드) 표면이 다르다**.
 */
const root = repoRoot();

const readIfPresent = (rel: string): string[] => {
  const abs = path.join(root, rel);
  return fs.existsSync(abs) ? [fs.readFileSync(abs, "utf8")] : [];
};
const envExampleTexts = [
  ...readIfPresent("codebase/backend/.env.example"),
  ...readIfPresent("codebase/frontend/.env.example"),
];

/**
 * `where` 필드에서 `파일.ts:줄` 참조를 **전부** 뽑는다. `a.ts:10·20` 처럼 같은 파일의
 * 여러 줄을 가운뎃점으로 잇는 표기도 받는다 — 실제 등록 항목이 그 형태를 쓴다.
 */
function parseWhereRefs(where: string): { file: string; line: number }[] {
  const out: { file: string; line: number }[] = [];
  for (const m of where.matchAll(/([\w./-]+\.ts):(\d+(?:·\d+)*)/g)) {
    const file = m[1];
    for (const n of m[2].split("·")) out.push({ file, line: Number(n) });
  }
  return out;
}

/**
 * 목록의 모든 항목이 **여전히 가이드에 인용되는지**. 두 목록이 같은 판정을 쓴다.
 *
 * **`staleGuideEntries` 로 이름을 바꿨다** — 첫 판은 `staleEntries` 였는데
 * `repo-guards/__tests__/internal-package-registration-guard.ts:129` 에 **export 된 동명
 * 함수**가 이미 있었고 시그니처가 다르다(`(string[], string[])` vs 여기)
 * (`--impl-done` `review/consistency/2026/09/13/20_34_48` naming_collision WARNING#5).
 * **이름을 정하기 전에 grep 하지 않은 것이 원인**이고, 이 저장소가 이미 적어 둔 규칙이다 —
 * *"새 식별자는 후보 토큰이 grep 0건임을 먼저 보여라."*
 */
function staleGuideEntries(
  list: readonly { token: string }[],
  cited: ReadonlySet<string>,
): string[] {
  return list.filter((e) => !cited.has(e.token)).map((e) => e.token);
}

/**
 * `basename` 으로 소스 파일을 찾아 줄 배열을 준다. **파일당 한 번만** 트리를 순회한다.
 *
 * 유일하게 특정되지 않으면(0건·2건 이상) `null` — 호출부가 그것을 결함으로 보고한다.
 */
const sourceLinesCache = new Map<string, string[] | null>();
function resolveSourceLines(file: string): string[] | null {
  const key = path.basename(file);
  const hit = sourceLinesCache.get(key);
  if (hit !== undefined) return hit;
  const found = walkTree(repoRoot(), ["codebase/backend/src"], {
    skipDir: (n) => n === "node_modules" || n === "dist" || n === "build",
    includeFile: (n) => n === key,
  });
  const value =
    found.length === 1
      ? fs.readFileSync(found[0].absPath, "utf8").split("\n")
      : null;
  sourceLinesCache.set(key, value);
  return value;
}

describe("유저 가이드 식별자 실재성 가드", () => {
  const mdxFiles = collectMdxFiles(root, "codebase/frontend/src/content/docs");

  // 기준집합 = 소스 토큰 ∪ env 선언처.
  // frontend 소스는 **넣지 않는다** — 넣으면 가이드가 인용한 이름이 프런트 라벨 맵으로
  // 자기를 증명한다(실측: 넣어도 오늘은 GREEN 이라 그 실수는 **조용히** 통과한다).
  const sourceTexts = walkTree(root, ["codebase/backend/src", "codebase/packages"], {
    skipDir: (name) => name === "node_modules" || name === "dist" || name === "build",
    includeFile: (name) => name.endsWith(".ts"),
  }).map((f) => fs.readFileSync(f.absPath, "utf8"));

  // **`docker-compose*` 로 좁힌다.** 종전 판은 루트의 모든 `.yml`/`.yaml` 을 읽어
  // `pnpm-lock.yaml`(784KB)·`pnpm-workspace.yaml` 까지 매 실행마다 정규식 스캔했다 —
  // 오늘 매치는 0건이라 무해했지만 **이름과 JSDoc 이 약속한 범위보다 구현이 넓었다**.
  // (`#1330` 이 "문서한 보장이 구현보다 넓으면 안 된다" 를 배운 것의 거울상 — 이번엔
  // 구현이 이름보다 넓다. 어느 쪽이든 다음 사람이 틀린 것을 믿게 된다.)
  const composeTexts = fs
    .readdirSync(root)
    .filter((f) => /^docker-compose.*\.ya?ml$/.test(f))
    .map((f) => fs.readFileSync(path.join(root, f), "utf8"));

  const sourceTokens = collectSourceTokens(sourceTexts);
  const envTokens = collectEnvDeclarations(envExampleTexts, composeTexts);
  const basis = new Set([...sourceTokens, ...envTokens]);

  const citations = mdxFiles.flatMap((abs) =>
    scanIdentifierCitations(fs.readFileSync(abs, "utf8")).map((c) => ({
      ...c,
      file: path.relative(root, abs),
    })),
  );

  const allowed = new Set(GUIDE_EXTERNAL_VOCABULARY.map((e) => e.token));

  // ── 발행 축 ────────────────────────────────────────────────────────────────
  // 기준집합과 **다른 소스 뷰**를 쓴다: 기준집합은 "이 이름이 어디든 있나" 를, 이쪽은
  // "따옴표가 토큰만 감쌌나 / 접두로만 붙나" 를 본다. 같은 `sourceTexts` 를 재사용한다.
  const quotedLiterals = collectQuotedLiterals(sourceTexts);
  const messagePrefixes = collectMessagePrefixes(sourceTexts);
  const catalogCodes = collectCatalogCodes([
    fs.readFileSync(
      path.join(root, "spec/5-system/3-error-handling.md"),
      "utf8",
    ),
  ]);
  const registeredNonEmitted = new Set(
    GUIDE_NON_EMITTED_VOCABULARY.map((e) => e.token),
  );

  /** 정본(`guide-identifier-scan.ts`)을 이 코퍼스에 묶은 얇은 래핑. */
  const prefixOnly = (token: string): boolean =>
    isMessagePrefixOnly(token, messagePrefixes, quotedLiterals);

  /** 판정 정본에 넘길 네 집합. 베이스라인과 대조군이 **같은 번들**을 쓴다. */
  const sets = {
    messagePrefixes,
    quotedLiterals,
    catalogCodes,
    registered: registeredNonEmitted,
  };

  // ── vacuity floors ──────────────────────────────────────────────────────────
  it("코퍼스를 실제로 적재한다 (vacuity floor)", () => {
    expect(mdxFiles.length).toBeGreaterThan(50); // 실측 92
    expect(sourceTexts.length).toBeGreaterThan(500);
    expect(sourceTokens.size).toBeGreaterThan(800); // 실측 1,743종
    // 두 source root 가 **각각** 적재됐음을 데이터로 — 합계만 보면 한쪽 오타가 묻힌다.
    expect(sourceTokens.has("MODEL_CONFIG_NOT_FOUND")).toBe(true); // backend/src
    expect(sourceTokens.has("EXPR_SYNTAX_ERROR")).toBe(true); //     packages
  });

  it("env 선언처 수집기가 살아 있다 (오늘 판정은 지탱하지 않는다)", () => {
    // **이 floor 는 "병합이 일을 한다" 를 주장하지 않는다** — 뮤턴트로 확인했듯 이 병합을
    // 통째로 빼도 스위트는 GREEN 이다(가이드가 인용하는 env 변수 8종이 전부 소스에도 있다).
    // 여기서 고정하는 것은 **수집기가 조용히 0종을 돌려주지 않는다**는 것뿐이다.
    // 병합을 남기는 이유는 내일의 오탐 방지 — 스캐너 docstring 참조.
    const envOnly = [...envTokens].filter((t) => !sourceTokens.has(t));
    expect(envOnly.length).toBeGreaterThan(5); // 실측 21종
    expect(envTokens.has("POSTGRES_PASSWORD")).toBe(true); // compose 주입 전용
    // 오늘 인용되는 env-only 토큰은 0종이라는 사실 자체를 고정한다 — 훗날 1종이 되면
    // 이 단언이 RED 가 되고, 그때 병합이 **실제로** 지탱하기 시작했다는 신호다.
    const citedTokens = new Set(citations.map((c) => c.token));
    expect(envOnly.filter((t) => citedTokens.has(t))).toEqual([]);
  });

  it("실제 코퍼스의 특정 파일·토큰을 이름으로 고정한다", () => {
    // **총량 floor 는 개별 토큰 하나가 사라져도 통과한다.** `#1330` 스위트에는 이런 명명
    // 회귀 단언이 있었는데 이번 재작성에서 전부 합성 fixture 로 갈아치우며 사라졌다
    // (`/ai-review` `review/code/2026/09/13/14_41_14` testing WARNING#6).
    // 좁은 회귀 형태를 이름으로 되돌린다.
    const discord = citations.filter(
      (c) => c.file.endsWith("discord.en.mdx") && c.axis === "backtick",
    );
    expect(discord.map((c) => c.token)).toContain("EXECUTION_TIMEOUT");

    // env 변수 축도 실제 파일로 고정 — 이 가드가 넓어진 **이유**가 env 축이다.
    const mcp = citations.filter((c) => c.file.endsWith("mcp-servers.mdx"));
    expect(mcp.map((c) => c.token)).toContain("MCP_ALLOW_INSECURE_URL");
  });

  it("세 축이 모두 후보를 낸다 (축이 조용히 죽는 것 방지)", () => {
    const byAxis = (axis: CitationAxis): number =>
      citations.filter((c) => c.axis === axis).length;
    expect(byAxis("field-table")).toBeGreaterThan(10);
    expect(byAxis("code-field")).toBeGreaterThan(0);
    expect(byAxis("backtick")).toBeGreaterThan(100);
  });

  // ── baseline ────────────────────────────────────────────────────────────────
  it("가이드가 적은 모든 식별자가 실재한다 (베이스라인 0)", () => {
    const missing = citations.filter(
      (c) => !basis.has(c.token) && !allowed.has(c.token),
    );
    expect(
      missing.map((c) => `${c.file}:${c.line} [${c.axis}] ${c.token}`),
    ).toEqual([]);
  });

  // ── 발행 축 (베이스라인) ────────────────────────────────────────────────────
  describe("발행 축 — 가이드가 «코드» 로 부르는 것이 코드인가", () => {
    it("접두 전용이면서 카탈로그에도 없는 인용은 **등록돼 있다** (베이스라인 0)", () => {
      // **정본을 부른다.** 종전엔 이 자리에서 `.filter(...)` **세 개**를 손으로 이어 붙였고,
      // 아래 `[한계]`·`[대조군]` 은 그것과 **분리된 병렬 구현**이었다 — 그래서 실제 체인에서
      // 카탈로그 필터를 지워도 71/71 GREEN 이었다
      // (`review/code/2026/09/13/20_57_13` testing WARNING#1, 리뷰어가 뮤테이션으로 관측).
      expect(computeNonEmittedOffenders(citations.map((c) => c.token), sets)).toEqual([]);
    });

    it("[vacuity] 세 수집기가 실제로 뭔가를 걷었다", () => {
      // 셋 중 하나가 빈 집합이면 위 단언이 **아무것도 안 보고** 통과한다.
      expect(quotedLiterals.size).toBeGreaterThan(200); // 실측 다수
      expect(messagePrefixes.size).toBeGreaterThan(3);
      expect(catalogCodes.size).toBeGreaterThan(50); // 실측 카탈로그 규모
    });

    it("등록된 3종이 **실제로 접두 전용**이다 (죽은 등록 방지)", () => {
      // 등록만 해 두고 실제로는 발행되기 시작하면 이 항목은 **거짓말**이 된다.
      // 그때 이 단언이 RED 로 알리고, 항목을 지우라는 신호가 된다.
      const notActuallyPrefixOnly = GUIDE_NON_EMITTED_VOCABULARY.filter(
        (e) => !prefixOnly(e.token),
      );
      expect(notActuallyPrefixOnly.map((e) => e.token)).toEqual([]);
    });

    it("등록된 3종이 **기준집합에 있다** (외부 어휘 목록과 제약이 반대)", () => {
      // `GUIDE_EXTERNAL_VOCABULARY` 는 *"기준집합에 없을 것"*, 이쪽은 *"있을 것"*.
      // 제약이 정확히 반대라 두 목록은 합칠 수 없다 — 합치면 예외 하나가 두 축을 덮는다.
      const notInBasis = GUIDE_NON_EMITTED_VOCABULARY.filter(
        (e) => !basis.has(e.token),
      );
      expect(notInBasis.map((e) => e.token)).toEqual([]);
    });

    it("각 항목이 **어디서** 접두가 붙는지와 사유를 밝힌다", () => {
      for (const entry of GUIDE_NON_EMITTED_VOCABULARY) {
        expect(entry.where.trim().length).toBeGreaterThan(10);
        expect(entry.why.trim().length).toBeGreaterThan(30);
      }
    });

    it("`where` 의 `파일:줄` 이 **실제로 그 토큰을 담는다** (프리텍스트 방지)", () => {
      // `/ai-review`(`review/code/2026/09/13/19_23_22` testing WARNING#6):
      // `where` 가 단언 없는 산문이면
      // 소스가 움직여도 아무도 모른다. 이 저장소는 자매 축(`impl-anchor-existence`)에서
      // 이미 grep 강제를 쓰고 있어 **이 목록만 예외였다**.
      // **첫 판은 `.exec()` 단일 매치였다** — `where` 가 `파일:7121·7125` 처럼 **여러
      // 위치**를 인용하면 **둘째부터 한 번도 검증되지 않았다**. 리뷰어가 둘째 줄 번호를
      // 없는 값으로 바꾸는 뮤테이션으로 63/63 GREEN 을 관측해 증명했다
      // (`review/code/2026/09/13/19_51_33` testing WARNING#2).
      // 지금은 `where` 안의 **모든** 위치를 걷는다.
      const broken: string[] = [];
      for (const entry of GUIDE_NON_EMITTED_VOCABULARY) {
        const refs = parseWhereRefs(entry.where);
        if (refs.length === 0) {
          broken.push(`${entry.token}: where 에 '파일.ts:줄' 이 없다 — ${entry.where}`);
          continue;
        }
        for (const { file, line: lineNo } of refs) {
          // **파일당 한 번만 순회한다.** 종전엔 참조마다 `backend/src` 1,304 파일을 다시
          // 걸었고, 등록 3항목·참조 4개 중 **3개가 같은 파일**이었다
          // (`/ai-review` `review/code/2026/09/13/21_19_46` performance WARNING#1).
          // 등록이 늘어나는 방향의 설계라 배율이 함께 커진다.
          const lines = resolveSourceLines(file);
          if (lines === null) {
            broken.push(`${entry.token}: ${file} 을 유일하게 특정할 수 없다`);
            continue;
          }
          const src = lines[lineNo - 1] ?? "";
          if (!src.includes(entry.token)) {
            broken.push(
              `${entry.token}: ${file}:${lineNo} 에 토큰이 없다 — ${src.trim().slice(0, 60)}`,
            );
          }
        }
      }
      expect(broken).toEqual([]);
    });

    it("[대조군] `parseWhereRefs` 가 `파일:줄·줄` 의 **모든** 위치를 낸다", () => {
      // 위 단언이 «전부» 를 본다는 주장을 파서 단에서 고정한다 — 단일 매치로 되돌리는
      // 뮤턴트가 여기서 바로 갈린다.
      expect(parseWhereRefs("a.ts:10 — 설명")).toEqual([{ file: "a.ts", line: 10 }]);
      expect(parseWhereRefs("a.ts:10·20 — 설명")).toEqual([
        { file: "a.ts", line: 10 },
        { file: "a.ts", line: 20 },
      ]);
      expect(parseWhereRefs("a.ts:10 · b.ts:30")).toEqual([
        { file: "a.ts", line: 10 },
        { file: "b.ts", line: 30 },
      ]);
      expect(parseWhereRefs("줄 번호 없는 산문")).toEqual([]);
    });

    it(`상한 ${NON_EMITTED_VOCABULARY_CAP}건을 넘지 않는다`, () => {
      // 거울상 목록(`GUIDE_EXTERNAL_VOCABULARY`)과 강제 수준을 맞춘다 — 상한이 없으면
      // *"한 줄 더 추가"* 가 기본값이 되고, 이 목록은 **가이드가 코드 아닌 것을 코드처럼
      // 부르는 것을 막으려고** 있는데 그 반대가 된다.
      expect(GUIDE_NON_EMITTED_VOCABULARY.length).toBeLessThanOrEqual(
        NON_EMITTED_VOCABULARY_CAP,
      );
    });

    it("각 항목이 **여전히 가이드에 인용된다** (죽은 항목 누적 방지)", () => {
      // 거울상 목록의 같은 강제. 가이드 문장이 재작성돼 인용이 사라지면 항목도 지운다.
      // **판정은 두 목록이 공유한다** — 직전 라운드에서 수집기 중복을 없애면서 이쪽에
      // 같은 클래스의 중복을 새로 만들었다
      // (`review/code/2026/09/13/19_51_33` maintainability WARNING#4).
      const cited = new Set(citations.map((c) => c.token));
      expect(staleGuideEntries(GUIDE_NON_EMITTED_VOCABULARY, cited)).toEqual([]);
    });

    it(`[vacuity] 목록이 비면 위 3강제가 전부 무의미해진다`, () => {
      expect(GUIDE_NON_EMITTED_VOCABULARY.length).toBeGreaterThan(0);
    });

    it("[회귀] `MAX_ITERATIONS_EXCEEDED` 는 **소비자-인용 때문에** 통과한다 (카탈로그 아님)", () => {
      // **첫 판 제목은 "카탈로그 덕에 통과한다" 였고 그것은 거짓이었다**
      // (`/ai-review` `review/code/2026/09/13/19_23_22` requirement WARNING#3 · 직접 재현).
      // 단계별 실측이 실제 경로를 보여준다:
      expect(messagePrefixes.has("MAX_ITERATIONS_EXCEEDED")).toBe(true);
      // ↓ `execution-failure-classifier.ts:76` 의 **소비자 Set** 이 정확 리터럴로 인용한다.
      expect(quotedLiterals.has("MAX_ITERATIONS_EXCEEDED")).toBe(true);
      // ⇒ 접두-전용 단계에서 탈락하므로 **카탈로그 검사에 도달하지 않는다.**
      expect(prefixOnly("MAX_ITERATIONS_EXCEEDED")).toBe(false);
      // 카탈로그에 있는 것은 사실이지만 **통과 근거가 아니다.** 그 구분이 이 테스트다.
      expect(catalogCodes.has("MAX_ITERATIONS_EXCEEDED")).toBe(true);

      // 대조 — `CONTAINER_MISSING_EMIT` 는 소비자 인용이 없어 접두-전용으로 남고,
      // 카탈로그에도 없어 등록이 필요했다. 두 토큰이 갈리는 자리가 정확히 여기다.
      expect(prefixOnly("CONTAINER_MISSING_EMIT")).toBe(true);
      expect(catalogCodes.has("CONTAINER_MISSING_EMIT")).toBe(false);
    });

    it("[한계] 카탈로그 탈출구는 **오늘 한 번도 발화하지 않는다**", () => {
      // 전수 실측: 인용된 «접두 전용» 중 카탈로그 등재 0종. 즉 이 필터는 현재 죽은
      // 경로다 — 그 사실을 숨기지 않고 **숫자로 고정**한다.
      //
      // 그래도 지우지 않는 이유: 트래커의 planner 항목이 *"`CONTAINER_*` 를 §1.4 에
      // backfill"* 을 처분안으로 담고 있고, 집행되면 이 탈출구가 발화해 등록 2종이
      // 자동으로 불필요해진다. 지우면 그 처분안 서술이 거짓이 된다.
      //
      // **언젠가 이 수가 0이 아니게 되면 이 단언이 RED 로 알린다** — 그때는 등록 항목을
      // 지울 수 있다는 신호다.
      // **정본으로 센다** — 카탈로그를 비운 집합으로 한 번 더 돌려, 그 차이가 곧
      // «탈출구가 구한 토큰» 이다. 손 계산이 아니라 판정 함수 자신의 출력 차이다.
      const withCatalog = computeNonEmittedOffenders(
        citations.map((c) => c.token),
        { ...sets, registered: new Set<string>() },
      );
      const withoutCatalog = computeNonEmittedOffenders(
        citations.map((c) => c.token),
        { ...sets, catalogCodes: new Set<string>(), registered: new Set<string>() },
      );
      const rescuedByCatalog = withoutCatalog.filter(
        (t) => !withCatalog.includes(t),
      );
      expect(rescuedByCatalog).toEqual([]);
    });

    it("[대조군] 그래도 탈출구가 **작동은 한다** (합성 입력)", () => {
      // 위 단언이 «0» 인 이유가 *"필터가 깨져서"* 가 아니라 *"오늘 해당이 없어서"* 임을
      // 가른다. 합성 카탈로그로 같은 판정을 돌려 본다.
      const synthCatalog = collectCatalogCodes([
        "| `SYNTH_PREFIX_ONLY` | 없음 | 합성 카탈로그 행 |",
      ]);
      expect(synthCatalog.has("SYNTH_PREFIX_ONLY")).toBe(true);
      const synthPrefixes = collectMessagePrefixes([
        "throw new Error('SYNTH_PREFIX_ONLY: 설명');",
      ]);
      const synthQuoted = collectQuotedLiterals([
        "throw new Error('SYNTH_PREFIX_ONLY: 설명');",
      ]);
      // 접두 전용이고 — 카탈로그에 있으므로 offender 가 **아니다**.
      expect(synthPrefixes.has("SYNTH_PREFIX_ONLY")).toBe(true);
      expect(synthQuoted.has("SYNTH_PREFIX_ONLY")).toBe(false);
      expect(synthCatalog.has("SYNTH_PREFIX_ONLY")).toBe(true);
    });
  });

  it("[회귀] 혼합 백틱 스팬에만 등장하는 6종도 **검사받는다**", () => {
    // **이 6종은 이 가드의 검사를 한 번도 받은 적이 없었다.** 첫 판 `BACKTICK` 은 백틱과
    // 토큰이 **붙어 있을 때만** 매치돼, 스팬에 다른 글자가 섞이면 통째로 빠졌다
    // (`/ai-review` `review/code/2026/09/13/16_56_29` requirement CRITICAL · 직접 전수 재현).
    //
    // 베이스라인-0 은 이것을 **원리적으로 관측할 수 없다** — 인용으로 걷히지 않은 토큰은
    // 애초에 `missing` 후보가 아니기 때문이다. 그래서 이름으로 고정한다.
    //
    // 리뷰어는 5종을 들었고 전수로 다시 세니 `NODE_ENV` 가 하나 더 있었다.
    const ONLY_IN_MIXED_SPANS = [
      "ALLOW_HTTP_HOOKS", // `ALLOW_HTTP_HOOKS=1`
      "INVALID_FIELD", // `details.code='INVALID_FIELD'`
      "MAKESHOP_UNRESOLVED_PATH_PARAM", // `MAKESHOP_UNRESOLVED_PATH_PARAM: operation …`
      "NODE_ENV", // `NODE_ENV=production`
      "PARALLEL_ENGINE", // `PARALLEL_ENGINE=v1`
      "UNKNOWN_PLACEHOLDER", // `details.code='UNKNOWN_PLACEHOLDER'`
    ];
    const citedByBacktick = new Set(
      citations.filter((c) => c.axis === "backtick").map((c) => c.token),
    );
    expect(
      ONLY_IN_MIXED_SPANS.filter((t) => !citedByBacktick.has(t)),
    ).toEqual([]);
    // 그리고 실제로 판정까지 간다 — 걷히기만 하고 기준집합 대조를 못 받으면 의미가 없다.
    expect(ONLY_IN_MIXED_SPANS.filter((t) => !basis.has(t))).toEqual([]);
  });

  // ── 허용목록 4강제 ──────────────────────────────────────────────────────────
  describe("외부 어휘 허용목록 — 은폐 수단이 되지 않도록", () => {
    it("[vacuity] 배열이 비면 아래 3강제가 **전부 무의미**해진다 — 하한을 명시한다", () => {
      // `/ai-review`(`review/code/2026/09/13/16_56_29` testing WARNING#2)가 배열을 `[]` 로
      // 비우는 뮤테이션을 걸었더니 이 describe 의 4강제 중 **상한 검사만** 살아남았다 —
      // 나머지 셋은 `for`·`filter` 라 빈 배열에서 참이다.
      //
      // 그때 그 뮤턴트가 그래도 잡힌 것은 **이 블록 덕분이 아니라** 무관한 베이스라인-0
      // 테스트가 우연히 잡아준 것이었다(`discord.mdx` 의 `MESSAGE_CREATE` 인용이
      // 허용목록에서 빠지니 RED). 코퍼스가 바뀌면 그 안전망도 같이 사라진다.
      expect(GUIDE_EXTERNAL_VOCABULARY.length).toBeGreaterThan(0);
    });

    it("각 항목이 외부 시스템과 사유를 밝힌다", () => {
      for (const entry of GUIDE_EXTERNAL_VOCABULARY) {
        expect(entry.system.trim().length).toBeGreaterThan(2);
        expect(entry.why.trim().length).toBeGreaterThan(20);
      }
    });

    it(`상한 ${EXTERNAL_VOCABULARY_CAP}건을 넘지 않는다`, () => {
      // 넘으면 "한 줄 더 추가" 가 아니라 **왜 외부 어휘가 이렇게 많은가** 를 묻게 한다.
      expect(GUIDE_EXTERNAL_VOCABULARY.length).toBeLessThanOrEqual(
        EXTERNAL_VOCABULARY_CAP,
      );
    });

    it("각 항목이 **여전히 가이드에 인용된다** (죽은 항목 누적 방지)", () => {
      const cited = new Set(citations.map((c) => c.token));
      expect(staleGuideEntries(GUIDE_EXTERNAL_VOCABULARY, cited)).toEqual([]);
    });

    it("각 항목이 **기준집합에 없다** (우리 것이 되면 항목이 강제 제거된다)", () => {
      // 이 단언이 없으면 실재하는 식별자를 허용목록에 넣어 다른 결함을 덮을 수 있다.
      const ours = GUIDE_EXTERNAL_VOCABULARY.filter((e) => basis.has(e.token));
      expect(ours.map((e) => e.token)).toEqual([]);
    });
  });

  // ── 과거 결함 재현 ──────────────────────────────────────────────────────────
  describe("이 가드를 만들게 한 과거 결함 (#1328)", () => {
    // `#1328` 이 손으로 고친 환경변수 오기. 이 가드의 **존재 이유**이므로 합성으로 고정한다.
    const BROKEN =
      '  { name: "None", type: "Auth", required: "Optional", description: "Plain-HTTP URLs are only allowed when `MCP_INSECURE_URL_ALLOWED` is enabled — otherwise calls are blocked." }';
    const FIXED = BROKEN.replace(
      "MCP_INSECURE_URL_ALLOWED",
      "MCP_ALLOW_INSECURE_URL",
    );

    it("오기를 잡는다", () => {
      const hits = scanIdentifierCitations(BROKEN);
      const tok = hits.find((h) => h.token === "MCP_INSECURE_URL_ALLOWED");
      expect(tok?.axis).toBe("backtick");
      expect(basis.has("MCP_INSECURE_URL_ALLOWED")).toBe(false);
    });

    it("정정된 이름은 통과한다", () => {
      const hits = scanIdentifierCitations(FIXED);
      expect(hits.some((h) => h.token === "MCP_ALLOW_INSECURE_URL")).toBe(true);
      expect(basis.has("MCP_ALLOW_INSECURE_URL")).toBe(true);
    });

    it("[회귀] `#1330` 의 문맥-게이팅 축이었다면 **놓쳤다**", () => {
      // 이 케이스가 이 가드가 넓어진 이유다. 누가 다시 문맥으로 좁히면 위 "오기를 잡는다"
      // 가 RED 가 되는데, **왜** RED 인지는 여기 적혀 있어야 추적된다.
      //
      // `#1330` 의 실패-문맥 게이트는 **지금 코드에 없다**(backtick 축이 대체했다). 정본이
      // 없으므로 손 사본 말고는 재현할 방법이 없어 리터럴로 둔다 — 대신 이것이 "옛 판본" 임을
      // 이름으로 못박는다.
      const REMOVED_1330_CODE_CONTEXT =
        /error\.code|error code|에러 코드|\bfail(?:s|ed|ure)?\b|실패|\berror\b|오류|timed out|시간 초과|rate limit|요청 한도|returns \d{3}/i;
      expect(REMOVED_1330_CODE_CONTEXT.test(BROKEN)).toBe(false);
    });

    it("[회귀] `field-table` 축도 이 줄을 **못 잡는다** (정본 스캐너로 확인)", () => {
      // 종전 판은 `FIELD_TABLE_NAME` 정규식을 이 파일에 **손으로 재복제**해 단언했다.
      // `/ai-review`(`review/code/2026/09/13/16_28_47` maintainability INFO#6)가 그 사본이
      // 조용히 낡을 수 있다고 지적했다 — 맞다. 그리고 이쪽 축은 `#1330` 의 문맥 게이트와
      // 달리 **정본이 살아 있다**. 사본에 이름표를 붙이는 대신 **정본을 실행**한다:
      // `UPPER_SNAKE` 정의가 바뀌면 이 단언이 함께 따라간다.
      const axes = scanIdentifierCitations(BROKEN).map((h) => h.axis);
      expect(axes).not.toContain("field-table");
      // 대조군 — 이 단언이 "스캐너가 아무것도 안 잡아서" 참이 되는 것을 막는다.
      expect(axes).toContain("backtick");
    });
  });
});

/**
 * `collectEnvDeclarations` 의 분기를 **합성 입력**으로 겨눈다.
 *
 * `/ai-review`(`review/code/2026/09/13/15_03_06`) testing WARNING: 주석 처리된 선언
 * (`#SOME_VAR=`)을 받는 `^#?` 분기가 **완전히 무검증**이었다 — 리뷰어가 `#?` 를 지우는
 * 뮤테이션을 걸었는데 19/19 가 그대로 GREEN 이었다.
 *
 * **실측으로 이유까지 확인했다**: `.env.example` 에 주석 처리된 선언이 **19건 실재**하지만
 * (`# ENABLE_SWAGGER_IN_PROD=false` 등) 그 19종이 **전부 소스에도** 있어(`process.env.X`)
 * 기준집합 합계가 바뀌지 않았다. 즉 분기는 일을 하는데 **아무도 그 일에 의존하지 않아서**
 * 죽어도 티가 안 났다. 코퍼스 의존 단언만으로는 이 분기를 영원히 못 겨눈다.
 */
describe("collectSourceTokens — 경계 대조군", () => {
  // 세 exported 함수 중 **유일하게** 합성 대조군이 없었다(`/ai-review`
  // `review/code/2026/09/13/16_04_15` testing WARNING#3). `\b` 를 지우는 뮤턴트가 26/26
  // GREEN 으로 생존했다 — 형제 둘은 라운드 2·4 에서 같은 클래스로 대조군을 얻었는데
  // 세 번째만 빠진 불균등이었다.
  it("워드 경계 안쪽의 부분 문자열은 안 센다", () => {
    // 이 방향이 위험하다 — 기준집합이 부풀면 가짜 토큰이 **우연히** 통과한다(거짓 PASS).
    expect([...collectSourceTokens(["const xMY_TOKEN = 1;"])]).toEqual([]);
    expect([...collectSourceTokens(["prefixFOO_BAR"])]).toEqual([]);
  });

  it("독립된 토큰은 센다", () => {
    expect([...collectSourceTokens(["const MY_TOKEN = 1;"])]).toEqual(["MY_TOKEN"]);
    expect([...collectSourceTokens(["process.env.SOME_FLAG"])]).toEqual(["SOME_FLAG"]);
  });

  it("긴 토큰은 통째로 센다 (내부 조각을 따로 세지 않는다)", () => {
    expect([...collectSourceTokens(["FOO_BAR_BAZ"])]).toEqual(["FOO_BAR_BAZ"]);
  });

  it("여러 텍스트에 걸친 중복은 한 번만", () => {
    expect([...collectSourceTokens(["A_B", "A_B", "C_D"])].sort()).toEqual([
      "A_B",
      "C_D",
    ]);
  });

  it("[비대상] 밑줄 없는 약어는 안 센다", () => {
    expect([...collectSourceTokens(["const LLM = 1; const HTTP = 2;"])]).toEqual([]);
  });
});

describe("resolveSourceLines — 유일성 가드", () => {
  // `/ai-review`(`review/code/2026/09/13/21_41_23` testing WARNING#2): 라운드 6 이 넣은
  // 캐시의 `found.length === 1` 가드에 **판별 fixture 가 없었다** — 리뷰어가 `>= 1` 로
  // 바꾸는 뮤테이션으로 76/76 GREEN 생존을 관측했다.
  //
  // 내가 라운드 6 에 돌린 뮤턴트는 *"파일명을 없는 것으로"*(0건 분기)였고, **2건 이상**
  // 분기는 겨누지 못했다. 이 파일이 네 번째로 밟는 «헬퍼 테스트 ≠ 호출부 테스트» 다.
  //
  // 다중 매치는 가상이 아니다 — `backend/src` 에 `index.ts` 가 **46개** 있다(실측).
  // 등록이 늘어 그런 basename 을 가리키면 **조용히 엉뚱한 파일**을 읽게 된다.
  it("[0건] 없는 basename 은 null", () => {
    expect(resolveSourceLines("definitely-not-a-real-file.ts")).toBeNull();
  });

  it("[2건 이상] 다중 매치도 null — 아무거나 고르지 않는다", () => {
    expect(resolveSourceLines("index.ts")).toBeNull();
  });

  it("[1건] 유일하면 줄 배열을 준다 (대조군)", () => {
    const lines = resolveSourceLines("execution-engine.service.ts");
    expect(lines).not.toBeNull();
    expect(lines!.length).toBeGreaterThan(1000);
  });
});

describe("computeNonEmittedOffenders — 네 항이 각각 무는가", () => {
  // **정본으로 합치는 것만으로는 부족했다.** 리뷰어가 카탈로그 필터 한 줄을 지워
  // 71/71 GREEN 을 관측했고(`review/code/2026/09/13/20_57_13` testing WARNING#1),
  // 제안대로 판정을 정본 하나로 모은 뒤 **같은 뮤턴트를 다시 걸었더니 여전히 생존**했다.
  //
  // 이유는 테스트 구조가 아니라 **데이터**다 — 그 필터는 오늘 실코퍼스에서 **한 번도
  // 발화하지 않는다**(«접두 전용 ∩ 카탈로그» = 공집합, 라운드 1 실측). 즉 실코퍼스로는
  // 어떤 테스트도 그 뮤턴트를 잡을 수 없다. **합성 입력만이 두 판정을 가른다.**
  const T = "SYNTH_TOKEN";
  const base = {
    messagePrefixes: new Set([T]),
    quotedLiterals: new Set<string>(),
    catalogCodes: new Set<string>(),
    registered: new Set<string>(),
  };

  it("접두 전용 + 카탈로그 없음 + 미등록 → offender", () => {
    expect(computeNonEmittedOffenders([T], base)).toEqual([T]);
  });

  it("[카탈로그 항] 카탈로그에 있으면 offender 가 아니다", () => {
    // 이 케이스가 **카탈로그 필터를 지우는 뮤턴트와 갈리는 유일한 값**이다.
    expect(
      computeNonEmittedOffenders([T], { ...base, catalogCodes: new Set([T]) }),
    ).toEqual([]);
  });

  it("[등록 항] 등록돼 있으면 offender 가 아니다", () => {
    expect(
      computeNonEmittedOffenders([T], { ...base, registered: new Set([T]) }),
    ).toEqual([]);
  });

  it("[접두-전용 항] 토큰-단독 리터럴이 있으면 offender 가 아니다", () => {
    expect(
      computeNonEmittedOffenders([T], { ...base, quotedLiterals: new Set([T]) }),
    ).toEqual([]);
  });

  it("[인용 항] 인용되지 않은 토큰은 애초에 후보가 아니다", () => {
    expect(computeNonEmittedOffenders([], base)).toEqual([]);
  });
});

describe("staleGuideEntries — 판별 대조군", () => {
  // `/ai-review`(`review/code/2026/09/13/20_13_13` testing WARNING#2): 이 헬퍼는 두
  // 호출부 모두 실코퍼스 베이스라인-0(`toEqual([])`)으로만 검증돼, **필터 방향이 뒤집혀도**
  // 목록이 커지기 전까지는 우연히만 잡힌다. 같은 파일이 다른 신규 함수 전부에 적용한
  // 규율(«두 판정이 갈리는 값을 고정») 을 이 1줄 함수만 비켜 갔다.
  it("인용되지 않은 항목을 낸다", () => {
    expect(staleGuideEntries([{ token: "NOT_CITED" }], new Set(["OTHER"]))).toEqual([
      "NOT_CITED",
    ]);
  });

  it("인용된 항목은 내지 않는다", () => {
    expect(staleGuideEntries([{ token: "CITED" }], new Set(["CITED"]))).toEqual([]);
  });

  it("[경계] 빈 목록은 빈 결과 — 단언이 vacuous 해지는 자리", () => {
    // 두 호출부가 `toEqual([])` 를 쓰므로, 목록이 비면 통과한다. 그 자리는 각 목록의
    // **상한·하한 강제**가 따로 막는다(`…_CAP` · `length > 0`).
    expect(staleGuideEntries([], new Set(["ANY"]))).toEqual([]);
  });
});

describe("isMessagePrefixOnly — 진리표 대조군", () => {
  // `/ai-review`(`review/code/2026/09/13/19_51_33` testing WARNING#3): 이 술어가 테스트
  // 파일 안의 지역 클로저라 **진리표를 직접 겨눌 수 없었다**. AND 항을 지우는 뮤턴트는
  // RED 를 내지만 *"offender 8종 폭증"* 이라는 뭉툭한 진단이고, `(F,T)`·`(F,F)` 는
  // 실제 코퍼스에 없어 **어떤 테스트도 관측하지 않았다**.
  const P = (p: string[], q: string[]) => (t: string) =>
    isMessagePrefixOnly(t, new Set(p), new Set(q));

  it("(접두 O, 리터럴 X) → true — 접두 전용", () => {
    expect(P(["A_ONE"], [])("A_ONE")).toBe(true);
  });

  it("(접두 O, 리터럴 O) → false — 소비자·분류기가 인용한다", () => {
    // 실제 코퍼스의 `MAX_ITERATIONS_EXCEEDED` 가 이 칸이다.
    expect(P(["A_ONE"], ["A_ONE"])("A_ONE")).toBe(false);
  });

  it("(접두 X, 리터럴 O) → false — 평범한 발행 코드", () => {
    expect(P([], ["A_ONE"])("A_ONE")).toBe(false);
  });

  it("(접두 X, 리터럴 X) → false — 이 축의 대상이 아니다", () => {
    expect(P([], [])("A_ONE")).toBe(false);
  });
});

/**
 * 발행 축 수집기 3종의 **합성 경계 대조군**.
 *
 * `/ai-review`(`review/code/2026/09/13/19_23_22` testing WARNING#5): 형제 함수
 * (`collectSourceTokens`·`collectEnvDeclarations`)에는 손으로 짠 대조군이 있는데
 * **신규 3종만 없었다** — 실제 코퍼스 통계와 이름-하나짜리 회귀에만 의존했다.
 * 각 제약마다 **두 판정이 갈리는 값**을 고정한다.
 */
describe("발행 축 수집기 — 경계 대조군", () => {
  describe("collectQuotedLiterals — 따옴표가 토큰만 감쌀 때", () => {
    it("세 따옴표 형태를 모두 받는다", () => {
      expect([...collectQuotedLiterals(["a 'A_ONE' b"])]).toEqual(["A_ONE"]);
      expect([...collectQuotedLiterals(['a "B_TWO" b'])]).toEqual(["B_TWO"]);
      expect([...collectQuotedLiterals(["a `C_THREE` b"])]).toEqual(["C_THREE"]);
    });

    it("[경계] 여닫이 따옴표가 **다르면** 안 받는다 (역참조)", () => {
      // 역참조를 빼는 뮤턴트가 이 값에서만 갈린다 — 같은 따옴표 케이스는 안 갈린다.
      expect([...collectQuotedLiterals(["a 'D_FOUR\" b"])]).toEqual([]);
    });

    it("[비대상] 따옴표 안에 토큰 **외의 글자**가 있으면 안 받는다", () => {
      // 이것이 «접두» 와 «리터럴» 을 가르는 자리다.
      expect([...collectQuotedLiterals(["throw new Error('E_FIVE: 설명')"])]).toEqual(
        [],
      );
      expect([...collectQuotedLiterals(["'F_SIX '"])]).toEqual([]);
    });

    it("[비대상] 따옴표가 아예 없으면 안 받는다", () => {
      expect([...collectQuotedLiterals(["bare G_SEVEN token"])]).toEqual([]);
    });
  });

  describe("collectMessagePrefixes — 여는 따옴표 직후 + `:` + 공백", () => {
    it("작은따옴표·템플릿 리터럴 둘 다 받는다 (코퍼스가 둘을 섞어 쓴다)", () => {
      expect([...collectMessagePrefixes(["new Error('H_ONE: 설명')"])]).toEqual([
        "H_ONE",
      ]);
      expect([...collectMessagePrefixes(["new Error(`I_TWO: ${x}`)"])]).toEqual([
        "I_TWO",
      ]);
    });

    it("[경계] `:` 가 없으면 접두가 아니다", () => {
      expect([...collectMessagePrefixes(["new Error('J_THREE 설명')"])]).toEqual([]);
    });

    it("[경계] `:` 뒤에 공백이 없으면 접두가 아니다", () => {
      // `'K_FOUR:값'` 은 접두 서술이 아니라 값 표기다 — 두 판정이 갈리는 값.
      expect([...collectMessagePrefixes(["'K_FOUR:값'"])]).toEqual([]);
    });

    it("[경계] 여는 따옴표 **직후**여야 한다", () => {
      // 문장 중간의 `… L_FIVE: …` 는 접두가 아니다.
      expect([...collectMessagePrefixes(["'prefix L_FIVE: 설명'"])]).toEqual([]);
    });
  });

  describe("collectCatalogCodes — 백틱만", () => {
    it("백틱 인용을 받는다", () => {
      expect([...collectCatalogCodes(["| `M_ONE` | 없음 | 설명 |"])]).toEqual([
        "M_ONE",
      ]);
    });

    it("[비대상] 따옴표는 카탈로그 인용이 아니다", () => {
      // spec 마크다운의 코드 표기는 백틱이다 — 따옴표까지 받으면 산문 예시가 섞인다.
      expect([...collectCatalogCodes(["'N_TWO' 는 예시"])]).toEqual([]);
      expect([...collectCatalogCodes(['"O_THREE" 는 예시'])]).toEqual([]);
    });

    it("[비대상] 백틱 없는 맨 토큰은 안 받는다", () => {
      expect([...collectCatalogCodes(["P_FOUR 는 맨 토큰"])]).toEqual([]);
    });
  });

  it("[공용] `collectMatches` 가 여러 텍스트의 중복을 한 번만 센다", () => {
    expect([
      ...collectQuotedLiterals(["'Q_ONE'", "'Q_ONE'", "'R_TWO'"]),
    ]).toEqual(["Q_ONE", "R_TWO"]);
  });
});

describe("collectEnvDeclarations — 분기별 대조군", () => {
  it("주석 처리된 선언을 받는다 (`#VAR=` · `# VAR=`)", () => {
    const got = collectEnvDeclarations(
      ["#ENABLE_SWAGGER_IN_PROD=false\n# CORS_ORIGINS=https://a.example\n"],
      [],
    );
    expect([...got].sort()).toEqual(["CORS_ORIGINS", "ENABLE_SWAGGER_IN_PROD"]);
  });

  it("주석 없는 선언도 받는다", () => {
    const got = collectEnvDeclarations(["LLM_STUB_MODE=false\n"], []);
    expect([...got]).toEqual(["LLM_STUB_MODE"]);
  });

  it("compose 는 **들여쓴 키**만 받는다 (최상위 키는 env 가 아니다)", () => {
    // **판별 fixture 는 두 판정이 갈리는 값이어야 한다.** 첫 판본은 들여쓴 키만 넣어서
    // `^\\s+` 를 `^\\s*` 로 바꾸는 뮤턴트가 **생존**했다 — 실제 compose 의 최상위 키는
    // 소문자 서비스명이라 `UPPER_SNAKE` 에 애초에 안 걸리기 때문이다. 최상위 UPPER_SNAKE
    // 줄을 함께 넣어야 그 제약이 관측된다.
    const got = collectEnvDeclarations(
      [],
      [
        "NOT_AN_ENV_KEY: top-level\n" +
          "services:\n  db:\n    environment:\n      POSTGRES_PASSWORD: secret\n",
      ],
    );
    expect([...got]).toEqual(["POSTGRES_PASSWORD"]);
  });

  it("[비대상] 값만 있고 이름이 소문자면 안 받는다", () => {
    expect([...collectEnvDeclarations(["lower_case=1\n"], [])]).toEqual([]);
  });

  it("[한계] compose 리스트 스타일(`- KEY=value`)은 **오늘 안 받는다**", () => {
    // `/ai-review`(`review/code/2026/09/13/16_28_47` requirement·testing INFO#2)가
    // "지원도 없고 그것을 겨냥한 테스트도 없다" 고 지적했다. 전제를 직접 셌다 —
    // 저장소 compose 두 파일에 리스트 스타일 **0건**, 매핑 스타일 66건.
    //
    // **넓히지 않고 미지원을 고정하는 쪽**을 택했다. 이 갭은 fail-closed 다 — 리스트
    // 스타일이 생기면 그 변수가 기준집합에서 빠져 가이드 인용이 RED 가 난다(거짓 경보).
    // 반대로 정규식을 넓히면 기준집합이 부풀어 **거짓 PASS** 방향으로 간다.
    //
    // 이 단언이 RED 로 뒤집히는 날은 누가 리스트 스타일 지원을 넣은 날이고, 그때
    // 스캐너 JSDoc 의 "매핑 스타일만" 서술도 함께 고쳐야 한다는 신호가 된다.
    const listStyle =
      "services:\n  api:\n    environment:\n      - LIST_STYLE_VAR=1\n";
    expect([...collectEnvDeclarations([], [listStyle])]).toEqual([]);
    // 대조군 — 같은 이름을 매핑 스타일로 쓰면 받는다(두 판정이 갈리는 값).
    const mapStyle =
      "services:\n  api:\n    environment:\n      LIST_STYLE_VAR: 1\n";
    expect([...collectEnvDeclarations([], [mapStyle])]).toEqual([
      "LIST_STYLE_VAR",
    ]);
  });

  it("실제 `.env.example` 에도 주석 처리된 선언이 있다 (분기가 죽은 코드가 아니다)", () => {
    // 합성 단언만 있으면 "분기는 살아 있지만 코퍼스엔 없다" 를 구분 못 한다.
    const commented = envExampleTexts
      .flatMap((t) => t.split("\n"))
      .filter((l) => /^#\s*[A-Z][A-Z0-9_]+=/.test(l));
    expect(commented.length).toBeGreaterThan(5); // 실측 19건
  });
});

/**
 * 스캐너의 판정 축을 **합성 입력**으로 겨눈다.
 *
 * 위 baseline-0 은 저장소가 지금 깨끗하다는 사실만 말한다 — 스캐너를 `return []` 로 바꿔도
 * 초록이다. 각 축이 무엇을 집고 무엇을 **일부러 놓치는지**는 여기서만 관측된다.
 */
describe("scanIdentifierCitations — 축별 대조군", () => {
  const tokens = (mdx: string): string[] =>
    scanIdentifierCitations(mdx).map((c) => `${c.axis}:${c.token}`);

  it("축 1 — FieldTable 의 name 을 집는다", () => {
    expect(
      tokens('<FieldTable rows={[\n  { name: "MADE_UP_CODE", type: "x" }\n]} />'),
    ).toEqual(["field-table:MADE_UP_CODE"]);
  });

  it("축 1 — 소문자 필드명은 식별자가 아니다", () => {
    expect(tokens('{ name: "max_tokens", type: "integer" }')).toEqual([]);
  });

  it("축 1 — `name` 이 **첫 키가 아니어도** 집는다 (라운드 7 WARNING#1)", () => {
    // 첫 판은 `\\{\\s*name:` 이라 키 순서가 다르면 **조용히 빠졌다**(fail-open). 오늘
    // 코퍼스의 `<FieldTable>` 행 242개가 전부 `name` 첫 키라 관측되지 않던 갭이다.
    expect(tokens('{ type: "x", name: "ORDER_FREE_CODE" }')).toEqual([
      "field-table:ORDER_FREE_CODE",
    ]);
    // 대조군 — `[^}]` 이므로 **객체 경계를 넘지 않는다**. 앞 객체의 여닫이를 지나
    // 뒤 객체의 `name` 을 끌어오면 줄 단위 판정이 무너진다.
    expect(tokens('{ type: "x" } { name: "SECOND_OBJ_CODE" }')).toEqual([
      "field-table:SECOND_OBJ_CODE",
    ]);
  });

  it("[경계] 축 1 은 줄 단위라 여러 줄로 쪼갠 행은 놓친다", () => {
    // **놓치는 것을 단언한다** — 한계가 코드에 없으면 다음 사람이 "왜 안 걸렸지" 를 추적한다.
    const split = '{\n  name: "MADE_UP_CODE",\n  type: "x"\n}';
    expect(tokens(split)).toEqual([]);
  });

  it("축 2 — 봉투 예시의 code 값을 집는다 (따옴표 유무 무관)", () => {
    expect(tokens('    "code": "MADE_UP_CODE",')).toEqual([
      "code-field:MADE_UP_CODE",
    ]);
    expect(tokens('{ error: { code: "MADE_UP_CODE", message: "…" } }')).toEqual([
      "code-field:MADE_UP_CODE",
    ]);
  });

  it("[비대상] `code` 로 끝나는 다른 키는 안 집는다", () => {
    // **리뷰어가 든 예시는 틀렸고 우려는 맞았다.** `"statusCode"` 는 camelCase 대문자 `C`
    // 라 원래부터 안 걸린다(실측). 실제로 걸리던 형태는 **전부 소문자**로 `code` 로 끝나는
    // 키다 — 그래서 fixture 를 `mycode` 로 짠다. 틀린 예시로 등재했다면 다음 사람이
    // `statusCode` 를 넣어 보고 "안 걸리네" 하며 진짜 갭을 오탐으로 닫았을 것이다.
    expect(tokens('{ "mycode": "NOT_A_CODE_FIELD" }')).toEqual([]);
    expect(tokens('{ "statusCode": "ALSO_NOT" }')).toEqual([]);
    // **스네이크케이스는 첫 경계 판(`(?<![A-Za-z])`)을 통과했다** — `_` 가 `[A-Za-z]` 가
    // 아니기 때문이다. 그때 주석은 "위험한 형태는 전부 소문자 `code` 접미" 라고 단정했는데
    // 고친 범위보다 넓은 주장이었다. `(?<!\w)` 로 넓히고 이 두 줄로 고정한다.
    expect(tokens('{ "error_code": "SNAKE_ONE" }')).toEqual([]);
    expect(tokens('{ "http_code": "SNAKE_TWO" }')).toEqual([]);
    // 대조군 — 정확히 `code` 인 키는 집는다(두 판정이 갈리는 값).
    expect(tokens('{ "code": "REAL_ONE" }')).toEqual(["code-field:REAL_ONE"]);
    expect(tokens("{ error: { code: \"BARE_FORM\" } }")).toEqual([
      "code-field:BARE_FORM",
    ]);
  });

  it("[설계] 하이픈 키(`x-code`)는 **의도적으로** 집는다 — 좁히지 말 것", () => {
    // `/ai-review`(`review/code/2026/09/13/16_28_47` requirement INFO#1)가 축 라벨
    // 오분류로 지적하며 경계를 `(?<![\w-])` 로 좁히자고 제안했다. **좁히는 쪽이 틀렸다.**
    //
    // 이 가드에서 과매치는 **fail-closed** 다 — 토큰이 `basis` 대조를 더 받을 뿐이다.
    // 좁히면 그 토큰이 검사 자체를 안 받아 **거짓 PASS** 방향으로 간다. 게다가 HTTP 헤더
    // 예시의 `x-code` 는 진짜 식별자를 담으므로 검사 대상인 것이 맞다.
    //
    // 이 대조군이 없으면 다음 사람이 INFO#1 을 "미완의 경계" 로 읽고 좁힌다 — 그리고
    // 스위트는 **GREEN 인 채로** 구멍이 난다. 그래서 결정을 여기 못박는다.
    expect(tokens('{ "x-code": "HYPHEN_ONE" }')).toEqual([
      "code-field:HYPHEN_ONE",
    ]);
    expect(tokens('{ "status-code": "HYPHEN_TWO" }')).toEqual([
      "code-field:HYPHEN_TWO",
    ]);
  });

  it("축 3 — 백틱 토큰을 **문맥과 무관하게** 집는다", () => {
    // `#1330` 은 여기에 실패-문맥 게이팅이 있었고 그래서 과거 결함을 놓쳤다.
    expect(tokens("환경변수 `SOME_ENV_FLAG` 로 켜요.")).toEqual([
      "backtick:SOME_ENV_FLAG",
    ]);
    expect(tokens("- 4xx → `output.error.code` 가 `MADE_UP_CODE` 로 채워져요.")).toEqual(
      ["backtick:MADE_UP_CODE"],
    );
  });

  it("축 3 — 실패 설명 셀의 괄호 인용도 집는다", () => {
    const row =
      "| `executionFailedTimeout` | Processing timed out (`HTTP_TIMEOUT` / `LLM_TIMEOUT`) | no |";
    expect(tokens(row)).toEqual(["backtick:HTTP_TIMEOUT", "backtick:LLM_TIMEOUT"]);
  });

  it("축 3 — 스팬에 **다른 글자가 섞여도** 집는다 (라운드 7 CRITICAL)", () => {
    // 첫 판은 `` /`(UPPER_SNAKE)`/ `` 라 백틱과 토큰이 **붙어 있어야** 매치됐다. 그런데
    // 주석은 *"**모든** 백틱 UPPER_SNAKE"* 라고 썼다 — 문서한 보장이 구현보다 넓었다.
    // 아래 네 형태는 실제 코퍼스에 반복 등장하고 **전부 미탐지**였다(직접 전수 재현).
    expect(tokens("`413 PUBLIC_WEBHOOK_BODY_TOO_LARGE`")).toEqual([
      "backtick:PUBLIC_WEBHOOK_BODY_TOO_LARGE",
    ]);
    expect(tokens("`PARALLEL_ENGINE=v1`")).toEqual(["backtick:PARALLEL_ENGINE"]);
    expect(tokens("`details.code='UNKNOWN_PLACEHOLDER'`")).toEqual([
      "backtick:UNKNOWN_PLACEHOLDER",
    ]);
    expect(tokens("`INVALID_FIELD: 설명문`")).toEqual(["backtick:INVALID_FIELD"]);
    // 한 스팬에 둘 이상이면 둘 다 — 스팬을 끊고 «안» 을 훑는다는 것이 관측되는 값.
    expect(tokens("`A_ONE and B_TWO`")).toEqual([
      "backtick:A_ONE",
      "backtick:B_TWO",
    ]);
  });

  it("[경계] 스팬 안쪽에도 워드 경계가 걸린다", () => {
    // **판별 fixture 를 한 번 잘못 골랐다.** 처음엔 `` `PREFIX_ONEMORE` `` 을 썼는데
    // `\\b` 를 빼는 뮤턴트에서 **생존**했다 — `UPPER_SNAKE` 가 greedy 라 경계가 없어도
    // 토큰 전체를 한 번에 먹어 결과가 같기 때문이다. 두 판정이 갈리는 값은 **접두사가
    // 붙은** 형태다:
    //
    // | 입력 | `\\b` 있음 | `\\b` 없음 |
    // |---|---|---|
    // | `` `PREFIX_ONEMORE` `` | `PREFIX_ONEMORE` | `PREFIX_ONEMORE` ← 안 갈린다 |
    // | `` `camelPREFIX_ONE` `` | **없음** | `PREFIX_ONE` ← 갈린다 |
    //
    // 경계를 빼면 이렇게 **식별자가 아닌 자리에서 토큰을 오려내** 인용으로 세고,
    // 그 조각은 기준집합에 없으니 **거짓 RED** 가 난다.
    expect(tokens("`camelPREFIX_ONE`")).toEqual([]);
    // 대조군 — 독립된 토큰은 그대로 집는다.
    expect(tokens("`PREFIX_ONEMORE`")).toEqual(["backtick:PREFIX_ONEMORE"]);
  });

  it("[비대상] 밑줄 없는 대문자 약어는 안 집는다", () => {
    // `UPPER_SNAKE` 가 **밑줄을 최소 하나** 요구하는 설계 결정을 고정한다. 주석에만 적혀
    // 있고 어떤 테스트도 겨누지 않아, `(?:_[A-Z0-9]+)+` 의 `+`→`*` 뮤턴트가 **생존**했다
    // (`/ai-review` `review/code/2026/09/13/15_24_12` testing WARNING#1 · 내가 직접 재현).
    //
    // 약어를 집기 시작하면 가이드의 `LLM`·`HTTP`·`API` 같은 낱말이 전부 후보가 되고,
    // 그것들은 기준집합에 있을 수도 없을 수도 있어 **베이스라인이 통제 불능**이 된다.
    expect(tokens("모델은 `LLM` 이고 전송은 `HTTP` 예요.")).toEqual([]);
    // 대조군 — 밑줄이 하나라도 있으면 집는다(두 판정이 갈리는 값이어야 제약이 관측된다).
    expect(tokens("`LLM_TIMEOUT` 은 집는다.")).toEqual(["backtick:LLM_TIMEOUT"]);
  });

  it("[비대상] 백틱 없는 산문 토큰은 안 집는다", () => {
    // 백틱은 "이건 식별자다" 라는 **작성자의 표시**다. 그게 없으면 일반 대문자 낱말과
    // 구분할 수 없어 오탐이 폭증한다.
    expect(tokens("This is ALL_CAPS but not in backticks.")).toEqual([]);
  });
});
