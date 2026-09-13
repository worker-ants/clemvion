import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

import { walkTree } from "./tree-walk";
import { collectMdxFiles, repoRoot } from "./impl-anchor-parse";
import {
  scanIdentifierCitations,
  collectSourceTokens,
  collectEnvDeclarations,
  GUIDE_EXTERNAL_VOCABULARY,
  type CitationAxis,
} from "./guide-identifier-scan";

/** 허용목록 상한 — 넘으면 통과가 아니라 **결정**을 강제한다. */
const EXTERNAL_VOCABULARY_CAP = 5;

/**
 * **유저 가이드가 이름 붙인 식별자는 실재해야 한다.**
 *
 * 에러 코드(`MAKESHOP_API_ERROR` 류)와 **환경변수**(`MCP_INSECURE_URL_ALLOWED` 류) 둘 다가
 * 대상이다. 후자는 `#1328` 이 손으로 고친 뒤 4개월간 아무도 몰랐던 클래스이고,
 * `#1330` 의 문맥-게이팅 축은 **그것을 못 잡았다**(스캐너 상단의 실측표).
 *
 * 가족·위치의 근거는 `spec/conventions/user-guide-evidence.md`. 자매
 * `impl-anchor-existence.test.ts` 와 **방향이 같고(가이드 → 코드) 표면이 다르다**.
 */
describe("유저 가이드 식별자 실재성 가드", () => {
  const root = repoRoot();
  const mdxFiles = collectMdxFiles(root, "codebase/frontend/src/content/docs");

  // 기준집합 = 소스 토큰 ∪ env 선언처.
  // frontend 소스는 **넣지 않는다** — 넣으면 가이드가 인용한 이름이 프런트 라벨 맵으로
  // 자기를 증명한다(실측: 넣어도 오늘은 GREEN 이라 그 실수는 **조용히** 통과한다).
  const sourceTexts = walkTree(root, ["codebase/backend/src", "codebase/packages"], {
    skipDir: (name) => name === "node_modules" || name === "dist" || name === "build",
    includeFile: (name) => name.endsWith(".ts"),
  }).map((f) => fs.readFileSync(f.absPath, "utf8"));

  const readIfPresent = (rel: string): string[] => {
    const abs = path.join(root, rel);
    return fs.existsSync(abs) ? [fs.readFileSync(abs, "utf8")] : [];
  };
  const envExampleTexts = [
    ...readIfPresent("codebase/backend/.env.example"),
    ...readIfPresent("codebase/frontend/.env.example"),
  ];
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
    // (`/ai-review` `14_41_14` testing WARNING#6). 좁은 회귀 형태를 이름으로 되돌린다.
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

  // ── 허용목록 4강제 ──────────────────────────────────────────────────────────
  describe("외부 어휘 허용목록 — 은폐 수단이 되지 않도록", () => {
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
      const stale = GUIDE_EXTERNAL_VOCABULARY.filter((e) => !cited.has(e.token));
      expect(stale.map((e) => e.token)).toEqual([]);
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
      const CODE_CONTEXT =
        /error\.code|error code|에러 코드|\bfail(?:s|ed|ure)?\b|실패|\berror\b|오류|timed out|시간 초과|rate limit|요청 한도|returns \d{3}/i;
      const FIELD_TABLE_NAME = /\{\s*name:\s*"([A-Z][A-Z0-9]*(?:_[A-Z0-9]+)+)"/;
      expect(CODE_CONTEXT.test(BROKEN)).toBe(false);
      expect(FIELD_TABLE_NAME.exec(BROKEN)?.[1]).toBeUndefined();
    });
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

  it("[비대상] 백틱 없는 산문 토큰은 안 집는다", () => {
    // 백틱은 "이건 식별자다" 라는 **작성자의 표시**다. 그게 없으면 일반 대문자 낱말과
    // 구분할 수 없어 오탐이 폭증한다.
    expect(tokens("This is ALL_CAPS but not in backticks.")).toEqual([]);
  });
});
