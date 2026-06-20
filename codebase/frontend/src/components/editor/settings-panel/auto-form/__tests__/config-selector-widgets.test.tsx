import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import {
  ChatConfigSelectorWidget,
  EmbeddingConfigSelectorWidget,
} from "../config-selector-widgets";
import type { WidgetProps } from "../widgets";
import { modelConfigsApi } from "@/lib/api/model-configs";

vi.mock("@/lib/api/model-configs", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api/model-configs")>(
    "@/lib/api/model-configs",
  );
  return {
    ...actual,
    modelConfigsApi: { list: vi.fn() },
  };
});

// translateBackendHint 은 dict 의존성을 갖는 실제 구현 대신 hint 문자열을 그대로 통과시킨다.
vi.mock("@/lib/i18n/backend-labels", () => ({
  translateBackendHint: (hint: string | undefined) => hint ?? "",
}));

vi.mock("@/lib/i18n", () => ({
  useLocale: () => "en",
  useT:
    () =>
    (key: string): string => {
      switch (key) {
        case "nodeConfigs.configSelector.chatDefaultOption":
          return "Inherit node's LLM config";
        case "nodeConfigs.configSelector.embeddingDefaultOption":
          return "Workspace default embedding";
        case "nodeConfigs.configSelector.staleConfigWarning":
          return "The selected model config no longer exists.";
        case "nodeConfigs.configSelector.noChatConfigsHint":
          return "No chat model configs are registered.";
        case "nodeConfigs.configSelector.noEmbeddingConfigsHint":
          return "No embedding model configs are registered.";
        default:
          return key;
      }
    },
}));

function wrap(ui: ReactNode) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
}

const baseChat = {
  kind: "chat" as const,
  provider: "openai",
  apiKey: "***",
  defaultModel: "gpt-4o",
  defaultParams: {},
  isDefault: false,
  createdAt: "2026-05-01T00:00:00Z",
  updatedAt: "2026-05-01T00:00:00Z",
};

const baseEmbedding = {
  kind: "embedding" as const,
  provider: "openai",
  apiKey: "***",
  defaultModel: "text-embedding-3-small",
  defaultParams: {},
  dimension: 1536,
  isDefault: false,
  createdAt: "2026-05-01T00:00:00Z",
  updatedAt: "2026-05-01T00:00:00Z",
};

function props(over: Partial<WidgetProps> = {}): WidgetProps {
  return {
    ui: { hint: "Pick a model config." },
    label: "Summary Model",
    value: "",
    onChange: vi.fn(),
    required: false,
    ...over,
  } as WidgetProps;
}

describe("ChatConfigSelectorWidget", () => {
  beforeEach(() => vi.clearAllMocks());

  it("lists chat configs (label + defaultModel, value=config.id) with an inherit option", async () => {
    (modelConfigsApi.list as ReturnType<typeof vi.fn>).mockResolvedValue([
      { ...baseChat, id: "c1", name: "Prod", isDefault: true },
      { ...baseChat, id: "c2", name: "Cheap", defaultModel: "gpt-4o-mini" },
    ]);
    wrap(<ChatConfigSelectorWidget {...props()} />);

    await waitFor(() => {
      const options = screen.getAllByRole("option") as HTMLOptionElement[];
      expect(options.length).toBe(3);
    });
    const options = screen.getAllByRole("option") as HTMLOptionElement[];
    // empty option = inherit node LLM config
    expect(options[0].value).toBe("");
    expect(options[0].textContent).toMatch(/Inherit node/);
    // value is the config id, label shows name (defaultModel) + default star
    expect(options[1].value).toBe("c1");
    expect(options[1].textContent).toMatch(/Prod \(gpt-4o\) \*/);
    expect(options[2].value).toBe("c2");
    expect(options[2].textContent).toMatch(/Cheap \(gpt-4o-mini\)/);
    // schema label + hint rendered (FieldGroup wrapping)
    expect(screen.getByText("Summary Model")).toBeInTheDocument();
    expect(screen.getByText("Pick a model config.")).toBeInTheDocument();
  });

  it("emits config.id on change", async () => {
    const onChange = vi.fn();
    (modelConfigsApi.list as ReturnType<typeof vi.fn>).mockResolvedValue([
      { ...baseChat, id: "c2", name: "Cheap" },
    ]);
    wrap(<ChatConfigSelectorWidget {...props({ onChange })} />);
    await waitFor(() =>
      expect(screen.getByRole("option", { name: /Cheap/ })).toBeInTheDocument(),
    );
    fireEvent.change(screen.getByRole("combobox"), {
      target: { value: "c2" },
    });
    expect(onChange).toHaveBeenCalledWith("c2");
  });

  it("warns when the saved id no longer exists in the loaded list", async () => {
    (modelConfigsApi.list as ReturnType<typeof vi.fn>).mockResolvedValue([
      { ...baseChat, id: "c1", name: "Prod" },
    ]);
    wrap(<ChatConfigSelectorWidget {...props({ value: "gone-cfg" })} />);
    await waitFor(() =>
      expect(
        screen.getByTestId("chat-config-stale-warning"),
      ).toBeInTheDocument(),
    );
  });

  it("hints to register a config when none exist", async () => {
    (modelConfigsApi.list as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    wrap(<ChatConfigSelectorWidget {...props()} />);
    await waitFor(() =>
      expect(
        screen.getByTestId("chat-config-no-configs-hint"),
      ).toBeInTheDocument(),
    );
  });
});

describe("EmbeddingConfigSelectorWidget", () => {
  beforeEach(() => vi.clearAllMocks());

  it("lists embedding configs with dimension and a workspace-default option", async () => {
    (modelConfigsApi.list as ReturnType<typeof vi.fn>).mockResolvedValue([
      { ...baseEmbedding, id: "e1", name: "OpenAI Small", isDefault: true },
    ]);
    wrap(
      <EmbeddingConfigSelectorWidget
        {...props({ label: "Embedding Model" })}
      />,
    );
    await waitFor(() => {
      const options = screen.getAllByRole("option") as HTMLOptionElement[];
      expect(options.length).toBe(2);
    });
    const options = screen.getAllByRole("option") as HTMLOptionElement[];
    expect(options[0].value).toBe("");
    expect(options[0].textContent).toMatch(/Workspace default embedding/);
    expect(options[1].value).toBe("e1");
    expect(options[1].textContent).toMatch(
      /OpenAI Small · text-embedding-3-small \(1536d\) \*/,
    );
    expect(screen.getByText("Embedding Model")).toBeInTheDocument();
  });

  it("queries the embedding kind (not chat)", async () => {
    const list = modelConfigsApi.list as ReturnType<typeof vi.fn>;
    list.mockResolvedValue([]);
    wrap(<EmbeddingConfigSelectorWidget {...props()} />);
    await waitFor(() => expect(list).toHaveBeenCalledWith("embedding"));
  });
});
