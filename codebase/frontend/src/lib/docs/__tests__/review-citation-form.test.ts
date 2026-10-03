import { describe, it, expect, beforeAll } from "vitest";

import { repoRoot } from "./impl-anchor-parse";
import type { MdFileRef } from "./tree-walk";
import {
  LOCAL_REVIEW_PATH,
  MIN_SWEPT_FILES,
  SHORT_FINDING_ID,
  collectMentionFiles,
  findMatchingLines,
} from "./codebase-mentions";

/**
 * **리뷰 인용 규약이 금지한 두 형태가 codebase 에 없다**(`CLE-ENG-REVIEWCITE` 규칙 9 · 10,
 * NERV 정본 전환 단계 4g, NERV Task `CLE-T-M7K35H`).
 *
 * - 규칙 9: NERV 발견은 전체 ID 로 인용한다(`finding <발견 전체 ID>`). 앞 8자만 적은 ID 는
 *   같은 분에 생긴 발견끼리 겹친다.
 * - 규칙 10: 리뷰 오케스트레이터의 로컬 산출물 경로(`.review/**`)는 인용하지 않는다. 커밋하지
 *   않는 경로라 다른 체크아웃에는 없다.
 *
 * 2026-10-03 실측으로 두 형태 모두 0건이다. 그래서 래칫 기준값 없이 0 을 요구한다. 규칙 5 의
 * 적용 범위 가운데 이 가드가 보는 것은 `codebase/**` 뿐이다. `scripts/**` · `.github/**` ·
 * `spec/**` 은 보지 않는다. 옛 커밋 산출물 경로(`review/<종류>/<날짜>/<시각>`)는 규칙 1 이
 * 유지하는 인용이라 세지 않는다.
 *
 * 보는 범위는 `codebase-mentions.ts` 가 정한다. 텍스트 확장자 목록의 파일만 읽고, 산출물 · 점
 * 디렉터리와 가드 자신의 파일은 뺀다. 규칙 9 는 `finding` 바로 뒤 소문자 16진 정확히 8자만,
 * 규칙 10 은 `.review/{code,consistency,merge,spec-coverage}/` 만 잡는다.
 */
const root = repoRoot();

/**
 * 금지 형태를 일부러 담은 다른 가드의 대조군(저장소 루트 기준) → 그 형태. 백엔드 응답 DTO 가드가
 * 줄인 발견 ID 를 잡는지 시험하는 fixture 다. 목록이 낡지 않았는지(파일이 있고 그 형태를 여전히
 * 담는지)도 확인한다.
 */
const FIXTURE_FILES: Readonly<Record<string, RegExp>> = {
  "codebase/backend/src/repo-guards/__tests__/fixtures/dto/responses/jsdoc-citation.fixture.ts":
    SHORT_FINDING_ID,
};

/** `pattern` 에 맞는 줄 가운데 대조군 허용분을 뺀 것. */
function violations(files: readonly MdFileRef[], pattern: RegExp): string[] {
  return findMatchingLines(files, pattern).filter((hit) => {
    const file = hit.slice(0, hit.lastIndexOf(":"));
    return FIXTURE_FILES[file] !== pattern;
  });
}

describe("리뷰 인용 형식", () => {
  let files: MdFileRef[] = [];

  beforeAll(() => {
    files = collectMentionFiles(root);
  });

  it("codebase 텍스트 파일을 실제로 훑는다 (vacuity floor)", () => {
    expect(files.length).toBeGreaterThan(MIN_SWEPT_FILES);
  });

  it("[규칙 9] `finding` 뒤에 줄인 발견 ID 가 없다", () => {
    const hits = violations(files, SHORT_FINDING_ID);
    if (hits.length > 0) {
      throw new Error(
        `줄인 NERV 발견 ID 인용 ${hits.length}건. 전체 ID(finding <발견 전체 ID>)로 쓴다.\n  ` +
          hits.join("\n  "),
      );
    }
  });

  it("[규칙 10] 로컬 리뷰 산출물 경로(`.review/**`)를 인용하지 않는다", () => {
    const hits = violations(files, LOCAL_REVIEW_PATH);
    if (hits.length > 0) {
      throw new Error(
        `.review/** 경로 인용 ${hits.length}건. 커밋하지 않는 경로다. NERV 발견 전체 ID 로 쓴다.\n  ` +
          hits.join("\n  "),
      );
    }
  });

  it("대조군 허용 목록이 낡지 않았다 (파일이 있고 그 형태를 여전히 담는다)", () => {
    const stale: string[] = [];
    for (const [file, pattern] of Object.entries(FIXTURE_FILES)) {
      const ref = files.find((f) => f.relPath === file);
      if (!ref) stale.push(`${file}: 파일이 없거나 훑는 범위 밖이다`);
      else if (findMatchingLines([ref], pattern).length === 0) {
        stale.push(`${file}: ${pattern} 형태를 더는 담지 않는다(목록에서 뺀다)`);
      }
    }
    expect(stale).toEqual([]);
  });
});

describe("리뷰 인용 형식 판정 (합성 입력)", () => {
  it("줄인 발견 ID 를 잡는다", () => {
    for (const s of [
      "// finding 01a10005 이 지적했다",
      "finding 01a10005,",
      "(finding 01a10005)",
      "finding  0123abcd",
    ]) {
      expect(SHORT_FINDING_ID.test(s), s).toBe(true);
    }
  });

  it("전체 ID · 다른 낱말 · 대문자 16진 · 8자가 아닌 숫자열은 잡지 않는다", () => {
    for (const s of [
      "finding 01a10005-3522-7077-a743-f8b684f88dad",
      "findings 01a10005",
      "refinding 01a10005",
      "finding 01A10005",
      "finding 01a1000",
      "finding 01a100059",
    ]) {
      expect(SHORT_FINDING_ID.test(s), s).toBe(false);
    }
  });

  it("로컬 산출물 경로를 잡고 옛 커밋 산출물 경로는 놓아 준다", () => {
    expect(LOCAL_REVIEW_PATH.test("`.review/code/2026/10/01/15_33_20`")).toBe(true);
    expect(LOCAL_REVIEW_PATH.test("./.review/consistency/2026/10/03/x")).toBe(true);
    expect(LOCAL_REVIEW_PATH.test(".review/merge/2026/10/03/12_00_00")).toBe(true);
    expect(LOCAL_REVIEW_PATH.test("(.review/spec-coverage/2026/10/03/12_00_00)")).toBe(true);
    expect(LOCAL_REVIEW_PATH.test("review/code/2026/09/04/23_02_51 W1")).toBe(false);
    expect(LOCAL_REVIEW_PATH.test("foo.review/code/")).toBe(false);
    expect(LOCAL_REVIEW_PATH.test(".review/other/")).toBe(false);
  });
});
