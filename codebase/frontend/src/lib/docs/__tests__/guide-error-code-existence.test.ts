import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

import { walkTree } from "./tree-walk";
import { collectMdxFiles, repoRoot } from "./impl-anchor-parse";
import {
  scanErrorCodeCitations,
  collectBackendTokens,
  type CitationAxis,
} from "./guide-error-code-scan";

/**
 * **유저 가이드가 이름 붙인 에러 코드는 backend 소스에 실재해야 한다.**
 *
 * 이 가드가 없는 동안 가이드는 다섯 종을 적고 있었다 — 지어낸 이름
 * (`MAKESHOP_API_ERROR`), 은퇴한 이름(`NODE_EXECUTION_FAILED`·`INTEGRATION_ERROR`,
 * `spec/5-system/3-error-handling.md §1.4` 가 "더 이상 사용하지 않는다" 고 명시),
 * 로드맵에만 있는 이름(`LLM_AUTH_ERROR`·`LLM_MODEL_NOT_FOUND`).
 *
 * 가족·위치·중복 아님의 근거는 `spec/conventions/user-guide-evidence.md` — 이 가드는
 * 자매 `impl-anchor-existence.test.ts` 와 **방향이 같고(가이드 → 코드) 표면이 다르다**
 * (자매는 `<ImplAnchor>` 의 `symbol`, 이쪽은 에러 코드 토큰).
 *
 * ## Planned 로드맵 이름을 왜 허용하지 않나
 *
 * `LLM_AUTH_ERROR`·`LLM_MODEL_NOT_FOUND` 는 `spec/5-system/7-llm-client.md §6` 에
 * **Planned** 로 실재하는 로드맵 이름이다. 술어가 *"backend 소스에 있는가"* 이므로 이들은
 * 잡히고 — **그게 맞다**. 유저 가이드는 *현재 동작*을 서술하는 문서이고, 미구현 코드를
 * 에러 코드 표에 싣는 것이 바로 이 가드가 막는 결함이다. 탈출구(허용목록)를 미리 파 두면
 * *"Planned 니까"* 로 오늘의 결함이 다시 들어온다. 훗날 가이드가 로드맵을 명시적으로
 * 소개해야 하면 그때 RED 가 뜨고 사람이 판단한다.
 */
