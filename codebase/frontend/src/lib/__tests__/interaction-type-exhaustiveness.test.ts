import { describe, it, expect } from "vitest";
import ts from "typescript";
import {
  INTERACTION_TYPE_VALUES,
  CONVERSATION_SOURCE_VALUES,
} from "@/lib/conversation/interaction-type-registry";
import { readFileSync } from "node:fs";
import { join } from "node:path";


/**
 * AST guard for `WaitingInteractionType` exhaustiveness.
 *
 * spec/conventions/interaction-type-registry.md §1.2 — the registry lists
 * every code site that switches on this enum. Adding a new enum value must
 * update all those sites in the same PR. The TS compiler enforces switches
 * via `assertNever`, but `if/else` chains and other non-switch consumers
 * (drawer / page detail / SchemaForm-style flag derivation) bypass that
 * check. This test parses each registered file and asserts every enum value
 * appears as a string literal **in code** — missing a value = fail.
 *
 * Adding a new value:
 *   1. Update `WaitingInteractionType` in execution-store.ts
 *   2. Update backend `WaitingInteractionType` in execution-engine.service.ts
 *   3. Update spec/conventions/interaction-type-registry.md §1.2 matrix
 *   4. Update every file listed in `REGISTRY_SITES` below (this test fails
 *      until all sites mention the new literal).
 */

// SoT: spec/conventions/interaction-type-registry.md §1.2 column "Frontend
// 처리 분기 위치". A new code site that branches on WaitingInteractionType
// MUST also be added to this list (and to the spec matrix).
//
// The exhaustive `isWaitingForm/Buttons/Conversation` derivation shared by the
// editor Run Results drawer and the execution-detail page lives in the
// `use-result-detail-waiting.ts` `deriveFlags` closure (single site — the two
// consumers delegate). The drawer's residual `isLiveConversation` only
// distinguishes the two AI states and is a subset consumer, not an exhaustive
// branch, so it is TS-`assertNever`-covered rather than listed here (rule 3).
const REGISTRY_SITES = [
  "codebase/frontend/src/lib/websocket/use-execution-events.ts",
  "codebase/frontend/src/lib/websocket/apply-execution-snapshot.ts",
  "codebase/frontend/src/components/editor/run-results/use-result-detail-waiting.ts",
];

// The value list and its compile-time `Exclude` assertion both live in
// `interaction-type-registry.ts` — a source module, so tsc actually reads
// them (this file is under `src/**/__tests__/**`, which tsconfig excludes,
// so an assertion written here would be dead). This test only imports that
// list and runs the runtime AST guard below.
const ENUM_VALUES = INTERACTION_TYPE_VALUES;

function readRepoFile(relPath: string): string {
  // tests run with cwd = `codebase/frontend`, so walk up to repo root.
  return readFileSync(join(__dirname, "../../../../../", relPath), "utf-8");
}

/**
 * Collect every string literal that appears in **code** (not in comments).
 *
 * Why the TypeScript parser rather than a regex: this guard's threat model is
 * "a registry site forgot to branch on a new enum value", and a site that only
 * *mentions* the value in prose must not satisfy it. A regex over raw source
 * cannot tell the two apart — the previous `['"`]value['"`]` pattern was
 * measured (PR #968 testing review) to stay green when the real branch in
 * `use-result-detail-waiting.ts` was broken, because the same file's JSDoc
 * quotes the value. Dropping the backtick from that pattern would not have
 * fixed it either: comments here quote values with single quotes too (e.g.
 * `use-execution-events.ts` documents its nodeType fallbacks as `→ 'buttons'`).
 *
 * Comments are trivia, not AST nodes, so parsing excludes them structurally.
 * Matching against *every* code literal (rather than narrower `=== "x"` /
 * `case "x":` shapes) keeps legitimate branch forms passing — the registry
 * sites variously use switch cases, `===` comparisons, union type
 * declarations, object property values, `return`s, and ternaries.
 *
 * `NoSubstitutionTemplateLiteral` counts too: a backtick literal in code is
 * code, and excluding it would only risk false failures.
 */
