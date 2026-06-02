import fs from "node:fs";
import path from "node:path";
import { describe, it, expect, beforeAll } from "vitest";
import {
  WARNING_KO,
  NODE_LABEL_KO,
  NODE_DESCRIPTION_KO,
  ERROR_KO,
  GRAPH_WARNING_KO,
} from "../backend-labels";
import { GRAPH_WARNING_RULES_BY_TYPE } from "@workflow/graph-warning-rules";

/**
 * Backend ↔ frontend i18n parity guard.
 *
 * 영문 SoT 원칙: backend `*.schema.ts` 의 NodeComponentMetadata 가 발행하는
 * 사용자 가시 문자열(node label, description, warningRules[].message) 의
 * 영문 값은 모두 frontend `backend-labels.ts` 의 한국어 매핑 테이블에 등록돼
 * 있어야 한다. 누락 시 ko 로케일에서 영문이 그대로 노출되는 사후 보정 PR
 * 패턴(예: PR #57, cbffad22 backend warningRules ko 매핑)을 차단.
 *
 * spec/conventions/i18n-userguide.md Principle 3 의 결정적 가드.
 *
 * 한계 — 본 가드는 schema 파일을 정규식으로 정적 파싱한다. 다음 형태는 미커버:
 * - 동적으로 생성된 message (`message: \`${prefix} ...\``, 변수에서 가져온 값)
 * - import 해온 message 상수 (다른 파일에서 정의된 string)
 * - validateConfig 의 imperative 반환 (런타임 평가 필요)
 *
 * 후속 과제: ts-morph 또는 TypeScript compiler API 기반 정적 분석으로 대체.
 */

// __dirname = codebase/frontend/src/lib/i18n/__tests__
// 6 hops back lands at the repo root (commit 33521233 의 codebase/ wrapper 반영).
const repoRoot = path.resolve(
  __dirname,
  "..",
  "..",
  "..",
  "..",
  "..",
  "..",
);
const backendNodesRoot = path.resolve(
  repoRoot,
  "codebase",
  "backend",
  "src",
  "nodes",
);

// 격리·CI 환경에서 backend 가 부재할 수 있으므로 fs 존재 시에만 검증.
const hasBackend = fs.existsSync(backendNodesRoot);

/**
 * `nodes/<cat>/<name>/<...>.schema.ts` 만 수집. nodes-coverage.test.ts 와
 * 동일한 수집 범위 (`_` prefix 디렉토리, `core/` 인프라 제외) 를 강제해
 * 두 가드의 검증 대상이 일관되도록 한다.
 */
function walkSchemaFiles(dir: string, isTop = true): string[] {
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (entry.name.startsWith("_")) continue;
      if (isTop && entry.name === "core") continue;
      const full = path.join(dir, entry.name);
      out.push(...walkSchemaFiles(full, false));
    } else if (entry.isFile() && entry.name.endsWith(".schema.ts")) {
      out.push(path.join(dir, entry.name));
    }
  }
  return out;
}

/**
 * `warningRules: [ { ..., message: '...' }, ... ]` 블록을 찾아 message 리터럴을
 * 모두 추출한다. validateConfig 의 imperative 반환은 정적 추출이 어려워 별도
 * 가드로 분리 (Principle 3 의 후속 보강 후보).
 */
