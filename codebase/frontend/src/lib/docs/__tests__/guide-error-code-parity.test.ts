import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

import { repoRoot } from "./impl-anchor-parse";

/**
 * **가이드의 에러 코드 표가 카탈로그와 양방향으로 맞아야 한다.**
 *
 * 자매 `guide-identifier-existence.test.ts` 는 가이드가 적은 코드가 실재하는지(가이드 → 코드)만
 * 본다. 실재 코드가 가이드 표에서 빠지는 방향(코드 → 가이드)은 그 가드가 못 잡는다. 실제로
 * 노드 종류별 표가 스펙 대비 5종을 빠뜨린 채 머지됐다(NERV Task `CLE-T-4T27RQ`). 이 파일은
 * `guide-sanitized-message-parity.test.ts` 의 양방향 대조를 두 표면에 적용한다.
 *
 * 1. `run-results{,.en}.mdx` 「노드 종류 | 코드」 표 ↔ 카탈로그 미러 `CLE-API-ERRCODES-EXEC` §6.6
 * 2. `integrations{,.en}.mdx` 가 옮긴 `MAKESHOP_UNRESOLVED_PATH_PARAM` 메시지 ↔ `makeshop.handler.ts` 템플릿
 *
 * 다른 가드처럼 소스를 import 하지 않고 텍스트로 읽는다. 추출이 깨지면 부분집합 단언이 저절로
 * 통과하므로 각 표면마다 vacuity floor 를 먼저 둔다.
 */

// ─── 1. 노드 종류별 에러 코드 표 ─────────────────────────────────────────────

const CATALOG_REL = "spec/CLE-API/CLE-API-ERRCODES-EXEC.md";
const CATALOG_SECTION = "## 6.6 ";

/** 카탈로그 §6.6 의 부류 → 가이드 표의 행 이름. */
const ROW_MAP: ReadonlyArray<{ catalog: string; guide: string }> = [
  { catalog: "HTTP", guide: "HTTP Request" },
  { catalog: "Database", guide: "Database" },
  { catalog: "Email", guide: "Email" },
  { catalog: "LLM", guide: "AI · LLM" },
  { catalog: "Code 노드", guide: "Code" },
  { catalog: "서브 워크플로우", guide: "Sub-workflow" },
];

/**
 * 가이드 표에 행을 두지 않는 카탈로그 부류와 그 이유. 카탈로그에 부류가 새로 생기면
 * `ROW_MAP` 이나 여기 중 한 곳에 올려야 테스트가 통과한다.
 */
const UNMAPPED_CATALOG_ROWS = new Map<string, string>([
  [
    "통합 공통 · Cafe24 · MakeShop",
    "코드를 와일드카드(`INTEGRATION_*` 등)로만 적고 목록은 §6.22 와 통합 노드 가이드가 다룬다",
  ],
  [
    "노드 취소",
    "`AbortError` 는 노드 실행의 error.code 이고 노드 종류를 따르지 않는다",
  ],
  [
    "반복 · 병렬 실패 회차 · 에러 포트 라우팅",
    "`UNKNOWN_ERROR` 는 대체값이고 노드 종류를 따르지 않는다",
  ],
]);

/**
 * 매핑한 부류의 코드 칸에 있지만 가이드 표에 싣지 않는 토큰과 그 이유. 카탈로그에서 사라지면
 * 이 목록에서도 지워야 한다(아래 「낡은 예외」 단언).
 */
const NOT_GUIDE_CODES = new Map<string, string>([
  ["HTTP_TIMEOUT", "발행하지 않아 enum 에서도 지웠다. 카탈로그 행은 스펙 초안 승인 뒤 미러에서 사라진다(NERV Task `CLE-T-P0W82J`)"],
  ["LLM_TIMEOUT", "발행하지 않아 enum 에서도 지웠다. 카탈로그 행은 스펙 초안 승인 뒤 미러에서 사라진다(NERV Task `CLE-T-P0W82J`)"],
  ["ALLOW_PRIVATE_HOST_TARGETS", "환경 변수다"],
  ["CODE_NODE_MEMORY_LIMIT_MB", "환경 변수다"],
]);

