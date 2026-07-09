import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

/**
 * Guard: e2e 스펙의 assertion/action timeout 은 전역 기본(`expect.timeout`) **미만의
 * 하드코딩 숫자로 override 하지 않는다**.
 *
 * Playwright 는 개별 지정 `{ timeout: N }` 이 global `expect.timeout` 보다 **항상 우선**한다.
 * 따라서 sub-global(전역 미만) 리터럴이 스펙에 흩뿌려지면 전역 timeout 상향(부하 시 slack
 * 확보)이 그 스펙에는 닿지 못한다 — 러너 병렬 부하에서 간헐 timeout flake 의 원인이자, PR #872
 * 리뷰가 Critical/INFO 로 반복 지적한 anti-pattern 이다. positive wait 은 명시 timeout 을 빼
 * **전역 기본에 위임**하고, 정말 더 필요한 곳만 전역 초과값(또는 명명 상수)을 쓴다.
 *
 * 본 가드는 `e2e/**` 의 `.ts` 소스에서 bare-numeric `timeout: N`(예: `5_000`, `3000`) 중
 * N < 전역 기본인 것을 CI(unit)로 차단한다. 전역 기본값은 `playwright.config.ts` 의
 * `expect: { timeout: N }` 에서 파싱해 SoT 로 동기화한다(하드코딩 아님). 명명 상수
 * (`timeout: DIALOG_TIMEOUT`)는 bare-numeric 이 아니므로 매칭되지 않는다 — 상수 정의값이
 * 전역 이상이면 정당(예: `PAGE_READY_TIMEOUT = 15_000`).
 *
 * vitest 는 `src/**` 만 include 하므로(= Playwright 스펙 트리 밖) 이 가드는 src 아래 두고
 * 형제 `e2e/` 트리를 상대경로로 스캔한다.
 */

// __dirname = .../codebase/frontend/src/__tests__ → ../.. = .../codebase/frontend
const FRONTEND = path.join(__dirname, "..", "..");
const E2E_DIR = path.join(FRONTEND, "e2e");
const PLAYWRIGHT_CONFIG = path.join(FRONTEND, "playwright.config.ts");

/** `timeout: <digits[_digits]>` 의 bare-numeric 값만 매칭(명명 상수는 제외). g 플래그로 전수. */
const TIMEOUT_LITERAL = /timeout:\s*(\d[\d_]*)\b/g;

/** `_` 구분자 제거 후 정수화. */
function toNumber(literal: string): number {
  return parseInt(literal.replace(/_/g, ""), 10);
}

/** `playwright.config.ts` 의 `expect: { timeout: N }` 를 전역 기본으로 파싱. */
function readGlobalExpectTimeout(): number {
  const src = fs.readFileSync(PLAYWRIGHT_CONFIG, "utf8");
  const m = src.match(/expect:\s*\{[^}]*\btimeout:\s*(\d[\d_]*)/);
  if (!m) {
    throw new Error(
      "playwright.config.ts 에서 expect.timeout 을 파싱하지 못했습니다 — 가드가 fail-open 됩니다.",
    );
  }
  return toNumber(m[1]);
}

/** `e2e/**` 의 `.ts` 파일 절대경로. node_modules 스킵. */
function collectE2eFiles(dir: string = E2E_DIR, acc: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules") continue;
      collectE2eFiles(full, acc);
    } else if (/\.ts$/.test(entry.name)) {
      acc.push(full);
    }
  }
  return acc;
}

/**
 * 한 줄에서 전역 미만 bare-numeric timeout 값들을 추출한다. 프로덕션 스캔
 * (`findSubGlobalTimeouts`)과 self-test 가 **이 단일 헬퍼로 판정 로직을 공유**한다 — 분리
 * 재구현하면 임계값 비교(`v < global`)를 바꿔도 self-test 가 회귀를 못 잡는 drift 가 생긴다.
 */
function subGlobalTimeoutsInLine(line: string, global: number): number[] {
  const hits: number[] = [];
  for (const m of line.matchAll(TIMEOUT_LITERAL)) {
    const value = toNumber(m[1]);
    if (value < global) hits.push(value);
  }
  return hits;
}

/** 전역 미만 bare-numeric timeout 리터럴을 가진 위치를 `e2e` 상대경로:line=value 로. */
function findSubGlobalTimeouts(global: number): string[] {
  const offenders: string[] = [];
  for (const file of collectE2eFiles()) {
    const lines = fs.readFileSync(file, "utf8").split("\n");
    lines.forEach((line, i) => {
      for (const value of subGlobalTimeoutsInLine(line, global)) {
        offenders.push(`${path.relative(E2E_DIR, file)}:${i + 1}=${value}`);
      }
    });
  }
  return offenders;
}

describe("no sub-global timeout override in e2e specs", () => {
  const GLOBAL = readGlobalExpectTimeout();

  // 타이틀에 파싱된 전역값을 노출 — 실패 시 어느 임계값 기준인지 즉시 드러난다.
  it(`has no bare-numeric timeout below the global expect.timeout (${GLOBAL}) in e2e specs`, () => {
    // 위반 시: 해당 timeout 리터럴을 제거해 전역 기본에 위임하거나, 전역 이상값/명명 상수로 바꾼다.
    expect(findSubGlobalTimeouts(GLOBAL)).toEqual([]);
  });

  // regex/파싱 self-test — "현재 위반 0건"만으로는 검출 로직 약화(정규식/파싱 실수)를 놓쳐 가드가
  // 조용히 무력화된다. 알려진 sub-global 은 검출, 전역 이상/명명 상수는 통과임을 고정한다.
  // self-test 는 프로덕션 스캔과 **동일한** `subGlobalTimeoutsInLine` 을 검증한다(별도 재구현
  // 아님) — 이 판정 로직이 곧 파일 스캔 파이프라인의 심장부라 여기서 회귀를 고정하면 drift 가 없다.
  describe("검출 로직 true/false positives", () => {
    it.each([
      ["언더스코어 5_000", "await expect(x).toBeVisible({ timeout: 5_000 });", [5000]],
      ["plain 3000", ").toBeVisible({ timeout: 3000 });", [3000]],
      ["경계 바로 아래 9_999", "{ timeout: 9_999 }", [9999]],
      ["waitForURL sub-global", "page.waitForURL(/x/, { timeout: 5_000 })", [5000]],
    ])("검출: %s", (_label, src, expected) => {
      expect(subGlobalTimeoutsInLine(src, 10_000)).toEqual(expected);
    });

    it.each([
      ["전역 동일 10_000", ").toBeVisible({ timeout: 10_000 });"],
      ["전역 초과 15_000", "{ timeout: 15_000 }"],
      ["명명 상수", ").toBeVisible({ timeout: DIALOG_TIMEOUT });"],
      ["hard-sleep(별개 API)", "await page.waitForTimeout(500);"],
      ["timeout 아닌 숫자", "const workers = 2000;"],
    ])("통과: %s", (_label, src) => {
      expect(subGlobalTimeoutsInLine(src, 10_000)).toEqual([]);
    });
  });

  it("가드가 fail-open 하지 않는다 (E2E 트리·config 해소)", () => {
    expect(fs.existsSync(E2E_DIR)).toBe(true);
    expect(fs.existsSync(PLAYWRIGHT_CONFIG)).toBe(true);
    // e2e 스펙이 최소 이 정도는 수집돼야 빈 트리에 fail-open(offender 0 위양성) 하지 않음을 보장.
    expect(collectE2eFiles().length).toBeGreaterThan(10);
    expect(GLOBAL).toBeGreaterThanOrEqual(10_000);
  });
});
