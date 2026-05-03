import { describe, expect, it } from "vitest";
import { buildNodeInitialConfig } from "../build-node-initial-config";

describe("buildNodeInitialConfig", () => {
  it("returns a shallow copy of defaultConfig for non-AI nodes regardless of default LLM ID", () => {
    const defaults = { foo: 1, bar: "x" };
    const result = buildNodeInitialConfig("http_request", defaults, "default-llm");
    expect(result).toEqual(defaults);
    expect(result).not.toBe(defaults);
  });

  it("pre-fills llmConfigId for ai_agent when a default LLM exists", () => {
    expect(
      buildNodeInitialConfig("ai_agent", {}, "default-llm-1"),
    ).toEqual({ llmConfigId: "default-llm-1" });
  });

  it("pre-fills llmConfigId for text_classifier when a default LLM exists", () => {
    expect(
      buildNodeInitialConfig("text_classifier", { inputField: "text" }, "default-llm-1"),
    ).toEqual({ inputField: "text", llmConfigId: "default-llm-1" });
  });

  it("pre-fills llmConfigId for information_extractor when a default LLM exists", () => {
    expect(
      buildNodeInitialConfig("information_extractor", undefined, "default-llm-1"),
    ).toEqual({ llmConfigId: "default-llm-1" });
  });

  it("does not overwrite an existing llmConfigId in defaultConfig", () => {
    expect(
      buildNodeInitialConfig(
        "ai_agent",
        { llmConfigId: "explicit-llm" },
        "default-llm-1",
      ),
    ).toEqual({ llmConfigId: "explicit-llm" });
  });

  it("leaves config empty when there is no default LLM", () => {
    expect(buildNodeInitialConfig("ai_agent", undefined, null)).toEqual({});
    expect(buildNodeInitialConfig("ai_agent", undefined, "")).toEqual({});
    expect(buildNodeInitialConfig("ai_agent", undefined, undefined)).toEqual({});
  });

  it("preserves other keys from defaultConfig", () => {
    expect(
      buildNodeInitialConfig(
        "ai_agent",
        { mode: "single_turn", systemPrompt: "x" },
        "default-llm-1",
      ),
    ).toEqual({
      mode: "single_turn",
      systemPrompt: "x",
      llmConfigId: "default-llm-1",
    });
  });
});
