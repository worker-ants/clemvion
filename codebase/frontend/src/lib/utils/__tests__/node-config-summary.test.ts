import { beforeEach, describe, expect, it } from "vitest";
import {
  getConfigSummary,
  truncateSummary,
} from "../node-config-summary";
import { useNodeDefinitionsStore } from "@/lib/stores/node-definitions-store";
import type {
  NodeDefinition,
  SummaryTemplate,
  WarningRule,
} from "@/lib/node-definitions/types";

function warningOf(detail: string) {
  return { text: `⚠ ${detail}`, isWarning: true };
}

function stubDefinition(
  type: string,
  partial: {
    summaryTemplate?: SummaryTemplate;
    warningRules?: readonly WarningRule[];
  } = {},
): NodeDefinition {
  return {
    type,
    category: "logic",
    label: type,
    description: "",
    icon: "Box",
    color: "#000",
    inputs: [],
    outputs: [],
    defaultConfig: {},
    configSchema: {},
    summaryTemplate: partial.summaryTemplate,
    warningRules: partial.warningRules,
  };
}

function seedStore(definitions: Record<string, NodeDefinition>) {
  useNodeDefinitionsStore.setState({
    status: "ready",
    error: null,
    categories: [],
    order: Object.keys(definitions),
    definitions,
  });
}

beforeEach(() => {
  useNodeDefinitionsStore.setState({
    status: "idle",
    error: null,
    categories: [],
    order: [],
    definitions: {},
  });
});

// ===== truncateSummary =====
describe("truncateSummary", () => {
  it("returns text as-is when under maxLen", () => {
    expect(truncateSummary("short text")).toEqual({
      display: "short text",
      isTruncated: false,
    });
  });

  it("returns text as-is when exactly maxLen", () => {
    const text = "a".repeat(40);
    expect(truncateSummary(text)).toEqual({
      display: text,
      isTruncated: false,
    });
  });

  it("truncates text over maxLen with ellipsis", () => {
    const text = "a".repeat(50);
    const result = truncateSummary(text);
    expect(result.display).toBe("a".repeat(39) + "…");
    expect(result.isTruncated).toBe(true);
  });

  it("supports custom maxLen", () => {
    const result = truncateSummary("hello world", 5);
    expect(result.display).toBe("hell…");
    expect(result.isTruncated).toBe(true);
  });
});

// ===== getConfigSummary — dispatcher =====
describe("getConfigSummary", () => {
  it("returns null for manual_trigger regardless of warningRules", () => {
    seedStore({
      manual_trigger: stubDefinition("manual_trigger", {
        warningRules: [
          { id: "manual_trigger:nothing", when: "!whatever", message: "x" },
        ],
      }),
    });
    expect(getConfigSummary("manual_trigger", {})).toBeNull();
  });

  it("returns null when no definition is registered", () => {
    expect(getConfigSummary("unknown_type", {})).toBeNull();
  });

  it("returns null when definition has neither warningRules nor summaryTemplate", () => {
    seedStore({ plain: stubDefinition("plain") });
    expect(getConfigSummary("plain", {})).toBeNull();
  });

  it("renders summaryTemplate when warningRules pass", () => {
    seedStore({
      http_request: stubDefinition("http_request", {
        summaryTemplate: {
          template: "{{method|default:GET}} {{url}}",
        },
        warningRules: [
          { id: "http_request:url-required", when: "!url", message: "URL not set" },
        ],
      }),
    });
    expect(
      getConfigSummary("http_request", { method: "POST", url: "/api" }),
    ).toEqual({ text: "POST /api", isWarning: false });
  });

  it("returns blocking warning from SSOT rules first", () => {
    seedStore({
      http_request: stubDefinition("http_request", {
        summaryTemplate: { template: "{{method}} {{url}}" },
        warningRules: [
          { id: "http_request:url-required", when: "!url", message: "URL not set" },
        ],
      }),
    });
    expect(getConfigSummary("http_request", {})).toEqual(
      warningOf("URL not set"),
    );
  });

  it("returns the first matching blocking warning when multiple fire", () => {
    seedStore({
      thing: stubDefinition("thing", {
        warningRules: [
          { id: "thing:a", when: "!a", message: "A missing" },
          { id: "thing:b", when: "!b", message: "B missing" },
        ],
      }),
    });
    expect(getConfigSummary("thing", {})).toEqual(warningOf("A missing"));
  });

  it("ignores advisory warnings as candidates for the badge", () => {
    seedStore({
      thing: stubDefinition("thing", {
        summaryTemplate: { template: "ok" },
        warningRules: [
          {
            id: "thing:soft",
            when: "!a",
            message: "Soft hint",
            severity: "advisory",
          },
        ],
      }),
    });
    expect(getConfigSummary("thing", {})).toEqual({
      text: "ok",
      isWarning: false,
    });
  });

  it("supports complex when expressions (mode dependent rules)", () => {
    seedStore({
      carousel: stubDefinition("carousel", {
        summaryTemplate: { template: "{{titleField|default:n/a}}" },
        warningRules: [
          {
            id: "carousel:dynamic-mode-needs-title-field",
            when: "mode == dynamic && !titleField",
            message: "Title field required",
          },
        ],
      }),
    });
    expect(getConfigSummary("carousel", { mode: "dynamic" })).toEqual(
      warningOf("Title field required"),
    );
    expect(
      getConfigSummary("carousel", { mode: "dynamic", titleField: "name" }),
    ).toEqual({ text: "name", isWarning: false });
    // static mode → rule doesn't fire even with no titleField
    expect(getConfigSummary("carousel", { mode: "static" })).toEqual({
      text: "n/a",
      isWarning: false,
    });
  });

  it("renders bare-string summaryTemplate", () => {
    seedStore({
      simple: stubDefinition("simple", {
        summaryTemplate: "{{label}}",
      }),
    });
    expect(getConfigSummary("simple", { label: "hello" })).toEqual({
      text: "hello",
      isWarning: false,
    });
  });
});