const GUIDE_TABLES: ReadonlyArray<{ rel: string; header: string }> = [
  {
    rel: "codebase/frontend/src/content/docs/05-run-and-debug/run-results.mdx",
    header: "| 노드 종류 | 코드 |",
  },
  {
    rel: "codebase/frontend/src/content/docs/05-run-and-debug/run-results.en.mdx",
    header: "| Node kind | Codes |",
  },
];

/** 백틱 하나가 코드 토큰 하나만 감싼 경우. `INTEGRATION_*` 같은 와일드카드는 걸리지 않는다. */
const CODE_SPAN = /`([A-Z][A-Z0-9_]*[A-Z0-9])`/g;

function codeTokens(cell: string): string[] {
  return [...cell.matchAll(new RegExp(CODE_SPAN))].map((m) => m[1]);
}

/** 마크다운 표 행에서 앞 두 칸(이름 · 코드)을 꺼낸다. 머리 행과 구분 행은 건너뛴다. */
function tableRows(lines: readonly string[]): Map<string, string[]> {
  const rows = new Map<string, string[]>();
  for (const line of lines) {
    const cells = line.split("|").map((c) => c.trim());
    // "| a | b | c |" → ["", "a", "b", "c", ""]
    if (cells.length < 4 || /^-+$/.test(cells[1])) continue;
    rows.set(cells[1], codeTokens(cells[2]));
  }
  return rows;
}

/** 카탈로그 §6.6 첫 표의 부류별 코드. 표는 절 머리 뒤 첫 연속 `|` 줄 묶음이다. */
function parseCatalogRows(text: string): Map<string, string[]> {
  const start = text.indexOf(`\n${CATALOG_SECTION}`);
  if (start < 0) return new Map();
  const body = text
    .slice(start + 1)
    .split("\n")
    .slice(1);
  const end = body.findIndex((l) => l.startsWith("## "));
  const section = end < 0 ? body : body.slice(0, end);
  const first = section.findIndex((l) => l.startsWith("|"));
  if (first < 0) return new Map();
  const after = section.slice(first);
  const stop = after.findIndex((l) => !l.startsWith("|"));
  const table = stop < 0 ? after : after.slice(0, stop);
  // 머리 행(`| 부류 | 코드 | 정의 문서 |`)을 뺀다.
  const rows = tableRows(table);
  rows.delete(table[0].split("|")[1].trim());
  return rows;
}

/** 가이드에서 `header` 로 시작하는 표의 행 이름별 코드. */
function parseGuideRows(text: string, header: string): Map<string, string[]> {
  const lines = text.split("\n");
  const at = lines.findIndex((l) => l.trim() === header);
  if (at < 0) return new Map();
  const after = lines.slice(at + 1);
  const stop = after.findIndex((l) => !l.startsWith("|"));
  return tableRows(stop < 0 ? after : after.slice(0, stop));
}

type RowDiff = { row: string; missing: string[]; orphans: string[] };

/**
 * 부류마다 카탈로그 코드(예외 제외)와 가이드 행 코드를 양방향으로 비교한다. `missing` 은
 * 가이드에 없는 카탈로그 코드(코드 → 가이드), `orphans` 는 카탈로그 그 부류에 없는 가이드 코드다.
 */
function diffRows(
  catalog: Map<string, string[]>,
  guide: Map<string, string[]>,
  rowMap: ReadonlyArray<{ catalog: string; guide: string }>,
  notGuide: ReadonlySet<string>,
): RowDiff[] {
  return rowMap.map(({ catalog: c, guide: g }) => {
    const want = (catalog.get(c) ?? []).filter((t) => !notGuide.has(t));
    const have = guide.get(g) ?? [];
    return {
      row: g,
      missing: [...new Set(want.filter((t) => !have.includes(t)))],
      orphans: have.filter((t) => !want.includes(t)),
    };
  });
}

