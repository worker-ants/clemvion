import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join, relative, resolve } from "node:path";

/**
 * UI label / hint / group / itemLabel parity guard.
 *
 * spec/conventions/i18n-userguide.md Principle 3-B — backend `*.schema.ts`
 * 의 zod `ui.label` / `ui.hint` / `ui.group` / `ui.itemLabel` 값은 frontend
 * `backend-labels.ts` 의 LABEL_KO / HINT_KO / GROUP_KO / ITEM_LABEL_KO 매핑에
 * 등록되어야 한다. PR #271 의 이슈 #2 ("Description override / Defaults overlay"
 * 영문 노출) 와 같은 회귀를 build 단계에서 차단.
 *
 * Strategy: backend `*.schema.ts` 파일을 string 으로 read 한 뒤 regex 로
 * literal 추출. zod 정의의 일관된 패턴 (`label: '...'`) 을 활용. 동적 표현
 * (`label: someConst`) 은 미커버 — i18n-userguide §Principle 3-B 의 "정적
 * 파싱 한정" 조항과 동일한 trade-off.
 */

const REPO_ROOT = resolve(__dirname, "../../../../../../");
const BACKEND_NODES_DIR = join(REPO_ROOT, "codebase/backend/src/nodes");
const BACKEND_LABELS_PATH = join(
  REPO_ROOT,
  "codebase/frontend/src/lib/i18n/backend-labels.ts",
);

// SoT path. spec/conventions/i18n-userguide.md §Principle 3-B.
// Each ui key may resolve from any of the listed mappings — option-style
// labels (`Single Turn`) live in OPTION_LABEL_KO, node-level labels
// (`AI Agent`) live in NODE_LABEL_KO, etc.
const UI_KEY_TO_MAPPING_CANDIDATES: Record<string, string[]> = {
  label: ["LABEL_KO", "OPTION_LABEL_KO", "NODE_LABEL_KO"],
  hint: ["HINT_KO"],
  group: ["GROUP_KO"],
  itemLabel: ["ITEM_LABEL_KO"],
};

// Heuristic exclusions: matches that are clearly not user-facing label
// values (e.g. expression-engine internal references). Add carefully —
// every exclusion weakens the guard.
const EXCLUDE_VALUE_PREFIXES = ["$", "{{", "<"]; // expression placeholders

/**
 * Baseline of historical misses — values already absent from backend-labels.ts
 * at the time this guard was introduced. Adding a new ui.* literal to a
 * backend schema **without** updating backend-labels.ts will produce an
 * extra entry beyond this baseline → test fails (ratchet pattern, mirrors
 * hardcoded-korean-ratchet.test.ts).
 *
 * Removing an entry from this set (by adding the mapping in backend-labels.ts)
 * is encouraged — the ratchet then prevents the same key from regressing.
 *
 * SoT for these literals: backend `*.schema.ts` files; mappings should be
 * added gradually in follow-up i18n PRs.
 */
const KNOWN_MISSES: Record<string, ReadonlySet<string>> = {
  label: new Set([
    "Integration ID",
    "Temperature",
    "Output Schema",
    "Error",
    "Include Evidence",
    "Success",
    "Parameter Name",
    "Expression",
    "Target Workflow",
    "Workflow Name",
    "Content-Type",
    "Encoding",
    "Inline CID",
    "To",
    "CC",
    "BCC",
    "Subject",
    "Attachments",
    "Main",
    "Match",
    "Unmatched",
    "Emit",
    "Done",
    "Operator",
    "True",
    "False",
    "Default",
    "Record values in meta",
    "Style",
    "Item Buttons",
    "X Axis",
    "Y Axis",
    "Colors",
    "Sortable",
    "Format",
  ]),
  hint: new Set([
    "Boolean expression — loop exits when truthy. Re-evaluated after every iteration.",
    "stop: throw on first branch failure (Parallel node FAILS). continue: wait for all branches, collect rejected branches in output.branches[i].error.",
    "Include before/after snapshots in meta.modifications (masked). Off by default.",
  ]),
  group: new Set<string>(),
  itemLabel: new Set(["Operation"]),
};

function walkSchemaFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...walkSchemaFiles(full));
    } else if (entry.name.endsWith(".schema.ts")) {
      out.push(full);
    }
  }
  return out;
}

/**
 * Extract `<uiKey>: '<value>'` / `"<value>"` occurrences from a schema TS
 * source. Only string-literal values are extracted; identifier / template
 * literal references are skipped (covered by the static-parsing limit
 * documented in spec).
 */