describe("유저 가이드 에러 코드 실재성 가드", () => {
  const root = repoRoot();
  const mdxFiles = collectMdxFiles(root, "codebase/frontend/src/content/docs");

  // 실재 판정의 기준집합은 **backend + packages** 다. frontend 소스를 넣으면 라벨 맵에만
  // 적힌 이름이 스스로를 증명하게 된다 — 코드를 발행하는 쪽이 backend 이므로 그쪽만 본다
  // (실측: frontend 를 넣어도 오늘은 GREEN 이다. 즉 넓히는 실수는 **조용히** 통과한다).
  //
  // `packages` 는 오늘의 인용만 보면 필요 없다(빼도 GREEN). 그래도 넣는 이유는 그쪽이
  // **자기 에러 코드를 정의**하기 때문이다 — expression-engine 의 `EXPR_*`, sdk 의
  // `*_FAILED`. 가이드가 그중 하나를 적는 날 basis 가 좁으면 실재하는 코드에 RED 가 난다.
  // 아래 단언이 그 근거를 데이터로 고정한다(경로 오타로 root 가 조용히 비는 것도 함께).
  const sourceTexts = walkTree(root, ["codebase/backend/src", "codebase/packages"], {
    skipDir: (name) => name === "node_modules" || name === "dist" || name === "build",
    includeFile: (name) => name.endsWith(".ts"),
  }).map((f) => fs.readFileSync(f.absPath, "utf8"));

  const backendTokens = collectBackendTokens(sourceTexts);

  const citations = mdxFiles.flatMap((abs) =>
    scanErrorCodeCitations(fs.readFileSync(abs, "utf8")).map((c) => ({
      ...c,
      file: path.relative(root, abs),
    })),
  );

  // ── vacuity floors ──────────────────────────────────────────────────────────
  // 아래 baseline-0 단언은 **입력이 비면 저절로 통과한다.** 수집기가 조용히 0건을 돌려주는
  // 형태(경로 오타·walkTree 옵션 변경·정규식 파손)를 양성으로 겨눈다. 실측 시점 값보다
  // 넉넉히 아래로 잡아 정상 증감에는 안 걸리게 한다.
  it("코퍼스를 실제로 적재한다 (vacuity floor)", () => {
    expect(mdxFiles.length).toBeGreaterThan(50); // 실측 92
    expect(sourceTexts.length).toBeGreaterThan(500);
    expect(backendTokens.size).toBeGreaterThan(800); // 실측 1743종
    // 두 root 가 **각각** 적재됐음을 데이터로 본다 — 합계만 보면 한쪽 경로 오타가 묻힌다.
    expect(backendTokens.has("MODEL_CONFIG_NOT_FOUND")).toBe(true); // backend/src
    expect(backendTokens.has("EXPR_SYNTAX_ERROR")).toBe(true); //     packages
  });

  it("세 축이 모두 후보를 낸다 (축이 조용히 죽는 것 방지)", () => {
    const byAxis = (axis: CitationAxis): number =>
      citations.filter((c) => c.axis === axis).length;
    // 축 하나가 파손돼 0건이 되면 그 축의 결함은 영구 미검출인데 스위트는 초록이다.
    expect(byAxis("field-table")).toBeGreaterThan(10); // 실측 38건 / 19종
    expect(byAxis("code-field")).toBeGreaterThan(0); //  실측  6건 /  2종
    expect(byAxis("prose")).toBeGreaterThan(60); //      실측 170건 / 66종
  });

  it("실패 설명 셀의 괄호 인용이 코퍼스에서 실제로 걷힌다", () => {
    // 위 floor 는 총량만 본다. 문맥 신호를 좁은 판(`error.code` 만)으로 되돌리면 총량은
    // 거의 그대로인데 **이 형태만** 사라지므로, 그 회귀를 이름으로 고정한다.
    const discord = citations.filter(
      (c) => c.file.endsWith("discord.en.mdx") && c.axis === "prose",
    );
    expect(discord.map((c) => c.code)).toContain("EXECUTION_TIMEOUT");
  });

  // ── baseline ────────────────────────────────────────────────────────────────
  it("가이드가 적은 모든 에러 코드가 backend 소스에 실재한다 (베이스라인 0)", () => {
    const missing = citations.filter((c) => !backendTokens.has(c.code));
    expect(
      missing.map((c) => `${c.file}:${c.line} [${c.axis}] ${c.code}`),
    ).toEqual([]);
  });
});

/**
 * 스캐너의 판정 축을 **합성 입력**으로 겨눈다.
 *
 * 위 baseline-0 은 저장소가 지금 깨끗하다는 사실만 말한다 — 스캐너를 통째로
 * `return []` 로 바꿔도 초록이다. 각 축이 실제로 무엇을 집고 무엇을 **일부러 놓치는지**는
 * 여기서만 관측된다.
 */
