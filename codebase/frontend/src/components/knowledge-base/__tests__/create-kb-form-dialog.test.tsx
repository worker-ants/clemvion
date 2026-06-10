import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  render,
  screen,
  fireEvent,
  waitFor,
  cleanup,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { useLocaleStore } from "@/lib/stores/locale-store";

const createMock = vi.fn();
const probeMock = vi.fn();
vi.mock("@/lib/api/knowledge-bases", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/lib/api/knowledge-bases")>();
  return {
    ...actual,
    knowledgeBasesApi: {
      create: (...args: unknown[]) => createMock(...args),
      probeEmbedding: (...args: unknown[]) => probeMock(...args),
    },
  };
});

const llmListMock = vi.fn();
vi.mock("@/lib/api/llm-configs", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/llm-configs")>();
  return {
    ...actual,
    llmConfigsApi: { list: (...args: unknown[]) => llmListMock(...args) },
  };
});

const rerankListMock = vi.fn();
vi.mock("@/lib/api/rerank-configs", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/lib/api/rerank-configs")>();
  return {
    ...actual,
    rerankConfigsApi: { list: (...args: unknown[]) => rerankListMock(...args) },
  };
});

const modelListMock = vi.fn();
vi.mock("@/lib/api/model-configs", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/lib/api/model-configs")>();
  return {
    ...actual,
    modelConfigsApi: { list: (...args: unknown[]) => modelListMock(...args) },
  };
});

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

import { CreateKbFormDialog } from "../create-kb-form-dialog";
import type { ModelConfigData } from "@/lib/api/model-configs";

function embConfig(over: Partial<ModelConfigData>): ModelConfigData {
  return {
    id: "id",
    kind: "embedding",
    provider: "openai",
    name: "Cfg",
    apiKey: "***",
    defaultModel: "text-embedding-3-small",
    dimension: 1536,
    isDefault: false,
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
    ...over,
  };
}

function wrap(ui: ReactNode) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
}

function getEmbeddingSelect(): HTMLSelectElement {
  // The embedding tab's NativeSelect is the one whose options include the
  // workspace-default leading option (en: "Workspace default").
  const selects = Array.from(
    document.querySelectorAll("select"),
  ) as HTMLSelectElement[];
  const found = selects.find((s) =>
    Array.from(s.options).some((o) => o.text.includes("Workspace default")),
  );
  if (!found) throw new Error("embedding model config select not found");
  return found;
}

