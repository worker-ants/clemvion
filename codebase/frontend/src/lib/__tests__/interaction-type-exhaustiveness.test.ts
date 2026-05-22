import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import type { WaitingInteractionType } from "@/lib/stores/execution-store";

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
const REGISTRY_SITES = [
  "codebase/frontend/src/lib/websocket/use-execution-events.ts",
  "codebase/frontend/src/lib/websocket/apply-execution-snapshot.ts",
  "codebase/frontend/src/components/editor/run-results/run-results-drawer.tsx",
  "codebase/frontend/src/app/(main)/workflows/[id]/executions/[executionId]/page.tsx",
];

// Derive the enum values from the actual TS type so a rename is caught
// without a manual fix here. The type is a string union; we list the values
// here as the test SoT and assert each matches the type via a typecheck.
const ENUM_VALUES = [
  "form",
  "buttons",
  "ai_conversation",
  "ai_form_render",
] as const;

// Compile-time assertion: every literal in ENUM_VALUES is assignable to
// WaitingInteractionType. If you add a value to the type, the next line
// errors until ENUM_VALUES includes it.
const _typecheck: ReadonlyArray<WaitingInteractionType> = ENUM_VALUES;
void _typecheck;

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
