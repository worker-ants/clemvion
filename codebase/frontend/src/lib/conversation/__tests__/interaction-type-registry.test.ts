import { describe, it, expect } from "vitest";
import { MULTI_TURN_INTERACTION_TYPES } from "@/lib/conversation/interaction-type-registry";

describe("MULTI_TURN_INTERACTION_TYPES", () => {
  // `interaction-type-exhaustiveness.test.ts` only proves every
  // `WaitingInteractionType` *key* is classified (via the exhaustive
  // `Record<WaitingInteractionType, boolean>` in interaction-type-registry.ts).
  // It says nothing about whether each key's boolean *value* is correct.
  // `isConversationOutput` (output-shape.ts) uses this Set to gate the
  // conversation preview tab — a wrong value here reproduces the exact class
  // of regression this PR's `@workflow/ai-end-reason` package was built to
  // prevent for `endReason` (PR #959), just for `interactionType` instead.
  it("contains exactly the multi-turn conversation interactionTypes", () => {
    expect(Array.from(MULTI_TURN_INTERACTION_TYPES).sort()).toEqual(
      ["ai_conversation", "ai_form_render"].sort(),
    );
  });

  it("excludes the single-turn interactionTypes (form, buttons)", () => {
    expect(MULTI_TURN_INTERACTION_TYPES.has("form")).toBe(false);
    expect(MULTI_TURN_INTERACTION_TYPES.has("buttons")).toBe(false);
  });
});