describe("CreateKbFormDialog — embedding ModelConfig select", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    cleanup();
    useLocaleStore.setState({ locale: "en" });
    llmListMock.mockResolvedValue([]);
    rerankListMock.mockResolvedValue([]);
    createMock.mockResolvedValue({ id: "new-kb" });
    probeMock.mockResolvedValue({ dimension: 1536, provider: "openai" });
  });

  it("renders the loaded embedding configs as options", async () => {
    modelListMock.mockResolvedValue([
      embConfig({ id: "emb-a", name: "OpenAI Emb", defaultModel: "m-a" }),
      embConfig({ id: "emb-b", name: "KURE", defaultModel: "kure-v1" }),
    ]);

    const user = userEvent.setup();
    wrap(<CreateKbFormDialog open onOpenChange={vi.fn()} />);

    // switch to embedding tab (Radix Tabs v1.1+ activates on pointer events)
    await user.click(await screen.findByRole("tab", { name: "Embedding" }));

    await waitFor(() => {
      const opts = Array.from(getEmbeddingSelect().options).map((o) => o.value);
      expect(opts).toContain("emb-a");
      expect(opts).toContain("emb-b");
    });
  });

  it("propagates embeddingModelConfigId + embeddingModel(defaultModel) into the create payload", async () => {
    modelListMock.mockResolvedValue([
      embConfig({ id: "emb-a", name: "OpenAI Emb", defaultModel: "m-a" }),
    ]);

    const user = userEvent.setup();
    wrap(<CreateKbFormDialog open onOpenChange={vi.fn()} />);

    fireEvent.change(
      await screen.findByPlaceholderText("Customer Support FAQ"),
      { target: { value: "My KB" } },
    );
    await user.click(screen.getByRole("tab", { name: "Embedding" }));

    await waitFor(() => {
      expect(
        Array.from(getEmbeddingSelect().options).map((o) => o.value),
      ).toContain("emb-a");
    });
    fireEvent.change(getEmbeddingSelect(), { target: { value: "emb-a" } });

    fireEvent.click(screen.getByRole("button", { name: "Create" }));

    await waitFor(() => expect(createMock).toHaveBeenCalled());
    const payload = createMock.mock.calls[0][0];
    expect(payload.embeddingModelConfigId).toBe("emb-a");
    expect(payload.embeddingModel).toBe("m-a");
  });

  it("probes with the selected embeddingModelConfigId when the test button is clicked", async () => {
    modelListMock.mockResolvedValue([
      embConfig({ id: "emb-a", name: "OpenAI Emb", defaultModel: "m-a" }),
    ]);

    const user = userEvent.setup();
    wrap(<CreateKbFormDialog open onOpenChange={vi.fn()} />);

    await user.click(await screen.findByRole("tab", { name: "Embedding" }));

    await waitFor(() => {
      expect(
        Array.from(getEmbeddingSelect().options).map((o) => o.value),
      ).toContain("emb-a");
    });
    fireEvent.change(getEmbeddingSelect(), { target: { value: "emb-a" } });

    // Test button is only rendered once a config is selected.
    const testBtn = await screen.findByRole("button", {
      name: "Test embedding",
    });
    fireEvent.click(testBtn);

    await waitFor(() => expect(probeMock).toHaveBeenCalled());
    expect(probeMock.mock.calls[0][0]).toMatchObject({
      embeddingModelConfigId: "emb-a",
      embeddingModel: "m-a",
    });
  });

  it("hides the embedding test button when the workspace-default option is selected", async () => {
    modelListMock.mockResolvedValue([
      embConfig({ id: "emb-a", name: "OpenAI Emb", defaultModel: "m-a" }),
    ]);

    const user = userEvent.setup();
    wrap(<CreateKbFormDialog open onOpenChange={vi.fn()} />);

    await user.click(await screen.findByRole("tab", { name: "Embedding" }));
    await waitFor(() => {
      expect(
        Array.from(getEmbeddingSelect().options).map((o) => o.value),
      ).toContain("emb-a");
    });

    // explicitly pick the empty (workspace-default) option → no probe target.
    fireEvent.change(getEmbeddingSelect(), { target: { value: "" } });

    await waitFor(() => {
      expect(
        screen.queryByRole("button", { name: "Test embedding" }),
      ).toBeNull();
    });
  });

  it("omits embedding fields when the workspace-default option is selected", async () => {
    modelListMock.mockResolvedValue([
      embConfig({ id: "emb-a", name: "OpenAI Emb", defaultModel: "m-a" }),
    ]);

    const user = userEvent.setup();
    wrap(<CreateKbFormDialog open onOpenChange={vi.fn()} />);

    fireEvent.change(
      await screen.findByPlaceholderText("Customer Support FAQ"),
      { target: { value: "My KB" } },
    );
    await user.click(screen.getByRole("tab", { name: "Embedding" }));

    await waitFor(() => {
      expect(
        Array.from(getEmbeddingSelect().options).map((o) => o.value),
      ).toContain("emb-a");
    });
    // explicitly pick the empty (workspace-default) option
    fireEvent.change(getEmbeddingSelect(), { target: { value: "" } });

    fireEvent.click(screen.getByRole("button", { name: "Create" }));

    await waitFor(() => expect(createMock).toHaveBeenCalled());
    const payload = createMock.mock.calls[0][0];
    expect(payload.embeddingModelConfigId).toBeUndefined();
    expect(payload.embeddingModel).toBeUndefined();
  });
});
