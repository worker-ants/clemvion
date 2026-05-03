import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, act, cleanup } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useLocaleStore } from "@/lib/stores/locale-store";
import {
  useWorkspaceStore,
  type WorkspaceRole,
} from "@/lib/stores/workspace-store";

const mockPush = vi.fn();
const mockReplace = vi.fn();
let currentSearchParams = new URLSearchParams();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush, replace: mockReplace, back: vi.fn() }),
  usePathname: () => "/schedules",
  useSearchParams: () => currentSearchParams,
}));

const apiGetMock = vi.fn();
vi.mock("@/lib/api/client", () => ({
  apiClient: {
    get: (...args: unknown[]) => apiGetMock(...args),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}));

import SchedulesPage from "../page";

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
    render(<SchedulesPage />, { wrapper: createWrapper() });
  });
}

function mockSchedulesResponse(body: unknown) {
  apiGetMock.mockImplementation((url: string) => {
    if (url === "/workflows") return Promise.resolve({ data: { data: [] } });
    return Promise.resolve({ data: body });
  });
}

function setRole(role: WorkspaceRole) {
  useWorkspaceStore.setState({
    workspaces: [
      { id: "ws-1", name: "Test", type: "team", slug: "team-1", role },
    ],
    currentWorkspaceId: "ws-1",
    loaded: true,
  });
}

describe("SchedulesPage — pagination", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    currentSearchParams = new URLSearchParams();
    useLocaleStore.setState({ locale: "en" });
    setRole("editor");
    cleanup();
  });

  it("sends ?page=&limit= on the list request", async () => {
    mockSchedulesResponse({
      data: [],
      pagination: { page: 1, limit: 20, totalItems: 0, totalPages: 0 },
    });
    await renderPage();
    const listCall = apiGetMock.mock.calls.find(
      ([url]) => url === "/schedules",
    );
    expect(listCall).toBeDefined();
    expect(listCall?.[1]?.params).toMatchObject({ page: 1, limit: 20 });
  });

  it("renders Pagination nav (list view) when totalPages > 1", async () => {
    mockSchedulesResponse({
      data: [
        {
          id: "s1",
          cronExpression: "0 9 * * *",
          timezone: "UTC",
          isActive: true,
          trigger: {
            name: "Daily",
            workflowId: "w1",
            workflow: { name: "WF" },
          },
        },
      ],
      pagination: { page: 1, limit: 20, totalItems: 50, totalPages: 3 },
    });
    await renderPage();
    await screen.findByText("Daily");
    expect(screen.getByRole("navigation")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "3" })).toBeInTheDocument();
  });
});

describe("SchedulesPage — RBAC", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    cleanup();
    currentSearchParams = new URLSearchParams();
    useLocaleStore.setState({ locale: "en" });
    useWorkspaceStore.getState().reset();
  });

  function row() {
    return {
      data: [
        {
          id: "s1",
          cronExpression: "0 9 * * *",
          timezone: "UTC",
          isActive: true,
          trigger: {
            name: "Daily",
            workflowId: "w1",
            workflow: { name: "WF" },
          },
        },
      ],
      pagination: { page: 1, limit: 20, totalItems: 1, totalPages: 1 },
    };
  }

  it("Editor: Add schedule·toggle·edit·delete 모두 노출. Run now 도 노출", async () => {
    setRole("editor");
    mockSchedulesResponse(row());
    await renderPage();
    await screen.findByText("Daily");
    expect(
      screen.getByRole("button", { name: /add schedule/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /deactivate|activate/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /run now/i }),
    ).toBeInTheDocument();
    // icon-only 버튼은 title 속성으로 식별
    expect(screen.getByTitle(/^edit$/i)).toBeInTheDocument();
    expect(screen.getByTitle(/^delete$/i)).toBeInTheDocument();
  });

  it("Viewer: Add schedule·toggle·edit·delete 모두 비표시. Run now 는 노출", async () => {
    setRole("viewer");
    mockSchedulesResponse(row());
    await renderPage();
    await screen.findByText("Daily");
    expect(
      screen.queryByRole("button", { name: /add schedule/i }),
    ).toBeNull();
    expect(
      screen.queryByRole("button", { name: /deactivate|activate/i }),
    ).toBeNull();
    expect(screen.queryByTitle(/^edit$/i)).toBeNull();
    expect(screen.queryByTitle(/^delete$/i)).toBeNull();
    // Run now 는 viewer 도 가능
    expect(
      screen.getByRole("button", { name: /run now/i }),
    ).toBeInTheDocument();
  });
});
