import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, act, cleanup } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useLocaleStore } from "@/lib/stores/locale-store";

const mockPush = vi.fn();
const mockReplace = vi.fn();
let currentSearchParams = new URLSearchParams();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush, replace: mockReplace, back: vi.fn() }),
  usePathname: () => "/llm-configs",
  useSearchParams: () => currentSearchParams,
}));

const getAllMock = vi.fn();
vi.mock("@/lib/api/llm-configs", () => ({
  llmConfigsApi: {
    getAll: (...args: unknown[]) => getAllMock(...args),
    create: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
    setDefault: vi.fn(),
    testConnection: vi.fn(),
    listModels: vi.fn(),
    previewModels: vi.fn(),
  },
}));

import LlmConfigsPage from "../page";

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  };
}

async function renderPage() {
  await act(async () => {
    render(<LlmConfigsPage />, { wrapper: createWrapper() });
  });
}

describe("LlmConfigsPage — pagination", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    currentSearchParams = new URLSearchParams();
    useLocaleStore.setState({ locale: "en" });
    cleanup();
  });

  it("sends ?page=&limit= on the list request", async () => {
    getAllMock.mockResolvedValue({
      data: [],
      pagination: { page: 1, limit: 20, totalItems: 0, totalPages: 0 },
    });
    await renderPage();
    expect(getAllMock).toHaveBeenCalledWith({ page: 1, limit: 20 });
  });

  it("renders Pagination nav when totalPages > 1", async () => {
    getAllMock.mockResolvedValue({
      data: [
        {
          id: "c1",
          provider: "openai",
          name: "Prod",
          apiKey: "***",
          defaultModel: "gpt-4o",
          defaultParams: {},
          isDefault: false,
          createdAt: "",
          updatedAt: "",
        },
      ],
      pagination: { page: 1, limit: 20, totalItems: 50, totalPages: 3 },
    });
    await renderPage();
    await screen.findByText("Prod");
    expect(screen.getByRole("navigation")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "3" })).toBeInTheDocument();
  });
});
