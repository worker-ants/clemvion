import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

import { repoRoot } from "./impl-anchor-parse";
import { collectMirrorKeys } from "./spec-keys";
import {
  collectMentionFiles,
  extractSpecKeyMentions,
  specKeyMentionProblem,
} from "./codebase-mentions";

/**
 * **codebase 가 링크 없이 적은 스펙 키(`CLE-…`)가 미러에 있다**(결정 D12, NERV 정본 전환 단계
 * 4g, NERV Task `CLE-T-M7K35H`).
 *
 * 키 링크(`[글](CLE-KEY#앵커)`)는 `spec-link-integrity` 범위 2 가 미러로 확인한다. 이 가드는
 * 링크로 감싸지 않은 언급(주석의 "NERV `CLE-API-ERRCODES` 「워크플로우 실행: 엔진 수준」" 같은
 * 표기)을 같은 기준으로 확인한다. 옛 경로를 키로 바꾸는 일이 늘수록 이 언급이 늘어난다. 오탈자
 * 키는 아무 데도 닿지 않는 인용이 된다. 키를 뽑을 때 링크 안팎을 가르지 않으므로 키 링크의 키도
 * 함께 센다(같은 판정이라 해가 없다).
 *
 * - 미러는 구현할 때 받은 문서만 담는 부분 스냅샷이다. 미러에 없는 키를 새로 적으려면 같은
 *   PR 에서 그 문서를 미러로 받는다(`CLE-ENG-SPECEVIDENCE` 규칙 18 과 같다).
 * - NERV Task 키(`CLE-T-` + 6자)는 스펙 키가 아니라 보지 않는다. `CLE-T` 는 Task 키 접두로 쓰이므로
 *   그 이름의 스펙 영역이 생기면 이 예외를 다시 본다.
 * - 미러하지 않는 카탈로그 영역(`CLE-C24` · `CLE-MKS`)의 키는 확인할 수 없어 통과시킨다.
 *   이 영역 키의 오탈자는 잡지 못한다.
 * - 키만 본다. 키 뒤에 적은 절 제목(「…」)이 그 문서에 있는지는 보지 않는다. 키 링크의 앵커는
 *   `spec-link-integrity` 범위 2 가 본다.
 */
const root = repoRoot();

/**
 * 판정을 시험하려고 일부러 미러에 없는 키를 쓰는 파일(저장소 루트 기준) → 그 키. 이 가드 자신의
 * 테스트는 `GUARD_SELF_FILES` 로 빠진다. 여기에는 다른 docs 가드의 대조군만 둔다.
 */
const FIXTURE_KEYS: Readonly<Record<string, readonly string[]>> = {
  "codebase/frontend/src/lib/docs/__tests__/no-internal-refs.test.ts": ["CLE-X"],
  "codebase/frontend/src/lib/docs/__tests__/registry.test.ts": ["CLE-X"],
  "codebase/frontend/src/lib/docs/__tests__/tree-walk.test.ts": ["CLE-X"],
  "codebase/frontend/src/lib/docs/__tests__/spec-keys.test.ts": [
    "CLE-C24X-META",
    "CLE-DIRLIKE",
    "CLE-WF-EDITR",
  ],
  "codebase/frontend/src/lib/docs/__tests__/spec-links.test.ts": [
    "CLE-NO-SUCH",
    "CLE-OK",
    "CLE-OK-DOC",
  ],
  "codebase/frontend/src/lib/docs/__tests__/spec-impl-locations.test.ts": [
    "CLE-AREA",
    "CLE-AREA-DOC",
    "CLE-TOP",
  ],
  // 키 링크 표기 `[글](CLE-KEY#앵커)` 를 설명하는 자리표시자.
  "codebase/frontend/src/lib/docs/__tests__/spec-keys.ts": ["CLE-KEY"],
  "codebase/frontend/src/lib/docs/__tests__/spec-links.ts": ["CLE-KEY"],
  "codebase/frontend/src/lib/docs/__tests__/spec-link-integrity.test.ts": ["CLE-KEY"],
};

