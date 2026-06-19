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
import { useLocaleStore } from "@/lib/stores/locale-store";

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
    baseUrl,
    configId,
    modelType,
  }: {
    value: string;
    onChange: (v: string) => void;
    provider: string;
    baseUrl?: string;
    configId?: string;
    modelType?: string;
  }) => (
    <div
      data-testid="chat-combobox"
      data-provider={provider}
      data-base-url={baseUrl ?? ""}
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
    baseUrl: "https://anthropic.example/v1",
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
    useLocaleStore.getState().setLocale("en");
    chatConfigs = CONFIGS;
  });
  afterEach(() => {
    cleanup();
    useLocaleStore.getState().setLocale("ko");
  });

  it("scopes the model list to the node's llmConfigId provider (provider + baseUrl + configId)", () => {
    renderWidget(ChatModelSelectorWidget, { config: { llmConfigId: "cfg-a" } });
    const box = screen.getByTestId("chat-combobox");
    expect(box.getAttribute("data-provider")).toBe("anthropic");
    expect(box.getAttribute("data-base-url")).toBe("https://anthropic.example/v1");
    expect(box.getAttribute("data-config-id")).toBe("cfg-a");
    expect(box.getAttribute("data-model-type")).toBe("chat");
  });

  it("falls back to the workspace default chat config when llmConfigId is unset", () => {
    renderWidget(ChatModelSelectorWidget, { config: {} });
    const box = screen.getByTestId("chat-combobox");
    expect(box.getAttribute("data-provider")).toBe("openai");
    expect(box.getAttribute("data-config-id")).toBe("cfg-default");
  });

  it("falls back to the default config when llmConfigId is stale (not in the list)", () => {
    // 노드 llmConfigId 가 삭제됐거나 목록에 없으면 default chat config 로 fallback —
    // useResolvedChatConfig 의 `configs.find(id) ?? isDefault ?? configs[0]` 경로.
    renderWidget(ChatModelSelectorWidget, {
      config: { llmConfigId: "cfg-nonexistent" },
    });
    const box = screen.getByTestId("chat-combobox");
    expect(box.getAttribute("data-provider")).toBe("openai");
    expect(box.getAttribute("data-config-id")).toBe("cfg-default");
  });

  it("degrades gracefully to empty provider when the config list is empty (loading)", () => {
    chatConfigs = [];
    renderWidget(ChatModelSelectorWidget, { config: { llmConfigId: "cfg-a" } });
    const box = screen.getByTestId("chat-combobox");
    expect(box.getAttribute("data-provider")).toBe("");
    expect(box.getAttribute("data-config-id")).toBe("");
  });

  it("coerces a non-string saved value to an empty string", () => {
    // 종전 expression 위젯에서 저장된 비문자열 값 등 하위호환 — typeof !== string → "".
    renderWidget(ChatModelSelectorWidget, {
      value: 42,
      config: { llmConfigId: "cfg-a" },
    });
    expect(
      (screen.getByLabelText("chat-model") as HTMLInputElement).value,
    ).toBe("");
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

  it("warns when llmConfigId is stale (set but not in the loaded list)", () => {
    renderWidget(ChatModelSelectorWidget, {
      config: { llmConfigId: "cfg-nonexistent" },
    });
    expect(screen.queryByTestId("chat-model-stale-warning")).not.toBeNull();
  });

  it("does not warn stale when llmConfigId resolves to a real config", () => {
    renderWidget(ChatModelSelectorWidget, { config: { llmConfigId: "cfg-a" } });
    expect(screen.queryByTestId("chat-model-stale-warning")).toBeNull();
  });

  it("does not warn stale while the config list is still empty (loading)", () => {
    chatConfigs = [];
    renderWidget(ChatModelSelectorWidget, {
      config: { llmConfigId: "cfg-nonexistent" },
    });
    expect(screen.queryByTestId("chat-model-stale-warning")).toBeNull();
  });

  it("warns when the saved value is a dynamic expression ({{ }})", () => {
    renderWidget(ChatModelSelectorWidget, {
      value: "{{ vars.model }}",
      config: { llmConfigId: "cfg-a" },
    });
    expect(
      screen.queryByTestId("chat-model-expression-warning"),
    ).not.toBeNull();
  });

  it("shows BOTH stale and expression warnings together (deleted provider + old expression value)", () => {
    // 현실 마이그레이션 시나리오: 종전 expression 값이 남아있고 provider 도 삭제된 경우.
    renderWidget(ChatModelSelectorWidget, {
      value: "{{ vars.model }}",
      config: { llmConfigId: "cfg-nonexistent" },
    });
    expect(screen.queryByTestId("chat-model-stale-warning")).not.toBeNull();
    expect(
      screen.queryByTestId("chat-model-expression-warning"),
    ).not.toBeNull();
  });

  it("shows no expression warning for a normal model-name value", () => {
    renderWidget(ChatModelSelectorWidget, {
      value: "gpt-4o",
      config: { llmConfigId: "cfg-a" },
    });
    expect(screen.queryByTestId("chat-model-expression-warning")).toBeNull();
  });
});

