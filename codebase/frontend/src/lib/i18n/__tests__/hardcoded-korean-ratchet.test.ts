import fs from "node:fs";
import path from "node:path";
import { describe, it, expect } from "vitest";

/**
 * Hardcoded Korean string ratchet (Principle 1).
 *
 * `src/{components,app,lib}/**\/*.{ts,tsx}` 안에서 한국어 문자(`[가-힣]`)를
 * 포함한 **소스 라인** (주석·블록주석 제거 후) 의 파일별 카운트가 baseline 을
 * 초과하면 fail. 새 파일이 한국어 라인을 포함해도 fail. baseline 보다 적으면
 * 통과(권장: baseline 갱신).
 *
 * - 단일 라인 카운트라 false-positive 가능 (예: dict path 가 i18n 키처럼
 *   보이는 텍스트라도 한국어 라인이면 카운트). baseline 이 현재 상태를 캡쳐해
 *   "감소 가능, 증가 불가" 보증을 제공.
 * - 의도된 한국어 보유 영역(dict/, backend-labels.ts, content/, 테스트,
 *   fixtures, stories) 은 화이트리스트로 제외.
 * - 갱신: `BASELINE_UPDATE=1` 환경변수로 baseline.json 자동 갱신.
 *
 * 결정적 ESLint custom rule (P2-a) 의 대체 가드 — 룰 작성·예외 관리 부담이
 * 낮은 대신 라인 단위 정확도가 트레이드오프. spec/conventions/i18n-userguide.md
 * Principle 1 의 ratchet 가드.
 */

const __filenameAbs = __filename;
// __dirname = codebase/frontend/src/lib/i18n/__tests__
const frontendRoot = path.resolve(__dirname, "..", "..", "..", "..");
const srcRoot = path.resolve(frontendRoot, "src");
const baselinePath = path.resolve(__dirname, "hardcoded-korean-baseline.json");

interface Baseline {
  _schema?: string;
  _updateCommand?: string;
  files: Record<string, number>;
}

const SCAN_ROOTS = ["components", "app", "lib"];

/** 의도된 한국어 보유 영역 — ratchet 에서 제외 */
function isExcluded(relPath: string): boolean {
  const p = relPath.replace(/\\/g, "/");
  if (p.includes("/__tests__/")) return true;
  if (p.endsWith(".test.ts") || p.endsWith(".test.tsx")) return true;
  if (p.endsWith(".spec.ts") || p.endsWith(".spec.tsx")) return true;
  if (p.endsWith(".stories.tsx") || p.endsWith(".stories.ts")) return true;
  if (p.includes("/fixtures/") || p.includes("/fixtures-broken/")) return true;
  if (p.includes("/i18n/dict/")) return true;
  if (p === "lib/i18n/backend-labels.ts") return true;
  if (p.includes("/content/docs/")) return true;
  return false;
}

function walkSourceFiles(dir: string, acc: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name === ".next") continue;
      walkSourceFiles(full, acc);
    } else if (entry.isFile()) {
      if (entry.name.endsWith(".ts") || entry.name.endsWith(".tsx")) {
        acc.push(full);
      }
    }
  }
  return acc;
}

/**
 * 한 줄에 한국어가 들어있는 "코드" 라인 수. 주석 제거 후 평가.
 * - 블록 주석 `/* ... *\/` (멀티라인 포함) 전부 제거
 * - 라인 주석 `// ...` 제거 (단, 문자열 리터럴 안의 `//` 는 보존)
 * - 결과 라인에 `[가-힣]` 매칭 시 1 증가
 */
function countKoreanCodeLines(source: string): number {
  // 1) 모든 블록 주석 제거 (멀티라인 가능)
  const noBlock = source.replace(/\/\*[\s\S]*?\*\//g, "");
  const lines = noBlock.split("\n");
  let count = 0;
  for (const raw of lines) {
    const stripped = stripLineComment(raw);
    if (/[가-힣]/.test(stripped)) count++;
  }
  return count;
}

function stripLineComment(line: string): string {
  let inStr = false;
  let quote = "";
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inStr) {
      if (c === "\\") {
        i++;
        continue;
      }
      if (c === quote) inStr = false;
    } else {
      if (c === '"' || c === "'" || c === "`") {
        inStr = true;
        quote = c;
      } else if (c === "/" && line[i + 1] === "/") {
        return line.slice(0, i);
      }
    }
  }
  return line;
}

