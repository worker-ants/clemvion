/**
 * sidebar.tsx — notification 관련 컴포넌트 테스트.
 *
 * 커버 범위:
 *   1. integration_action_required 알림에 Reconnect 버튼 렌더링
 *   2. 다른 타입 알림에는 Reconnect 버튼 미노출
 *   3. 필터 칩 "통합 액션 필요" 클릭 시 해당 타입 알림만 표시
 *   4. Reconnect 버튼 클릭 시 router.push 가 올바른 경로로 호출됨
 *   5. popover 닫힘 후 재열기 시 필터가 "all" 로 리셋됨
 *
 * Sidebar 는 useRouter, useQuery, 여러 store 에 의존하므로
 * vi.mock 으로 격리하고, React Query 는 QueryClient 로직이 아닌
 * apiClient mock 으로 응답을 주입한다.
 */
import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// jsdom 에는 window.matchMedia 가 없으므로 stub 필요 (sidebar 의 useMediaQuery 사용)
Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// ─── next/navigation mock ─────────────────────────────────────────────────
const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush, back: vi.fn() }),
  usePathname: () => "/dashboard",
}));

// ─── next/link mock ───────────────────────────────────────────────────────
vi.mock("next/link", () => ({
  default: ({
    children,
    href,
  }: {
    children: React.ReactNode;
    href: string;
  }) => <a href={href}>{children}</a>,
}));

// ─── API client mock ──────────────────────────────────────────────────────
const apiGetMock = vi.fn();
const apiPatchMock = vi.fn().mockResolvedValue({});
const apiPostMock = vi.fn().mockResolvedValue({});
vi.mock("@/lib/api/client", () => ({
  apiClient: {
    get: (...args: unknown[]) => apiGetMock(...args),
    patch: (...args: unknown[]) => apiPatchMock(...args),
    post: (...args: unknown[]) => apiPostMock(...args),
  },
}));

// ─── auth / workspace / sidebar stores mock ──────────────────────────────
vi.mock("@/lib/stores/auth-store", () => ({
  useAuthStore: (sel: (s: unknown) => unknown) =>
    sel({ user: { name: "Test User" }, logout: vi.fn() }),
}));
vi.mock("@/lib/stores/workspace-store", () => ({
  useWorkspaceStore: (sel: (s: unknown) => unknown) =>
    sel({
      workspaces: [],
      currentWorkspaceId: null,
      setWorkspaces: vi.fn(),
      switchWorkspace: vi.fn(),
    }),
}));
vi.mock("@/lib/stores/sidebar-store", () => ({
  useSidebarStore: (sel: (s: unknown) => unknown) =>
    sel({
      collapsed: false,
      toggleCollapse: vi.fn(),
      setIsSmall: vi.fn(),
      setIsMedium: vi.fn(),
    }),
  selectCollapsed: (s: { collapsed: boolean }) => s.collapsed,
}));

// ─── i18n mock — passthrough key as label ────────────────────────────────
vi.mock("@/lib/i18n", () => ({
  useT: () => (key: string) => key,
}));

// ─── workspace API mock ───────────────────────────────────────────────────
vi.mock("@/lib/api/workspaces", () => ({
  workspacesApi: {
    list: vi.fn().mockResolvedValue({ data: { data: [] } }),
  },
}));

// ─── auth API mock ────────────────────────────────────────────────────────
vi.mock("@/lib/api/auth", () => ({
  authApi: { logout: vi.fn() },
}));

// ─── CreateTeamWorkspaceDialog mock ──────────────────────────────────────
vi.mock("@/components/workspace/create-team-workspace-dialog", () => ({
  CreateTeamWorkspaceDialog: () => null,
}));

// ─── Logo mock ────────────────────────────────────────────────────────────
vi.mock("@/components/ui/logo", () => ({
  Logo: () => <span data-testid="logo" />,
  LogoMark: () => <span data-testid="logomark" />,
}));

// ─── workspace utils mock ─────────────────────────────────────────────────
vi.mock("@/lib/utils/workspace", () => ({
  roleLabelKey: () => "sidebar.roleLabel.member",
}));

import { Sidebar } from "../sidebar";

// ─── helpers ─────────────────────────────────────────────────────────────
function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  };
}

type NotifFixture = {
  id: string;
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string;
  type?: string;
  resourceId?: string | null;
  resourceType?: string | null;
};

function mockNotifResponse(notifs: NotifFixture[]) {
  apiGetMock.mockImplementation((url: string) => {
    if (url === "/notifications?limit=10") {
      return Promise.resolve({ data: { data: notifs } });
    }
    if (url === "/notifications/unread-count") {
      return Promise.resolve({ data: { data: { count: notifs.filter(n => !n.isRead).length } } });
    }
    if (url === "/workspaces") {
      return Promise.resolve({ data: { data: [] } });
    }
    return Promise.resolve({ data: { data: [] } });
  });
}

