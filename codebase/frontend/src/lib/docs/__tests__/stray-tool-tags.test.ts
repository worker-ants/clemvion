import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, it, expect } from "vitest";
import { repoRoot } from "./impl-anchor-parse";
import { walkTree } from "./tree-walk";

// Guard: `plan/**` · `spec/**` 마크다운에 **도구 아티팩트 태그**가 남아 있으면 안 된다.
//
// ## 무엇을 막나
//
// 작성 도구가 문서를 감싸던 XML 유사 태그(`</content>`, `</invoke>` 등)가 본문에 그대로
// 남는 오염이 있었다. 2026-09-01 실측: `plan/` 5파일 6건 + `review/` 31파일. 여는 태그는
// **어디에도 없어**(grep 0건) 짝이 맞지 않는 순수 잔재였고, 그중 하나는 문서 **중간**에
// 박혀 있어(`webchat-usewidget-extraction.md:119`) 그 아래 절과 체크리스트 사이를 갈랐다.
//
// 오염 자체는 2026-06-06 ~ 07-18 구간에만 있고 그 뒤로는 없다 — 원인이 된 도구 동작은 이미
// 멈췄다. 그래서 이 가드는 **원인 제거가 아니라 재발 감지**다. 값이 싸고, 이런 잔재는
// 사람 눈에 잘 안 띄면서 마크다운 렌더러·파서마다 다르게 취급된다.
//
// ## 범위를 왜 직접 정하나
//
// `plan-scan.ts` 의 `collectLivePlanMarkdown` 은 `recurse: false` 라 `in-progress` 하위
// 폴더(`node-output-redesign/**`)를 안 본다. 그 스코핑은 "라이프사이클 plan 만 센다" 는
// 다른 목적에서 나온 것이라, 오염 검사가 그것을 물려받으면 **사각지대를 함께 물려받는다.**
// 여기서는 `walkTree` 를 직접 불러 `plan/`·`spec/` 전체를 본다 — 인덱스 파일(`0-`/`_` 접두)도
// 포함한다. 오염은 파일의 성격을 가리지 않는다.
//
// `review/**` 는 **일부러 뺐다.** 봉인된 세션 산출물이라 아무도 편집하지 않고, 그 안의
// 잔재는 읽히지 않는 자리에 있다. 31파일을 지금 훑으면 이력 diff 만 부풀고 얻는 것이 없다.
//
// ## 왜 코드펜스를 예외로 두지 않나
//
// 이 태그들은 문법 예제로 쓸 일이 없다. 예외를 두면 "펜스 안이면 통과" 라는 우회로가
// 생기고, 오염이 하필 펜스 안에 떨어지는 경우를 놓친다. 정말 필요해지면 그때 fixture 와
// 함께 예외를 낸다.

/**
 * 도구가 남기는 XML 유사 래퍼. 여는/닫는 형태 모두.
 *
 * **알파벳 순**으로 둔다 — 빈도순은 새 태그가 어디 들어가야 하는지가 사람마다 갈린다.
 */
const TOOL_TAGS = [
  "antml",
  "content",
  "function_calls",
  "invoke",
  "parameter",
] as const;

/**
 * 전제 테스트의 하한. 2026-09-01 실측 `plan/`+`spec/` 마크다운(archive 제외) **891개** —
 * 한 자릿수 배수 아래로 잡아 자연 감소에는 안 걸리고 "스캔이 통째로 실패" 만 잡는다.
 *
 * (초판은 이 자리에 **436** 이라 적었다. 재지 않고 쓴 숫자였고 리뷰가 아니라 내가 다시 세서
 * 잡았다 — 주석의 "실측" 도 실측이어야 한다.)
 */
const MIN_EXPECTED_MD_FILES = 100;

/**
 * **한 줄이 통째로** 태그일 때만 잡는다.
 *
 * 문장 안에 인용된 `</content>` (예: 이 가드를 설명하는 문서)는 잡지 않는다 — 그것은
 * 오염이 아니라 서술이고, 잡으면 이 파일을 참조하는 문서가 전부 걸린다. 실제 오염은
 * 항상 줄 단위로 떨어진다(실측 6건 전부).
 */
const STRAY_TAG_LINE = new RegExp(
  `^\\s*</?(?:${TOOL_TAGS.join("|")})\\b[^>]*>\\s*$`,
);