function buildCurrentCounts(): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const r of SCAN_ROOTS) {
    const root = path.join(srcRoot, r);
    if (!fs.existsSync(root)) continue;
    for (const file of walkSourceFiles(root)) {
      const rel = path
        .relative(srcRoot, file)
        .replace(/\\/g, "/");
      if (isExcluded(rel)) continue;
      // 본 테스트 파일 자체는 제외 (한국어 메시지 포함)
      if (file === __filenameAbs) continue;
      const source = fs.readFileSync(file, "utf8");
      const n = countKoreanCodeLines(source);
      if (n > 0) counts[rel] = n;
    }
  }
  return counts;
}

function loadBaseline(): Baseline {
  if (!fs.existsSync(baselinePath)) {
    return { files: {} };
  }
  const raw = fs.readFileSync(baselinePath, "utf8");
  return JSON.parse(raw) as Baseline;
}

function writeBaseline(counts: Record<string, number>): void {
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  const data: Baseline = {
    _schema:
      "Hardcoded Korean string ratchet baseline. Per-file count of source " +
      "lines containing [가-힣]. Excludes dict/, backend-labels.ts, content/, " +
      "tests, fixtures, stories. Goal: monotonic decrease toward {}.",
    _updateCommand:
      "BASELINE_UPDATE=1 npm test -- hardcoded-korean-ratchet",
    files: Object.fromEntries(
      Object.entries(counts).sort(([a], [b]) => a.localeCompare(b)),
    ),
  };
  fs.writeFileSync(
    baselinePath,
    JSON.stringify(data, null, 2) + `\n// total: ${total}\n`.replace(/^/, ""),
    "utf8",
  );
  // Re-write without inline total comment (JSON safety)
  fs.writeFileSync(baselinePath, JSON.stringify(data, null, 2) + "\n", "utf8");
}

describe("hardcoded-korean ratchet (Principle 1)", () => {
  const counts = buildCurrentCounts();

  if (process.env.BASELINE_UPDATE === "1") {
    writeBaseline(counts);
    it("BASELINE_UPDATE=1 — baseline 을 현재 카운트로 갱신했어요", () => {
      const total = Object.values(counts).reduce((a, b) => a + b, 0);
      console.log(
        `[baseline updated] files: ${Object.keys(counts).length}, total lines: ${total}`,
      );
      expect(fs.existsSync(baselinePath)).toBe(true);
    });
    return;
  }

  const baseline = loadBaseline();

  it("baseline 파일이 존재해요", () => {
    expect(
      fs.existsSync(baselinePath),
      "BASELINE_UPDATE=1 npm test -- hardcoded-korean-ratchet 로 baseline 을 먼저 생성하세요.",
    ).toBe(true);
  });

  it("기존 파일이 baseline 이상으로 한국어 라인을 늘리지 않아요", () => {
    const increases: string[] = [];
    for (const [file, current] of Object.entries(counts)) {
      const allowed = baseline.files[file] ?? 0;
      if (current > allowed) {
        increases.push(`  - ${file}: ${allowed} → ${current} (+${current - allowed})`);
      }
    }
    expect(
      increases,
      `다음 파일에서 한국어 하드코딩 라인이 baseline 보다 증가했어요:\n` +
        increases.join("\n") +
        "\n→ dict/{ko,en}/<section>.ts 의 키로 옮긴 뒤 t() / translate() 호출로 바꿔주세요. " +
        "정당한 사유가 있다면 `BASELINE_UPDATE=1 npm test -- hardcoded-korean-ratchet` 로 baseline 을 갱신하고 PR review 에서 사유를 명시하세요. " +
        "(spec/conventions/i18n-userguide.md Principle 1)",
    ).toEqual([]);
  });

  it("baseline 에 없는 신규 파일이 한국어 라인을 도입하지 않아요", () => {
    const newViolators = Object.keys(counts)
      .filter((f) => !(f in baseline.files))
      .map((f) => `  - ${f}: +${counts[f]} 라인`)
      .sort();
    expect(
      newViolators,
      `baseline 에 없는 신규 파일에서 한국어 하드코딩 라인이 발견됐어요:\n` +
        newViolators.join("\n") +
        "\n→ 작성 시점에 dict/{ko,en}/<section>.ts 의 키로 옮겨주세요. " +
        "(spec/conventions/i18n-userguide.md Principle 1)",
    ).toEqual([]);
  });

  it("baseline 에 있지만 사라진 파일은 깔끔하게 제거됐어요 (info)", () => {
    const stale = Object.keys(baseline.files).filter((f) => !(f in counts));
    if (stale.length > 0) {
      console.log(
        `[ratchet] baseline 에 남아있지만 더 이상 위반이 없는 파일 ${stale.length} 건 — BASELINE_UPDATE=1 로 정리 권장:\n` +
          stale.map((s) => `  - ${s}`).join("\n"),
      );
    }
    // 본 항목은 정보성. 항상 통과.
    expect(true).toBe(true);
  });
});
