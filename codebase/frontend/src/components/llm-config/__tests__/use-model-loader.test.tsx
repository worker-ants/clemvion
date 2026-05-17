import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { useModelLoader } from "../use-model-loader";
import { llmConfigsApi } from "@/lib/api/llm-configs";

vi.mock("@/lib/api/llm-configs", () => ({
  llmConfigsApi: {
    previewModels: vi.fn(),
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

describe("useModelLoader", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("routes to previewModels when apiKey is supplied", async () => {
    vi.mocked(llmConfigsApi.previewModels).mockResolvedValue([
      { id: "gpt-4o", name: "gpt-4o", type: "chat" },
    ]);

    const { result } = renderHook(
      () =>
        useModelLoader({
          provider: "openai",
          apiKey: "sk-xxx",
          baseUrl: "https://proxy.example.com/v1",
          fallbackErrorMessage: "failed",
        }),
      { wrapper },
    );

    act(() => result.current.load());
    await waitFor(() => {
      expect(llmConfigsApi.previewModels).toHaveBeenCalledWith({
        provider: "openai",
        apiKey: "sk-xxx",
        baseUrl: "https://proxy.example.com/v1",
      });
    });
    await waitFor(() => {
      expect(result.current.models).toHaveLength(1);
      expect(result.current.isSuccess).toBe(true);
    });
  });

  it("routes to listModels when apiKey is empty and configId is set", async () => {
    vi.mocked(llmConfigsApi.listModels).mockResolvedValue([
      { id: "claude-sonnet-4-5", name: "Claude Sonnet 4.5", type: "chat" },
    ]);

    const { result } = renderHook(
      () =>
        useModelLoader({
          provider: "anthropic",
          apiKey: "",
          configId: "existing-uuid",
          fallbackErrorMessage: "failed",
        }),
      { wrapper },
    );

    act(() => result.current.load());
    await waitFor(() => {
      expect(llmConfigsApi.listModels).toHaveBeenCalledWith("existing-uuid");
    });
    expect(llmConfigsApi.previewModels).not.toHaveBeenCalled();
  });

  it("resets models and error message when provider changes", async () => {
    vi.mocked(llmConfigsApi.previewModels).mockResolvedValue([
      { id: "gpt-4o", name: "gpt-4o", type: "chat" },
    ]);

    const { result, rerender } = renderHook(
      ({ provider }: { provider: string }) =>
        useModelLoader({
          provider,
          apiKey: "sk-xxx",
          fallbackErrorMessage: "failed",
        }),
      { wrapper, initialProps: { provider: "openai" } },
    );

    act(() => result.current.load());
    await waitFor(() => expect(result.current.models).toHaveLength(1));

    rerender({ provider: "anthropic" });
    await waitFor(() => expect(result.current.models).toHaveLength(0));
  });

  it("disables load when non-local provider has no apiKey", () => {
    const { result } = renderHook(
      () =>
        useModelLoader({
          provider: "openai",
          apiKey: "",
          fallbackErrorMessage: "failed",
        }),
      { wrapper },
    );
    expect(result.current.canLoad).toBe(false);
  });

  it("enables load for local provider without apiKey when baseUrl is provided", () => {
    const { result } = renderHook(
      () =>
        useModelLoader({
          provider: "local",
          apiKey: "",
          baseUrl: "http://localhost:11434/v1",
          fallbackErrorMessage: "failed",
        }),
      { wrapper },
    );
    expect(result.current.canLoad).toBe(true);
  });

  it("extracts sanitized error message from axios response", async () => {
    vi.mocked(llmConfigsApi.previewModels).mockRejectedValue(
      Object.assign(new Error("boom"), {
        isAxiosError: true,
        response: { data: { message: "Rate limit exceeded" } },
      }),
    );

    const { result } = renderHook(
      () =>
        useModelLoader({
          provider: "openai",
          apiKey: "sk-xxx",
          fallbackErrorMessage: "fallback",
        }),
      { wrapper },
    );

    act(() => result.current.load());
    await waitFor(() => {
      expect(result.current.errorMessage).toBe("Rate limit exceeded");
    });
  });

  it("falls back to the provided message for non-axios errors", async () => {
    vi.mocked(llmConfigsApi.previewModels).mockRejectedValue(
      new Error("plain"),
    );

    const { result } = renderHook(
      () =>
        useModelLoader({
          provider: "openai",
          apiKey: "sk-xxx",
          fallbackErrorMessage: "fallback-msg",
        }),
      { wrapper },
    );

    act(() => result.current.load());
    await waitFor(() => {
      expect(result.current.errorMessage).toBe("fallback-msg");
    });
  });
});