function extractUiValues(
  source: string,
  uiKey: string,
): Set<string> {
  // Match e.g.   label: 'Foo'   |   label: "Foo Bar"
  // Tolerate whitespace + optional trailing comma.
  const re = new RegExp(
    `\\b${uiKey}:\\s*(['"\\\`])([^'"\\\`]+)\\1`,
    "g",
  );
  const out = new Set<string>();
  for (const m of source.matchAll(re)) {
    const v = m[2].trim();
    if (!v) continue;
    if (EXCLUDE_VALUE_PREFIXES.some((p) => v.startsWith(p))) continue;
    out.add(v);
  }
  return out;
}

/**
 * Extract keys of an object literal `const LABEL_KO: Record<...> = { ... }`
 * from the backend-labels.ts source. We use string parsing rather than
 * `import` to avoid TS module resolution surprises during test runs.
 */
function extractMappingKeys(source: string, mappingName: string): Set<string> {
  const startMarker = `const ${mappingName}: Record<string, string> = {`;
  const startIdx = source.indexOf(startMarker);
  if (startIdx < 0) {
    throw new Error(`mapping ${mappingName} not found in backend-labels.ts`);
  }
  const bodyStart = startIdx + startMarker.length;
  // Scan until balanced closing `};`. The mappings don't contain nested
  // braces in their keys/values, so a simple counter is sufficient.
  let depth = 1;
  let i = bodyStart;
  while (i < source.length && depth > 0) {
    const ch = source[i];
    if (ch === "{") depth++;
    else if (ch === "}") depth--;
    if (depth === 0) break;
    i++;
  }
  const body = source.slice(bodyStart, i);
  // Match keys: either `"key with space":` or `bareIdent:`.
  const keyRe = /(?:"([^"]+)"|'([^']+)'|([A-Za-z_][\w]*))\s*:/g;
  const out = new Set<string>();
  for (const m of body.matchAll(keyRe)) {
    const key = m[1] ?? m[2] ?? m[3];
    if (key) out.add(key);
  }
  return out;
}

describe("backend ui.* ↔ frontend backend-labels parity", () => {
  const schemaFiles = walkSchemaFiles(BACKEND_NODES_DIR);
  const backendLabelsSource = readFileSync(BACKEND_LABELS_PATH, "utf-8");

  // Aggregate every ui.* value seen across all backend schemas.
  const collected: Record<string, Set<string>> = {
    label: new Set(),
    hint: new Set(),
    group: new Set(),
    itemLabel: new Set(),
  };
  for (const file of schemaFiles) {
    const src = readFileSync(file, "utf-8");
    for (const uiKey of Object.keys(collected)) {
      for (const v of extractUiValues(src, uiKey)) {
        collected[uiKey].add(v);
      }
    }
  }

  for (const [uiKey, mappingCandidates] of Object.entries(
    UI_KEY_TO_MAPPING_CANDIDATES,
  )) {
    it(`every backend ${uiKey} value is mapped in one of ${mappingCandidates.join(" / ")} (ratchet vs baseline)`, () => {
      const allMappingKeys = new Set<string>();
      for (const mapping of mappingCandidates) {
        for (const k of extractMappingKeys(backendLabelsSource, mapping)) {
          allMappingKeys.add(k);
        }
      }
      const baseline = KNOWN_MISSES[uiKey];
      const newMisses = [...collected[uiKey]].filter(
        (v) => !allMappingKeys.has(v) && !baseline.has(v),
      );
      if (newMisses.length > 0) {
        const list = newMisses.map((v) => `  - ${v}`).join("\n");
        throw new Error(
          `New backend ${uiKey} value(s) missing from ${mappingCandidates.join(" / ")}:\n` +
            `${list}\n` +
            `\nAdd entries to the appropriate mapping in backend-labels.ts (or to KNOWN_MISSES if intentional). ` +
            `SoT: spec/conventions/i18n-userguide.md §Principle 3-B`,
        );
      }
      // Also detect stale baseline entries — if a value was added to a
      // mapping, remove it from KNOWN_MISSES to tighten the ratchet.
      const staleBaseline = [...baseline].filter((v) => allMappingKeys.has(v));
      if (staleBaseline.length > 0) {
        const list = staleBaseline.map((v) => `  - ${v}`).join("\n");
        throw new Error(
          `Stale KNOWN_MISSES entries (now present in mapping — remove from baseline):\n${list}`,
        );
      }
    });
  }

  it("scans at least one schema file (sanity)", () => {
    expect(schemaFiles.length).toBeGreaterThan(5);
  });
});

// Suppress unused-warning for the regex utility export below if any.
export const __test_only__ = {
  REPO_ROOT,
  BACKEND_LABELS_PATH,
  BACKEND_NODES_DIR,
  relativeTo: (p: string) => relative(REPO_ROOT, p),
};