interface StrayHit {
  relPath: string;
  line: number;
  text: string;
}

/**
 * 스캔 대상 수집 — **한 곳**에만 둔다.
 *
 * 초판은 이 `walkTree` 호출을 `findStrayTags` 와 전제 테스트에 각각 복제했다. 사본이 둘이면
 * `skipDir` 같은 옵션이 한쪽만 바뀌어도 아무도 모른다(리뷰 1R testing WARNING).
 */
function collectScanTargets(root: string) {
  return walkTree(root, ["plan", "spec"], {
    // `archive/` 는 옛 memory/user_memo 보관소다 — 라이프사이클 문서가 아니라 제외한다.
    // 이 분기는 아래 fixture 테스트가 잠근다(무력화하면 RED).
    skipDir: (name) => name === "archive",
    includeFile: (name) => name.endsWith(".md"),
  });
}

function findStrayTags(root: string): StrayHit[] {
  const files = collectScanTargets(root);
  const hits: StrayHit[] = [];
  for (const file of files) {
    const lines = fs.readFileSync(file.absPath, "utf-8").split("\n");
    lines.forEach((line, i) => {
      if (STRAY_TAG_LINE.test(line)) {
        hits.push({ relPath: file.relPath, line: i + 1, text: line.trim() });
      }
    });
  }
  return hits;
}

describe("plan/spec 마크다운에 도구 아티팩트 태그가 없다", () => {
  const root = repoRoot();

  it("[전제] 스캔이 실제로 파일을 봤다 — 0건이면 아래 단언이 vacuous 하다", () => {
    expect(collectScanTargets(root).length).toBeGreaterThan(MIN_EXPECTED_MD_FILES);
  });

  it("잔재 태그가 없다", () => {
    const hits = findStrayTags(root).map(
      (h) => `${h.relPath}:${h.line}  ${h.text}`,
    );
    expect(hits).toEqual([]);
  });

  // 탐지가 실제로 작동하는지 — "위반 0건" 은 검사가 도는 증거가 아니다.
  // (이 파일 위쪽 `plan-scan.ts` 헤더가 같은 교훈을 적고 있다: 158 tests GREEN 인데
  //  위반 수집 분기가 한 번도 실행되지 않았던 이력.)
  it.each([
    ["닫는 태그", "</content>"],
    ["여는 태그", "<content>"],
    ["들여쓴 태그", "   </invoke>"],
    ["속성 달린 태그", '<parameter name="x">'],
  ])("탐지: %s 를 잡는다", (_label, line) => {
    expect(STRAY_TAG_LINE.test(line)).toBe(true);
  });

  // `skipDir("archive")` 분기가 **어떤 테스트로도 검증되지 않았다** (리뷰 1R testing
  // WARNING). 무력화해도 10/10 GREEN 이었다 — 이 파일 헤더가 경고하는 바로 그 모양이다.
  // 실 저장소 스캔으로는 잡을 수 없다(현재 `archive/` 에 잔재가 없다). fixture 로 가른다.
  it("archive/ 는 스캔하지 않는다 — 그 밖은 스캔한다 (대조군 포함)", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "stray-tags-fixture-"));
    try {
      const archived = path.join(tmp, "plan", "complete", "archive", "from-x");
      fs.mkdirSync(archived, { recursive: true });
      fs.writeFileSync(path.join(archived, "old.md"), "# Old\n</content>\n");

      const live = path.join(tmp, "plan", "complete");
      fs.writeFileSync(path.join(live, "kept.md"), "# Kept\n</content>\n");

      const hits = findStrayTags(tmp).map((h) => h.relPath);
      // 대조군이 없으면 "0건" 이 제외 때문인지 스캔 실패 때문인지 안 갈린다.
      expect(hits).toEqual(["plan/complete/kept.md"]);
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  it.each([
    ["문장 안 인용", "본문에서 `</content>` 를 설명하는 줄"],
    ["마크다운 링크", "- [x] `</invoke>` 제거 완료"],
    ["무관한 HTML", "<br />"],
    ["빈 줄", ""],
  ])("오탐 없음: %s 는 안 잡는다", (_label, line) => {
    expect(STRAY_TAG_LINE.test(line)).toBe(false);
  });
});
