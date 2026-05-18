import fs from "node:fs";
import path from "node:path";
import { describe, it, expect } from "vitest";
import {
  WARNING_KO,
  NODE_LABEL_KO,
  NODE_DESCRIPTION_KO,
} from "../backend-labels";

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

function walkSchemaFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walkSchemaFiles(full));
    else if (entry.isFile() && entry.name.endsWith(".schema.ts")) out.push(full);
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
        fields[fm[1]] = unescape(fm[3]);
        i += fm[0].length;
        continue;
      }
    }
    i++;
  }
  return fields;
}

function skipString(block: string, start: number): number {
  const quote = block[start];
  let i = start + 1;
  while (i < block.length && block[i] !== quote) {
    if (block[i] === "\\") i++;
    i++;
  }
  return i + 1;
}

function unescape(s: string): string {
  return s.replace(/\\(['"`\\nrt])/g, (_, ch) => {
    if (ch === "n") return "\n";
    if (ch === "r") return "\r";
    if (ch === "t") return "\t";
    return ch;
  });
}

describe.runIf(hasBackend)("backend-labels parity (영문 SoT → ko 매핑)", () => {
  const schemaFiles = walkSchemaFiles(backendNodesRoot);
  const allWarnings = new Set<string>();
  const allLabels = new Set<string>();
  const allDescriptions = new Set<string>();

  for (const file of schemaFiles) {
    const source = fs.readFileSync(file, "utf8");
    for (const w of extractWarningMessages(source)) allWarnings.add(w);
    const top = extractNodeMetadataTopFields(source);
    for (const l of top.labels) allLabels.add(l);
    for (const d of top.descriptions) allDescriptions.add(d);
  }

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

  it("발견한 schema 파일이 sanity 수준이에요 (>= 10 개)", () => {
    expect(schemaFiles.length).toBeGreaterThanOrEqual(10);
  });
});
