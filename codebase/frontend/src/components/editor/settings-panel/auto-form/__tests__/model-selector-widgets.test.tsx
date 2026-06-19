// Unit tests for the auto-form model selector widgets
// (`ChatModelSelectorWidget` / `EmbeddingModelSelectorWidget`).
//
// These wrap the app's `ModelCombobox` / `EmbeddingModelCombobox` and scope the
// model list to the node's `llmConfigId` provider (read from the sibling
// `config`). The comboboxes themselves are stubbed — we only verify the
// widget's wiring: sibling-config resolution, provider/configId passthrough,
// and that the stored value is the model-name string.
//
// SoT: spec/4-nodes/3-ai/1-ai-agent.md §12.12 후속 결정,
//      spec/3-workflow-editor/1-node-common.md §2.6.2.

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const CHAT_KEY = ["model-configs", "chat", "list"] as const;

let chatConfigs: unknown[] = [];
vi.mock("@/lib/api/model-configs", () => ({
  MODEL_CONFIGS_CHAT_LIST_QUERY_KEY: ["model-configs", "chat", "list"],
  modelConfigsApi: { list: vi.fn(() => Promise.resolve(chatConfigs)) },
}));

// Stub ModelCombobox — surface the props the widget computes as data-attrs.
vi.mock("@/components/llm-config/model-combobox", () => ({
  ModelCombobox: ({
    value,
    onChange,
    provider,
    configId,
    modelType,
  }: {
    value: string;
    onChange: (v: string) => void;
    provider: string;
    configId?: string;
    modelType?: string;
  }) => (
    <div
      data-testid="chat-combobox"
      data-provider={provider}
      data-config-id={configId ?? ""}
      data-model-type={modelType ?? ""}
    >
      <input
        aria-label="chat-model"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  ),
}));

// Stub EmbeddingModelCombobox — surface modelConfigId.
vi.mock("@/components/knowledge-base/embedding-model-combobox", () => ({
  EmbeddingModelCombobox: ({
    value,
    onChange,
    modelConfigId,
  }: {
    value: string;
    onChange: (v: string) => void;
    modelConfigId?: string;
  }) => (
    <div data-testid="embedding-combobox" data-model-config-id={modelConfigId ?? ""}>
      <input
        aria-label="embedding-model"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  ),
}));

import {
  ChatModelSelectorWidget,
  EmbeddingModelSelectorWidget,
} from "../model-selector-widgets";
import type { JsonSchemaNode } from "@/lib/node-definitions";

const SCHEMA: JsonSchemaNode = { type: "string" };

const CONFIGS = [
  {
    id: "cfg-default",
    kind: "chat",
    provider: "openai",
    name: "OpenAI",
    baseUrl: null,
    defaultModel: "gpt-4o",
    isDefault: true,
  },
  {
    id: "cfg-a",
    kind: "chat",
    provider: "anthropic",
    name: "Anthropic",
    baseUrl: null,
    defaultModel: "claude-x",
    isDefault: false,
  },
];

function renderWidget(
  Widget: typeof ChatModelSelectorWidget | typeof EmbeddingModelSelectorWidget,
  opts: {
    value?: unknown;
    onChange?: (v: unknown) => void;
    config?: Record<string, unknown>;
  } = {},
) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  queryClient.setQueryData([...CHAT_KEY], chatConfigs);
  return render(
    <QueryClientProvider client={queryClient}>
      <Widget
        schema={SCHEMA}
        label="Model"
        value={opts.value ?? ""}
        onChange={opts.onChange ?? (() => {})}
        config={opts.config}
      />
    </QueryClientProvider>,
  );
}

describe("ChatModelSelectorWidget", () => {
  beforeEach(() => {
    chatConfigs = CONFIGS;
  });
  afterEach(() => cleanup());

  it("scopes the model list to the node's llmConfigId provider", () => {
    renderWidget(ChatModelSelectorWidget, { config: { llmConfigId: "cfg-a" } });
    const box = screen.getByTestId("chat-combobox");
    expect(box.getAttribute("data-provider")).toBe("anthropic");
    expect(box.getAttribute("data-config-id")).toBe("cfg-a");
    expect(box.getAttribute("data-model-type")).toBe("chat");
  });

  it("falls back to the workspace default chat config when llmConfigId is unset", () => {
    renderWidget(ChatModelSelectorWidget, { config: {} });
    const box = screen.getByTestId("chat-combobox");
    expect(box.getAttribute("data-provider")).toBe("openai");
    expect(box.getAttribute("data-config-id")).toBe("cfg-default");
  });

  it("stores the picked value as a model-name string", () => {
    const onChange = vi.fn();
    renderWidget(ChatModelSelectorWidget, {
      onChange,
      config: { llmConfigId: "cfg-a" },
    });
    fireEvent.change(screen.getByLabelText("chat-model"), {
      target: { value: "claude-x" },
    });
    expect(onChange).toHaveBeenCalledWith("claude-x");
  });
});

describe("EmbeddingModelSelectorWidget", () => {
  afterEach(() => cleanup());

  it("passes the node's llmConfigId as the embedding model config source", () => {
    renderWidget(EmbeddingModelSelectorWidget, {
      config: { llmConfigId: "cfg-a" },
    });
    expect(
      screen.getByTestId("embedding-combobox").getAttribute("data-model-config-id"),
    ).toBe("cfg-a");
  });

  it("leaves the config source empty (workspace default) when llmConfigId is unset", () => {
    renderWidget(EmbeddingModelSelectorWidget, { config: {} });
    expect(
      screen.getByTestId("embedding-combobox").getAttribute("data-model-config-id"),
    ).toBe("");
  });

  it("stores the picked value as a model-name string", () => {
    const onChange = vi.fn();
    renderWidget(EmbeddingModelSelectorWidget, { onChange });
    fireEvent.change(screen.getByLabelText("embedding-model"), {
      target: { value: "text-embedding-3-large" },
    });
    expect(onChange).toHaveBeenCalledWith("text-embedding-3-large");
  });
});
