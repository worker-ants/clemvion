import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

import { repoRoot } from "./impl-anchor-parse";

/**
 * **유저 가이드가 옮겨 적은 실패 문장이 SoT 와 글자까지 같아야 한다.**
 *
 * `/ai-review` `review/code/2026/09/13/10_12_19` architecture WARNING#1 이 지목한 자리다.
 * 같은 PR 이 `models{,.en}.mdx` 의 **에러 코드 표**를 없애고 그 자리에 사용자가 실제로 보는
 * **8갈래 문장표**를 넣었는데, 그 문장은 `sanitize-error.util.ts` 의 문자열을 **손으로 옮긴
 * 것**이다. 즉 그 PR 이 막으려던 클래스(SoT 가 바뀌면 미러 문서가 조용히 낡는다)를 **같은
 * 표에서 다시 열었다** — 지어낸 *이름* 대신 낡은 *문장*으로 형태만 바뀐 채로.
 *
 * 자매 `guide-error-code-existence.test.ts` 는 **코드 토큰**의 실재를 본다. 이 가드는
 * **문장의 일치**를 본다 — 표면이 다르다.
 *
 * ## SoT 를 import 하지 않고 텍스트로 읽는 이유
 *
 * frontend 테스트가 backend 소스를 import 하면 패키지 경계를 넘는 빌드 의존이 생긴다.
 * 이 폴더의 가드 가족은 전부 `readFileSync` 로 소스를 **텍스트로** 읽는다 — 같은 관례를
 * 따른다. 반환 리터럴을 정규식으로 걷는 것이 취약해 보일 수 있지만, 그 취약함은
 * **실패 방향이 안전하다**: 추출이 깨지면 아래 vacuity floor(8건)가 먼저 RED 가 된다.
 */
describe("가이드 실패 문장 ↔ sanitizeLlmErrorMessage 일치", () => {
  const root = repoRoot();
  const sotRel = "codebase/backend/src/modules/llm/utils/sanitize-error.util.ts";
  const sotText = fs.readFileSync(path.join(root, sotRel), "utf8");

  // `return 'Authentication failed. Please check your API key.';` 꼴의 반환 리터럴.
  const sentences = [
    ...sotText.matchAll(/return\s+'([^']+)'\s*;/g),
  ].map((m) => m[1]);

  const guides = [
    "codebase/frontend/src/content/docs/06-integrations-and-config/models.mdx",
    "codebase/frontend/src/content/docs/06-integrations-and-config/models.en.mdx",
  ];

  it("SoT 에서 8갈래를 실제로 추출한다 (vacuity floor)", () => {
    // 추출이 깨지면 아래 부분집합 단언이 **저절로 통과**한다 — 그 방향을 먼저 막는다.
    expect(sentences).toHaveLength(8);
    expect(new Set(sentences).size).toBe(8);
    expect(sentences).toContain("Connection test failed. Please check your configuration.");
  });

  for (const rel of guides) {
    describe(rel, () => {
      const text = fs.readFileSync(path.join(root, rel), "utf8");
      // 문장표의 첫 열만 본다 — 둘째 열은 로케일별 설명이라 SoT 대조 대상이 아니다.
      // 영문 마침표로 끝나는 첫 열 셀만 후보로 삼아 다른 표(파라미터 표 등)를 배제한다.
      const rows = [...text.matchAll(/^\|\s*([A-Z][^|]*?\.)\s*\|/gm)].map((m) =>
        m[1].trim(),
      );

      it("표에서 문장 행을 찾는다 (vacuity floor)", () => {
        expect(rows.length).toBeGreaterThanOrEqual(8);
      });

      it("표의 모든 문장이 SoT 에 글자까지 존재한다", () => {
        const orphans = rows.filter((r) => !sentences.includes(r));
        expect(orphans).toEqual([]);
      });

      it("SoT 의 8갈래가 모두 표에 실려 있다 (누락 방향)", () => {
        // 부분집합 단언만으로는 **행을 지우는 편집**이 조용히 통과한다.
        const missing = sentences.filter((s) => !rows.includes(s));
        expect(missing).toEqual([]);
      });
    });
  }
});
