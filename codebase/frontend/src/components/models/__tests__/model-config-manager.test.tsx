import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, act, cleanup } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { ModelConfigManager } from "../model-config-manager";
import { useLocaleStore } from "@/lib/stores/locale-store";
import { useWorkspaceStore } from "@/lib/stores/workspace-store";

// Mock ModelCombobox so tests can inject a model value without the real combobox logic.
vi.mock("@/components/llm-config/model-combobox", () => ({
  ModelCombobox: ({
    value,
    onChange,
    placeholder,
  }: {
    value: string;
    onChange: (v: string) => void;
    placeholder?: string;
  }) => (
    <input
      data-testid="model-combobox"
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
    />
  ),
}));

// --- Navigation mock (for usePageParam) ---
const mockSetPage = vi.fn();
let currentSearchParams = new URLSearchParams();
vi.mock("next/navigation", () => ({
  useParams: () => ({}),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
  usePathname: () => "/models",
  useSearchParams: () => currentSearchParams,
}));

// --- API mock ---
const createMock = vi.fn();
const updateMock = vi.fn();
const removeMock = vi.fn();
const setDefaultMock = vi.fn();
const testConnectionMock = vi.fn();
const getAllMock = vi.fn();

vi.mock("@/lib/api/model-configs", async (orig) => {
  const actual = await orig<typeof import("@/lib/api/model-configs")>();
  return {
    ...actual,
    modelConfigsApi: {
      getAll: (...args: unknown[]) => getAllMock(...args),
      list: vi.fn(),
      create: (...args: unknown[]) => createMock(...args),
      update: (...args: unknown[]) => updateMock(...args),
      remove: (...args: unknown[]) => removeMock(...args),
      setDefault: (...args: unknown[]) => setDefaultMock(...args),
      testConnection: (...args: unknown[]) => testConnectionMock(...args),
      listModels: vi.fn().mockResolvedValue([]),
      previewModels: vi.fn().mockResolvedValue([]),
    },
  };
});

// --- Toast mock ---
vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

// ---- Helpers ----
function setupStore() {
  useWorkspaceStore.setState({
    workspaces: [{ id: "ws-1", name: "Test", type: "team", slug: "t", role: "editor" }],
    currentWorkspaceId: "ws-1",
    loaded: true,
  });
}

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

const EMPTY_PAGE = {
  data: [],
  pagination: { page: 1, limit: 20, totalItems: 0, totalPages: 0 },
};

const SINGLE_CHAT_CONFIG = {
  data: [
    {
      id: "cfg-1",
      kind: "chat" as const,
      provider: "openai",
      name: "GPT-4o Production",
      apiKey: "sk-****abcd",
      baseUrl: null,
      defaultModel: "gpt-4o",
      defaultParams: { temperature: 0.7, max_tokens: 4096 },
      dimension: null,
      isDefault: true,
      createdAt: "2026-01-01T00:00:00Z",
      updatedAt: "2026-01-01T00:00:00Z",
    },
  ],
  pagination: { page: 1, limit: 20, totalItems: 1, totalPages: 1 },
};