describe("scanErrorCodeCitations — 축별 대조군", () => {
  const codes = (mdx: string): string[] =>
    scanErrorCodeCitations(mdx).map((c) => `${c.axis}:${c.code}`);

  it("축 1 — FieldTable 의 name 을 집는다", () => {
    expect(
      codes('<FieldTable rows={[\n  { name: "MADE_UP_CODE", type: "x" }\n]} />'),
    ).toEqual(["field-table:MADE_UP_CODE"]);
  });

  it("축 1 — 소문자 필드명은 코드가 아니다", () => {
    expect(codes('{ name: "max_tokens", type: "integer" }')).toEqual([]);
  });

  it("[경계] 축 1 은 줄 단위라 여러 줄로 쪼갠 행은 놓친다", () => {
    // **놓치는 것을 단언한다** — 오늘 코퍼스는 전부 한 줄 스타일이라(실측) 실질 위험은
    // 낮지만, 이 한계가 어디인지 코드로 적혀 있지 않으면 다음 사람이 "왜 안 걸렸지" 를
    // 추적하게 된다. 넓히려면 이 케이스가 먼저 RED 로 뒤집힌다.
    const split = '{\n  name: "MADE_UP_CODE",\n  type: "x"\n}';
    expect(codes(split)).toEqual([]);
  });

  it("축 2 — 봉투 예시의 code 값을 집는다 (따옴표 유무 무관)", () => {
    expect(codes('    "code": "MADE_UP_CODE",')).toEqual([
      "code-field:MADE_UP_CODE",
    ]);
    expect(codes('{ error: { code: "MADE_UP_CODE", message: "…" } }')).toEqual([
      "code-field:MADE_UP_CODE",
    ]);
  });

  it("축 3′ — 에러 코드 문맥의 산문 백틱을 집는다", () => {
    expect(codes("- 4xx → `output.error.code` 가 `MADE_UP_CODE` 로 채워져요.")).toEqual(
      ["prose:MADE_UP_CODE"],
    );
  });

  it("축 3′ — 코드 열을 가진 표의 행을 집는다", () => {
    const table = ["| 카테고리 | 코드 |", "|---|---|", "| LLM | `MADE_UP_CODE` |"].join(
      "\n",
    );
    expect(codes(table)).toEqual(["prose:MADE_UP_CODE"]);
  });

  it("축 3′ — 표가 끝나면 문맥도 끝난다", () => {
    // 표 아래 산문의 토큰까지 계속 집으면 문맥 판정이 사실상 파일 전역이 된다.
    const doc = [
      "| 카테고리 | 코드 |",
      "|---|---|",
      "| LLM | `REAL_ONE` |",
      "",
      "환경변수 `SOME_ENV_FLAG` 로 켜요.",
    ].join("\n");
    expect(codes(doc)).toEqual(["prose:REAL_ONE"]);
  });

  it("축 3″ — 실패를 서술하는 셀의 괄호 인용도 집는다", () => {
    // **이 형태가 문맥 신호를 넓히게 한 이유다.** 코드 열이 없는 표(chat-channel 가이드의
    // `executionFailed*` 키 표, 6파일)가 실패 설명 안에 코드를 괄호로 적는다. 좁은
    // 신호(`error.code` 만)로는 39종이었고 이 자리가 통째로 빠졌다 — 넓혀 66종, 부재 0.
    const row =
      "| `executionFailedTimeout` | Processing timed out (`HTTP_TIMEOUT` / `LLM_TIMEOUT`) | no |";
    expect(codes(row)).toEqual(["prose:HTTP_TIMEOUT", "prose:LLM_TIMEOUT"]);
  });

  it("[비대상] 실패 문맥이 없는 산문 토큰은 집지 않는다 — 외부 어휘", () => {
    // 실제 오탐이었다: Discord Gateway 이벤트 이름. 우리 코드에 없는 것이 **정상**이다.
    // 허용목록이 아니라 **줄의 주어**로 떨군다 — 같은 토큰이 실패 문맥에 오면 대상이 된다.
    const prose =
      "- **자유 텍스트 DM 미지원** — Discord 의 일반 `MESSAGE_CREATE` event 는 Gateway WebSocket 연결이 필요해요.";
    expect(codes(prose)).toEqual([]);
    expect(codes("에러 코드 `MESSAGE_CREATE` 로 내려와요.")).toEqual([
      "prose:MESSAGE_CREATE",
    ]);
  });

  it("[비대상] 코드 열이 없는 표의 백틱은 집지 않는다", () => {
    const table = ["| 이벤트 | 설명 |", "|---|---|", "| `MESSAGE_CREATE` | 메시지 |"].join(
      "\n",
    );
    expect(codes(table)).toEqual([]);
  });
});