describe("diffRows — 양방향 대조 fixture", () => {
  const catalog = new Map([
    ["HTTP", ["HTTP_A", "HTTP_TIMEOUT", "HTTP_B"]],
    ["Database", ["DB_A", "ENV_FLAG"]],
  ]);
  const map = [
    { catalog: "HTTP", guide: "HTTP Request" },
    { catalog: "Database", guide: "Database" },
  ];
  const notGuide = new Set(["HTTP_TIMEOUT", "ENV_FLAG"]);

  it("가이드가 카탈로그 코드를 빠뜨리면 missing 에 잡힌다 (코드 → 가이드)", () => {
    const guide = new Map([
      ["HTTP Request", ["HTTP_A"]],
      ["Database", ["DB_A"]],
    ]);
    expect(diffRows(catalog, guide, map, notGuide)).toEqual([
      { row: "HTTP Request", missing: ["HTTP_B"], orphans: [] },
      { row: "Database", missing: [], orphans: [] },
    ]);
  });

  it("가이드 코드가 다른 부류 행에 있으면 양쪽 모두에 잡힌다", () => {
    const guide = new Map([
      ["HTTP Request", ["HTTP_A", "HTTP_B", "DB_A"]],
      ["Database", []],
    ]);
    expect(diffRows(catalog, guide, map, notGuide)).toEqual([
      { row: "HTTP Request", missing: [], orphans: ["DB_A"] },
      { row: "Database", missing: ["DB_A"], orphans: [] },
    ]);
  });

  it("예외 토큰은 가이드에 없어도 되고 있으면 orphan 이다", () => {
    const guide = new Map([
      ["HTTP Request", ["HTTP_A", "HTTP_B", "HTTP_TIMEOUT"]],
      ["Database", ["DB_A"]],
    ]);
    expect(diffRows(catalog, guide, map, notGuide)[0].orphans).toEqual([
      "HTTP_TIMEOUT",
    ]);
  });

  it("표 파서는 와일드카드 · 괄호 설명 안의 백틱 문구를 코드로 세지 않는다", () => {
    const text = [
      "intro",
      "## 6.6 노드",
      "",
      "| 부류 | 코드 | 정의 문서 |",
      "|------|------|------|",
      "| Email | `E_A`(설명 `details.code` · `INTEGRATION_*`) · `E_B` | [x](y) |",
      "",
      "| 부류 | 코드 |",
      "| Other | `O_A` |",
      "## 6.7 다음",
    ].join("\n");
    expect([...parseCatalogRows(text)]).toEqual([["Email", ["E_A", "E_B"]]]);
  });
});

describe("가이드 노드 종류별 에러 코드 표 ↔ 카탈로그 §6.6", () => {
  const root = repoRoot();
  const catalog = parseCatalogRows(
    fs.readFileSync(path.join(root, CATALOG_REL), "utf8"),
  );
  const mappedTokens = ROW_MAP.flatMap((r) => catalog.get(r.catalog) ?? []);

  it("카탈로그 표를 실제로 읽는다 (vacuity floor)", () => {
    expect(catalog.size).toBeGreaterThanOrEqual(ROW_MAP.length);
    expect(mappedTokens.length).toBeGreaterThanOrEqual(25);
    expect(mappedTokens).toContain("HTTP_TRANSPORT_FAILED");
  });

  it("카탈로그의 모든 부류가 매핑되거나 제외 이유를 가진다", () => {
    const known = new Set([
      ...ROW_MAP.map((r) => r.catalog),
      ...UNMAPPED_CATALOG_ROWS.keys(),
    ]);
    expect([...catalog.keys()].filter((k) => !known.has(k))).toEqual([]);
    expect([...known].filter((k) => !catalog.has(k))).toEqual([]);
  });

  it("낡은 예외가 없다 — 예외 토큰은 모두 매핑한 부류에 실재한다", () => {
    expect(
      [...NOT_GUIDE_CODES.keys()].filter((t) => !mappedTokens.includes(t)),
    ).toEqual([]);
  });

  for (const { rel, header } of GUIDE_TABLES) {
    describe(rel, () => {
      const guide = parseGuideRows(
        fs.readFileSync(path.join(root, rel), "utf8"),
        header,
      );

      it("표의 행을 모두 찾는다 (vacuity floor)", () => {
        expect([...guide.keys()]).toEqual(ROW_MAP.map((r) => r.guide));
      });

      it("부류마다 카탈로그 코드와 가이드 코드가 양방향으로 같다", () => {
        const diffs = diffRows(
          catalog,
          guide,
          ROW_MAP,
          new Set(NOT_GUIDE_CODES.keys()),
        ).filter((d) => d.missing.length > 0 || d.orphans.length > 0);
        expect(diffs).toEqual([]);
      });
    });
  }
});