function extractWarningMessages(source: string): string[] {
  const out = new Set<string>();
  const startRe = /\bwarningRules\s*:\s*\[/g;
  let m: RegExpExecArray | null;
  while ((m = startRe.exec(source)) !== null) {
    const arrayStart = m.index + m[0].length;
    let depth = 1;
    let i = arrayStart;
    while (i < source.length && depth > 0) {
      const c = source[i];
      if (c === "[") depth++;
      else if (c === "]") depth--;
      i++;
    }
    const block = source.slice(arrayStart, i - 1);
    const msgRe = /\bmessage\s*:\s*(['"`])((?:\\.|(?!\1).)*)\1/g;
    let mm: RegExpExecArray | null;
    while ((mm = msgRe.exec(block)) !== null) {
      out.add(unescape(mm[2]));
    }
  }
  return [...out];
}

/**
 * `<name>NodeMetadata: NodeComponentMetadata = { ... }` 블록 안의 **최상위 깊이**
 * `label: '...'` / `description: '...'` 만 추출한다. zod meta({ ui: { label: ... } })
 * 같은 nested label 은 (field label 이지 node label 이 아니므로) 의도적으로 제외.
 */
function extractNodeMetadataTopFields(source: string): {
  labels: string[];
  descriptions: string[];
} {
  const labels = new Set<string>();
  const descriptions = new Set<string>();
  const startRe = /\bNodeMetadata\s*:\s*NodeComponentMetadata\s*=\s*\{/g;
  let m: RegExpExecArray | null;
  while ((m = startRe.exec(source)) !== null) {
    const objStart = m.index + m[0].length;
    let depth = 1;
    let i = objStart;
    while (i < source.length && depth > 0) {
      const c = source[i];
      if (c === "{") depth++;
      else if (c === "}") depth--;
      i++;
    }
    const block = source.slice(objStart, i - 1);
    const top = collectTopLevelStringFields(block);
    if (top.label !== undefined) labels.add(top.label);
    if (top.description !== undefined) descriptions.add(top.description);
  }
  return { labels: [...labels], descriptions: [...descriptions] };
}

/**
 * 객체 본문에서 **최상위 깊이** 의 `<key>: '<value>'` 쌍만 모은다. 중첩 객체·
 * 배열·괄호식·문자열 리터럴·주석을 모두 건너뛰는 단순 상태 기계.
 *
 * 한계 — 정규식 기반이라 다음은 미커버:
 * - 동적 키 (`[symbol]: '...'`)
 * - template literal 안의 `${...}` 표현식이 backtick 종료로 오인될 수 있음 (skipString 한계)
 * - getter/setter, 구조분해 할당
 *
 * NodeComponentMetadata 의 단순 `key: 'string'` 패턴에 한정해 사용한다.
 */
function collectTopLevelStringFields(block: string): Record<string, string> {
  const fields: Record<string, string> = {};
  let depth = 0;
  let i = 0;
  while (i < block.length) {
    const c = block[i];
    if (c === "{" || c === "[" || c === "(") {
      depth++;
      i++;
      continue;
    }
    if (c === "}" || c === "]" || c === ")") {
      depth--;
      i++;
      continue;
    }
    if (c === "'" || c === '"' || c === "`") {
      i = skipString(block, i);
      continue;
    }
    if (c === "/" && block[i + 1] === "/") {
      while (i < block.length && block[i] !== "\n") i++;
      continue;
    }
    if (c === "/" && block[i + 1] === "*") {
      i += 2;
      while (i < block.length && !(block[i] === "*" && block[i + 1] === "/")) i++;
      i += 2;
      continue;
    }
    if (depth === 0) {
      const rest = block.slice(i);
      const fm = rest.match(
        /^([a-zA-Z_][a-zA-Z0-9_]*)\s*:\s*(['"`])((?:\\.|(?!\2).)*)\2/,
      );
      if (fm) {
        fields[fm[1]] = unescapeString(fm[3]);
        i += fm[0].length;
        continue;
      }
    }
    i++;
  }
  return fields;
}

/**
 * 인용부호로 시작하는 문자열 리터럴을 건너뛰고 종료 위치를 반환.
 *
 * 한계 — backtick (`` ` ``) 문자열 안의 `${...}` interpolation 을 처리하지
 * 않으므로 표현식 안의 중첩 문자열·끝 backtick 이 잘못 매칭될 수 있다. 본
 * 가드는 backend schema 의 단순 string literal 만 처리하므로 실용 한도 안.
 */
function skipString(block: string, start: number): number {
  const quote = block[start];
  let i = start + 1;
  while (i < block.length && block[i] !== quote) {
    if (block[i] === "\\") i++;
    i++;
  }
  return i + 1;
}

/**
 * 정규식 capture group 으로 뽑은 string 안의 escape sequence (`\\n`, `\\"` 등)
 * 를 실제 문자로 복원. 전역 `unescape()` (deprecated) 와 명칭 충돌 회피를 위해
 * `unescapeString` 명명.
 */
function unescapeString(s: string): string {
  return s.replace(/\\(['"`\\nrt])/g, (_, ch) => {
    if (ch === "n") return "\n";
    if (ch === "r") return "\r";
    if (ch === "t") return "\t";
    return ch;
  });
}

describe.runIf(hasBackend)("backend-labels parity (영문 SoT → ko 매핑)", () => {
  // `describe` 콜백 최상단에서 IO 를 수행하면 vitest 의 수집 단계에서 에러가
  // 나도 `it` 들이 등록되기 전이라 사용자에게 noisy crash 로 노출된다.
  // `beforeAll` 안으로 옮겨 수집과 IO 를 분리.
  let schemaFiles: string[];
  const allWarnings = new Set<string>();
  const allLabels = new Set<string>();
  const allDescriptions = new Set<string>();

  beforeAll(() => {
    schemaFiles = walkSchemaFiles(backendNodesRoot);
    for (const file of schemaFiles) {
      const source = fs.readFileSync(file, "utf8");
      for (const w of extractWarningMessages(source)) allWarnings.add(w);
      const top = extractNodeMetadataTopFields(source);
      for (const l of top.labels) allLabels.add(l);
      for (const d of top.descriptions) allDescriptions.add(d);
    }
  });

  it("backend warningRules 의 모든 message 가 WARNING_KO 에 매핑돼요", () => {
    const koKeys = new Set(Object.keys(WARNING_KO));
    const missing = [...allWarnings].filter((m) => !koKeys.has(m)).sort();
    expect(
      missing,
      `backend warningRules 가 발행하지만 WARNING_KO 에 매핑이 없는 메시지 ${missing.length} 건:\n` +
        missing.map((s) => `  - ${JSON.stringify(s)}`).join("\n") +
        "\n→ codebase/frontend/src/lib/i18n/backend-labels.ts 의 WARNING_KO 에 한국어 매핑을 추가해주세요. (spec/conventions/i18n-userguide.md Principle 3)",
    ).toEqual([]);
  });

  it("backend NodeMetadata 의 모든 label 이 NODE_LABEL_KO 에 매핑돼요", () => {
    const koKeys = new Set(Object.keys(NODE_LABEL_KO));
    const missing = [...allLabels].filter((l) => !koKeys.has(l)).sort();
    expect(
      missing,
      `backend NodeMetadata.label 이지만 NODE_LABEL_KO 에 매핑이 없는 라벨 ${missing.length} 건:\n` +
        missing.map((s) => `  - ${JSON.stringify(s)}`).join("\n") +
        "\n→ codebase/frontend/src/lib/i18n/backend-labels.ts 의 NODE_LABEL_KO 에 한국어 매핑을 추가해주세요. (Principle 3 / Principle 4)",
    ).toEqual([]);
  });

  it("backend NodeMetadata 의 모든 description 이 NODE_DESCRIPTION_KO 에 매핑돼요", () => {
    const koKeys = new Set(Object.keys(NODE_DESCRIPTION_KO));
    const missing = [...allDescriptions].filter((d) => !koKeys.has(d)).sort();
    expect(
      missing,
      `backend NodeMetadata.description 이지만 NODE_DESCRIPTION_KO 에 매핑이 없는 설명 ${missing.length} 건:\n` +
        missing.map((s) => `  - ${JSON.stringify(s)}`).join("\n") +
        "\n→ codebase/frontend/src/lib/i18n/backend-labels.ts 의 NODE_DESCRIPTION_KO 에 한국어 매핑을 추가해주세요. (Principle 3 / Principle 4)",
    ).toEqual([]);
  });

  // 현재 backend 노드 카탈로그(7 카테고리 27 노드) 대비 여유 마진.
  // 절반 가량으로 줄어들면 ratchet 가드가 의도된 검증 범위를 잃었을 가능성.
  const MIN_EXPECTED_NODE_SCHEMAS = 10;

  it(`발견한 schema 파일이 sanity 수준이에요 (>= ${MIN_EXPECTED_NODE_SCHEMAS} 개)`, () => {
    expect(schemaFiles.length).toBeGreaterThanOrEqual(MIN_EXPECTED_NODE_SCHEMAS);
  });
});

/**
 * i18n Principle 3-C 자동 가드 — 코드/동적 backend 메시지 localization parity.
 *
 * 기존 P1-B(위 describe)는 `*.schema.ts` 의 **정적** warningRules[].message 만
 * 커버한다. 동적 graphWarningRules 메시지(`${node.label}` 보간)와 error 코드는
 * P1-B 미커버이며 아래 P3-C-1 / P3-C-2 가 전담한다 (ruleId·code 는 렌더 메시지가
 * 동적이어도 정적 상수라 키 parity 검증이 성립).
 *
 * SoT: spec/conventions/i18n-userguide.md Principle 3-C.
 */
describe("i18n Principle 3-C — 코드/동적 메시지 매핑 parity", () => {
  it("P3-C-1: 등재된 모든 graphWarningRule ruleId 가 GRAPH_WARNING_KO 에 매핑돼요", () => {
    const ruleIds = Object.values(GRAPH_WARNING_RULES_BY_TYPE)
      .flatMap((rules) => rules.map((r) => r.id))
      .sort();
    const koKeys = new Set(Object.keys(GRAPH_WARNING_KO));
    const missing = ruleIds.filter((id) => !koKeys.has(id));
    expect(
      missing,
      `GRAPH_WARNING_KO 에 매핑이 없는 graphWarningRule ruleId ${missing.length} 건:\n` +
        missing.map((s) => `  - ${s}`).join("\n") +
        "\n→ codebase/frontend/src/lib/i18n/backend-labels.ts 의 GRAPH_WARNING_KO 에 한국어 템플릿을 추가해주세요. (Principle 3-C)",
    ).toEqual([]);
  });

  it("P3-C-2: user-facing 등록 error 코드가 ERROR_KO 에 매핑돼요", () => {
    // "user-facing localized" 로 등록한 코드 집합. ErrorCode enum 전체가 아니라
    // 사용자 노출이 확정된 코드만 — 점진 확장 (Principle 3-C 범위).
    const LOCALIZED_ERROR_CODES = ["GRAPH_VALIDATION_FAILED"];
    const koKeys = new Set(Object.keys(ERROR_KO));
    const missing = LOCALIZED_ERROR_CODES.filter((c) => !koKeys.has(c));
    expect(
      missing,
      `ERROR_KO 에 매핑이 없는 user-facing error 코드 ${missing.length} 건:\n` +
        missing.map((s) => `  - ${s}`).join("\n") +
        "\n→ codebase/frontend/src/lib/i18n/backend-labels.ts 의 ERROR_KO 에 한국어 메시지를 추가해주세요. (Principle 3-C)",
    ).toEqual([]);
  });
});