function collectCodeStringLiterals(source: string, fileName: string): Set<string> {
  const sourceFile = ts.createSourceFile(
    fileName,
    source,
    ts.ScriptTarget.Latest,
    /* setParentNodes */ false,
    ts.ScriptKind.TS,
  );
  const literals = new Set<string>();
  const visit = (node: ts.Node): void => {
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
      literals.add(node.text);
    }
    ts.forEachChild(node, visit);
  };
  ts.forEachChild(sourceFile, visit);
  return literals;
}

/**
 * Self-test for the guard's own mechanism. Without this, a future refactor
 * back to a raw-text match would silently restore the comment false-negative
 * that this file exists to prevent, and every guard below would still be
 * green. Encodes the PR #968 finding as an executable property.
 */
describe("collectCodeStringLiterals", () => {
  it("collects code literals and ignores mentions inside comments", () => {
    const fixture = [
      "/**",
      " * JSDoc quoting `ghost_backtick`, 'ghost_single' and \"ghost_double\".",
      " */",
      "// line comment quoting 'ghost_line'",
      "/* block comment quoting `ghost_block` */",
      'const branch = value === "real_literal"; // trailing comment: `ghost_trailing`',
      "const templated = other === `real_template`;",
    ].join("\n");

    const literals = collectCodeStringLiterals(fixture, "fixture.ts");

    expect(literals.has("real_literal")).toBe(true);
    expect(literals.has("real_template")).toBe(true);
    for (const ghost of [
      "ghost_backtick",
      "ghost_single",
      "ghost_double",
      "ghost_line",
      "ghost_block",
      "ghost_trailing",
    ]) {
      expect(literals.has(ghost)).toBe(false);
    }
  });
});

describe("WaitingInteractionType exhaustiveness across registry sites", () => {
  it("every enum value appears as a string literal in every registry site", () => {
    const missing: Array<{ site: string; value: string }> = [];
    for (const site of REGISTRY_SITES) {
      const literals = collectCodeStringLiterals(readRepoFile(site), site);
      for (const value of ENUM_VALUES) {
        if (!literals.has(value)) {
          missing.push({ site, value });
        }
      }
    }
    if (missing.length > 0) {
      throw new Error(
        `Missing WaitingInteractionType branches:\n${missing
          .map((m) => `  - ${m.site}: '${m.value}'`)
          .join("\n")}\n` +
          `\nUpdate the missing sites or remove the unused enum value.\n` +
          `SoT: spec/conventions/interaction-type-registry.md §1.2`,
      );
    }
  });
});

/**
 * AST guard for `ConversationTurnSource` exhaustiveness.
 *
 * spec/conventions/interaction-type-registry.md §2.1 — registry lists every
 * code site that switches on this enum. Adding a new value must update all
 * those sites in the same PR.
 */

// SoT: spec/conventions/interaction-type-registry.md §2.1 column "UI 분기 위치"
// (AST 가드 대상 코드 파일만 — spec §9.1 매핑표는 cross-ref 로 비대상)
const SOURCE_REGISTRY_SITES = [
  "codebase/frontend/src/lib/conversation/conversation-utils.ts",
];

const SOURCE_ENUM_VALUES = CONVERSATION_SOURCE_VALUES;

describe("ConversationTurnSource exhaustiveness across registry sites", () => {
  it("every source value appears as a string literal in every registry site", () => {
    const missing: Array<{ site: string; value: string }> = [];
    for (const site of SOURCE_REGISTRY_SITES) {
      const literals = collectCodeStringLiterals(readRepoFile(site), site);
      for (const value of SOURCE_ENUM_VALUES) {
        if (!literals.has(value)) {
          missing.push({ site, value });
        }
      }
    }
    if (missing.length > 0) {
      throw new Error(
        `Missing ConversationTurnSource branches:\n${missing
          .map((m) => `  - ${m.site}: '${m.value}'`)
          .join("\n")}\n` +
          `\nUpdate the missing sites or remove the unused enum value.\n` +
          `SoT: spec/conventions/interaction-type-registry.md §2.1`,
      );
    }
  });
});
