import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, act, cleanup, fireEvent } from "@testing-library/react";
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
    // icon-only 버튼은 aria-label 로 식별 (Stage 10 a11y — title 중복 제거).
    expect(
      screen.getByRole("button", { name: /^edit$/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /^delete$/i }),
    ).toBeInTheDocument();
  });

  it("Visual 탭으로 전환만 해도 기본 cron(0 9 * * *)이 즉시 emit 되어 'Generated expression' 미리보기가 노출", async () => {
    setRole("editor");
    mockSchedulesResponse({
      data: [],
      pagination: { page: 1, limit: 20, totalItems: 0, totalPages: 0 },
    });
    await renderPage();

    // Add Schedule 다이얼로그 오픈
    const addBtn = await screen.findByRole("button", { name: /add schedule/i });
    await act(async () => {
      fireEvent.click(addBtn);
    });

    // Visual 탭 클릭
    const visualTab = await screen.findByRole("button", { name: /^visual$/i });
    await act(async () => {
      fireEvent.click(visualTab);
    });

    // 기본값(daily 09:00)에 해당하는 cron 식이 미리보기에 표시되어야 한다
    expect(await screen.findByText("0 9 * * *")).toBeInTheDocument();
  });

  it("expression 입력 → visual 전환 시 cron 이 시각 컨트롤로 분해되어 표시된다", async () => {
    // 사용자가 Mon 자정 cron 을 직접 입력한 뒤 시각 탭으로 가면 weekly 가
    // 선택되어 있고 Mon 만 선택된 상태로 표시되어야 한다 (parser 동기화).
    setRole("editor");
    mockSchedulesResponse({
      data: [],
      pagination: { page: 1, limit: 20, totalItems: 0, totalPages: 0 },
    });
    await renderPage();

    const addBtn = await screen.findByRole("button", { name: /add schedule/i });
    await act(async () => {
      fireEvent.click(addBtn);
    });

    // expression input 에 weekly Mon 자정 cron 입력
    const cronInput = await screen.findByPlaceholderText("0 * * * *");
    await act(async () => {
      fireEvent.change(cronInput, { target: { value: "0 0 * * 1" } });
    });

    // visual 탭으로 전환
    const visualTab = screen.getByRole("button", { name: /^visual$/i });
    await act(async () => {
      fireEvent.click(visualTab);
    });

    // frequency select 가 weekly 로 표시되는지
    const frequencySelect = screen.getByLabelText(/frequency/i) as HTMLSelectElement;
    expect(frequencySelect.value).toBe("weekly");

    // generated expression 미리보기가 입력한 cron 그대로
    expect(screen.getByText("0 0 * * 1")).toBeInTheDocument();
  });

  it("visual 컨트롤로 monthly/15일 설정 → expression → 다시 visual 왕복 시 보존", async () => {
    setRole("editor");
    mockSchedulesResponse({
      data: [],
      pagination: { page: 1, limit: 20, totalItems: 0, totalPages: 0 },
    });
    await renderPage();

    const addBtn = await screen.findByRole("button", { name: /add schedule/i });
    await act(async () => {
      fireEvent.click(addBtn);
    });

    // visual 탭 진입 → daily 디폴트 09:00
    const visualTab = await screen.findByRole("button", { name: /^visual$/i });
    await act(async () => {
      fireEvent.click(visualTab);
    });

    // frequency = monthly 로 변경
    const frequencySelect = screen.getByLabelText(/frequency/i) as HTMLSelectElement;
    await act(async () => {
      fireEvent.change(frequencySelect, { target: { value: "monthly" } });
    });

    // day-of-month = 15
    const domSelect = screen.getByLabelText(/day of month/i) as HTMLSelectElement;
    await act(async () => {
      fireEvent.change(domSelect, { target: { value: "15" } });
    });

    // expression 탭으로 가서 cron 확인
    const expressionTab = screen.getByRole("button", { name: /^expression$/i });
    await act(async () => {
      fireEvent.click(expressionTab);
    });
    const cronInput = (await screen.findByPlaceholderText(
      "0 * * * *",
    )) as HTMLInputElement;
    expect(cronInput.value).toBe("0 9 15 * *");

    // 다시 visual 탭으로 → monthly/15 가 그대로 보존되어야 한다
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /^visual$/i }));
    });
    expect(
      (screen.getByLabelText(/frequency/i) as HTMLSelectElement).value,
    ).toBe("monthly");
    expect(
      (screen.getByLabelText(/day of month/i) as HTMLSelectElement).value,
    ).toBe("15");
  });

  it("표현 불가 cron(*/5)을 입력하고 visual 로 가면 안내 텍스트가 노출된다", async () => {
    setRole("editor");
    mockSchedulesResponse({
      data: [],
      pagination: { page: 1, limit: 20, totalItems: 0, totalPages: 0 },
    });
    await renderPage();

    const addBtn = await screen.findByRole("button", { name: /add schedule/i });
    await act(async () => {
      fireEvent.click(addBtn);
    });

    const cronInput = await screen.findByPlaceholderText("0 * * * *");
    await act(async () => {
      fireEvent.change(cronInput, { target: { value: "*/5 * * * *" } });
    });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /^visual$/i }));
    });

    // 안내 메시지가 표시
    expect(
      screen.getByText(/cannot be represented in the visual editor/i),
    ).toBeInTheDocument();

    // 그러나 cron 자체는 사용자가 visual 컨트롤을 만지기 전까지 보존
    const expressionTab = screen.getByRole("button", { name: /^expression$/i });
    await act(async () => {
      fireEvent.click(expressionTab);
    });
    const cronInputAfter = (await screen.findByPlaceholderText(
      "0 * * * *",
    )) as HTMLInputElement;
    expect(cronInputAfter.value).toBe("*/5 * * * *");
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
