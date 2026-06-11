import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, act, cleanup, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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

  const emptyPage = {
    data: [],
    pagination: { page: 1, limit: 20, totalItems: 0, totalPages: 0 },
  };

  it("defaults to the chat tab and lists with kind=chat + pagination", async () => {
    getAllMock.mockResolvedValue(emptyPage);
    await renderPage();
    expect(getAllMock).toHaveBeenCalledWith("chat", { page: 1, limit: 20 });
  });

  it("honors ?tab=rerank by listing with kind=rerank", async () => {
    currentSearchParams = new URLSearchParams("tab=rerank");
    getAllMock.mockResolvedValue(emptyPage);
    await renderPage();
    expect(getAllMock).toHaveBeenCalledWith("rerank", { page: 1, limit: 20 });
  });

  // SUMMARY#W11: embedding 탭 API 호출 검증
  it("honors ?tab=embedding by listing with kind=embedding", async () => {
    currentSearchParams = new URLSearchParams("tab=embedding");
    getAllMock.mockResolvedValue(emptyPage);
    await renderPage();
    expect(getAllMock).toHaveBeenCalledWith("embedding", { page: 1, limit: 20 });
  });

  // SUMMARY#W11: 탭 전환 시 mockReplace 호출 URL 검증
  // Radix Tabs v1.1+ uses keyboard/pointer events for activation.
  // Use userEvent.click (which fires the full pointer event sequence) to trigger onValueChange.
  it("calls router.replace with tab=embedding when the Embedding tab trigger is activated", async () => {
    const user = userEvent.setup();
    getAllMock.mockResolvedValue(emptyPage);
    await renderPage();

    // Radix Tabs renders triggers with role="tab"
    const embeddingTab = Array.from(
      document.querySelectorAll('[role="tab"]'),
    ).find((el) => el.textContent?.trim() === "Embedding") as HTMLElement | undefined;

    expect(embeddingTab).toBeTruthy();

    await user.click(embeddingTab!);

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith(
        expect.stringContaining("tab=embedding"),
      );
    });
  });
});
