import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
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

function getSelect(): HTMLSelectElement {
  return screen.getByTestId("model-combobox-select") as HTMLSelectElement;
}

function optionValues(): string[] {
  return Array.from(getSelect().options).map((o) => o.value);
}

describe("ModelCombobox", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders select with only loaded options after loading (no free-form input)", async () => {
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

    // 모델 미로드 — select 비활성
    expect(getSelect()).toBeDisabled();

    fireEvent.click(getLoadButton());

    await waitFor(() => {
      expect(llmConfigsApi.previewModels).toHaveBeenCalledWith({
        provider: "openai",
        apiKey: "sk-xxx",
        baseUrl: undefined,
      });
    });

    // 로드 후 chat 모델만 option, embedding 모델 제외
    await waitFor(() => {
      expect(optionValues()).toContain("gpt-4o");
    });
    expect(optionValues()).toContain("gpt-4o-mini");
    expect(optionValues()).not.toContain("text-embedding-3-small");

    // 자유 입력용 <input> 가 없어야 한다
    expect(
      document.querySelector('input[data-testid="model-combobox-input"]'),
    ).toBeNull();
  });

  it("fires onChange when an option is selected", async () => {
    const onChange = vi.fn();
    vi.mocked(llmConfigsApi.previewModels).mockResolvedValue([
      { id: "gpt-4o", name: "gpt-4o", type: "chat" },
      { id: "gpt-4o-mini", name: "gpt-4o-mini", type: "chat" },
    ]);

    wrap(
      <ModelCombobox
        value=""
        onChange={onChange}
        provider="openai"
        apiKey="sk-xxx"
      />,
    );

    fireEvent.click(getLoadButton());

    await waitFor(() => {
      expect(getSelect()).not.toBeDisabled();
    });

    fireEvent.change(getSelect(), { target: { value: "gpt-4o-mini" } });
    expect(onChange).toHaveBeenCalledWith("gpt-4o-mini");
  });

  it("preserves a previously saved model id as a placeholder option when not in the loaded list", async () => {
    vi.mocked(llmConfigsApi.listModels).mockResolvedValue([
      { id: "claude-sonnet-4-6", name: "Claude Sonnet 4.6", type: "chat" },
    ]);

    wrap(
      <ModelCombobox
        value="claude-sonnet-old-id"
        onChange={vi.fn()}
        provider="anthropic"
        apiKey=""
        configId="existing-uuid"
      />,
    );

    // 로드 전: 저장된 값은 selected option 으로 노출되어야 함
    expect(getSelect().value).toBe("claude-sonnet-old-id");
    expect(optionValues()).toContain("claude-sonnet-old-id");

    fireEvent.click(getLoadButton());

    await waitFor(() => {
      expect(optionValues()).toContain("claude-sonnet-4-6");
    });

    // 저장값이 로드된 목록에 없으므로 placeholder option 형태로 유지
    expect(optionValues()).toContain("claude-sonnet-old-id");
    expect(getSelect().value).toBe("claude-sonnet-old-id");
  });

  it("drops the placeholder option once the user picks a real model", async () => {
    const onChange = vi.fn();
    vi.mocked(llmConfigsApi.listModels).mockResolvedValue([
      { id: "claude-sonnet-4-6", name: "Claude Sonnet 4.6", type: "chat" },
    ]);

    const { rerender } = wrap(
      <ModelCombobox
        value="claude-sonnet-old-id"
        onChange={onChange}
        provider="anthropic"
        apiKey=""
        configId="existing-uuid"
      />,
    );

    fireEvent.click(getLoadButton());
    await waitFor(() => {
      expect(optionValues()).toContain("claude-sonnet-4-6");
    });

    fireEvent.change(getSelect(), {
      target: { value: "claude-sonnet-4-6" },
    });
    expect(onChange).toHaveBeenCalledWith("claude-sonnet-4-6");

    rerender(
      <QueryClientProvider
        client={
          new QueryClient({ defaultOptions: { queries: { retry: false } } })
        }
      >
        <ModelCombobox
          value="claude-sonnet-4-6"
          onChange={onChange}
          provider="anthropic"
          apiKey=""
          configId="existing-uuid"
        />
      </QueryClientProvider>,
    );

    // 새 value 가 로드 목록에 있으므로 placeholder option 은 사라져야 한다
    expect(optionValues()).not.toContain("claude-sonnet-old-id");
  });

  it("disables the load button and select when provider is empty", () => {
    wrap(
      <ModelCombobox
        value=""
        onChange={vi.fn()}
        provider=""
        apiKey="sk-xxx"
      />,
    );
    expect(getLoadButton()).toBeDisabled();
    expect(getSelect()).toBeDisabled();
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
    expect(getLoadButton()).not.toBeDisabled();
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

  it("calls listModels (saved-config path) when configId is set and apiKey is empty", async () => {
    vi.mocked(llmConfigsApi.listModels).mockResolvedValue([
      { id: "claude-sonnet-4-6", name: "Claude Sonnet 4.6", type: "chat" },
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

  it("uses preview endpoint when both configId and re-entered apiKey are present", async () => {
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

  it("shows a localized code-mapped message and keeps select disabled on failure", async () => {
    vi.mocked(llmConfigsApi.previewModels).mockRejectedValue(
      Object.assign(new Error("Request failed"), {
        isAxiosError: true,
        response: {
          data: {
            error: {
              code: "LLM_CREDENTIALS_REQUIRED",
              message: "Authentication failed at https://internal.endpoint/v1",
            },
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
      expect(screen.getByText(/API 키를 입력/)).toBeInTheDocument();
    });
    // 서버 원본 메시지(엔드포인트 등)는 노출되지 않는다
    expect(screen.queryByText(/internal\.endpoint/)).toBeNull();

    // 조회 실패 → 자유 입력 fallback 없음. select 는 비활성 유지.
    expect(getSelect()).toBeDisabled();
  });

  it("shows the empty-list hint after a successful empty response", async () => {
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
    expect(getSelect()).toBeDisabled();
  });

  it("clears loaded models and resets select on provider change", async () => {
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
      expect(optionValues()).toContain("gpt-4o");
    });

    rerender(
      <QueryClientProvider
        client={
          new QueryClient({ defaultOptions: { queries: { retry: false } } })
        }
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
      expect(optionValues()).not.toContain("gpt-4o");
    });
    expect(getSelect()).toBeDisabled();
  });

  // SUMMARY#W10 (api injection): custom api mock 주입 시 해당 mock 이 호출됨
  it("uses injected api prop when provided, not the default llmConfigsApi", async () => {
    const customApi = {
      listModels: vi.fn().mockResolvedValue([
        { id: "custom-model", name: "Custom Model", type: "chat" as const },
      ]),
      previewModels: vi.fn().mockResolvedValue([]),
    };

    wrap(
      <ModelCombobox
        value=""
        onChange={vi.fn()}
        provider="anthropic"
        apiKey=""
        configId="cfg-custom"
        api={customApi}
      />,
    );

    fireEvent.click(getLoadButton());

    await waitFor(() => {
      expect(customApi.listModels).toHaveBeenCalledWith("cfg-custom");
    });
    expect(llmConfigsApi.listModels).not.toHaveBeenCalled();
    await waitFor(() => {
      expect(optionValues()).toContain("custom-model");
    });
  });

  it("propagates disabled prop to both select and load button", () => {
    wrap(
      <ModelCombobox
        value=""
        onChange={vi.fn()}
        provider="openai"
        apiKey="sk-xxx"
        disabled
      />,
    );
    expect(getSelect()).toBeDisabled();
    expect(getLoadButton()).toBeDisabled();
  });

  // SUMMARY#2(testing): 인플라이트 요청 중 로드 버튼이 비활성
  it("disables the load button while the request is pending", async () => {
    let resolveLoad!: (v: Awaited<ReturnType<typeof llmConfigsApi.previewModels>>) => void;
    vi.mocked(llmConfigsApi.previewModels).mockReturnValue(
      new Promise((res) => { resolveLoad = res; }),
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

    // 응답 전 — 버튼이 비활성이어야 한다
    await waitFor(() => {
      expect(getLoadButton()).toBeDisabled();
    });

    // 응답 후 — 버튼이 활성 복귀
    act(() => { resolveLoad([{ id: "gpt-4o", name: "gpt-4o", type: "chat" }]); });
    await waitFor(() => {
      expect(getLoadButton()).not.toBeDisabled();
    });
  });
});
