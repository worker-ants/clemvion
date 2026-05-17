import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { ModelCombobox } from "../model-combobox";
import { llmConfigsApi } from "@/lib/api/llm-configs";

vi.mock("@/lib/api/llm-configs", () => ({
  llmConfigsApi: {
    previewModels: vi.fn(),
    listModels: vi.fn(),
  },
}));

function wrap(ui: ReactNode) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
}

function getLoadButton(): HTMLButtonElement {
  return screen.getByTestId("model-combobox-load") as HTMLButtonElement;
}

describe("ModelCombobox", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders current value and allows direct typing", () => {
    const onChange = vi.fn();
    wrap(
      <ModelCombobox
        value="gpt-4o"
        onChange={onChange}
        provider="openai"
        apiKey="sk-xxx"
        placeholder="gpt-4o"
      />,
    );
    const input = screen.getByPlaceholderText("gpt-4o") as HTMLInputElement;
    expect(input.value).toBe("gpt-4o");
    fireEvent.change(input, { target: { value: "gpt-4o-mini" } });
    expect(onChange).toHaveBeenCalledWith("gpt-4o-mini");
  });

  it("disables the load button when provider is empty", () => {
    wrap(
      <ModelCombobox
        value=""
        onChange={vi.fn()}
        provider=""
        apiKey="sk-xxx"
      />,
    );
    expect(getLoadButton()).toBeDisabled();
  });

  it("disables the load button when non-local provider is missing apiKey", () => {
    wrap(
      <ModelCombobox
        value=""
        onChange={vi.fn()}
        provider="openai"
        apiKey=""
      />,
    );
    expect(getLoadButton()).toBeDisabled();
  });

  it("enables the load button for local provider without apiKey", () => {
    wrap(
      <ModelCombobox
        value=""
        onChange={vi.fn()}
        provider="local"
        apiKey=""
        baseUrl="http://localhost:11434/v1"
      />,
    );
    expect(
      getLoadButton(),
    ).not.toBeDisabled();
  });

  it("calls previewModels when apiKey is provided (create flow) and renders chat-only options", async () => {
    vi.mocked(llmConfigsApi.previewModels).mockResolvedValue([
      { id: "gpt-4o", name: "gpt-4o", type: "chat" },
      { id: "gpt-4o-mini", name: "gpt-4o-mini", type: "chat" },
      {
        id: "text-embedding-3-small",
        name: "text-embedding-3-small",
        type: "embedding",
      },
    ]);

    wrap(
      <ModelCombobox
        value=""
        onChange={vi.fn()}
        provider="openai"
        apiKey="sk-xxx"
      />,
    );

    fireEvent.click(getLoadButton());

    await waitFor(() => {
      expect(llmConfigsApi.previewModels).toHaveBeenCalledWith({
        provider: "openai",
        apiKey: "sk-xxx",
        baseUrl: undefined,
      });
    });

    await waitFor(() => {
      const values = Array.from(
        document.querySelectorAll("datalist option"),
      ).map((o) => (o as HTMLOptionElement).value);
      expect(values).toContain("gpt-4o");
      expect(values).toContain("gpt-4o-mini");
      expect(values).not.toContain("text-embedding-3-small");
    });
  });

  it("disables the load button when local provider is missing baseUrl", () => {
    wrap(
      <ModelCombobox
        value=""
        onChange={vi.fn()}
        provider="local"
        apiKey=""
        baseUrl=""
      />,
    );
    expect(getLoadButton()).toBeDisabled();
  });

  it("trims apiKey and baseUrl before calling preview endpoint", async () => {
    vi.mocked(llmConfigsApi.previewModels).mockResolvedValue([]);

    wrap(
      <ModelCombobox
        value=""
        onChange={vi.fn()}
        provider="openai"
        apiKey="   sk-trim-me   "
        baseUrl="  https://proxy.example.com/v1  "
      />,
    );

    fireEvent.click(getLoadButton());

    await waitFor(() => {
      expect(llmConfigsApi.previewModels).toHaveBeenCalledWith({
        provider: "openai",
        apiKey: "sk-trim-me",
        baseUrl: "https://proxy.example.com/v1",
      });
    });
  });

  it("uses preview endpoint (not saved-config) when both configId and re-entered apiKey are present", async () => {
    vi.mocked(llmConfigsApi.previewModels).mockResolvedValue([]);

    wrap(
      <ModelCombobox
        value=""
        onChange={vi.fn()}
        provider="openai"
        apiKey="sk-new-key"
        configId="existing-uuid"
      />,
    );

    fireEvent.click(getLoadButton());

    await waitFor(() => {
      expect(llmConfigsApi.previewModels).toHaveBeenCalledWith({
        provider: "openai",
        apiKey: "sk-new-key",
        baseUrl: undefined,
      });
    });
    expect(llmConfigsApi.listModels).not.toHaveBeenCalled();
  });

  it("calls listModels (saved-config path) in edit flow when apiKey is empty and configId is set", async () => {
    vi.mocked(llmConfigsApi.listModels).mockResolvedValue([
      { id: "claude-sonnet-4-20250514", name: "Claude Sonnet 4", type: "chat" },
    ]);

    wrap(
      <ModelCombobox
        value=""
        onChange={vi.fn()}
        provider="anthropic"
        apiKey=""
        configId="existing-uuid"
      />,
    );

    fireEvent.click(getLoadButton());

    await waitFor(() => {
      expect(llmConfigsApi.listModels).toHaveBeenCalledWith("existing-uuid");
    });
    expect(llmConfigsApi.previewModels).not.toHaveBeenCalled();
  });

  it("shows a sanitized error message when the API call fails", async () => {
    vi.mocked(llmConfigsApi.previewModels).mockRejectedValue(
      Object.assign(new Error("Request failed"), {
        isAxiosError: true,
        response: {
          data: {
            message: "Authentication failed. Please check your API key.",
          },
        },
      }),
    );

    wrap(
      <ModelCombobox
        value=""
        onChange={vi.fn()}
        provider="openai"
        apiKey="bad-key"
      />,
    );

    fireEvent.click(getLoadButton());

    await waitFor(() => {
      expect(
        screen.getByText(/authentication failed/i),
      ).toBeInTheDocument();
    });
  });

  it("disables the load button while the request is pending", async () => {
    let resolve: ((v: []) => void) | undefined;
    vi.mocked(llmConfigsApi.previewModels).mockImplementation(
      () =>
        new Promise<[]>((r) => {
          resolve = r;
        }),
    );

    wrap(
      <ModelCombobox
        value=""
        onChange={vi.fn()}
        provider="openai"
        apiKey="sk-xxx"
      />,
    );

    fireEvent.click(getLoadButton());
    await waitFor(() => {
      expect(getLoadButton()).toBeDisabled();
    });

    // Resolve to avoid leaking the pending promise across tests.
    resolve?.([]);
  });

  it("renders the 'no models available' hint after a successful empty response", async () => {
    vi.mocked(llmConfigsApi.previewModels).mockResolvedValue([]);
    wrap(
      <ModelCombobox
        value=""
        onChange={vi.fn()}
        provider="openai"
        apiKey="sk-xxx"
      />,
    );
    fireEvent.click(getLoadButton());
    await waitFor(() => {
      expect(screen.getByText(/사용 가능한 모델이 없어요/)).toBeInTheDocument();
    });
  });

  it("disables the load button when azure provider is missing baseUrl", () => {
    wrap(
      <ModelCombobox
        value=""
        onChange={vi.fn()}
        provider="azure"
        apiKey="k"
        baseUrl=""
      />,
    );
    expect(getLoadButton()).toBeDisabled();
  });

  it("keeps previously loaded models visible when a retry fails", async () => {
    vi.mocked(llmConfigsApi.previewModels).mockResolvedValueOnce([
      { id: "gpt-4o", name: "gpt-4o", type: "chat" },
    ]);

    wrap(
      <ModelCombobox
        value=""
        onChange={vi.fn()}
        provider="openai"
        apiKey="sk-xxx"
      />,
    );

    fireEvent.click(getLoadButton());
    await waitFor(() => {
      const values = Array.from(
        document.querySelectorAll("datalist option"),
      ).map((o) => (o as HTMLOptionElement).value);
      expect(values).toContain("gpt-4o");
    });

    vi.mocked(llmConfigsApi.previewModels).mockRejectedValueOnce(
      Object.assign(new Error("fail"), {
        isAxiosError: true,
        response: { data: { message: "Rate limit exceeded" } },
      }),
    );

    fireEvent.click(getLoadButton());
    await waitFor(() => {
      expect(screen.getByText(/rate limit exceeded/i)).toBeInTheDocument();
    });

    // 이전 로드된 모델 목록이 유지되어야 한다.
    const values = Array.from(
      document.querySelectorAll("datalist option"),
    ).map((o) => (o as HTMLOptionElement).value);
    expect(values).toContain("gpt-4o");
  });

  it("clears model list and error message when provider changes", async () => {
    vi.mocked(llmConfigsApi.previewModels).mockResolvedValue([
      { id: "gpt-4o", name: "gpt-4o", type: "chat" },
    ]);

    const { rerender } = wrap(
      <ModelCombobox
        value=""
        onChange={vi.fn()}
        provider="openai"
        apiKey="sk-xxx"
      />,
    );

    fireEvent.click(getLoadButton());
    await waitFor(() => {
      const values = Array.from(
        document.querySelectorAll("datalist option"),
      ).map((o) => (o as HTMLOptionElement).value);
      expect(values).toContain("gpt-4o");
    });

    rerender(
      <QueryClientProvider
        client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
      >
        <ModelCombobox
          value=""
          onChange={vi.fn()}
          provider="anthropic"
          apiKey="sk-xxx"
        />
      </QueryClientProvider>,
    );

    await waitFor(() => {
      const values = Array.from(
        document.querySelectorAll("datalist option"),
      ).map((o) => (o as HTMLOptionElement).value);
      expect(values).not.toContain("gpt-4o");
    });
  });

  it("ignores a stale response when provider changes mid-flight", async () => {
    let resolveFirst: ((v: { id: string; name: string; type: "chat" }[]) => void) | undefined;
    vi.mocked(llmConfigsApi.previewModels).mockImplementationOnce(
      () =>
        new Promise((r) => {
          resolveFirst = r as never;
        }),
    );

    const { rerender } = wrap(
      <ModelCombobox
        value=""
        onChange={vi.fn()}
        provider="openai"
        apiKey="sk-xxx"
      />,
    );

    fireEvent.click(getLoadButton());

    // provider 전환 — 이전 요청이 아직 인-플라이트
    rerender(
      <QueryClientProvider
        client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
      >
        <ModelCombobox
          value=""
          onChange={vi.fn()}
          provider="anthropic"
          apiKey="sk-yyy"
        />
      </QueryClientProvider>,
    );

    // 이전 openai 응답 도착
    resolveFirst?.([{ id: "gpt-4o", name: "gpt-4o", type: "chat" }]);

    // 짧게 대기 후 datalist 에 gpt-4o 가 들어가지 않았는지 확인 (stale 가드)
    await new Promise((r) => setTimeout(r, 20));
    const values = Array.from(
      document.querySelectorAll("datalist option"),
    ).map((o) => (o as HTMLOptionElement).value);
    expect(values).not.toContain("gpt-4o");
  });

  it("clears the error message when a retry starts (onMutate)", async () => {
    vi.mocked(llmConfigsApi.previewModels)
      .mockRejectedValueOnce(
        Object.assign(new Error("fail"), {
          isAxiosError: true,
          response: { data: { message: "Rate limit exceeded" } },
        }),
      )
      .mockImplementationOnce(() => new Promise(() => {}));

    wrap(
      <ModelCombobox
        value=""
        onChange={vi.fn()}
        provider="openai"
        apiKey="sk-xxx"
      />,
    );

    fireEvent.click(getLoadButton());
    await waitFor(() => {
      expect(screen.getByText(/rate limit exceeded/i)).toBeInTheDocument();
    });

    fireEvent.click(getLoadButton());
    await waitFor(() => {
      expect(screen.queryByText(/rate limit exceeded/i)).not.toBeInTheDocument();
    });
  });

  it("propagates disabled prop to both input and load button", () => {
    wrap(
      <ModelCombobox
        value=""
        onChange={vi.fn()}
        provider="openai"
        apiKey="sk-xxx"
        placeholder="m"
        disabled
      />,
    );
    expect(screen.getByPlaceholderText("m")).toBeDisabled();
    expect(getLoadButton()).toBeDisabled();
  });
});
