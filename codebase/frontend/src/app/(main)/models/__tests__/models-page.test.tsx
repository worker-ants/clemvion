import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, act, cleanup } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useLocaleStore } from "@/lib/stores/locale-store";

const mockReplace = vi.fn();
let currentSearchParams = new URLSearchParams();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: mockReplace, back: vi.fn() }),
  usePathname: () => "/models",
  useSearchParams: () => currentSearchParams,
}));

const getAllMock = vi.fn();
vi.mock("@/lib/api/model-configs", async (orig) => {
  const actual = await orig<typeof import("@/lib/api/model-configs")>();
  return {
    ...actual,
    modelConfigsApi: {
      getAll: (...args: unknown[]) => getAllMock(...args),
      list: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      remove: vi.fn(),
      setDefault: vi.fn(),
      testConnection: vi.fn(),
      listModels: vi.fn(),
      previewModels: vi.fn(),
    },
  };
});

import ModelsPage from "../page";

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
    render(<ModelsPage />, { wrapper: createWrapper() });
  });
}

describe("ModelsPage — tabbed model config", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    currentSearchParams = new URLSearchParams();
    useLocaleStore.setState({ locale: "en" });
    cleanup();
  });

  it("defaults to the chat tab and lists with kind=chat + pagination", async () => {
    getAllMock.mockResolvedValue({
      data: [],
      pagination: { page: 1, limit: 20, totalItems: 0, totalPages: 0 },
    });
    await renderPage();
    expect(getAllMock).toHaveBeenCalledWith("chat", { page: 1, limit: 20 });
  });

  it("honors ?tab=rerank by listing with kind=rerank", async () => {
    currentSearchParams = new URLSearchParams("tab=rerank");
    getAllMock.mockResolvedValue({
      data: [],
      pagination: { page: 1, limit: 20, totalItems: 0, totalPages: 0 },
    });
    await renderPage();
    expect(getAllMock).toHaveBeenCalledWith("rerank", { page: 1, limit: 20 });
  });
});
