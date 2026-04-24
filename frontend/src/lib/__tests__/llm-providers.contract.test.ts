import { describe, it, expect } from "vitest";
import {
  LLM_PROVIDERS,
  LOCAL_PROVIDER,
  PROVIDERS_REQUIRING_BASE_URL,
} from "../llm-providers";

// Contract test — the LLM provider list is hard-coded on both frontend and
// backend (no shared monorepo package yet). This test fails whenever the
// frontend list drifts from the expected set, which forces anyone adding a
// new provider to update both sides together.
describe("LLM providers contract", () => {
  it("exposes the full provider list exactly once, in the expected order", () => {
    expect(LLM_PROVIDERS).toEqual([
      "openai",
      "anthropic",
      "google",
      "azure",
      "local",
    ]);
  });

  it("LOCAL_PROVIDER resolves to the 'local' entry", () => {
    expect(LOCAL_PROVIDER).toBe("local");
    expect(LLM_PROVIDERS).toContain(LOCAL_PROVIDER);
  });

  it("PROVIDERS_REQUIRING_BASE_URL is azure + local only", () => {
    expect([...PROVIDERS_REQUIRING_BASE_URL].sort()).toEqual([
      "azure",
      "local",
    ]);
  });
});
