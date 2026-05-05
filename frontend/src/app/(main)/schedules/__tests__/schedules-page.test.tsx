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

const EMPTY_RESPONSE = {
  data: [],
  pagination: { page: 1, limit: 20, totalItems: 0, totalPages: 0 },
};

async function openAddDialog() {
  const addBtn = await screen.findByRole("button", { name: /add schedule/i });
  await act(async () => {
    fireEvent.click(addBtn);
  });
}

async function clickTab(name: "expression" | "visual") {
  const re = name === "expression" ? /^expression$/i : /^visual$/i;
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: re }));
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
    mockSchedulesResponse(EMPTY_RESPONSE);
    await renderPage();
    await openAddDialog();
    await clickTab("visual");
    expect(await screen.findByText("0 9 * * *")).toBeInTheDocument();
  });

  it("expression 입력 → visual 전환 시 weekly + Mon 만 선택 + 미리보기 cron 보존", async () => {
    setRole("editor");
    mockSchedulesResponse(EMPTY_RESPONSE);
    await renderPage();
    await openAddDialog();

    // expression input 에 weekly Mon 자정 cron 입력
    const cronInput = await screen.findByPlaceholderText("0 * * * *");
    await act(async () => {
      fireEvent.change(cronInput, { target: { value: "0 0 * * 1" } });
    });
    await clickTab("visual");

    // frequency select 가 weekly 로
    const frequencySelect = screen.getByLabelText(/frequency/i) as HTMLSelectElement;
    expect(frequencySelect.value).toBe("weekly");

    // 요일 버튼 중 Mon 만 primary 클래스(selected) — selectedDays = [1]
    const monBtn = screen.getByRole("button", { name: /^mon$/i });
    expect(monBtn.className).toMatch(/bg-\[hsl\(var\(--primary\)\)\]/);
    const tueBtn = screen.getByRole("button", { name: /^tue$/i });
    expect(tueBtn.className).not.toMatch(/bg-\[hsl\(var\(--primary\)\)\]/);

    // 미리보기 cron 그대로
    expect(screen.getByText("0 0 * * 1")).toBeInTheDocument();
    // 변환 가능한 cron 이므로 안내 메시지는 노출되지 않아야 한다 (음성 경로)
    expect(
      screen.queryByText(/cannot be represented in the visual editor/i),
    ).toBeNull();
  });

  it("visual 컨트롤로 monthly/15일 설정 → expression → 다시 visual 왕복 시 보존", async () => {
    setRole("editor");
    mockSchedulesResponse(EMPTY_RESPONSE);
    await renderPage();
    await openAddDialog();
    await clickTab("visual");

    const frequencySelect = screen.getByLabelText(/frequency/i) as HTMLSelectElement;
    await act(async () => {
      fireEvent.change(frequencySelect, { target: { value: "monthly" } });
    });
    const domSelect = screen.getByLabelText(/day of month/i) as HTMLSelectElement;
    await act(async () => {
      fireEvent.change(domSelect, { target: { value: "15" } });
    });

    await clickTab("expression");
    const cronInput = (await screen.findByPlaceholderText(
      "0 * * * *",
    )) as HTMLInputElement;
    expect(cronInput.value).toBe("0 9 15 * *");

    await clickTab("visual");
    expect(
      (screen.getByLabelText(/frequency/i) as HTMLSelectElement).value,
    ).toBe("monthly");
    expect(
      (screen.getByLabelText(/day of month/i) as HTMLSelectElement).value,
    ).toBe("15");
  });

  it("표현 불가 cron(*/5)을 입력하고 visual 로 가면 안내 텍스트가 노출되고 cron 은 보존된다", async () => {
    setRole("editor");
    mockSchedulesResponse(EMPTY_RESPONSE);
    await renderPage();
    await openAddDialog();

    const cronInput = await screen.findByPlaceholderText("0 * * * *");
    await act(async () => {
      fireEvent.change(cronInput, { target: { value: "*/5 * * * *" } });
    });
    await clickTab("visual");

    expect(
      screen.getByText(/cannot be represented in the visual editor/i),
    ).toBeInTheDocument();

    await clickTab("expression");
    const cronInputAfter = (await screen.findByPlaceholderText(
      "0 * * * *",
    )) as HTMLInputElement;
    expect(cronInputAfter.value).toBe("*/5 * * * *");
  });

  it("표현 불가 cron 이 expression 에 남아있어도 visual state(직전 값) 는 보존된다", async () => {
    // 사용자가 visual 에서 monthly/15 설정 → expression 으로 가서 임의의
    // 표현 불가 cron 으로 덮어 씀 → visual 로 돌아오면 monthly/15 그대로
    // 유지되며 안내 메시지가 표시. (parser 가 null 을 반환하면 visual state
    // 는 변경 안 됨)
    setRole("editor");
    mockSchedulesResponse(EMPTY_RESPONSE);
    await renderPage();
    await openAddDialog();
    await clickTab("visual");

    const frequencySelect = screen.getByLabelText(/frequency/i) as HTMLSelectElement;
    await act(async () => {
      fireEvent.change(frequencySelect, { target: { value: "monthly" } });
    });
    const domSelect = screen.getByLabelText(/day of month/i) as HTMLSelectElement;
    await act(async () => {
      fireEvent.change(domSelect, { target: { value: "15" } });
    });

    await clickTab("expression");
    const cronInput = (await screen.findByPlaceholderText(
      "0 * * * *",
    )) as HTMLInputElement;
    await act(async () => {
      fireEvent.change(cronInput, { target: { value: "0 9-17 * * *" } });
    });

    await clickTab("visual");
    // visual state 는 직전 값(monthly/15) 유지
    expect(
      (screen.getByLabelText(/frequency/i) as HTMLSelectElement).value,
    ).toBe("monthly");
    expect(
      (screen.getByLabelText(/day of month/i) as HTMLSelectElement).value,
    ).toBe("15");
    // 안내 메시지도 동시에 노출
    expect(
      screen.getByText(/cannot be represented in the visual editor/i),
    ).toBeInTheDocument();
  });

  it("openEdit: 표현 가능한 cron 의 schedule 편집 시 visual 탭에서 분해된 state 노출", async () => {
    setRole("editor");
    apiGetMock.mockImplementation((url: string) => {
      if (url === "/workflows")
        return Promise.resolve({
          data: { data: [{ id: "w1", name: "WF" }] },
        });
      return Promise.resolve({
        data: {
          data: [
            {
              id: "s1",
              cronExpression: "30 14 15 * *",
              timezone: "UTC",
              isActive: true,
              trigger: {
                name: "Monthly Report",
                workflowId: "w1",
                workflow: { name: "WF" },
              },
            },
          ],
          pagination: { page: 1, limit: 20, totalItems: 1, totalPages: 1 },
        },
      });
    });
    await renderPage();
    await screen.findByText("Monthly Report");
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /^edit$/i }));
    });
    await clickTab("visual");

    expect(
      (screen.getByLabelText(/frequency/i) as HTMLSelectElement).value,
    ).toBe("monthly");
    expect(
      (screen.getByLabelText(/day of month/i) as HTMLSelectElement).value,
    ).toBe("15");
    expect(
      (screen.getByLabelText(/^hour$/i) as HTMLSelectElement).value,
    ).toBe("14");
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
