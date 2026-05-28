import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { useDefaultLlmConfigId } from "../use-default-llm-config-id";
import { llmConfigsApi, type LlmConfigData } from "@/lib/api/llm-configs";

vi.mock("@/lib/api/llm-configs", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/llm-configs")>();
  return {
    ...actual,
    llmConfigsApi: { list: vi.fn() },
  };
});

function wrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

function config(over: Partial<LlmConfigData>): LlmConfigData {
  return {
    id: "id",
    provider: "openai",
    name: "Cfg",
    apiKey: "***",
    defaultModel: "gpt-4o",
    defaultParams: {},
    isDefault: false,
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
    ...over,
  };
}

describe("useDefaultLlmConfigId", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns the isDefault config id when present", async () => {
    vi.mocked(llmConfigsApi.list).mockResolvedValue([
      config({ id: "a", isDefault: false }),
      config({ id: "b", isDefault: true }),
    ]);

    const { result } = renderHook(() => useDefaultLlmConfigId(), { wrapper });

    await waitFor(() => expect(result.current).toBe("b"));
  });

  it("falls back to the first config when none is default", async () => {
    vi.mocked(llmConfigsApi.list).mockResolvedValue([
      config({ id: "first" }),
      config({ id: "second" }),
    ]);

    const { result } = renderHook(() => useDefaultLlmConfigId(), { wrapper });

    await waitFor(() => expect(result.current).toBe("first"));
  });

  it("returns undefined when the list is empty", async () => {
    vi.mocked(llmConfigsApi.list).mockResolvedValue([]);

    const { result } = renderHook(() => useDefaultLlmConfigId(), { wrapper });

    await waitFor(() => expect(llmConfigsApi.list).toHaveBeenCalled());
    expect(result.current).toBeUndefined();
  });
});
