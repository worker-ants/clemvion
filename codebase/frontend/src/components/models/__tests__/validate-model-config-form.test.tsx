import { describe, it, expect } from "vitest";
import {
  validateModelConfigForm,
  needsBaseUrl,
  apiKeyRequiredOnCreate,
  type ModelConfigFormState,
} from "../validate-model-config-form";

function state(overrides: Partial<ModelConfigFormState> = {}): ModelConfigFormState {
  return {
    provider: "openai",
    name: "My Config",
    apiKey: "test-key-1234",
    baseUrl: "",
    model: "gpt-4o",
    isEdit: false,
    ...overrides,
  };
}

describe("needsBaseUrl", () => {
  it("requires baseUrl for azure/local/tei", () => {
    expect(needsBaseUrl("azure")).toBe(true);
    expect(needsBaseUrl("local")).toBe(true);
    expect(needsBaseUrl("tei")).toBe(true);
  });
  it("does not require baseUrl for hosted providers", () => {
    expect(needsBaseUrl("openai")).toBe(false);
    expect(needsBaseUrl("anthropic")).toBe(false);
    expect(needsBaseUrl("cohere")).toBe(false);
    expect(needsBaseUrl("")).toBe(false);
  });
});

describe("apiKeyRequiredOnCreate", () => {
  it("requires apiKey for non-self-hosted providers", () => {
    expect(apiKeyRequiredOnCreate("openai")).toBe(true);
    expect(apiKeyRequiredOnCreate("cohere")).toBe(true);
    expect(apiKeyRequiredOnCreate("azure")).toBe(true);
  });
  it("does not require apiKey for local/tei or empty", () => {
    expect(apiKeyRequiredOnCreate("local")).toBe(false);
    expect(apiKeyRequiredOnCreate("tei")).toBe(false);
    expect(apiKeyRequiredOnCreate("")).toBe(false);
  });
});

describe("validateModelConfigForm", () => {
  it("returns null when all required fields are present", () => {
    expect(validateModelConfigForm(state(), "chat")).toBeNull();
  });

  it("returns requiredFields when name/provider/model missing", () => {
    expect(validateModelConfigForm(state({ name: "  " }), "chat")).toBe(
      "models.requiredFields",
    );
    expect(validateModelConfigForm(state({ provider: "" }), "chat")).toBe(
      "models.requiredFields",
    );
    expect(validateModelConfigForm(state({ model: "" }), "chat")).toBe(
      "models.requiredFields",
    );
  });

  it("returns apiKeyRequired when creating non-self-hosted without key", () => {
    expect(
      validateModelConfigForm(state({ apiKey: "", isEdit: false }), "chat"),
    ).toBe("models.apiKeyRequired");
  });

  it("does NOT require apiKey when editing (key omitted = keep existing)", () => {
    expect(
      validateModelConfigForm(state({ apiKey: "", isEdit: true }), "chat"),
    ).toBeNull();
  });

  it("does NOT require apiKey for self-hosted tei on create", () => {
    expect(
      validateModelConfigForm(
        state({ provider: "tei", apiKey: "", baseUrl: "http://x" }),
        "rerank",
      ),
    ).toBeNull();
  });

  it("returns baseUrlRequired when provider needs baseUrl but missing", () => {
    expect(
      validateModelConfigForm(
        state({ provider: "azure", baseUrl: "" }),
        "chat",
      ),
    ).toBe("models.baseUrlRequired");
  });

  it("returns baseUrlRequired for local provider when baseUrl is missing (create)", () => {
    expect(
      validateModelConfigForm(
        state({ provider: "local", apiKey: "", baseUrl: "" }),
        "chat",
      ),
    ).toBe("models.baseUrlRequired");
  });

  it("returns null for local provider when baseUrl is provided (create)", () => {
    expect(
      validateModelConfigForm(
        state({ provider: "local", apiKey: "", baseUrl: "http://localhost:11434" }),
        "chat",
      ),
    ).toBeNull();
  });

  it("returns baseUrlRequired for tei provider when baseUrl is missing (create)", () => {
    expect(
      validateModelConfigForm(
        state({ provider: "tei", apiKey: "", baseUrl: "" }),
        "rerank",
      ),
    ).toBe("models.baseUrlRequired");
  });

  it("returns null for tei provider when baseUrl is provided (create)", () => {
    expect(
      validateModelConfigForm(
        state({ provider: "tei", apiKey: "", baseUrl: "http://localhost:8080" }),
        "rerank",
      ),
    ).toBeNull();
  });

  it("returns baseUrlRequired in edit mode when provider needs baseUrl but missing", () => {
    expect(
      validateModelConfigForm(
        state({ provider: "local", apiKey: "", baseUrl: "", isEdit: true }),
        "chat",
      ),
    ).toBe("models.baseUrlRequired");
  });

  it("returns null for local provider in edit mode when baseUrl is provided", () => {
    expect(
      validateModelConfigForm(
        state({
          provider: "local",
          apiKey: "",
          baseUrl: "http://localhost:11434",
          isEdit: true,
        }),
        "chat",
      ),
    ).toBeNull();
  });
});
