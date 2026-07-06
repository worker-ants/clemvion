import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, act, cleanup, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useLocaleStore } from "@/lib/stores/locale-store";
import { useWorkspaceStore } from "@/lib/stores/workspace-store";
import type { FolderData } from "@/lib/api/folders";

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

// Folders API mock — foldersApi.list() returns FolderData[] directly (the
// real impl unwraps `{ data: [] }`). Default empty so the folder filter stays
// hidden and unrelated tests are unaffected; the folder describe overrides it.
// FolderData is imported type-only (elided at runtime) so the mock shape stays
// in lockstep with the real API contract instead of drifting from a local copy.
let foldersResponse: FolderData[] = [];
vi.mock("@/lib/api/folders", () => ({
  foldersApi: {
    list: vi.fn(() => Promise.resolve(foldersResponse)),
  },
}));

import WorkflowsPage from "../page";

function setListResponse(body: unknown) {
  listResponse = body;
}

function setFoldersResponse(body: FolderData[]) {
  foldersResponse = body;
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

describe("WorkflowsPage — search/filter no-results reset CTA", () => {
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

  afterEach(() => {
    cleanup();
  });

  it("shows the reset-filters CTA (not the create CTA) when a filter is active and no results match, and clears the filter on click", async () => {
    setListResponse({
      data: [],
      pagination: { page: 1, limit: 10, totalItems: 0, totalPages: 0 },
    });
    await renderPage();

    // Default empty state (no active filters) offers the create CTA.
    expect(
      await screen.findByRole("button", { name: /Create Workflow/i }),
    ).toBeInTheDocument();

    // Activating the "Active" status filter makes hasActiveFilters true.
    await userEvent.click(screen.getByRole("button", { name: /^Active$/ }));

    // Now the no-results state offers a reset CTA instead of create.
    const resetBtn = await screen.findByRole("button", {
      name: /Reset Filters/i,
    });
    expect(resetBtn).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /Create Workflow/i }),
    ).toBeNull();

    // Clicking reset restores the default empty state (create CTA returns).
    await userEvent.click(resetBtn);
    expect(
      await screen.findByRole("button", { name: /Create Workflow/i }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /Reset Filters/i }),
    ).toBeNull();
  });
});