// ---- Tests ----
describe("ModelConfigManager — handleSave validation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    currentSearchParams = new URLSearchParams();
    useLocaleStore.setState({ locale: "en" });
    setupStore();
    cleanup();
  });

  it("Save button is disabled when model is not set (spec §B.2)", async () => {
    getAllMock.mockResolvedValue(EMPTY_PAGE);

    await act(async () => {
      render(<ModelConfigManager kind="chat" />, { wrapper: createWrapper() });
    });

    // Open dialog
    fireEvent.click(screen.getByText("Add Model"));
    expect(screen.getByText("Add Model", { selector: "h2" })).toBeInTheDocument();

    // Save button should be disabled when model is empty
    const createBtn = screen.getByText("Create");
    expect(createBtn).toBeDisabled();
    expect(createMock).not.toHaveBeenCalled();
  });

  it("shows required-fields error when model is set but name is empty", async () => {
    getAllMock.mockResolvedValue(EMPTY_PAGE);
    const { toast } = await import("sonner");

    await act(async () => {
      render(<ModelConfigManager kind="chat" />, { wrapper: createWrapper() });
    });

    fireEvent.click(screen.getByText("Add Model"));

    // Set model so button is enabled, but leave name empty
    const modelInput = screen.getByTestId("model-combobox");
    fireEvent.change(modelInput, { target: { value: "gpt-4o" } });

    // Save button should now be enabled
    await waitFor(() => expect(screen.getByText("Create")).not.toBeDisabled());

    // Attempt save with model but no name/provider
    fireEvent.click(screen.getByText("Create"));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(expect.stringContaining("required"));
    });
    expect(createMock).not.toHaveBeenCalled();
  });

  it("shows apiKey-required error when non-local provider has no key on create", async () => {
    getAllMock.mockResolvedValue(EMPTY_PAGE);
    const { toast } = await import("sonner");

    await act(async () => {
      render(<ModelConfigManager kind="chat" />, { wrapper: createWrapper() });
    });

    fireEvent.click(screen.getByText("Add Model"));

    // Set provider + name + model but leave apiKey empty
    const providerSelect = screen.getByDisplayValue("Select a provider");
    fireEvent.change(providerSelect, { target: { value: "openai" } });

    const nameInput = screen.getByPlaceholderText("e.g. GPT-4o Production");
    fireEvent.change(nameInput, { target: { value: "My Config" } });

    // Set model so the Save button is enabled
    const modelInput = screen.getByTestId("model-combobox");
    fireEvent.change(modelInput, { target: { value: "gpt-4o" } });

    await waitFor(() => expect(screen.getByText("Create")).not.toBeDisabled());
    fireEvent.click(screen.getByText("Create"));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(expect.stringContaining("API Key"));
    });
    expect(createMock).not.toHaveBeenCalled();
  });

  it("does NOT require apiKey for tei provider (self-hosted)", async () => {
    getAllMock.mockResolvedValue(EMPTY_PAGE);
    createMock.mockResolvedValue({ id: "new-cfg" });

    await act(async () => {
      render(<ModelConfigManager kind="rerank" />, { wrapper: createWrapper() });
    });

    fireEvent.click(screen.getByText("Add Model"));

    const providerSelect = screen.getByDisplayValue("Select a provider");
    fireEvent.change(providerSelect, { target: { value: "tei" } });

    // Wait for showApiKey to become false (cohere → hidden, tei → shown is false for rerank non-cohere)
    await waitFor(() => {
      expect(screen.queryByPlaceholderText(/Enter API Key/)).toBeNull();
    });
  });
});

describe("ModelConfigManager — kind-based render branches", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    currentSearchParams = new URLSearchParams();
    useLocaleStore.setState({ locale: "en" });
    setupStore();
    cleanup();
  });

  it("chat kind shows Temperature/MaxTokens params", async () => {
    getAllMock.mockResolvedValue(EMPTY_PAGE);

    await act(async () => {
      render(<ModelConfigManager kind="chat" />, { wrapper: createWrapper() });
    });

    fireEvent.click(screen.getByText("Add Model"));

    expect(screen.getByText("Temperature")).toBeInTheDocument();
    expect(screen.getByText("Max Tokens")).toBeInTheDocument();
    expect(screen.queryByText("Dimension")).toBeNull();
  });

  it("embedding kind shows Dimension field, not Temperature/MaxTokens", async () => {
    getAllMock.mockResolvedValue(EMPTY_PAGE);

    await act(async () => {
      render(<ModelConfigManager kind="embedding" />, { wrapper: createWrapper() });
    });

    fireEvent.click(screen.getByText("Add Model"));

    expect(screen.getByText("Dimension")).toBeInTheDocument();
    expect(screen.queryByText("Temperature")).toBeNull();
  });

  it("rerank kind — tei provider: API Key field hidden", async () => {
    getAllMock.mockResolvedValue(EMPTY_PAGE);

    await act(async () => {
      render(<ModelConfigManager kind="rerank" />, { wrapper: createWrapper() });
    });

    fireEvent.click(screen.getByText("Add Model"));

    const providerSelect = screen.getByDisplayValue("Select a provider");
    fireEvent.change(providerSelect, { target: { value: "tei" } });

    await waitFor(() => {
      expect(screen.queryByPlaceholderText(/Enter API Key/)).toBeNull();
    });
  });

  it("rerank kind — cohere provider: API Key field visible", async () => {
    getAllMock.mockResolvedValue(EMPTY_PAGE);

    await act(async () => {
      render(<ModelConfigManager kind="rerank" />, { wrapper: createWrapper() });
    });

    fireEvent.click(screen.getByText("Add Model"));

    const providerSelect = screen.getByDisplayValue("Select a provider");
    fireEvent.change(providerSelect, { target: { value: "cohere" } });

    await waitFor(() => {
      expect(screen.getByPlaceholderText(/Enter API Key/)).toBeInTheDocument();
    });
  });

  it("rerank kind — Test button hidden in list row", async () => {
    getAllMock.mockResolvedValue({
      data: [
        {
          id: "r-1",
          kind: "rerank",
          provider: "tei",
          name: "My Reranker",
          apiKey: null,
          baseUrl: "http://localhost:8080",
          defaultModel: "bge-reranker-v2-m3",
          defaultParams: null,
          dimension: null,
          isDefault: true,
          createdAt: "2026-01-01T00:00:00Z",
          updatedAt: "2026-01-01T00:00:00Z",
        },
      ],
      pagination: { page: 1, limit: 20, totalItems: 1, totalPages: 1 },
    });

    await act(async () => {
      render(<ModelConfigManager kind="rerank" />, { wrapper: createWrapper() });
    });

    await waitFor(() => {
      expect(screen.getByText("My Reranker")).toBeInTheDocument();
    });

    expect(screen.queryByText("Test")).toBeNull();
  });

  it("chat kind — Test button visible in list row", async () => {
    getAllMock.mockResolvedValue(SINGLE_CHAT_CONFIG);

    await act(async () => {
      render(<ModelConfigManager kind="chat" />, { wrapper: createWrapper() });
    });

    await waitFor(() => {
      expect(screen.getByText("GPT-4o Production")).toBeInTheDocument();
    });

    expect(screen.getByText("Test")).toBeInTheDocument();
  });

  it("table renders apiKey as masked bullets when present", async () => {
    getAllMock.mockResolvedValue(SINGLE_CHAT_CONFIG);

    await act(async () => {
      render(<ModelConfigManager kind="chat" />, { wrapper: createWrapper() });
    });

    await waitFor(() => {
      expect(screen.getByText("GPT-4o Production")).toBeInTheDocument();
    });

    // Should show masked value, NOT the real key
    expect(screen.getByText("••••••••")).toBeInTheDocument();
    expect(screen.queryByText("sk-****abcd")).toBeNull();
  });
});

