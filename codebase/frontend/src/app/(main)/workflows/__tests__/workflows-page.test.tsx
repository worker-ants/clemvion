import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, act, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useLocaleStore } from "@/lib/stores/locale-store";
import { useWorkspaceStore } from "@/lib/stores/workspace-store";

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
    // ownership describe 가 store 에 팀 워크스페이스를 셋업하므로, 이 describe
    // 시작 시점에 명시적으로 빈 상태로 초기화해 테스트 간 누수를 차단한다.
    useWorkspaceStore.setState({
      workspaces: [],
      currentWorkspaceId: null,
      loaded: true,
    });
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

describe("WorkflowsPage — ownership filter (NAV-WF-07)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    currentSearchParams = new URLSearchParams();
    useLocaleStore.setState({ locale: "en" });
    useWorkspaceStore.setState({
      workspaces: [],
      currentWorkspaceId: null,
      loaded: true,
    });
    cleanup();
  });

  // 마지막 it 가 끝난 뒤에도 DOM 이 남으면 후속 test file 로 잔류해 false-positive
  // duplicate-text 매칭이 발생할 수 있어 명시적으로 cleanup.
  afterEach(() => {
    cleanup();
    useWorkspaceStore.setState({
      workspaces: [],
      currentWorkspaceId: null,
      loaded: true,
    });
  });

  it("hides ownership filter group in personal workspace", async () => {
    useWorkspaceStore.setState({
      workspaces: [
        {
          id: "ws-1",
          name: "Personal",
          type: "personal",
          slug: "personal-1",
          role: "owner",
        },
      ],
      currentWorkspaceId: "ws-1",
      loaded: true,
    });
    setListResponse({
      data: [{ id: "wf-0", name: "Mine", isActive: true, tags: [] }],
      pagination: { page: 1, limit: 10, totalItems: 1, totalPages: 1 },
    });
    await renderPage();
    await screen.findByText("Mine");
    expect(
      screen.queryByRole("group", { name: /Ownership filter/i }),
    ).toBeNull();
  });

  it("renders ownership filter and sends ?ownership=mine when 'Mine' is clicked in team workspace", async () => {
    useWorkspaceStore.setState({
      workspaces: [
        {
          id: "ws-1",
          name: "Team Alpha",
          type: "team",
          slug: "team-alpha",
          role: "editor",
        },
      ],
      currentWorkspaceId: "ws-1",
      loaded: true,
    });
    setListResponse({
      data: [{ id: "wf-0", name: "Doc", isActive: true, tags: [] }],
      pagination: { page: 1, limit: 10, totalItems: 1, totalPages: 1 },
    });
    await renderPage();
    await screen.findByText("Doc");

    const group = screen.getByRole("group", { name: /Ownership filter/i });
    expect(group).toBeInTheDocument();

    const { workflowsApi } = await import("@/lib/api/workflows");
    const listSpy = workflowsApi.list as unknown as ReturnType<typeof vi.fn>;
    listSpy.mockClear();

    await userEvent.click(
      screen.getByRole("button", { name: /^Mine$/ }),
    );

    await vi.waitFor(() => expect(listSpy).toHaveBeenCalled());
    // The most recent invocation should carry ownership=mine.
    const lastParams = listSpy.mock.calls.at(-1)?.[0] as
      | Record<string, string>
      | undefined;
    expect(lastParams?.ownership).toBe("mine");
  });

  it("omits ownership param when 'All' is selected (default state)", async () => {
    useWorkspaceStore.setState({
      workspaces: [
        {
          id: "ws-1",
          name: "Team Alpha",
          type: "team",
          slug: "team-alpha",
          role: "editor",
        },
      ],
      currentWorkspaceId: "ws-1",
      loaded: true,
    });
    setListResponse({
      data: [],
      pagination: { page: 1, limit: 10, totalItems: 0, totalPages: 0 },
    });
    await renderPage();

    const { workflowsApi } = await import("@/lib/api/workflows");
    const listSpy = workflowsApi.list as unknown as ReturnType<typeof vi.fn>;
    const firstCallParams = listSpy.mock.calls[0]?.[0] as
      | Record<string, string>
      | undefined;
    expect(firstCallParams?.ownership).toBeUndefined();
  });
});