async function renderAndOpenNotifPopover(notifs: NotifFixture[]) {
  mockNotifResponse(notifs);
  let result: ReturnType<typeof render>;
  await act(async () => {
    result = render(<Sidebar />, { wrapper: createWrapper() });
  });
  // click the bell button to open popover
  const bellButton = screen.getByRole("button", {
    name: /sidebar\.notifications/i,
  });
  await act(async () => {
    fireEvent.click(bellButton);
  });
  await waitFor(() => {
    // popover is open if notification list query data is loaded
  });
  return result!;
}

// ─── tests ───────────────────────────────────────────────────────────────
describe("Sidebar — notification UI (integration_action_required)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPush.mockReset();
  });

  afterEach(() => {
    vi.clearAllTimers();
  });

  it("shows Reconnect button for integration_action_required notification", async () => {
    await renderAndOpenNotifPopover([
      {
        id: "n1",
        title: "Integration needs reconnect",
        message: "Please reconnect",
        isRead: false,
        createdAt: new Date().toISOString(),
        type: "integration_action_required",
        resourceId: "int-abc",
        resourceType: "integration",
      },
    ]);

    await waitFor(() => {
      expect(
        screen.getByText("sidebar.notificationCta.reconnect"),
      ).toBeInTheDocument();
    });
  });

  it("does NOT show Reconnect button for execution_failed notification", async () => {
    await renderAndOpenNotifPopover([
      {
        id: "n2",
        title: "Workflow failed",
        message: "Execution failed",
        isRead: false,
        createdAt: new Date().toISOString(),
        type: "execution_failed",
        resourceId: "wf-1",
      },
    ]);

    await waitFor(() => {
      expect(screen.getByText("Workflow failed")).toBeInTheDocument();
    });
    expect(
      screen.queryByText("sidebar.notificationCta.reconnect"),
    ).not.toBeInTheDocument();
  });

  it("Reconnect button click calls router.push with correct /integrations/<id> path", async () => {
    await renderAndOpenNotifPopover([
      {
        id: "n3",
        title: "Integration needs reconnect",
        message: "Please reconnect",
        isRead: false,
        createdAt: new Date().toISOString(),
        type: "integration_action_required",
        resourceId: "int-abc-123",
        resourceType: "integration",
      },
    ]);

    await waitFor(() => {
      expect(
        screen.getByText("sidebar.notificationCta.reconnect"),
      ).toBeInTheDocument();
    });

    await act(async () => {
      fireEvent.click(screen.getByText("sidebar.notificationCta.reconnect"));
    });

    expect(mockPush).toHaveBeenCalledWith("/integrations/int-abc-123");
  });

  it("filter chip 'integration-action-required' shows only that type", async () => {
    await renderAndOpenNotifPopover([
      {
        id: "n4",
        title: "Integration alert",
        message: "Action needed",
        isRead: false,
        createdAt: new Date().toISOString(),
        type: "integration_action_required",
        resourceId: "int-1",
      },
      {
        id: "n5",
        title: "Execution failed",
        message: "Workflow error",
        isRead: false,
        createdAt: new Date().toISOString(),
        type: "execution_failed",
        resourceId: "wf-1",
      },
    ]);

    await waitFor(() => {
      expect(screen.getByText("Integration alert")).toBeInTheDocument();
      expect(screen.getByText("Execution failed")).toBeInTheDocument();
    });

    // click the integration-action-required filter chip
    const chipButton = screen.getByRole("tab", {
      name: "sidebar.notificationFilter.integrationActionRequired",
    });
    await act(async () => {
      fireEvent.click(chipButton);
    });

    await waitFor(() => {
      expect(screen.getByText("Integration alert")).toBeInTheDocument();
      expect(screen.queryByText("Execution failed")).not.toBeInTheDocument();
    });
  });

  it("notifFilter resets to 'all' after popover is closed and reopened", async () => {
    await renderAndOpenNotifPopover([
      {
        id: "n6",
        title: "Integration alert",
        message: "Action needed",
        isRead: false,
        createdAt: new Date().toISOString(),
        type: "integration_action_required",
        resourceId: "int-1",
      },
      {
        id: "n7",
        title: "Execution failed",
        message: "Workflow error",
        isRead: false,
        createdAt: new Date().toISOString(),
        type: "execution_failed",
      },
    ]);

    await waitFor(() => {
      expect(screen.getByText("Integration alert")).toBeInTheDocument();
    });

    // select integration-action-required filter
    const chipButton = screen.getByRole("tab", {
      name: "sidebar.notificationFilter.integrationActionRequired",
    });
    await act(async () => {
      fireEvent.click(chipButton);
    });

    await waitFor(() => {
      expect(screen.queryByText("Execution failed")).not.toBeInTheDocument();
    });

    // close the popover by clicking the bell button again
    const bellButton = screen.getByRole("button", {
      name: /sidebar\.notifications/i,
    });
    await act(async () => {
      fireEvent.click(bellButton);
    });

    // reopen the popover
    await act(async () => {
      fireEvent.click(bellButton);
    });

    // after reopen, both items should be visible (filter reset to "all")
    await waitFor(() => {
      expect(screen.getByText("Integration alert")).toBeInTheDocument();
      expect(screen.getByText("Execution failed")).toBeInTheDocument();
    });
  });
});
