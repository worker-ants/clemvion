import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, act, cleanup, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useLocaleStore } from "@/lib/stores/locale-store";
import { useWorkspaceStore, type WorkspaceRole } from "@/lib/stores/workspace-store";
import WebChatPage from "../page";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), back: vi.fn() }),
  usePathname: () => "/web-chat",
  useSearchParams: () => new URLSearchParams(),
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

const WEBHOOK_INSTANCE = {
  id: "t-1",
  name: "Support bot",
  type: "webhook",
  isActive: true,
  workflowId: "wf-1",
  workflowName: "FAQ Bot",
  endpointPath: "endpoint-uuid-123",
  config: { interaction: { enabled: true, tokenStrategy: "per_execution" } },
};

const WEBHOOK_INSTANCE_2 = {
  id: "t-3",
  name: "Sales bot",
  type: "webhook",
  isActive: true,
  workflowId: "wf-1",
  workflowName: "FAQ Bot",
  endpointPath: "endpoint-uuid-456",
  config: { interaction: { enabled: true, tokenStrategy: "per_execution" } },
};

// interaction 이 꺼진 webhook 은 인스턴스 목록에서 제외돼야 한다.
const NON_INTERACTION_WEBHOOK = {
  id: "t-2",
  name: "Plain webhook",
  type: "webhook",
  isActive: true,
  workflowId: "wf-2",
  workflowName: "Other",
  endpointPath: "ep-2",
  config: {},
};

function mockApi(triggers: unknown[]) {
  apiGetMock.mockImplementation((url: string) => {
    if (url === "/workflows") {
      return Promise.resolve({ data: { data: [{ id: "wf-1", name: "FAQ Bot" }] } });
    }
    return Promise.resolve({
      data: {
        data: triggers,
        pagination: { page: 1, limit: 100, totalItems: triggers.length, totalPages: 1 },
      },
    });
  });
}

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

async function renderPage() {
  await act(async () => {
    render(<WebChatPage />, { wrapper: createWrapper() });
  });
}

function setRole(role: WorkspaceRole) {
  useWorkspaceStore.setState({
    workspaces: [{ id: "ws-1", name: "Test", type: "team", slug: "team-1", role }],
    currentWorkspaceId: "ws-1",
    loaded: true,
  });
}

describe("WebChatPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useLocaleStore.setState({ locale: "en" });
    setRole("editor");
    cleanup();
  });

  it("인스턴스가 없으면 빈 상태를 보여준다", async () => {
    mockApi([]);
    await renderPage();
    expect(await screen.findByText("No web chats yet")).toBeInTheDocument();
  });

  it("interaction 켜진 webhook 만 인스턴스로 노출하고, 선택 시 설치 스니펫에 endpointPath 를 포함한다", async () => {
    mockApi([WEBHOOK_INSTANCE, NON_INTERACTION_WEBHOOK]);
    await renderPage();

    // interaction 켜진 것만 목록에 (Plain webhook 제외)
    expect(await screen.findByText("Support bot")).toBeInTheDocument();
    expect(screen.queryByText("Plain webhook")).not.toBeInTheDocument();

    // 첫 인스턴스 자동 선택 → 설치 스니펫에 endpointPath 포함
    const snippet = await screen.findByText(/endpoint-uuid-123/);
    expect(snippet).toBeInTheDocument();
    expect(snippet.textContent).toContain("ClemvionChat('boot',");
  });

  it("viewer 는 '웹채팅 만들기' 버튼이 보이지 않는다 (editor+)", async () => {
    setRole("viewer");
    mockApi([WEBHOOK_INSTANCE]);
    await renderPage();
    await screen.findByText("Support bot");
    expect(screen.queryByText("New web chat")).not.toBeInTheDocument();
  });

  it("editor 는 '웹채팅 만들기' 버튼이 보인다", async () => {
    mockApi([WEBHOOK_INSTANCE]);
    await renderPage();
    await screen.findByText("Support bot");
    expect(screen.getByText("New web chat")).toBeInTheDocument();
  });

  it("admin 도 '웹채팅 만들기' 버튼이 보인다", async () => {
    setRole("admin");
    mockApi([WEBHOOK_INSTANCE]);
    await renderPage();
    await screen.findByText("Support bot");
    expect(screen.getByText("New web chat")).toBeInTheDocument();
  });

  it("두 번째 인스턴스를 선택하면 스니펫의 endpointPath 가 교체된다", async () => {
    mockApi([WEBHOOK_INSTANCE, WEBHOOK_INSTANCE_2]);
    await renderPage();
    // 첫 인스턴스 자동 선택 → endpoint-uuid-123
    expect(await screen.findByText(/endpoint-uuid-123/)).toBeInTheDocument();
    // 두 번째 인스턴스 클릭 → 스니펫이 endpoint-uuid-456 으로 교체
    await act(async () => {
      fireEvent.click(screen.getByText("Sales bot"));
    });
    expect(await screen.findByText(/endpoint-uuid-456/)).toBeInTheDocument();
    expect(screen.queryByText(/endpoint-uuid-123/)).not.toBeInTheDocument();
  });

  it("목록 조회 실패 시 loadError 를 보여준다", async () => {
    apiGetMock.mockImplementation((url: string) => {
      if (url === "/workflows") return Promise.resolve({ data: { data: [] } });
      return Promise.reject(new Error("boom"));
    });
    await renderPage();
    expect(await screen.findByText("Failed to load web chats")).toBeInTheDocument();
  });

  it("로딩 중에는 빈 상태가 아니라 로딩 표시를 보여준다", async () => {
    let resolveList: (v: unknown) => void = () => {};
    apiGetMock.mockImplementation((url: string) => {
      if (url === "/workflows") return Promise.resolve({ data: { data: [] } });
      return new Promise((r) => {
        resolveList = r;
      });
    });
    await renderPage();
    expect(screen.getByText("Loading...")).toBeInTheDocument();
    expect(screen.queryByText("No web chats yet")).not.toBeInTheDocument();
    // act warning 회피용 정리.
    await act(async () => {
      resolveList({
        data: { data: [], pagination: { page: 1, limit: 100, totalItems: 0, totalPages: 0 } },
      });
    });
  });
});
