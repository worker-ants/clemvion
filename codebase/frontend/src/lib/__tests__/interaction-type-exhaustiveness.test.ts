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
 *   2. Update `INTERACTION_TYPE_VALUES` (+ `IS_MULTI_TURN_INTERACTION`) in
 *      interaction-type-registry.ts — its `Exclude` assertion breaks `tsc`
 *      until the value list matches the type
 *   3. Update backend `WaitingInteractionType` in execution-engine.service.ts
 *   4. Update spec/conventions/interaction-type-registry.md §1.2 matrix
 *   5. Update every file listed in `REGISTRY_SITES` below (this test fails
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
 * Choose the parser's {@link ts.ScriptKind} from the file extension. Registry
 * sites are `.ts` today, but a branch can move into a component and make a site
 * `.tsx`. `.ts` and `.tsx` parse differently: in `.tsx`, `<Foo>` opens a JSX
 * element; in `.ts`, `<Foo>expr` is a type assertion. Parsing a `.tsx` source
 * as `ScriptKind.TS` yields an unsound parse (the JSX is not read as JSX), and
 * the reverse drops literals outright (a `<Config>{ … }` cast parsed as TSX
 * loses its object). So the guard derives the kind rather than hardcoding one.
 */
function scriptKindForFile(fileName: string): ts.ScriptKind {
  return fileName.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
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
 *
 * The {@link ts.ScriptKind} is derived from `fileName` (see
 * {@link scriptKindForFile}) so a `.tsx` registry site parses soundly. That
 * derivation lives inside this entrypoint and the `.tsx` self-test asserts on
 * this function's own output for both extensions, so reverting it to a
 * hardcoded kind fails the test (PR #972 reviews WARNING #2 / #977-followup: an
 * earlier self-test parsed through a helper — never through this entrypoint
 * with a `.tsx` name — which let the real fix line be reverted with every test
 * still green).
 */
function collectCodeStringLiterals(source: string, fileName: string): Set<string> {
  const sourceFile = ts.createSourceFile(
    fileName,
    source,
    ts.ScriptTarget.Latest,
    /* setParentNodes */ false,
    scriptKindForFile(fileName),
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

  it("recognizes union-type and object-property literal forms as code", () => {
    // Registry sites express branches in shapes well beyond `=== "x"` /
    // `case "x":` — union-type members and object-property values are the two
    // easiest to overlook. Matching against *every* code literal (not a
    // narrower shape) is what keeps these passing; lock that here so a future
    // narrowing to `=== "x"` shapes would fail instead of silently skipping
    // these sites (which would be a false CI failure on real registry code).
    //
    // Each token appears in exactly ONE syntactic form, so a scanner that
    // stops descending into that form fails here — the token cannot leak in
    // from a `=== "x"` elsewhere.
    const fixture = [
      'type Waiting = "union_member_a" | "union_member_b";', // union-type members
      'const cfg = { waitingInteractionType: "object_prop_value" };', // object-property value
      "function pick(x: string): string {",
      '  return x === "ternary_test" ? "ternary_then" : "ternary_else";', // ternary results
      "}",
      'function label(): string { return "return_value"; }', // return
    ].join("\n");

    const literals = collectCodeStringLiterals(fixture, "fixture.ts");

    for (const value of [
      "union_member_a",
      "union_member_b",
      "object_prop_value",
      "ternary_then",
      "ternary_else",
      "return_value",
    ]) {
      expect(literals.has(value)).toBe(true);
    }
  });

  it("does not collect tokens that appear only inside a regex literal", () => {
    // The TS parser types `/…/` as a RegularExpressionLiteral, not a
    // StringLiteral, so a token that lives only inside a regex never satisfies
    // the guard — which is exactly why the real parser is used instead of a
    // hand-rolled comment stripper (it would mis-tokenize regexes like
    // conversation-utils.ts `/\[\/?user-input\]/g`).
    const fixture = [
      "const tag = /regex_only_token/g;",
      "const userInput = /\\[\\/?user-input\\]/g;",
      'const real = value === "kept_literal";',
    ].join("\n");

    const collected = [...collectCodeStringLiterals(fixture, "fixture.ts")];

    // The sibling real string literal is still picked up.
    expect(collected).toContain("kept_literal");
    // No collected entry is derived from a regex. `.includes` (not `.has`)
    // catches the natural regression too: a scanner that also added
    // RegularExpressionLiteral nodes would surface `/regex_only_token/g` and
    // `/\[\/?user-input\]/g` verbatim, which a plain `.has(token)` check would
    // miss but `.includes(token)` does not.
    for (const token of ["regex_only_token", "user-input"]) {
      expect(collected.some((literal) => literal.includes(token))).toBe(false);
    }
  });

  it("parses angle-bracket syntax by extension, through the guard's own entrypoint", () => {
    // A registry branch can move into a component, making a site `.tsx`. `<Foo>`
    // is a TYPE ASSERTION in `.ts` but opens a JSX element in `.tsx`, so the
    // extension alone changes what the parser sees. Feed the SAME source to the
    // real entrypoint under both names and assert its output flips:
    //   - `.ts`  → `<Config>expr` is a cast → the object's literal is collected.
    //   - `.tsx` → `<Config>` opens a (never-closed) JSX element → the object,
    //             string literal included, is dropped.
    // Both assertions run through `collectCodeStringLiterals` itself (not a
    // helper), so hardcoding its ScriptKind in either direction fails one:
    // TS-everywhere keeps the `.tsx` literal (breaks the `false`), TSX-everywhere
    // drops the `.ts` literal (breaks the `true`). This is the PR #972 review
    // lesson end-to-end — WARNING #1 (the `.tsx`→literal-loss direction) and the
    // #977 follow-up WARNING (the entrypoint, not a proxy, must be exercised
    // with a `.tsx` name).
    //
    // NB: this leans on the TS parser's angle-bracket disambiguation; if a
    // `typescript` upgrade ever flips this test, suspect a parser-semantics
    // change before assuming a guard regression.
    const cast = 'const cfg = <Config>{ mode: "cast_literal", n: 1 };';

    expect(collectCodeStringLiterals(cast, "hook.ts").has("cast_literal")).toBe(
      true,
    );
    expect(
      collectCodeStringLiterals(cast, "component.tsx").has("cast_literal"),
    ).toBe(false);
  });
});

describe("scriptKindForFile", () => {
  it("selects TSX for .tsx sites and TS otherwise", () => {
    expect(scriptKindForFile("components/editor/result-view.tsx")).toBe(
      ts.ScriptKind.TSX,
    );
    expect(scriptKindForFile("lib/websocket/use-execution-events.ts")).toBe(
      ts.ScriptKind.TS,
    );
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
