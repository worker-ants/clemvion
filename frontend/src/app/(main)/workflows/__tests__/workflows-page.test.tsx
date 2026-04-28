import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, act, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useLocaleStore } from "@/lib/stores/locale-store";

// next/navigation mock — must be hoisted via vi.mock
const mockPush = vi.fn();
const mockReplace = vi.fn();
let currentSearchParams = new URLSearchParams();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush, replace: mockReplace, back: vi.fn() }),
  usePathname: () => "/workflows",
  useSearchParams: () => currentSearchParams,
}));

// Workflows API mock — controlled per test via setListResponse / setCreateResult
let listResponse: unknown = {};
const createMock = vi.fn();
vi.mock("@/lib/api/workflows", () => ({
  workflowsApi: {
    list: vi.fn(() => Promise.resolve({ data: listResponse })),
    create: (...args: unknown[]) => createMock(...args),
  },
}));

import WorkflowsPage from "../page";

function setListResponse(body: unknown) {
  listResponse = body;
}

let lastQueryClient: QueryClient | null = null;
function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  lastQueryClient = queryClient;
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  };
}

async function renderPage() {
  await act(async () => {
    render(<WorkflowsPage />, { wrapper: createWrapper() });
  });
}

describe("WorkflowsPage — pagination", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    currentSearchParams = new URLSearchParams();
    useLocaleStore.setState({ locale: "en" });
    cleanup();
  });

  it("shows pagination when totalItems > pageSize (regression for parse bug)", async () => {
    // Backend returns 10 items per page but reports totalItems=25 → 3 pages.
    // The previous bug read responseData.length (= 10) and concluded
    // totalPages=1, hiding the pagination UI.
    setListResponse({
      data: Array.from({ length: 10 }, (_, i) => ({
        id: `wf-${i}`,
        name: `Workflow ${i}`,
        isActive: true,
        tags: [],
      })),
      pagination: { page: 1, limit: 10, totalItems: 25, totalPages: 3 },
    });

    await renderPage();

    // Wait for query to settle
    await screen.findByText("Workflow 0");

    // Pagination nav must be present and reach page 3
    expect(screen.getByRole("navigation")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "3" })).toBeInTheDocument();
    expect(screen.getByLabelText("Next page")).not.toBeDisabled();
  });

  it("hides pagination when totalItems <= pageSize", async () => {
    setListResponse({
      data: [
        { id: "wf-0", name: "Only", isActive: true, tags: [] },
      ],
      pagination: { page: 1, limit: 10, totalItems: 1, totalPages: 1 },
    });

    await renderPage();
    await screen.findByText("Only");

    expect(screen.queryByRole("navigation")).not.toBeInTheDocument();
  });

  it("invalidates the workflows query after create (regression for stale-cache bug)", async () => {
    // The cause: createMutation.onSuccess pushed to /workflows/[id] without
    // invalidating ["workflows"]. With the global staleTime: 60s, returning
    // to the list within 60s would render stale cache.
    setListResponse({
      data: [],
      pagination: { page: 1, limit: 10, totalItems: 0, totalPages: 0 },
    });
    createMock.mockResolvedValue({
      data: { data: { id: "new-wf", name: "New", isActive: true, tags: [] } },
    });

    await renderPage();
    const invalidateSpy = vi.spyOn(lastQueryClient!, "invalidateQueries");

    // Empty state shows the "Create Workflow" CTA. The header "+ New" button
    // is also present — both wire to createMutation.
    const createBtn = await screen.findByRole("button", {
      name: /Create Workflow/i,
    });
    await userEvent.click(createBtn);

    await vi.waitFor(() => {
      expect(createMock).toHaveBeenCalled();
      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: ["workflows"],
      });
    });
    expect(mockPush).toHaveBeenCalledWith("/workflows/new-wf");
  });

  it("tolerates legacy response shape (bare array under `data`)", async () => {
    // Some older deployments may return data: WorkflowData[] without a
    // pagination block. Page should still render without crashing.
    setListResponse({
      data: [
        { id: "wf-0", name: "Legacy", isActive: false, tags: [] },
      ],
    });

    await renderPage();
    expect(await screen.findByText("Legacy")).toBeInTheDocument();
    expect(screen.queryByRole("navigation")).not.toBeInTheDocument();
  });
});