describe("링크 없는 스펙 키 언급", () => {
  const files = collectMentionFiles(root);
  const mirrorKeys = collectMirrorKeys(path.join(root, "spec"));
  const mentions = files.map((f) => ({
    file: f.relPath,
    keys: [...new Set(extractSpecKeyMentions(fs.readFileSync(f.absPath, "utf8")))],
  }));

  it("미러와 언급을 실제로 읽는다 (vacuity floor)", () => {
    expect(mirrorKeys.size).toBeGreaterThan(150); // 2026-10-03 실측 181
    const distinct = new Set(mentions.flatMap((m) => m.keys));
    expect(distinct.size).toBeGreaterThan(50); // 2026-10-03 실측 100여 종
    expect(mentions.filter((m) => m.keys.length > 0).length).toBeGreaterThan(20);
  });

  it("언급한 키가 모두 미러에 있다", () => {
    const problems: string[] = [];
    for (const { file, keys } of mentions) {
      const allowed = new Set(FIXTURE_KEYS[file] ?? []);
      for (const key of keys) {
        if (allowed.has(key)) continue;
        const why = specKeyMentionProblem(key, mirrorKeys);
        if (why) problems.push(`${file}: ${key} — ${why}`);
      }
    }
    if (problems.length > 0) {
      throw new Error(`미러에 없는 스펙 키 언급 ${problems.length}건.\n  ${problems.join("\n  ")}`);
    }
  });

  it("대조군 허용 목록이 낡지 않았다 (없는 파일 · 쓰지 않는 키 · 미러에 있는 키)", () => {
    const stale: string[] = [];
    for (const [file, keys] of Object.entries(FIXTURE_KEYS)) {
      const m = mentions.find((x) => x.file === file);
      if (!m) {
        stale.push(`${file}: 파일이 없거나 훑는 범위 밖이다`);
        continue;
      }
      for (const key of keys) {
        if (!m.keys.includes(key)) stale.push(`${file}: ${key} 를 더는 쓰지 않는다`);
        if (mirrorKeys.has(key)) stale.push(`${file}: ${key} 는 미러에 있다(목록에서 뺀다)`);
      }
    }
    expect(stale).toEqual([]);
  });
});

describe("스펙 키 언급 판정 (합성 입력)", () => {
  it("키를 뽑고 Task 키와 자리표시자는 건너뛴다", () => {
    const text = [
      "근거: NERV `CLE-API-ERRCODES` 「워크플로우 실행: 엔진 수준」, Task CLE-T-RXMB2X",
      "[글](CLE-OBS-LOGGING#로그-형식) · spec/CLE-ENG/CLE-ENG-MIGRATION.md",
      "자리표시자 `CLE-T-…` · `CLE-ENG-…` · 글로브 CLE-* · 소문자 cle-api",
    ].join("\n");
    expect(extractSpecKeyMentions(text)).toEqual([
      "CLE-API-ERRCODES",
      "CLE-OBS-LOGGING",
      "CLE-ENG",
      "CLE-ENG-MIGRATION",
    ]);
  });

  it("미러에 있거나 미러하지 않는 영역의 키는 통과한다", () => {
    const mirror = new Set(["CLE-API-ERRCODES"]);
    expect(specKeyMentionProblem("CLE-API-ERRCODES", mirror)).toBeNull();
    expect(specKeyMentionProblem("CLE-C24-CUSTOMER", mirror)).toBeNull();
    expect(specKeyMentionProblem("CLE-MKS", mirror)).toBeNull();
  });

  it("미러에 없는 키는 받는 명령과 함께 막는다", () => {
    const why = specKeyMentionProblem("CLE-API-ERRCODE", new Set(["CLE-API-ERRCODES"]));
    expect(why).toMatch(/pull\.py --task <CLE-T-…> --spec <KEY>/);
    // 영역 접두는 하이픈 경계로 맞춘다. `CLE-C24X` 는 카탈로그 영역이 아니다.
    expect(specKeyMentionProblem("CLE-C24X-META", new Set())).not.toBeNull();
  });
});
