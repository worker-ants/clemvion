import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, act, cleanup, fireEvent } from "@testing-library/react";
import userEvent, { PointerEventsCheckLevel } from "@testing-library/user-event";
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

// 실제 이력 다이얼로그를 마운트하면 /triggers/:id/history mock 없이 react-query 가
// 요청을 시도하므로, open/triggerId 만 노출하는 경량 stub 으로 대체한다.
vi.mock("@/components/triggers/trigger-history-dialog", () => ({
  TriggerHistoryDialog: ({
    open,
    triggerId,
    triggerName,
    workflowId,
  }: {
    open: boolean;
    triggerId: string | null;
    triggerName?: string;
    workflowId?: string | null;
  }) =>
    open ? (
      <div data-testid="history-dialog">{`${triggerId}|${triggerName}|${workflowId}`}</div>
    ) : null,
}));

import SchedulesPage from "../page";

// 각 테스트 후 마운트된 DOM 을 정리한다. 두 describe 의 beforeEach 가 cleanup() 을 호출하지만
// 파일의 마지막 렌더는 정리되지 않아, 전체 스위트 실행 시 다음 파일로 DOM 이 누수돼 간헐 실패가
// 났다(예: 중복 'Daily' 매칭). 상시 afterEach 로 culprit 잔류를 제거한다.
afterEach(() => {
  cleanup();
});

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
  // 빈 목록 응답에서는 헤더의 'Add schedule' 버튼 외에 EmptyState 도 동일한
  // 접근성 이름의 버튼을 렌더한다(둘 다 editor RoleGate). 목록 쿼리가 resolve
  // 되어 EmptyState 가 그려진 뒤에는 'Add schedule' 버튼이 2개가 되는데,
  // 쿼리 resolve 시점은 전체 스위트 부하에 따라 흔들려서 findByRole(단수)이
  // 간헐적으로 다중 매칭 throw 를 냈다(이 파일의 flaky 원인). findAllByRole 로
  // 다중 매칭을 허용해 비결정성을 제거한다.
  // 인덱스 선택은 안전하다: 헤더·EmptyState 두 버튼 모두 onClick 이
  // setShowDialog(true) 로 동일한 생성 다이얼로그를 열기 때문에 어느 쪽을
  // 눌러도(또는 향후 DOM 순서가 바뀌어도) 테스트 의도인 "다이얼로그 오픈"은
  // 동일하게 충족된다. (격리 렌더에는 app-shell <header> 가 없어 banner role
  // 스코프 한정은 적용 불가.)
  const addBtns = await screen.findAllByRole("button", {
    name: /add schedule/i,
  });
  await act(async () => {
    fireEvent.click(addBtns[0]);
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
    // edit·delete 버튼은 title 이 아닌 aria-label 로 식별된다(Stage 10 a11y).
    // queryByTitle 은 title 부재로 항상 null → viewer 에 버튼이 노출돼도
    // 통과하는 false-negative 였다. Editor 테스트와 동일하게 role+name 으로 검증.
    expect(
      screen.queryByRole("button", { name: /^edit$/i }),
    ).toBeNull();
    expect(
      screen.queryByRole("button", { name: /^delete$/i }),
    ).toBeNull();
    // Run now 는 viewer 도 가능
    expect(
      screen.getByRole("button", { name: /run now/i }),
    ).toBeInTheDocument();
  });
});

// [Spec 2-navigation/3-schedule §2.1] 워크플로 링크 + ⋮ 오버플로 메뉴(실행 이력·트리거에서 보기)
describe("SchedulesPage — row links & overflow menu", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    cleanup();
    currentSearchParams = new URLSearchParams();
    useLocaleStore.setState({ locale: "en" });
    setRole("editor");
  });

  function rowWithTrigger() {
    return {
      data: [
        {
          id: "s1",
          cronExpression: "0 9 * * *",
          timezone: "UTC",
          isActive: true,
          trigger: {
            id: "t1",
            name: "Daily",
            workflowId: "w1",
            workflow: { name: "WF" },
          },
        },
      ],
      pagination: { page: 1, limit: 20, totalItems: 1, totalPages: 1 },
    };
  }

  it("워크플로우 이름이 에디터(/workflows/:id) 링크로 렌더된다", async () => {
    mockSchedulesResponse(rowWithTrigger());
    await renderPage();
    const link = await screen.findByRole("link", { name: "WF" });
    expect(link).toHaveAttribute("href", "/workflows/w1");
  });

  it("⋮ 메뉴에 실행 이력·트리거에서 보기 항목, 트리거 링크는 /triggers?triggerId= 로 향한다", async () => {
    mockSchedulesResponse(rowWithTrigger());
    await renderPage();
    await screen.findByText("Daily");
    const user = userEvent.setup({
      pointerEventsCheck: PointerEventsCheckLevel.Never,
    });
    await user.click(
      screen.getByRole("button", { name: /schedule actions/i }),
    );
    expect(await screen.findByText(/run history/i)).toBeInTheDocument();
    const viewInTrigger = screen.getByRole("menuitem", {
      name: /view in trigger/i,
    });
    expect(viewInTrigger).toHaveAttribute("href", "/triggers?triggerId=t1");
  });

  it("실행 이력 클릭 시 이력 다이얼로그가 해당 triggerId 로 열린다", async () => {
    mockSchedulesResponse(rowWithTrigger());
    await renderPage();
    await screen.findByText("Daily");
    const user = userEvent.setup({
      pointerEventsCheck: PointerEventsCheckLevel.Never,
    });
    await user.click(
      screen.getByRole("button", { name: /schedule actions/i }),
    );
    await user.click(await screen.findByText(/run history/i));
    // 다이얼로그에 triggerId·triggerName·workflowId 가 모두 전달됨을 검증
    expect(await screen.findByTestId("history-dialog")).toHaveTextContent(
      "t1|Daily|w1",
    );
  });

  it("트리거 없는 스케줄: 워크플로 plain text, ⋮ 항목은 비활성(이력 클릭 no-op·트리거 링크 href 없음)", async () => {
    // trigger.id·workflowId 부재 (degenerate 케이스) — 게이팅 분기 회귀 방지.
    mockSchedulesResponse({
      data: [
        {
          id: "s2",
          cronExpression: "0 9 * * *",
          timezone: "UTC",
          isActive: true,
          trigger: { name: "Orphan", workflow: { name: "WF" } },
        },
      ],
      pagination: { page: 1, limit: 20, totalItems: 1, totalPages: 1 },
    });
    await renderPage();
    await screen.findByText("Orphan");
    // 워크플로 이름은 링크가 아닌 plain text
    expect(screen.queryByRole("link", { name: "WF" })).toBeNull();

    const user = userEvent.setup({
      pointerEventsCheck: PointerEventsCheckLevel.Never,
    });
    await user.click(
      screen.getByRole("button", { name: /schedule actions/i }),
    );
    // "트리거에서 보기" 는 렌더되지만 링크가 아니다(비활성)
    const viewItem = screen.getByRole("menuitem", {
      name: /view in trigger/i,
    });
    expect(viewItem).not.toHaveAttribute("href");
    // "실행 이력" 은 비활성 → 클릭해도 다이얼로그가 열리지 않는다(no-op)
    await user.click(screen.getByRole("menuitem", { name: /run history/i }));
    expect(screen.queryByTestId("history-dialog")).toBeNull();
  });
});