describe("WorkflowsPage — sort (NAV §2.4)", () => {
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

  afterEach(() => {
    cleanup();
  });

  it("omits sort/order params on the default (created) sort", async () => {
    setListResponse({
      data: [{ id: "wf-0", name: "Doc", isActive: true, tags: [] }],
      pagination: { page: 1, limit: 10, totalItems: 1, totalPages: 1 },
    });
    await renderPage();
    await screen.findByText("Doc");

    const { workflowsApi } = await import("@/lib/api/workflows");
    const listSpy = workflowsApi.list as unknown as ReturnType<typeof vi.fn>;
    const firstCallParams = listSpy.mock.calls[0]?.[0] as
      | Record<string, string>
      | undefined;
    // Default sort delegates to the server default — no explicit params sent.
    expect(firstCallParams?.sort).toBeUndefined();
    expect(firstCallParams?.order).toBeUndefined();
  });

  it("sends sort=last_run&order=desc when 'Last run' is selected", async () => {
    setListResponse({
      data: [{ id: "wf-0", name: "Doc", isActive: true, tags: [] }],
      pagination: { page: 1, limit: 10, totalItems: 1, totalPages: 1 },
    });
    await renderPage();
    await screen.findByText("Doc");

    const { workflowsApi } = await import("@/lib/api/workflows");
    const listSpy = workflowsApi.list as unknown as ReturnType<typeof vi.fn>;
    listSpy.mockClear();

    await userEvent.selectOptions(
      screen.getByTestId("workflow-sort"),
      "lastRun",
    );

    await vi.waitFor(() => expect(listSpy).toHaveBeenCalled());
    const lastParams = listSpy.mock.calls.at(-1)?.[0] as
      | Record<string, string>
      | undefined;
    expect(lastParams?.sort).toBe("last_run");
    expect(lastParams?.order).toBe("desc");
  });

  it("sends sort=updated_at&order=desc when 'Recently updated' is selected", async () => {
    setListResponse({
      data: [{ id: "wf-0", name: "Doc", isActive: true, tags: [] }],
      pagination: { page: 1, limit: 10, totalItems: 1, totalPages: 1 },
    });
    await renderPage();
    await screen.findByText("Doc");

    const { workflowsApi } = await import("@/lib/api/workflows");
    const listSpy = workflowsApi.list as unknown as ReturnType<typeof vi.fn>;
    listSpy.mockClear();

    await userEvent.selectOptions(
      screen.getByTestId("workflow-sort"),
      "updated",
    );

    await vi.waitFor(() => expect(listSpy).toHaveBeenCalled());
    const lastParams = listSpy.mock.calls.at(-1)?.[0] as
      | Record<string, string>
      | undefined;
    expect(lastParams?.sort).toBe("updated_at");
    expect(lastParams?.order).toBe("desc");
  });

  it("resets page to 1 when the sort changes (carries page=1, not the prior page)", async () => {
    // 3 pages so the pagination nav renders and page 2 is reachable.
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
    await screen.findByText("Workflow 0");

    // Go to page 2 first.
    await userEvent.click(screen.getByRole("button", { name: "2" }));

    const { workflowsApi } = await import("@/lib/api/workflows");
    const listSpy = workflowsApi.list as unknown as ReturnType<typeof vi.fn>;
    listSpy.mockClear();

    // Changing the sort must reset to page 1.
    await userEvent.selectOptions(
      screen.getByTestId("workflow-sort"),
      "name",
    );

    await vi.waitFor(() => expect(listSpy).toHaveBeenCalled());
    const lastParams = listSpy.mock.calls.at(-1)?.[0] as
      | Record<string, string | number>
      | undefined;
    // page is serialized as a string in the list params.
    expect(String(lastParams?.page)).toBe("1");
    expect(lastParams?.sort).toBe("name");
  });

  it("treats a non-default sort as an active filter: empty results show the Reset CTA, and reset restores the default sort", async () => {
    setListResponse({
      data: [],
      pagination: { page: 1, limit: 10, totalItems: 0, totalPages: 0 },
    });
    await renderPage();

    // Default sort + no other filters → create CTA.
    expect(
      await screen.findByRole("button", { name: /Create Workflow/i }),
    ).toBeInTheDocument();

    // Switching to a non-default sort makes hasActiveFilters true even though
    // no search/status/ownership filter is set.
    await userEvent.selectOptions(
      screen.getByTestId("workflow-sort"),
      "lastRun",
    );

    const resetBtn = await screen.findByRole("button", {
      name: /Reset Filters/i,
    });
    expect(resetBtn).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /Create Workflow/i }),
    ).toBeNull();

    // Reset restores default sort → create CTA returns, select goes back to created.
    await userEvent.click(resetBtn);
    expect(
      await screen.findByRole("button", { name: /Create Workflow/i }),
    ).toBeInTheDocument();
    expect(
      (screen.getByTestId("workflow-sort") as HTMLSelectElement).value,
    ).toBe("created");
  });
});

