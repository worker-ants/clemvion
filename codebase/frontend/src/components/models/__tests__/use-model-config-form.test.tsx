import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { useModelConfigForm, DEFAULT_TEMPERATURE, DEFAULT_MAX_TOKENS } from "../use-model-config-form";
import type { ModelConfigData } from "@/lib/api/model-configs";

// --- API mock ---
const createMock = vi.fn();
const updateMock = vi.fn();

vi.mock("@/lib/api/model-configs", async (orig) => {
  const actual = await orig<typeof import("@/lib/api/model-configs")>();
  return {
    ...actual,
    modelConfigsApi: {
      ...actual.modelConfigsApi,
      create: (...args: unknown[]) => createMock(...args),
      update: (...args: unknown[]) => updateMock(...args),
      listModels: vi.fn().mockResolvedValue([]),
      previewModels: vi.fn().mockResolvedValue([]),
    },
  };
});

// --- Toast mock ---
vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

// --- i18n mock ---
vi.mock("@/lib/i18n", () => ({
  useT: () => (key: string) => key,
}));

function wrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

function makeConfig(over: Partial<ModelConfigData> = {}): ModelConfigData {
  return {
    id: "cfg-1",
    kind: "chat",
    provider: "openai",
    name: "Prod GPT",
    apiKey: "••••",
    baseUrl: null,
    defaultModel: "gpt-4o",
    defaultParams: { temperature: 0.5, max_tokens: 2048 },
    dimension: null,
    isDefault: false,
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
    ...over,
  };
}

describe("useModelConfigForm — openFor", () => {
  beforeEach(() => vi.clearAllMocks());

  it("openFor(null) resets to defaults", () => {
    const { result } = renderHook(
      () =>
        useModelConfigForm({
          kind: "chat",
          editConfig: null,
          onClose: vi.fn(),
        }),
      { wrapper },
    );

    act(() => result.current.openFor(null));

    expect(result.current.provider).toBe("");
    expect(result.current.name).toBe("");
    expect(result.current.apiKey).toBe("");
    expect(result.current.baseUrl).toBe("");
    expect(result.current.model).toBe("");
    expect(result.current.temperature).toBe(String(DEFAULT_TEMPERATURE));
    expect(result.current.maxTokens).toBe(String(DEFAULT_MAX_TOKENS));
    expect(result.current.dimension).toBe("");
    expect(result.current.editId).toBeNull();
  });

  it("openFor(config) seeds fields from existing config", () => {
    const config = makeConfig({
      provider: "anthropic",
      name: "Claude Config",
      baseUrl: null,
      defaultModel: "claude-3-5-sonnet",
      defaultParams: { temperature: 1.0, max_tokens: 8192 },
    });

    const { result } = renderHook(
      () =>
        useModelConfigForm({
          kind: "chat",
          editConfig: config,
          onClose: vi.fn(),
        }),
      { wrapper },
    );

    act(() => result.current.openFor(config));

    expect(result.current.provider).toBe("anthropic");
    expect(result.current.name).toBe("Claude Config");
    expect(result.current.apiKey).toBe(""); // always cleared on seed
    expect(result.current.baseUrl).toBe("");
    expect(result.current.model).toBe("claude-3-5-sonnet");
    expect(result.current.temperature).toBe("1");
    expect(result.current.maxTokens).toBe("8192");
    expect(result.current.editId).toBe("cfg-1");
  });

  it("openFor(config) seeds baseUrl when present", () => {
    const config = makeConfig({
      provider: "azure",
      baseUrl: "https://my.openai.azure.com/",
    });

    const { result } = renderHook(
      () =>
        useModelConfigForm({ kind: "chat", editConfig: config, onClose: vi.fn() }),
      { wrapper },
    );

    act(() => result.current.openFor(config));
    expect(result.current.baseUrl).toBe("https://my.openai.azure.com/");
  });

  it("openFor(config) seeds dimension when present (embedding)", () => {
    const config = makeConfig({
      kind: "embedding",
      dimension: 1536,
      defaultParams: null,
    });

    const { result } = renderHook(
      () =>
        useModelConfigForm({ kind: "embedding", editConfig: config, onClose: vi.fn() }),
      { wrapper },
    );

    act(() => result.current.openFor(config));
    expect(result.current.dimension).toBe("1536");
  });

  it("openFor falls back to defaults when defaultParams is null", () => {
    const config = makeConfig({ defaultParams: null });

    const { result } = renderHook(
      () =>
        useModelConfigForm({ kind: "chat", editConfig: config, onClose: vi.fn() }),
      { wrapper },
    );

    act(() => result.current.openFor(config));
    expect(result.current.temperature).toBe(String(DEFAULT_TEMPERATURE));
    expect(result.current.maxTokens).toBe(String(DEFAULT_MAX_TOKENS));
  });
});