describe("ModelConfigManager — delete flow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    currentSearchParams = new URLSearchParams();
    useLocaleStore.setState({ locale: "en" });
    setupStore();
    cleanup();
  });

  it("delete confirm dialog appears and removal is called on confirm", async () => {
    getAllMock.mockResolvedValue(SINGLE_CHAT_CONFIG);
    removeMock.mockResolvedValue(undefined);

    await act(async () => {
      render(<ModelConfigManager kind="chat" />, { wrapper: createWrapper() });
    });

    await waitFor(() => {
      expect(screen.getByText("GPT-4o Production")).toBeInTheDocument();
    });

    // Click the trash icon button (aria-label="Delete" in row actions)
    const deleteBtn = screen.getByRole("button", { name: "Delete" });
    fireEvent.click(deleteBtn);

    expect(screen.getByText("Delete Model Config")).toBeInTheDocument();

    // Confirm deletion — use stable testid on the confirm button
    const confirmBtn = screen.getByTestId("confirm-modal-confirm-btn");
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(removeMock).toHaveBeenCalledWith("cfg-1");
    });
  });
});

describe("ModelConfigManager — embedding dimension payload", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    currentSearchParams = new URLSearchParams();
    useLocaleStore.setState({ locale: "en" });
    setupStore();
    cleanup();
  });

  it("includes dimension in create payload when embedding kind and dimension is entered", async () => {
    getAllMock.mockResolvedValue(EMPTY_PAGE);
    createMock.mockResolvedValue({ id: "new-emb" });

    await act(async () => {
      render(<ModelConfigManager kind="embedding" />, { wrapper: createWrapper() });
    });

    fireEvent.click(screen.getByText("Add Model"));

    const providerSelect = screen.getByDisplayValue("Select a provider");
    fireEvent.change(providerSelect, { target: { value: "openai" } });

    const nameInput = screen.getByPlaceholderText("e.g. GPT-4o Production");
    fireEvent.change(nameInput, { target: { value: "My Embedding" } });

    const apiKeyInput = screen.getByPlaceholderText(/Enter API Key/);
    fireEvent.change(apiKeyInput, { target: { value: "test-key-1234" } });

    // Set model via the mocked ModelCombobox
    const modelInput = screen.getByTestId("model-combobox");
    fireEvent.change(modelInput, { target: { value: "text-embedding-3-small" } });

    const dimensionInput = screen.getByPlaceholderText("e.g. 1536 or 3072");
    fireEvent.change(dimensionInput, { target: { value: "1536" } });

    // Save button is enabled once model is set
    const saveBtn = screen.getByText("Create");
    await waitFor(() => expect(saveBtn).not.toBeDisabled());
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(createMock).toHaveBeenCalledWith(
        expect.objectContaining({ dimension: 1536 }),
      );
    });
  });
});

// OpenAI embedding dimension constants — avoid magic literals in assertions.
// text-embedding-3-small: 1536, text-embedding-3-large: 3072
const OPENAI_SMALL_DIM = 1536; // text-embedding-3-small
const OPENAI_LARGE_DIM = 3072; // text-embedding-3-large

