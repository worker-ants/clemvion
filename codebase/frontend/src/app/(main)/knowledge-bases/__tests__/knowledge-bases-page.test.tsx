import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, act, cleanup } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useLocaleStore } from "@/lib/stores/locale-store";

const mockPush = vi.fn();
const mockReplace = vi.fn();
let currentSearchParams = new URLSearchParams();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush, replace: mockReplace, back: vi.fn() }),
  usePathname: () => "/knowledge-bases",
  useSearchParams: () => currentSearchParams,
}));

const getAllMock = vi.fn();
vi.mock("@/lib/api/knowledge-bases", () => ({
  knowledgeBasesApi: {
    getAll: (...args: unknown[]) => getAllMock(...args),
    create: vi.fn(),
    remove: vi.fn(),
  },
}));

import KnowledgeBasesPage from "../page";

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
    render(<KnowledgeBasesPage />, { wrapper: createWrapper() });
  });
}

describe("KnowledgeBasesPage — pagination", () => {
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
          id: "kb-1",
          name: "KB",
          embeddingModel: "text-embedding-3-small",
          chunkSize: 1000,
          chunkOverlap: 200,
          documentCount: 5,
          createdAt: "",
          updatedAt: "",
        },
      ],
      pagination: { page: 1, limit: 20, totalItems: 60, totalPages: 3 },
    });
    await renderPage();
    await screen.findByText("KB");
    expect(screen.getByRole("navigation")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "3" })).toBeInTheDocument();
  });

  it("hides Pagination when totalPages = 1", async () => {
    getAllMock.mockResolvedValue({
      data: [
        {
          id: "kb-1",
          name: "Solo",
          embeddingModel: "text-embedding-3-small",
          chunkSize: 1000,
          chunkOverlap: 200,
          documentCount: 0,
          createdAt: "",
          updatedAt: "",
        },
      ],
      pagination: { page: 1, limit: 20, totalItems: 1, totalPages: 1 },
    });
    await renderPage();
    await screen.findByText("Solo");
    expect(screen.queryByRole("navigation")).not.toBeInTheDocument();
  });
});

describe("KnowledgeBasesPage — unsearchable warning", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    currentSearchParams = new URLSearchParams();
    useLocaleStore.setState({ locale: "en" });
    cleanup();
  });

  function kbCard(overrides: Record<string, unknown>) {
    return {
      id: "kb-1",
      name: "Plans",
      embeddingModel: "multilingual-e5-large",
      ragMode: "vector",
      chunkSize: 1000,
      chunkOverlap: 200,
      documentCount: 8,
      reembedStatus: "idle",
      createdAt: "",
      updatedAt: "",
      ...overrides,
    };
  }

  it("shows 're-embedding required' when embeddingDimension is null and reembed idle", async () => {
    getAllMock.mockResolvedValue({
      data: [kbCard({ embeddingDimension: null, reembedStatus: "idle" })],
      pagination: { page: 1, limit: 20, totalItems: 1, totalPages: 1 },
    });
    await renderPage();
    await screen.findByText("Plans");
    expect(
      screen.getByText("Re-embedding required · not searchable"),
    ).toBeInTheDocument();
  });

  it("shows 're-embedding…' when reembed in_progress", async () => {
    getAllMock.mockResolvedValue({
      data: [
        kbCard({ embeddingDimension: null, reembedStatus: "in_progress" }),
      ],
      pagination: { page: 1, limit: 20, totalItems: 1, totalPages: 1 },
    });
    await renderPage();
    await screen.findByText("Plans");
    expect(screen.getByText("Re-embedding…")).toBeInTheDocument();
    expect(
      screen.queryByText("Re-embedding required · not searchable"),
    ).not.toBeInTheDocument();
  });

  it("hides the warning for a healthy KB (dimension set)", async () => {
    getAllMock.mockResolvedValue({
      data: [kbCard({ embeddingDimension: 1024, reembedStatus: "idle" })],
      pagination: { page: 1, limit: 20, totalItems: 1, totalPages: 1 },
    });
    await renderPage();
    await screen.findByText("Plans");
    expect(
      screen.queryByText("Re-embedding required · not searchable"),
    ).not.toBeInTheDocument();
    expect(screen.getByText("1024d")).toBeInTheDocument();
  });
});