// ===== LLM provider context bypass =====
describe("getConfigSummary — hasDefaultLlmConfig context", () => {
  const noProviderRule: WarningRule = {
    id: "ai_agent:no-llm-provider",
    when: "!model && !llmConfigId",
    message: "Select an LLM provider",
  };
  const otherRule: WarningRule = {
    id: "ai_agent:multi-turn-needs-system-prompt",
    when: "mode == multi_turn && !systemPrompt",
    message: "Multi-turn requires a system prompt",
  };

  beforeEach(() => {
    seedStore({
      ai_agent: stubDefinition("ai_agent", {
        summaryTemplate: { template: "{{model|default:default}}" },
        warningRules: [noProviderRule, otherRule],
      }),
      text_classifier: stubDefinition("text_classifier", {
        summaryTemplate: { template: "{{model|default:default}}" },
        warningRules: [
          { ...noProviderRule, id: "text_classifier:no-llm-provider" },
        ],
      }),
      information_extractor: stubDefinition("information_extractor", {
        summaryTemplate: { template: "{{model|default:default}}" },
        warningRules: [
          { ...noProviderRule, id: "information_extractor:no-llm-provider" },
        ],
      }),
    });
  });

  it("warns about missing provider when no default LLM config exists", () => {
    expect(getConfigSummary("ai_agent", {})).toEqual(
      warningOf("Select an LLM provider"),
    );
    expect(
      getConfigSummary("ai_agent", {}, { hasDefaultLlmConfig: false }),
    ).toEqual(warningOf("Select an LLM provider"));
  });

  it("suppresses ai_agent provider warning when default LLM config exists", () => {
    expect(
      getConfigSummary("ai_agent", {}, { hasDefaultLlmConfig: true }),
    ).toEqual({ text: "default", isWarning: false });
  });

  it("still surfaces other (non-provider) warnings even with default LLM config", () => {
    expect(
      getConfigSummary(
        "ai_agent",
        { mode: "multi_turn" },
        { hasDefaultLlmConfig: true },
      ),
    ).toEqual(warningOf("Multi-turn requires a system prompt"));
  });

  it("suppresses provider warning for text_classifier when default LLM config exists", () => {
    expect(
      getConfigSummary(
        "text_classifier",
        {},
        { hasDefaultLlmConfig: true },
      ),
    ).toEqual({ text: "default", isWarning: false });
    expect(getConfigSummary("text_classifier", {})).toEqual(
      warningOf("Select an LLM provider"),
    );
  });

  it("suppresses provider warning for information_extractor when default LLM config exists", () => {
    expect(
      getConfigSummary(
        "information_extractor",
        {},
        { hasDefaultLlmConfig: true },
      ),
    ).toEqual({ text: "default", isWarning: false });
    expect(getConfigSummary("information_extractor", {})).toEqual(
      warningOf("Select an LLM provider"),
    );
  });

  it("does NOT suppress :no-llm-provider rule for non-LLM node types", () => {
    seedStore({
      other: stubDefinition("other", {
        warningRules: [
          {
            id: "other:no-llm-provider",
            when: "!model",
            message: "Other warning",
          },
        ],
      }),
    });
    expect(
      getConfigSummary("other", {}, { hasDefaultLlmConfig: true }),
    ).toEqual(warningOf("Other warning"));
  });
});