describe("ModelConfigManager — embedding connection test dimension auto-detect", () => {
  const EMBEDDING_CONFIG_NO_DIM = {
    data: [
      {
        id: "emb-1",
        kind: "embedding" as const,
        provider: "openai",
        name: "My Embedding",
        apiKey: "sk-****abcd",
        baseUrl: null,
        defaultModel: "text-embedding-3-small",
        dimension: null,
        isDefault: false,
        createdAt: "2026-01-01T00:00:00Z",
        updatedAt: "2026-01-01T00:00:00Z",
      },
    ],
    pagination: { page: 1, limit: 20, totalItems: 1, totalPages: 1 },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    currentSearchParams = new URLSearchParams();
    useLocaleStore.setState({ locale: "en" });
    setupStore();
    cleanup();
  });

  it("persists detected dimension and shows it in the toast on successful test", async () => {
    getAllMock.mockResolvedValue(EMBEDDING_CONFIG_NO_DIM);
    testConnectionMock.mockResolvedValue({ success: true, dimension: OPENAI_SMALL_DIM });
    updateMock.mockResolvedValue({ id: "emb-1" });
    const { toast } = await import("sonner");

    await act(async () => {
      render(<ModelConfigManager kind="embedding" />, {
        wrapper: createWrapper(),
      });
    });

    fireEvent.click(await screen.findByText("Test"));

    await waitFor(() => {
      // detected dimension is persisted back to the config via PATCH (best-effort)
      expect(updateMock).toHaveBeenCalledWith("emb-1", { dimension: OPENAI_SMALL_DIM });
    });
    expect(toast.success).toHaveBeenCalledWith(
      expect.stringContaining(String(OPENAI_SMALL_DIM)),
    );
  });

  it("does not persist when detected dimension equals stored dimension", async () => {
    getAllMock.mockResolvedValue({
      ...EMBEDDING_CONFIG_NO_DIM,
      data: [{ ...EMBEDDING_CONFIG_NO_DIM.data[0], dimension: OPENAI_SMALL_DIM }],
    });
    testConnectionMock.mockResolvedValue({ success: true, dimension: OPENAI_SMALL_DIM });
    const { toast } = await import("sonner");

    await act(async () => {
      render(<ModelConfigManager kind="embedding" />, {
        wrapper: createWrapper(),
      });
    });

    fireEvent.click(await screen.findByText("Test"));

    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith(
        expect.stringContaining(String(OPENAI_SMALL_DIM)),
      );
    });
    expect(updateMock).not.toHaveBeenCalled();
  });

  it("still reports success when dimension auto-persist fails (e.g. permission)", async () => {
    getAllMock.mockResolvedValue(EMBEDDING_CONFIG_NO_DIM);
    testConnectionMock.mockResolvedValue({ success: true, dimension: OPENAI_LARGE_DIM });
    updateMock.mockRejectedValue(new Error("403 Forbidden"));
    const { toast } = await import("sonner");

    await act(async () => {
      render(<ModelConfigManager kind="embedding" />, {
        wrapper: createWrapper(),
      });
    });

    fireEvent.click(await screen.findByText("Test"));

    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith(
        expect.stringContaining(String(OPENAI_LARGE_DIM)),
      );
    });
    expect(toast.error).not.toHaveBeenCalled();
  });

  it("renders the dimension field read-only when editing a config that already has a dimension", async () => {
    getAllMock.mockResolvedValue({
      ...EMBEDDING_CONFIG_NO_DIM,
      data: [{ ...EMBEDDING_CONFIG_NO_DIM.data[0], dimension: OPENAI_SMALL_DIM }],
    });

    await act(async () => {
      render(<ModelConfigManager kind="embedding" />, {
        wrapper: createWrapper(),
      });
    });

    fireEvent.click(await screen.findByLabelText("Edit"));

    const dimensionInput = screen.getByPlaceholderText("e.g. 1536 or 3072");
    expect(dimensionInput).toHaveValue(OPENAI_SMALL_DIM);
    expect(dimensionInput).toHaveAttribute("readonly");
  });

  it("renders the dimension field writable when editing a config with no dimension (INFO #15)", async () => {
    // dimension=null のとき readOnly でないことを検証 (INFO #15 — 反対ケース).
    getAllMock.mockResolvedValue(EMBEDDING_CONFIG_NO_DIM); // dimension: null

    await act(async () => {
      render(<ModelConfigManager kind="embedding" />, {
        wrapper: createWrapper(),
      });
    });

    fireEvent.click(await screen.findByLabelText("Edit"));

    const dimensionInput = screen.getByPlaceholderText("e.g. 1536 or 3072");
    expect(dimensionInput).toHaveValue(null); // no saved dimension
    expect(dimensionInput).not.toHaveAttribute("readonly");
  });
});
