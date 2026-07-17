import { describe, it } from "vitest";
import {
  INTERACTION_TYPE_VALUES,
  CONVERSATION_SOURCE_VALUES,
} from "@/lib/conversation/interaction-type-registry";
import { readFileSync } from "node:fs";
import { join } from "node:path";


/**
 * AST/grep guard for `WaitingInteractionType` exhaustiveness.
 *
 * spec/conventions/interaction-type-registry.md §1.2 — the registry lists
 * every code site that switches on this enum. Adding a new enum value must
 * update all those sites in the same PR. The TS compiler enforces switches
 * via `assertNever`, but `if/else` chains and other non-switch consumers
 * (drawer / page detail / SchemaForm-style flag derivation) bypass that
 * check. This test grep-finds string literals of every enum value in each
 * registered file — missing a value = fail.
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
// list and runs the runtime grep guard below.
//
// Known limitation: the grep matches backtick-quoted mentions too, so a
// JSDoc reference to a value in a registry site satisfies the guard even
// when the real branch is missing or misspelled. Treat a green here as
// "no site forgot the value entirely", not as proof the branch is correct.
const ENUM_VALUES = INTERACTION_TYPE_VALUES;

function readRepoFile(relPath: string): string {
  // tests run with cwd = `codebase/frontend`, so walk up to repo root.
  return readFileSync(join(__dirname, "../../../../../", relPath), "utf-8");
}

describe("WaitingInteractionType exhaustiveness across registry sites", () => {
  it("every enum value appears as a string literal in every registry site", () => {
    const missing: Array<{ site: string; value: string }> = [];
    for (const site of REGISTRY_SITES) {
      const src = readRepoFile(site);
      for (const value of ENUM_VALUES) {
        // Match `'value'` or `"value"` — backend-emitted enum literals.
        const pattern = new RegExp(`['"\`]${value}['"\`]`);
        if (!pattern.test(src)) {
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
 * AST/grep guard for `ConversationTurnSource` exhaustiveness.
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
      const src = readRepoFile(site);
      for (const value of SOURCE_ENUM_VALUES) {
        const pattern = new RegExp(`['"\`]${value}['"\`]`);
        if (!pattern.test(src)) {
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
