import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { useDefaultEmbeddingModelConfigId } from "../use-default-embedding-model-config-id";
import {
  modelConfigsApi,
  type ModelConfigData,
} from "@/lib/api/model-configs";

vi.mock("@/lib/api/model-configs", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/lib/api/model-configs")>();
  return {
    ...actual,
    modelConfigsApi: { list: vi.fn() },
  };
});

function wrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

function config(over: Partial<ModelConfigData>): ModelConfigData {
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

describe("useDefaultEmbeddingModelConfigId", () => {
  beforeEach(() => vi.clearAllMocks());

  it("queries the embedding kind", async () => {
    vi.mocked(modelConfigsApi.list).mockResolvedValue([config({ id: "a" })]);
    renderHook(() => useDefaultEmbeddingModelConfigId(), { wrapper });
    await waitFor(() =>
      expect(modelConfigsApi.list).toHaveBeenCalledWith("embedding"),
    );
  });

  it("returns the isDefault config id when present", async () => {
    vi.mocked(modelConfigsApi.list).mockResolvedValue([
      config({ id: "a", isDefault: false }),
      config({ id: "b", isDefault: true }),
    ]);

    const { result } = renderHook(() => useDefaultEmbeddingModelConfigId(), {
      wrapper,
    });

    await waitFor(() => expect(result.current).toBe("b"));
  });

  it("falls back to the first config when none is default", async () => {
    vi.mocked(modelConfigsApi.list).mockResolvedValue([
      config({ id: "first" }),
      config({ id: "second" }),
    ]);

    const { result } = renderHook(() => useDefaultEmbeddingModelConfigId(), {
      wrapper,
    });

    await waitFor(() => expect(result.current).toBe("first"));
  });

  it("returns undefined when the list is empty", async () => {
    vi.mocked(modelConfigsApi.list).mockResolvedValue([]);

    const { result } = renderHook(() => useDefaultEmbeddingModelConfigId(), {
      wrapper,
    });

    await waitFor(() => expect(modelConfigsApi.list).toHaveBeenCalled());
    expect(result.current).toBeUndefined();
  });
});
