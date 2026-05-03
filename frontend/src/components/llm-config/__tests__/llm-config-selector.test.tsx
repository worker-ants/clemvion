import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { LlmConfigSelector } from "../llm-config-selector";
import { llmConfigsApi } from "@/lib/api/llm-configs";

vi.mock("@/lib/api/llm-configs", () => ({
  llmConfigsApi: {
    getAll: vi.fn(),
  },
}));

function wrap(ui: ReactNode) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
}

const baseConfig = {
  provider: "openai",
  apiKey: "***",
  defaultModel: "gpt-4o",
  defaultParams: {},
  createdAt: "2026-05-01T00:00:00Z",
  updatedAt: "2026-05-01T00:00:00Z",
};

describe("LlmConfigSelector", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows the resolved default LLM name on the empty option when a default exists", async () => {
    (llmConfigsApi.getAll as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: [
        { ...baseConfig, id: "c1", name: "Prod OpenAI", isDefault: true },
        { ...baseConfig, id: "c2", name: "Backup", isDefault: false },
      ],
    });

    wrap(<LlmConfigSelector value="" onChange={vi.fn()} />);

    await waitFor(() => {
      const options = screen.getAllByRole("option") as HTMLOptionElement[];
      expect(options.length).toBe(3);
      expect(options[0].value).toBe("");
      expect(options[0].textContent).toMatch(/Prod OpenAI/);
    });

    const options = screen.getAllByRole("option") as HTMLOptionElement[];
    expect(options[0].textContent).toMatch(/현재|currently/i);
  });

  it("falls back to the bare default label and shows the no-default hint when no default exists", async () => {
    (llmConfigsApi.getAll as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: [{ ...baseConfig, id: "c1", name: "Custom", isDefault: false }],
    });

    wrap(<LlmConfigSelector value="" onChange={vi.fn()} />);

    await waitFor(() => {
      const options = screen.getAllByRole("option");
      expect(options[0].textContent).not.toMatch(/currently|현재/i);
    });

    expect(
      screen.getByText(/workspace default LLM|워크스페이스 기본 LLM/i),
    ).toBeInTheDocument();
  });

  it("does not show the no-default hint when a specific config is selected", async () => {
    (llmConfigsApi.getAll as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: [{ ...baseConfig, id: "c1", name: "Custom", isDefault: false }],
    });

    wrap(<LlmConfigSelector value="c1" onChange={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByRole("option", { name: /Custom/i })).toBeInTheDocument();
    });

    expect(
      screen.queryByText(/workspace default LLM|워크스페이스 기본 LLM/i),
    ).not.toBeInTheDocument();
  });
});
