import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { useEmbeddingModelLoader } from "../use-embedding-model-loader";
import { llmConfigsApi } from "@/lib/api/llm-configs";

vi.mock("@/lib/api/llm-configs", () => ({
  llmConfigsApi: {
    listModels: vi.fn(),
  },
}));

function wrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );
}

describe("useEmbeddingModelLoader", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("loads embedding models for the given configId", async () => {
    vi.mocked(llmConfigsApi.listModels).mockResolvedValue([
      { id: "text-embedding-3-small", name: "text-embedding-3-small", type: "embedding" },
    ]);

    const { result } = renderHook(
      () =>
        useEmbeddingModelLoader({
          configId: "cfg-abc",
          fallbackErrorMessage: "failed",
        }),
      { wrapper },
    );

    act(() => result.current.load());

    await waitFor(() => {
      expect(llmConfigsApi.listModels).toHaveBeenCalledWith("cfg-abc", {
        type: "embedding",
      });
    });
    await waitFor(() => {
      expect(result.current.models).toHaveLength(1);
      expect(result.current.models[0].id).toBe("text-embedding-3-small");
      expect(result.current.hasAttemptedLoad).toBe(true);
    });
  });

  it("sets canLoad=false when configId is undefined", () => {
    const { result } = renderHook(
      () =>
        useEmbeddingModelLoader({
          configId: undefined,
          fallbackErrorMessage: "failed",
        }),
      { wrapper },
    );

    expect(result.current.canLoad).toBe(false);
  });

  it("sets canLoad=true when configId is defined", () => {
    const { result } = renderHook(
      () =>
        useEmbeddingModelLoader({
          configId: "cfg-abc",
          fallbackErrorMessage: "failed",
        }),
      { wrapper },
    );

    expect(result.current.canLoad).toBe(true);
  });

  // SUMMARY#W2: retry clears errorMessage (onMutate error clear)
  it("clears the error message when a retry starts (onMutate)", async () => {
    vi.mocked(llmConfigsApi.listModels)
      .mockRejectedValueOnce(
        Object.assign(new Error("first fail"), {
          isAxiosError: true,
          response: { data: { error: { code: "LLM_MODEL_LIST_FAILED" } } },
        }),
      )
      .mockResolvedValueOnce([
        { id: "text-embedding-3-small", name: "text-embedding-3-small", type: "embedding" },
      ]);

    const { result } = renderHook(
      () =>
        useEmbeddingModelLoader({
          configId: "cfg-abc",
          fallbackErrorMessage: "failed",
        }),
      { wrapper },
    );

    act(() => result.current.load());
    await waitFor(() => {
      expect(result.current.errorMessage).toBe("failed");
    });

    // Retry start clears errorMessage
    act(() => result.current.load());
    await waitFor(() => {
      expect(result.current.errorMessage).toBeNull();
    });
    await waitFor(() => {
      expect(result.current.models).toHaveLength(1);
    });
  });

  // SUMMARY#W2: first load success → second load failure → models are preserved
  it("keeps previously loaded models when a retry fails", async () => {
    vi.mocked(llmConfigsApi.listModels)
      .mockResolvedValueOnce([
        { id: "text-embedding-3-small", name: "text-embedding-3-small", type: "embedding" },
      ])
      .mockRejectedValueOnce(
        Object.assign(new Error("network"), {
          isAxiosError: true,
          response: { data: { error: { code: "LLM_MODEL_LIST_FAILED" } } },
        }),
      );

    const { result } = renderHook(
      () =>
        useEmbeddingModelLoader({
          configId: "cfg-abc",
          fallbackErrorMessage: "failed",
        }),
      { wrapper },
    );

    act(() => result.current.load());
    await waitFor(() => {
      expect(result.current.models).toHaveLength(1);
    });

    act(() => result.current.load());
    await waitFor(() => {
      expect(result.current.errorMessage).toBe("failed");
    });

    // onError does not call setModels([]) — previous list is preserved
    expect(result.current.models).toHaveLength(1);
    expect(result.current.models[0].id).toBe("text-embedding-3-small");
  });

  // SUMMARY#W2: stale closure guard — response arriving after configId change is discarded
  it("discards a stale response when configId changes during an in-flight request", async () => {
    let resolveFirst!: (value: typeof import("@/lib/api/llm-configs").ModelInfo[]) => void;
    const firstPromise = new Promise<typeof import("@/lib/api/llm-configs").ModelInfo[]>(
      (res) => { resolveFirst = res; },
    );

    vi.mocked(llmConfigsApi.listModels)
      .mockReturnValueOnce(firstPromise)
      .mockResolvedValue([
        { id: "new-model", name: "new-model", type: "embedding" },
      ]);

    const { result, rerender } = renderHook(
      ({ configId }: { configId: string }) =>
        useEmbeddingModelLoader({
          configId,
          fallbackErrorMessage: "failed",
        }),
      { wrapper, initialProps: { configId: "cfg-a" } },
    );

    // Start the first request but do not resolve it yet
    act(() => result.current.load());

    // Change configId — resets state and snapshot
    rerender({ configId: "cfg-b" });

    // Resolve the stale request with cfg-a data
    act(() => {
      resolveFirst([
        { id: "stale-model", name: "stale-model", type: "embedding" },
      ]);
    });

    // Stale response should be discarded — models for cfg-a must not appear
    await waitFor(() => {
      expect(result.current.models).not.toContainEqual(
        expect.objectContaining({ id: "stale-model" }),
      );
    });
  });

  // SUMMARY#W2: configId reset clears models, error and hasAttemptedLoad
  it("resets models, error and hasAttemptedLoad when configId changes", async () => {
    vi.mocked(llmConfigsApi.listModels).mockResolvedValue([
      { id: "text-embedding-3-small", name: "text-embedding-3-small", type: "embedding" },
    ]);

    const { result, rerender } = renderHook(
      ({ configId }: { configId: string }) =>
        useEmbeddingModelLoader({
          configId,
          fallbackErrorMessage: "failed",
        }),
      { wrapper, initialProps: { configId: "cfg-a" } },
    );

    act(() => result.current.load());
    await waitFor(() => expect(result.current.models).toHaveLength(1));
    expect(result.current.hasAttemptedLoad).toBe(true);

    rerender({ configId: "cfg-b" });

    await waitFor(() => {
      expect(result.current.models).toHaveLength(0);
      expect(result.current.hasAttemptedLoad).toBe(false);
    });
  });

  it("maps a known error code and falls back otherwise", async () => {
    vi.mocked(llmConfigsApi.listModels).mockRejectedValueOnce(
      Object.assign(new Error("boom"), {
        isAxiosError: true,
        response: { data: { error: { code: "LLM_CONFIG_INVALID" } } },
      }),
    );

    const { result } = renderHook(
      () =>
        useEmbeddingModelLoader({
          configId: "cfg-abc",
          fallbackErrorMessage: "generic fallback",
          errorMessagesByCode: { LLM_CONFIG_INVALID: "Invalid config" },
        }),
      { wrapper },
    );

    act(() => result.current.load());
    await waitFor(() => {
      expect(result.current.errorMessage).toBe("Invalid config");
    });
  });
});