describe("useModelConfigForm — handleSave create payload", () => {
  beforeEach(() => vi.clearAllMocks());

  it("assembles chat create payload with params and apiKey", async () => {
    createMock.mockResolvedValue({ id: "new-1" });

    const onClose = vi.fn();
    const { result } = renderHook(
      () =>
        useModelConfigForm({ kind: "chat", editConfig: null, onClose }),
      { wrapper },
    );

    act(() => result.current.openFor(null));
    act(() => {
      result.current.setProvider("openai");
      result.current.setName("My Chat");
      result.current.setApiKey("test-key-1234");
      result.current.setModel("gpt-4o");
      result.current.setTemperature("0.9");
      result.current.setMaxTokens("2048");
    });

    await act(async () => result.current.handleSave());

    expect(createMock).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: "chat",
        provider: "openai",
        name: "My Chat",
        apiKey: "test-key-1234",
        defaultModel: "gpt-4o",
        defaultParams: { temperature: 0.9, max_tokens: 2048 },
      }),
    );
  });

  it("omits apiKey from create payload when empty string", async () => {
    createMock.mockResolvedValue({ id: "new-2" });

    const { result } = renderHook(
      () =>
        useModelConfigForm({ kind: "chat", editConfig: null, onClose: vi.fn() }),
      { wrapper },
    );

    act(() => result.current.openFor(null));
    act(() => {
      result.current.setProvider("local");
      result.current.setName("Ollama");
      result.current.setBaseUrl("http://localhost:11434");
      result.current.setModel("llama3");
    });

    await act(async () => result.current.handleSave());

    expect(createMock).toHaveBeenCalledWith(
      expect.objectContaining({ apiKey: undefined }),
    );
  });

  it("includes dimension in embedding create payload", async () => {
    createMock.mockResolvedValue({ id: "new-emb" });

    const { result } = renderHook(
      () =>
        useModelConfigForm({ kind: "embedding", editConfig: null, onClose: vi.fn() }),
      { wrapper },
    );

    act(() => result.current.openFor(null));
    act(() => {
      result.current.setProvider("openai");
      result.current.setName("Embeddings");
      result.current.setApiKey("test-key-1234");
      result.current.setModel("text-embedding-3-small");
      result.current.setDimension("1536");
    });

    await act(async () => result.current.handleSave());

    expect(createMock).toHaveBeenCalledWith(
      expect.objectContaining({ dimension: 1536 }),
    );
  });

  it("omits dimension from embedding payload when not entered", async () => {
    createMock.mockResolvedValue({ id: "new-emb-nodim" });

    const { result } = renderHook(
      () =>
        useModelConfigForm({ kind: "embedding", editConfig: null, onClose: vi.fn() }),
      { wrapper },
    );

    act(() => result.current.openFor(null));
    act(() => {
      result.current.setProvider("openai");
      result.current.setName("Embeddings");
      result.current.setApiKey("test-key-1234");
      result.current.setModel("text-embedding-3-small");
      // leave dimension empty
    });

    await act(async () => result.current.handleSave());

    expect(createMock).toHaveBeenCalledWith(
      expect.objectContaining({ dimension: undefined }),
    );
  });

  it("parseFloat fallback: invalid temperature string falls back to DEFAULT_TEMPERATURE", async () => {
    createMock.mockResolvedValue({ id: "new-3" });

    const { result } = renderHook(
      () =>
        useModelConfigForm({ kind: "chat", editConfig: null, onClose: vi.fn() }),
      { wrapper },
    );

    act(() => result.current.openFor(null));
    act(() => {
      result.current.setProvider("openai");
      result.current.setName("Test");
      result.current.setApiKey("test-key-1234");
      result.current.setModel("gpt-4o");
      result.current.setTemperature("not-a-number");
    });

    await act(async () => result.current.handleSave());

    expect(createMock).toHaveBeenCalledWith(
      expect.objectContaining({
        defaultParams: expect.objectContaining({ temperature: DEFAULT_TEMPERATURE }),
      }),
    );
  });
});

describe("useModelConfigForm — handleSave update payload", () => {
  beforeEach(() => vi.clearAllMocks());

  it("assembles update payload without apiKey when apiKey is empty (keep existing)", async () => {
    updateMock.mockResolvedValue({});

    const config = makeConfig();
    const { result } = renderHook(
      () =>
        useModelConfigForm({ kind: "chat", editConfig: config, onClose: vi.fn() }),
      { wrapper },
    );

    act(() => result.current.openFor(config));
    act(() => {
      result.current.setName("Updated Name");
      // leave apiKey empty — should not be in payload
    });

    await act(async () => result.current.handleSave());

    const call = updateMock.mock.calls[0];
    expect(call[0]).toBe("cfg-1");
    expect(call[1]).toMatchObject({
      provider: "openai",
      name: "Updated Name",
      defaultModel: "gpt-4o",
    });
    expect(call[1].apiKey).toBeUndefined();
  });

  it("includes apiKey in update payload when a new key is entered", async () => {
    updateMock.mockResolvedValue({});

    const config = makeConfig();
    const { result } = renderHook(
      () =>
        useModelConfigForm({ kind: "chat", editConfig: config, onClose: vi.fn() }),
      { wrapper },
    );

    act(() => result.current.openFor(config));
    act(() => result.current.setApiKey("new-key-5678"));

    await act(async () => result.current.handleSave());

    expect(updateMock).toHaveBeenCalledWith(
      "cfg-1",
      expect.objectContaining({ apiKey: "new-key-5678" }),
    );
  });
});