// ─── 2. MakeShop 메시지 문구 ↔ 핸들러 템플릿 ─────────────────────────────────

const MAKESHOP_HANDLER_REL =
  "codebase/backend/src/nodes/integration/makeshop/makeshop.handler.ts";
const MAKESHOP_GUIDES = [
  "codebase/frontend/src/content/docs/02-nodes/integrations.mdx",
  "codebase/frontend/src/content/docs/02-nodes/integrations.en.mdx",
];
const MESSAGE_PREFIX = "MAKESHOP_UNRESOLVED_PATH_PARAM: ";

/** 백틱으로 감싼, `prefix` 로 시작하는 문구를 모두 꺼낸다(템플릿 리터럴 · 마크다운 공통). */
function quotedWithPrefix(text: string, prefix: string): string[] {
  return text
    .split("`")
    .filter((_, i) => i % 2 === 1)
    .filter((s) => s.startsWith(prefix));
}

/**
 * 가이드 문구가 템플릿과 맞는지 본다. 템플릿의 `${…}` 와 가이드의 `...` 를 같은 자리표시로 보고
 * 고정 문구 조각을 차례로 비교한다. 가이드는 보간 뒤를 생략하므로 마지막 조각은 접두만 맞으면 된다.
 * 맞으면 `null`, 아니면 어긋난 이유를 돌려준다.
 */
function prefixMismatch(guide: string, template: string): string | null {
  const want = template.split(/\$\{[^}]*\}/);
  const have = guide.split(/\.\.\.|…/);
  if (have.length < 2) return "가이드 문구에 자리표시 `...` 가 없다";
  if (have.length > want.length)
    return "가이드 문구의 자리표시가 템플릿보다 많다";
  for (let i = 0; i < have.length - 1; i++) {
    if (have[i] !== want[i])
      return `조각 ${i}: ${JSON.stringify(have[i])} ≠ ${JSON.stringify(want[i])}`;
  }
  const last = have.length - 1;
  if (!want[last].startsWith(have[last])) {
    return `마지막 조각 ${JSON.stringify(have[last])} 가 ${JSON.stringify(want[last])} 의 접두가 아니다`;
  }
  return null;
}

describe("prefixMismatch — 문구 대조 fixture", () => {
  const template = "P: op '${a}' has x: ${b}. Check y.";

  it("보간을 `...` 로 줄이고 뒤를 생략한 문구는 맞다", () => {
    expect(prefixMismatch("P: op '...' has x: ...", template)).toBeNull();
    expect(prefixMismatch("P: op '...' has", template)).toBeNull();
  });

  it("고정 문구 한 단어가 달라지면 잡는다", () => {
    expect(prefixMismatch("P: op '...' have x: ...", template)).toMatch(
      /조각 1/,
    );
  });

  it("마지막 조각이 템플릿에 없는 말이면 잡는다", () => {
    expect(prefixMismatch("P: op '...' has x: ... Retry.", template)).toMatch(
      /마지막 조각/,
    );
  });

  it("자리표시가 없거나 템플릿보다 많으면 잡는다", () => {
    expect(prefixMismatch("P: op 'x' has x: y", template)).toMatch(/자리표시/);
    expect(prefixMismatch("P: op '...' has x: ... ... ...", template)).toMatch(
      /많다/,
    );
  });
});

describe("MakeShop 가이드 메시지 문구 ↔ makeshop.handler.ts 템플릿 접두", () => {
  const root = repoRoot();
  const templates = quotedWithPrefix(
    fs.readFileSync(path.join(root, MAKESHOP_HANDLER_REL), "utf8"),
    MESSAGE_PREFIX,
  );

  it("핸들러에서 템플릿을 하나 찾는다 (vacuity floor)", () => {
    expect(templates).toHaveLength(1);
    expect(templates[0]).toContain("${");
  });

  for (const rel of MAKESHOP_GUIDES) {
    it(`${rel} 의 문구가 템플릿 접두와 같다`, () => {
      const quotes = quotedWithPrefix(
        fs.readFileSync(path.join(root, rel), "utf8"),
        MESSAGE_PREFIX,
      );
      expect(quotes).toHaveLength(1);
      expect(prefixMismatch(quotes[0], templates[0])).toBeNull();
    });
  }
});
