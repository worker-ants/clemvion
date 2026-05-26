import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { EmbeddingModelCombobox } from "../embedding-model-combobox";
import { llmConfigsApi } from "@/lib/api/llm-configs";

vi.mock("@/lib/api/llm-configs", () => ({
  llmConfigsApi: {
    list: vi.fn(),
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
  return screen.getByTestId("embedding-model-load") as HTMLButtonElement;
}

function getSelect(): HTMLSelectElement {
  return screen.getByTestId("embedding-model-select") as HTMLSelectElement;
}

function optionValues(): string[] {
  return Array.from(getSelect().options).map((o) => o.value);
}

const DEFAULT_CONFIG = {
  id: "default-cfg",
  isDefault: true,
};

describe("EmbeddingModelCombobox", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(llmConfigsApi.list).mockResolvedValue([DEFAULT_CONFIG] as never);
  });

  it("renders a disabled select before models are loaded (no free input)", async () => {
    wrap(
      <EmbeddingModelCombobox value="" onChange={vi.fn()} />,
    );

    // 자유 입력용 input 이 존재하지 않아야 함
    await waitFor(() => {
      expect(getSelect()).toBeDisabled();
    });
    expect(
      document.querySelector(
        'input[data-testid="embedding-model-input"]',
      ),
    ).toBeNull();
  });

  it("loads embedding models from the explicit llmConfigId on button click", async () => {
    vi.mocked(llmConfigsApi.listModels).mockResolvedValue([
      {
        id: "text-embedding-3-small",
        name: "text-embedding-3-small",
        type: "embedding",
      },
      {
        id: "text-embedding-3-large",
        name: "text-embedding-3-large",
        type: "embedding",
      },
    ]);

    wrap(
      <EmbeddingModelCombobox
        value=""
        onChange={vi.fn()}
        llmConfigId="explicit-cfg"
      />,
    );

    fireEvent.click(getLoadButton());

    await waitFor(() => {
      expect(llmConfigsApi.listModels).toHaveBeenCalledWith("explicit-cfg", {
        type: "embedding",
      });
    });

    await waitFor(() => {
      expect(optionValues()).toContain("text-embedding-3-small");
    });
    expect(optionValues()).toContain("text-embedding-3-large");
  });

  it("falls back to the workspace default LLMConfig when llmConfigId is undefined", async () => {
    vi.mocked(llmConfigsApi.listModels).mockResolvedValue([
      {
        id: "text-embedding-3-small",
        name: "text-embedding-3-small",
        type: "embedding",
      },
    ]);

    wrap(<EmbeddingModelCombobox value="" onChange={vi.fn()} />);

    // getAll 이 default config 를 resolve 한 뒤 버튼이 활성화돼야 한다
    await waitFor(() => {
      expect(getLoadButton()).not.toBeDisabled();
    });

    fireEvent.click(getLoadButton());

    await waitFor(() => {
      expect(llmConfigsApi.listModels).toHaveBeenCalledWith("default-cfg", {
        type: "embedding",
      });
    });
  });

  it("fires onChange when an option is picked", async () => {
    const onChange = vi.fn();
    vi.mocked(llmConfigsApi.listModels).mockResolvedValue([
      {
        id: "text-embedding-3-small",
        name: "text-embedding-3-small",
        type: "embedding",
      },
    ]);

    wrap(
      <EmbeddingModelCombobox
        value=""
        onChange={onChange}
        llmConfigId="explicit-cfg"
      />,
    );

    fireEvent.click(getLoadButton());

    await waitFor(() => {
      expect(getSelect()).not.toBeDisabled();
    });

    fireEvent.change(getSelect(), {
      target: { value: "text-embedding-3-small" },
    });
    expect(onChange).toHaveBeenCalledWith("text-embedding-3-small");
  });

  it("preserves a previously saved id as a placeholder when missing from the loaded list", async () => {
    vi.mocked(llmConfigsApi.listModels).mockResolvedValue([
      {
        id: "text-embedding-3-small",
        name: "text-embedding-3-small",
        type: "embedding",
      },
    ]);

    wrap(
      <EmbeddingModelCombobox
        value="legacy-embedding-id"
        onChange={vi.fn()}
        llmConfigId="explicit-cfg"
      />,
    );

    // 로드 전: select 비활성이지만 저장값은 option 으로 노출
    await waitFor(() => {
      expect(optionValues()).toContain("legacy-embedding-id");
    });

    fireEvent.click(getLoadButton());

    await waitFor(() => {
      expect(optionValues()).toContain("text-embedding-3-small");
    });

    // legacy 값은 placeholder 로 유지
    expect(optionValues()).toContain("legacy-embedding-id");
    expect(getSelect().value).toBe("legacy-embedding-id");
  });

  it("keeps select disabled and shows error message on load failure (no free input fallback)", async () => {
    vi.mocked(llmConfigsApi.listModels).mockRejectedValue(
      Object.assign(new Error("boom"), {
        isAxiosError: true,
        response: { data: { message: "Provider unavailable" } },
      }),
    );

    wrap(
      <EmbeddingModelCombobox
        value=""
        onChange={vi.fn()}
        llmConfigId="explicit-cfg"
      />,
    );

    fireEvent.click(getLoadButton());

    await waitFor(() => {
      expect(screen.getByText(/provider unavailable/i)).toBeInTheDocument();
    });
    expect(getSelect()).toBeDisabled();
  });

  it("clears loaded models and resets select when llmConfigId changes", async () => {
    vi.mocked(llmConfigsApi.listModels).mockResolvedValueOnce([
      {
        id: "text-embedding-3-small",
        name: "text-embedding-3-small",
        type: "embedding",
      },
    ]);

    const { rerender } = wrap(
      <EmbeddingModelCombobox
        value=""
        onChange={vi.fn()}
        llmConfigId="cfg-a"
      />,
    );

    fireEvent.click(getLoadButton());
    await waitFor(() => {
      expect(optionValues()).toContain("text-embedding-3-small");
    });

    rerender(
      <QueryClientProvider
        client={
          new QueryClient({ defaultOptions: { queries: { retry: false } } })
        }
      >
        <EmbeddingModelCombobox
          value=""
          onChange={vi.fn()}
          llmConfigId="cfg-b"
        />
      </QueryClientProvider>,
    );

    await waitFor(() => {
      expect(optionValues()).not.toContain("text-embedding-3-small");
    });
    expect(getSelect()).toBeDisabled();
  });

  // SUMMARY#5: list 결과가 빈 배열 → effectiveConfigId=undefined → 버튼 비활성
  it("disables the load button when list returns no configs (canLoad=false)", async () => {
    vi.mocked(llmConfigsApi.list).mockResolvedValue([]);

    wrap(<EmbeddingModelCombobox value="" onChange={vi.fn()} />);

    await waitFor(() => {
      expect(getLoadButton()).toBeDisabled();
    });
    expect(getSelect()).toBeDisabled();
  });

  // SUMMARY#6: list API 실패 시 버튼 비활성 유지
  it("disables the load button when list API fails", async () => {
    vi.mocked(llmConfigsApi.list).mockRejectedValue(new Error("network"));

    wrap(<EmbeddingModelCombobox value="" onChange={vi.fn()} />);

    await waitFor(() => {
      expect(getLoadButton()).toBeDisabled();
    });
  });

  // SUMMARY#7: isEmpty 상태 — 로드 성공 + 빈 목록 → "모델 없음" 메시지 표시
  it("shows the empty-list message when load succeeds with no embedding models", async () => {
    vi.mocked(llmConfigsApi.listModels).mockResolvedValue([]);

    wrap(
      <EmbeddingModelCombobox
        value=""
        onChange={vi.fn()}
        llmConfigId="explicit-cfg"
      />,
    );

    fireEvent.click(getLoadButton());

    await waitFor(() => {
      // 사용 가능한 모델이 없을 때 noModelsFound 또는 embeddingModelLoadRequired 메시지
      const msg =
        screen.queryByText(/사용 가능한 모델이 없어요/i) ??
        screen.queryByText(/no models/i);
      expect(msg).toBeInTheDocument();
    });
    expect(getSelect()).toBeDisabled();
  });

  // SUMMARY#1 regression guard: llmConfigId 변경 직후 isEmpty 메시지가 나타나지 않아야 함
  it("does not show empty-list message immediately after llmConfigId change (stale isSuccess guard)", async () => {
    vi.mocked(llmConfigsApi.listModels).mockResolvedValueOnce([]);

    const { rerender } = wrap(
      <EmbeddingModelCombobox
        value=""
        onChange={vi.fn()}
        llmConfigId="cfg-a"
      />,
    );

    // cfg-a 로 로드 → 빈 응답 → 이 시점에는 isEmpty=true
    fireEvent.click(getLoadButton());
    await waitFor(() => {
      const msg =
        screen.queryByText(/사용 가능한 모델이 없어요/i) ??
        screen.queryByText(/no models/i);
      expect(msg).toBeInTheDocument();
    });

    // cfg-b 로 변경 → reset → isEmpty 메시지가 사라져야 한다
    rerender(
      <QueryClientProvider
        client={
          new QueryClient({ defaultOptions: { queries: { retry: false } } })
        }
      >
        <EmbeddingModelCombobox
          value=""
          onChange={vi.fn()}
          llmConfigId="cfg-b"
        />
      </QueryClientProvider>,
    );

    await waitFor(() => {
      const msg =
        screen.queryByText(/사용 가능한 모델이 없어요/i) ??
        screen.queryByText(/no models/i);
      expect(msg).toBeNull();
    });
    expect(getSelect()).toBeDisabled();
  });

  // INFO: type:"chat" 모델이 listModels 응답에 섞여도 select option 에 나타나지 않아야 함
  it("filters out non-embedding models from the select options", async () => {
    vi.mocked(llmConfigsApi.listModels).mockResolvedValue([
      { id: "gpt-4o", name: "gpt-4o", type: "chat" },
      {
        id: "text-embedding-3-small",
        name: "text-embedding-3-small",
        type: "embedding",
      },
    ]);

    wrap(
      <EmbeddingModelCombobox
        value=""
        onChange={vi.fn()}
        llmConfigId="explicit-cfg"
      />,
    );

    fireEvent.click(getLoadButton());

    await waitFor(() => {
      expect(optionValues()).toContain("text-embedding-3-small");
    });
    // chat 모델은 노출되지 않아야 한다
    expect(optionValues()).not.toContain("gpt-4o");
  });
});