describe("SchedulesPage — inbound ?triggerId= deep-link (Spec §2.1)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    currentSearchParams = new URLSearchParams();
    useLocaleStore.setState({ locale: "en" });
    setRole("editor");
    // jsdom doesn't implement scrollIntoView; the focus ref callback calls it.
    Element.prototype.scrollIntoView = vi.fn();
    cleanup();
  });

  function focusRow() {
    return {
      data: [
        {
          id: "s1",
          cronExpression: "0 9 * * *",
          timezone: "UTC",
          isActive: true,
          trigger: {
            id: "t1",
            name: "Daily",
            workflowId: "w1",
            workflow: { name: "WF" },
          },
        },
      ],
      pagination: { page: 1, limit: 20, totalItems: 1, totalPages: 1 },
    };
  }

  it("highlights and scrolls to the schedule row matching ?triggerId= on landing", async () => {
    // Deep-link from the trigger list's "스케줄 관리에서 편집" (→ /schedules?triggerId=…).
    currentSearchParams = new URLSearchParams("triggerId=t1");
    mockSchedulesResponse(focusRow());
    await renderPage();

    const focused = await screen.findByTestId("schedule-focused-row");
    expect(focused).toBeInTheDocument();
    expect(Element.prototype.scrollIntoView).toHaveBeenCalled();
  });

  it("sends triggerId to the list request so the server filters cross-page", async () => {
    currentSearchParams = new URLSearchParams("triggerId=t1");
    mockSchedulesResponse(focusRow());
    await renderPage();
    await screen.findByText("Daily");

    const listCall = apiGetMock.mock.calls.find(
      ([url]) => url === "/schedules",
    );
    expect(listCall?.[1]?.params).toMatchObject({ triggerId: "t1" });
  });

  it("omits triggerId from the list request when not deep-linked", async () => {
    mockSchedulesResponse(focusRow());
    await renderPage();
    await screen.findByText("Daily");

    const listCall = apiGetMock.mock.calls.find(
      ([url]) => url === "/schedules",
    );
    expect(listCall?.[1]?.params?.triggerId).toBeUndefined();
  });

  it("shows a 'show all' reset link (→ /schedules) when deep-linked", async () => {
    currentSearchParams = new URLSearchParams("triggerId=t1");
    mockSchedulesResponse(focusRow());
    await renderPage();

    const clear = await screen.findByTestId("schedules-clear-trigger-filter");
    expect(clear).toHaveAttribute("href", "/schedules");
  });

  it("shows no reset link when not deep-linked", async () => {
    mockSchedulesResponse(focusRow());
    await renderPage();
    await screen.findByText("Daily");
    expect(
      screen.queryByTestId("schedules-clear-trigger-filter"),
    ).toBeNull();
  });

  it("highlights no row when ?triggerId= matches no schedule on the page", async () => {
    currentSearchParams = new URLSearchParams("triggerId=nope");
    mockSchedulesResponse(focusRow());
    await renderPage();

    await screen.findByText("Daily");
    expect(screen.queryByTestId("schedule-focused-row")).toBeNull();
  });

  it("highlights no row when no ?triggerId= is present", async () => {
    mockSchedulesResponse(focusRow());
    await renderPage();

    await screen.findByText("Daily");
    expect(screen.queryByTestId("schedule-focused-row")).toBeNull();
  });

  it("does not blank-match a trigger-less schedule when ?triggerId= is empty", async () => {
    // Guards `!!focusTriggerId`: an empty param ("") must not match a schedule
    // whose triggerId is also "" (no linked trigger).
    currentSearchParams = new URLSearchParams("triggerId=");
    mockSchedulesResponse({
      data: [
        {
          id: "s1",
          cronExpression: "0 9 * * *",
          timezone: "UTC",
          isActive: true,
          // No `trigger` → mapSchedule sets triggerId = "".
          name: "Orphan",
        },
      ],
      pagination: { page: 1, limit: 20, totalItems: 1, totalPages: 1 },
    });
    await renderPage();

    await screen.findByText("Orphan");
    expect(screen.queryByTestId("schedule-focused-row")).toBeNull();
  });
});
