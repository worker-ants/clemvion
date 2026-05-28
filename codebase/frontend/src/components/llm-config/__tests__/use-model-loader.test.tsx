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
      expect(result.current.hasAttemptedLoad).toBe(true);
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

  it("maps a known error code to its localized message", async () => {
    vi.mocked(llmConfigsApi.previewModels).mockRejectedValue(
      Object.assign(new Error("boom"), {
        isAxiosError: true,
        response: {
          data: { error: { code: "LLM_CREDENTIALS_REQUIRED", message: "raw" } },
        },
      }),
    );

    const { result } = renderHook(
      () =>
        useModelLoader({
          provider: "openai",
          apiKey: "sk-xxx",
          fallbackErrorMessage: "fallback",
          errorMessagesByCode: { LLM_CREDENTIALS_REQUIRED: "Enter an API key" },
        }),
      { wrapper },
    );

    act(() => result.current.load());
    await waitFor(() => {
      expect(result.current.errorMessage).toBe("Enter an API key");
    });
  });

  it("falls back (never shows raw message) for an unmapped error code", async () => {
    vi.mocked(llmConfigsApi.previewModels).mockRejectedValue(
      Object.assign(new Error("boom"), {
        isAxiosError: true,
        response: {
          data: { error: { code: "LLM_MODEL_LIST_FAILED", message: "leaky endpoint detail" } },
        },
      }),
    );

    const { result } = renderHook(
      () =>
        useModelLoader({
          provider: "openai",
          apiKey: "sk-xxx",
          fallbackErrorMessage: "fallback",
          errorMessagesByCode: { LLM_CREDENTIALS_REQUIRED: "Enter an API key" },
        }),
      { wrapper },
    );

    act(() => result.current.load());
    await waitFor(() => {
      expect(result.current.errorMessage).toBe("fallback");
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

  // SUMMARY#2: 실패 후 재로드 시 errorMessage 가 null 로 초기화된다 (onMutate 에러 클리어)
  it("clears the error message when a retry starts (onMutate)", async () => {
    vi.mocked(llmConfigsApi.previewModels)
      .mockRejectedValueOnce(
        Object.assign(new Error("first fail"), {
          isAxiosError: true,
          response: { data: { error: { code: "LLM_MODEL_LIST_FAILED" } } },
        }),
      )
      .mockResolvedValueOnce([
        { id: "gpt-4o", name: "gpt-4o", type: "chat" },
      ]);

    const { result } = renderHook(
      () =>
        useModelLoader({
          provider: "openai",
          apiKey: "sk-xxx",
          fallbackErrorMessage: "failed",
        }),
      { wrapper },
    );

    // 첫 번째 로드 실패 — 에러 메시지 설정 (코드 미매핑 → fallback)
    act(() => result.current.load());
    await waitFor(() => {
      expect(result.current.errorMessage).toBe("failed");
    });

    // 재시도 시작 시 에러 메시지가 즉시 null 로 초기화된다
    act(() => result.current.load());
    await waitFor(() => {
      expect(result.current.errorMessage).toBeNull();
    });
    // 재시도 성공 후 모델 목록이 채워진다
    await waitFor(() => {
      expect(result.current.models).toHaveLength(1);
    });
  });

  // SUMMARY#4: provider 변경 시 이전 모델 목록이 즉시 초기화된다 (resetKey 기반)
  // 인플라이트 stale 가드는 use-model-loader 의 snapshot 비교로 보호되며,
  // 컴포넌트 수준(model-combobox.test.tsx)에서 검증한다.
  it("clears models immediately when provider changes (stale-guard reset behavior)", async () => {
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

    // provider 변경 → resetKey 변경 → render-phase reset → 즉시 모델 목록 초기화
    rerender({ provider: "anthropic" });
    await waitFor(() => expect(result.current.models).toHaveLength(0));
  });

  // SUMMARY#3: 첫 로드 성공 → 두 번째 로드 실패 → 기존 모델 목록 유지
  it("keeps previously loaded models when a retry fails", async () => {
    vi.mocked(llmConfigsApi.previewModels)
      .mockResolvedValueOnce([
        { id: "gpt-4o", name: "gpt-4o", type: "chat" },
      ])
      .mockRejectedValueOnce(
        Object.assign(new Error("network"), {
          isAxiosError: true,
          response: { data: { error: { code: "LLM_MODEL_LIST_FAILED" } } },
        }),
      );

    const { result } = renderHook(
      () =>
        useModelLoader({
          provider: "openai",
          apiKey: "sk-xxx",
          fallbackErrorMessage: "failed",
        }),
      { wrapper },
    );

    // 첫 로드 성공
    act(() => result.current.load());
    await waitFor(() => {
      expect(result.current.models).toHaveLength(1);
      expect(result.current.models[0].id).toBe("gpt-4o");
    });

    // 두 번째 로드 실패 (코드 미매핑 → fallback)
    act(() => result.current.load());
    await waitFor(() => {
      expect(result.current.errorMessage).toBe("failed");
    });

    // onError 에서 setModels([]) 를 호출하지 않으므로 기존 목록이 유지된다
    expect(result.current.models).toHaveLength(1);
    expect(result.current.models[0].id).toBe("gpt-4o");
  });

  // SUMMARY#2(INFO): apiKey / baseUrl 이 trim 되어 API 에 전달됨
  it("trims apiKey and baseUrl before calling previewModels", async () => {
    vi.mocked(llmConfigsApi.previewModels).mockResolvedValue([]);

    const { result } = renderHook(
      () =>
        useModelLoader({
          provider: "openai",
          apiKey: "  sk-with-spaces  ",
          baseUrl: "  https://proxy.example.com/v1  ",
          fallbackErrorMessage: "failed",
        }),
      { wrapper },
    );

    act(() => result.current.load());
    await waitFor(() => {
      expect(llmConfigsApi.previewModels).toHaveBeenCalledWith({
        provider: "openai",
        apiKey: "sk-with-spaces",
        baseUrl: "https://proxy.example.com/v1",
      });
    });
  });
});
