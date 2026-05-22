import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, act, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PointerEventsCheckLevel } from "@testing-library/user-event";
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
  usePathname: () => "/triggers",
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

vi.mock("@/components/triggers/trigger-detail-drawer", () => ({
  TriggerDetailDrawer: () => null,
}));

// INFO-14: TriggerHistoryDialog mock — 페이지 테스트 격리성 확보.
// 이 mock 이 없으면 실제 컴포넌트가 렌더링되어 /triggers/:id/history API mock 이
// 설정되지 않은 상태에서 react-query 가 요청을 시도할 수 있다.
vi.mock("@/components/triggers/trigger-history-dialog", () => ({
  TriggerHistoryDialog: () => null,
}));

import TriggersPage from "../page";

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
    render(<TriggersPage />, { wrapper: createWrapper() });
  });
}

function mockTriggersResponse(body: unknown) {
  // Two queries: /triggers (list) and /workflows (workflows-list dropdown)
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

describe("TriggersPage — pagination", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    currentSearchParams = new URLSearchParams();
    useLocaleStore.setState({ locale: "en" });
    setRole("editor");
    cleanup();
  });

  it("sends ?page=&limit= on the list request", async () => {
    mockTriggersResponse({
      data: [],
      pagination: { page: 1, limit: 20, totalItems: 0, totalPages: 0 },
    });
    await renderPage();
    const listCall = apiGetMock.mock.calls.find(
      ([url]) => url === "/triggers",
    );
    expect(listCall).toBeDefined();
    expect(listCall?.[1]?.params).toMatchObject({ page: 1, limit: 20 });
  });

  it("renders Pagination nav when totalPages > 1", async () => {
    mockTriggersResponse({
      data: [
        {
          id: "t1",
          name: "Hook A",
          type: "webhook",
          isActive: true,
          workflowId: "w1",
          workflow: { id: "w1", name: "WF" },
        },
      ],
      pagination: { page: 1, limit: 20, totalItems: 50, totalPages: 3 },
    });
    await renderPage();
    await screen.findByText("Hook A");
    expect(screen.getByRole("navigation")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "3" })).toBeInTheDocument();
  });
});

describe("TriggersPage — RBAC", () => {
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
          id: "t1",
          name: "Hook A",
          type: "webhook",
          isActive: true,
          workflowId: "w1",
          workflow: { id: "w1", name: "WF" },
        },
      ],
      pagination: { page: 1, limit: 20, totalItems: 1, totalPages: 1 },
    };
  }

  it("Editor: Add webhook 버튼·⋮ 메뉴 노출", async () => {
    setRole("editor");
    mockTriggersResponse(row());
    await renderPage();
    await screen.findByText("Hook A");
    expect(
      screen.getByRole("button", { name: /add webhook/i }),
    ).toBeInTheDocument();
    // ⋮ 메뉴 trigger (한 행 → 한 trigger)
    expect(
      screen.getByRole("button", { name: /trigger actions/i }),
    ).toBeInTheDocument();
  });

  it("Viewer: Add webhook 비노출 (⋮ 메뉴는 read-only 항목용으로 유지)", async () => {
    setRole("viewer");
    mockTriggersResponse(row());
    await renderPage();
    await screen.findByText("Hook A");
    expect(
      screen.queryByRole("button", { name: /add webhook/i }),
    ).toBeNull();
    // ⋮ 메뉴 trigger 는 viewer 도 노출 (상세 보기·호출 이력 진입용).
    expect(
      screen.getByRole("button", { name: /trigger actions/i }),
    ).toBeInTheDocument();
  });

  // W4: viewer 가 ⋮ 메뉴를 열었을 때 "Delete"·"Activate/Deactivate" 항목이 숨겨진다
  it("Viewer: ⋮ 메뉴 열면 Delete·Activate 항목이 없다 (canEdit 가드)", async () => {
    setRole("viewer");
    mockTriggersResponse(row());
    await renderPage();
    await screen.findByText("Hook A");

    // Radix DropdownMenu 는 포인터 이벤트 기반이므로 PointerEventsCheckLevel.Never 사용
    const user = userEvent.setup({
      pointerEventsCheck: PointerEventsCheckLevel.Never,
    });
    const menuButton = screen.getByRole("button", { name: /trigger actions/i });
    await user.click(menuButton);

    // canEdit 가드 항목은 viewer 에게 렌더링되지 않아야 함
    expect(screen.queryByText(/^delete$/i)).toBeNull();
    expect(screen.queryByText(/activate/i)).toBeNull();
    expect(screen.queryByText(/deactivate/i)).toBeNull();
  });
});