describe("WorkflowsPage — folder filter (NAV §2.3)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    currentSearchParams = new URLSearchParams();
    useLocaleStore.setState({ locale: "en" });
    useWorkspaceStore.setState({
      workspaces: [],
      currentWorkspaceId: null,
      loaded: true,
    });
    setFoldersResponse([
      { id: "fld-1", name: "Marketing", sortOrder: 0 },
      { id: "fld-2", name: "Sales", sortOrder: 1 },
    ]);
    cleanup();
  });

  afterEach(() => {
    cleanup();
    // Reset so the empty default leaks back to other describes regardless of
    // execution order — the folder filter must stay hidden elsewhere.
    setFoldersResponse([]);
  });

  it("hides the folder filter when the workspace has no folders", async () => {
    setFoldersResponse([]);
    setListResponse({
      data: [{ id: "wf-0", name: "Doc", isActive: true, tags: [] }],
      pagination: { page: 1, limit: 10, totalItems: 1, totalPages: 1 },
    });
    await renderPage();
    await screen.findByText("Doc");
    expect(screen.queryByTestId("workflow-folder-filter")).toBeNull();
  });

  it("renders the folder filter with a leading 'All folders' option when folders exist", async () => {
    setListResponse({
      data: [{ id: "wf-0", name: "Doc", isActive: true, tags: [] }],
      pagination: { page: 1, limit: 10, totalItems: 1, totalPages: 1 },
    });
    await renderPage();
    await screen.findByText("Doc");

    const select = await screen.findByTestId("workflow-folder-filter");
    expect(select).toBeInTheDocument();
    // First option is the "all" sentinel with an empty value.
    const options = within(select as HTMLSelectElement).getAllByRole("option");
    expect(options[0]).toHaveValue("");
    expect(options[0]).toHaveTextContent(/All folders/i);
    expect(
      within(select as HTMLSelectElement).getByRole("option", {
        name: "Marketing",
      }),
    ).toHaveValue("fld-1");
  });

  it("sends ?folderId=<id> on the first page when a folder is selected", async () => {
    setListResponse({
      data: [{ id: "wf-0", name: "Doc", isActive: true, tags: [] }],
      pagination: { page: 1, limit: 10, totalItems: 1, totalPages: 1 },
    });
    await renderPage();
    await screen.findByText("Doc");

    const { workflowsApi } = await import("@/lib/api/workflows");
    const listSpy = workflowsApi.list as unknown as ReturnType<typeof vi.fn>;
    listSpy.mockClear();

    await userEvent.selectOptions(
      screen.getByTestId("workflow-folder-filter"),
      "fld-2",
    );

    await vi.waitFor(() => expect(listSpy).toHaveBeenCalled());
    const lastParams = listSpy.mock.calls.at(-1)?.[0] as
      | Record<string, string>
      | undefined;
    expect(lastParams?.folderId).toBe("fld-2");
    // The onChange handler calls setPage(1) alongside setFolderId, so the query
    // carries the first page. (This mock's searchParams is static, so we assert
    // the emitted page param rather than a live 2→1 transition.)
    expect(String(lastParams?.page)).toBe("1");
  });

  it("omits folderId on the default (all folders) selection", async () => {
    setListResponse({
      data: [{ id: "wf-0", name: "Doc", isActive: true, tags: [] }],
      pagination: { page: 1, limit: 10, totalItems: 1, totalPages: 1 },
    });
    await renderPage();
    await screen.findByText("Doc");

    const { workflowsApi } = await import("@/lib/api/workflows");
    const listSpy = workflowsApi.list as unknown as ReturnType<typeof vi.fn>;
    const firstCallParams = listSpy.mock.calls[0]?.[0] as
      | Record<string, string>
      | undefined;
    expect(firstCallParams?.folderId).toBeUndefined();
  });

  it("treats a selected folder as an active filter and clears it on reset", async () => {
    setListResponse({
      data: [],
      pagination: { page: 1, limit: 10, totalItems: 0, totalPages: 0 },
    });
    await renderPage();

    // No filters yet → create CTA.
    expect(
      await screen.findByRole("button", { name: /Create Workflow/i }),
    ).toBeInTheDocument();

    await userEvent.selectOptions(
      screen.getByTestId("workflow-folder-filter"),
      "fld-1",
    );

    // Selecting a folder makes hasActiveFilters true → reset CTA appears.
    const resetBtn = await screen.findByRole("button", {
      name: /Reset Filters/i,
    });
    expect(resetBtn).toBeInTheDocument();

    // Reset restores the default: folder select returns to the "all" value and
    // the create CTA comes back.
    await userEvent.click(resetBtn);
    expect(
      await screen.findByRole("button", { name: /Create Workflow/i }),
    ).toBeInTheDocument();
    expect(
      (screen.getByTestId("workflow-folder-filter") as HTMLSelectElement).value,
    ).toBe("");
  });

  it("clears the selected folder when the workspace is switched", async () => {
    // Folders are workspace-scoped: a folderId from the old workspace would
    // match nothing after a switch, so switching must reset it to 'all'.
    useWorkspaceStore.setState({
      workspaces: [
        { id: "ws-1", name: "One", type: "team", slug: "one", role: "editor" },
        { id: "ws-2", name: "Two", type: "team", slug: "two", role: "editor" },
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

    // Select a folder in ws-1.
    await userEvent.selectOptions(
      screen.getByTestId("workflow-folder-filter"),
      "fld-2",
    );
    expect(
      (screen.getByTestId("workflow-folder-filter") as HTMLSelectElement).value,
    ).toBe("fld-2");

    // Switching workspace fires the store subscribe callback → setFolderId("").
    await act(async () => {
      useWorkspaceStore.setState({ currentWorkspaceId: "ws-2" });
    });

    // Generous timeout: the reset flows through a store subscribe callback and a
    // folders refetch, which can brush the 1000ms default on a cold start.
    await vi.waitFor(
      () =>
        expect(
          (screen.getByTestId("workflow-folder-filter") as HTMLSelectElement)
            .value,
        ).toBe(""),
      { timeout: 3000 },
    );
  });
});

describe("WorkflowsPage — tag filter (NAV §2.3)", () => {
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

  afterEach(() => {
    cleanup();
  });

  it("renders the tag filter input", async () => {
    setListResponse({
      data: [{ id: "wf-0", name: "Doc", isActive: true, tags: [] }],
      pagination: { page: 1, limit: 10, totalItems: 1, totalPages: 1 },
    });
    await renderPage();
    await screen.findByText("Doc");
    expect(screen.getByTestId("workflow-tag-filter")).toBeInTheDocument();
  });

  it("sends ?tag=<value> (debounced) on the first page when a tag is typed", async () => {
    setListResponse({
      data: [{ id: "wf-0", name: "Doc", isActive: true, tags: ["sales"] }],
      pagination: { page: 1, limit: 10, totalItems: 1, totalPages: 1 },
    });
    await renderPage();
    await screen.findByText("Doc");

    const { workflowsApi } = await import("@/lib/api/workflows");
    const listSpy = workflowsApi.list as unknown as ReturnType<typeof vi.fn>;
    listSpy.mockClear();

    await userEvent.type(screen.getByTestId("workflow-tag-filter"), "sales");

    // The 300ms debounce fires within waitFor's window, then the query re-runs
    // carrying tag=sales.
    await vi.waitFor(() => {
      const lastParams = listSpy.mock.calls.at(-1)?.[0] as
        | Record<string, string>
        | undefined;
      expect(lastParams?.tag).toBe("sales");
    });
    const lastParams = listSpy.mock.calls.at(-1)?.[0] as
      | Record<string, string>
      | undefined;
    // Documents the emitted first-page param. Like the folder-filter test, this
    // mock's searchParams is static (router.replace is a no-op), so page stays 1
    // regardless of setPage — this asserts the emitted value, not a live 2→1
    // reset transition. See use-page-param mock note above.
    expect(String(lastParams?.page)).toBe("1");
  });

  it("omits tag on the empty (default) input", async () => {
    setListResponse({
      data: [{ id: "wf-0", name: "Doc", isActive: true, tags: [] }],
      pagination: { page: 1, limit: 10, totalItems: 1, totalPages: 1 },
    });
    await renderPage();
    await screen.findByText("Doc");

    const { workflowsApi } = await import("@/lib/api/workflows");
    const listSpy = workflowsApi.list as unknown as ReturnType<typeof vi.fn>;
    const firstCallParams = listSpy.mock.calls[0]?.[0] as
      | Record<string, string>
      | undefined;
    expect(firstCallParams?.tag).toBeUndefined();
  });

  it("currently sends a whitespace-only tag as-is (no trimming, matching the search filter)", async () => {
    // Pins the intentional no-trim behavior: like search, a whitespace-only
    // entry is sent verbatim (server `= ANY(tags)` safely yields 0 rows) and
    // counts as an active filter. If trimming is ever added, this test flips.
    setListResponse({
      data: [],
      pagination: { page: 1, limit: 10, totalItems: 0, totalPages: 0 },
    });
    await renderPage();

    const { workflowsApi } = await import("@/lib/api/workflows");
    const listSpy = workflowsApi.list as unknown as ReturnType<typeof vi.fn>;
    listSpy.mockClear();

    await userEvent.type(screen.getByTestId("workflow-tag-filter"), "   ");

    await vi.waitFor(() => {
      const lastParams = listSpy.mock.calls.at(-1)?.[0] as
        | Record<string, string>
        | undefined;
      expect(lastParams?.tag).toBe("   ");
    });
    // Whitespace-only still flips hasActiveFilters → reset CTA is shown.
    expect(
      await screen.findByRole("button", { name: /Reset Filters/i }),
    ).toBeInTheDocument();
  });

  it("treats a typed tag as an active filter and clears it on reset", async () => {
    setListResponse({
      data: [],
      pagination: { page: 1, limit: 10, totalItems: 0, totalPages: 0 },
    });
    await renderPage();

    // No filters yet → create CTA.
    expect(
      await screen.findByRole("button", { name: /Create Workflow/i }),
    ).toBeInTheDocument();

    await userEvent.type(screen.getByTestId("workflow-tag-filter"), "sales");

    // Once the debounce promotes the tag, hasActiveFilters flips → reset CTA.
    const resetBtn = await screen.findByRole("button", {
      name: /Reset Filters/i,
    });
    expect(resetBtn).toBeInTheDocument();

    await userEvent.click(resetBtn);
    expect(
      await screen.findByRole("button", { name: /Create Workflow/i }),
    ).toBeInTheDocument();
    expect(
      (screen.getByTestId("workflow-tag-filter") as HTMLInputElement).value,
    ).toBe("");
  });
});