describe("EmbeddingModelSelectorWidget", () => {
  // 모듈-레벨 chatConfigs 를 리셋해 앞 describe 의 변형(빈 목록 등)이 누수되지 않게 한다
  // (현재 embedding 콤보박스 stub 은 chatConfigs 를 읽지 않으나 격리를 명시).
  beforeEach(() => {
    useLocaleStore.getState().setLocale("en");
    chatConfigs = CONFIGS;
  });
  afterEach(() => {
    cleanup();
    useLocaleStore.getState().setLocale("ko");
  });

  it("warns when the saved value is a dynamic expression ({{ }})", () => {
    renderWidget(EmbeddingModelSelectorWidget, {
      value: "{{ env.EMBED_MODEL }}",
      config: { llmConfigId: "cfg-a" },
    });
    expect(
      screen.queryByTestId("embedding-model-expression-warning"),
    ).not.toBeNull();
  });

  it("shows no expression warning for a normal model-name value", () => {
    renderWidget(EmbeddingModelSelectorWidget, {
      value: "text-embedding-3-small",
      config: { llmConfigId: "cfg-a" },
    });
    expect(
      screen.queryByTestId("embedding-model-expression-warning"),
    ).toBeNull();
  });

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

// Regression: the model selector widgets must render the schema field label +
// hint (via FieldGroup) — earlier they rendered only the combobox, dropping the
// "Embedding/Summary/Extraction Model" label and its role description so users
// could no longer tell what each model field was for.
describe("model selector widgets — field label + hint (regression)", () => {
  beforeEach(() => {
    useLocaleStore.getState().setLocale("en");
    chatConfigs = CONFIGS;
  });
  afterEach(() => {
    cleanup();
    useLocaleStore.getState().setLocale("ko");
  });

  function renderWithLabelHint(
    Widget:
      | typeof ChatModelSelectorWidget
      | typeof EmbeddingModelSelectorWidget,
    label: string,
    hint: string,
  ) {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    queryClient.setQueryData([...CHAT_KEY], chatConfigs);
    return render(
      <QueryClientProvider client={queryClient}>
        <Widget
          schema={SCHEMA}
          ui={{ hint }}
          label={label}
          value=""
          onChange={() => {}}
          config={{ llmConfigId: "cfg-a" }}
        />
      </QueryClientProvider>,
    );
  }

  it("ChatModelSelectorWidget renders its field label and hint", () => {
    renderWithLabelHint(
      ChatModelSelectorWidget,
      "Summary Model",
      "Optional low-cost model for the rolling-summary call.",
    );
    expect(screen.getByText("Summary Model")).toBeTruthy();
    expect(
      screen.getByText("Optional low-cost model for the rolling-summary call."),
    ).toBeTruthy();
  });

  it("EmbeddingModelSelectorWidget renders its field label and hint", () => {
    renderWithLabelHint(
      EmbeddingModelSelectorWidget,
      "Embedding Model",
      "Embedding model used for memory recall/extraction.",
    );
    expect(screen.getByText("Embedding Model")).toBeTruthy();
    expect(
      screen.getByText("Embedding model used for memory recall/extraction."),
    ).toBeTruthy();
  });
});
