import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent, act, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useLocaleStore } from "@/lib/stores/locale-store";
import { useWorkspaceStore } from "@/lib/stores/workspace-store";

const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  useParams: () => ({}),
  useRouter: () => ({ push: mockPush }),
}));

const getSummary = vi.fn();
const getRecentWorkflows = vi.fn();
const getRecentExecutions = vi.fn();
vi.mock("@/lib/api/dashboard", () => ({
  dashboardApi: {
    getSummary: () => getSummary(),
    getRecentWorkflows: () => getRecentWorkflows(),
    getRecentExecutions: () => getRecentExecutions(),
  },
}));

vi.mock("@/lib/api/workflows", () => ({
  workflowsApi: { create: vi.fn() },
}));

import DashboardPage from "../page";

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
    render(<DashboardPage />, { wrapper: createWrapper() });
  });
}

const SUMMARY = {
  totalWorkflows: 3,
  activeWorkflows: 2,
  runs7d: 10,
  runs7dPrevious: 8,
  runs7dChangePercent: 25,
  successRate: 0.9,
  avgExecutionTime: 3200,
};

const RECENT_EXECUTION = {
  id: "exec-1",
  workflowId: "wf-1",
  workflowName: "My Workflow",
  status: "completed",
  durationMs: 3200,
  activeRunningMs: 3200,
  startedAt: "2024-01-15T14:02:30Z",
  triggerSource: "manual" as const,
  triggerLabel: "Alice",
};

describe("DashboardPage — recent executions row navigation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useLocaleStore.setState({ locale: "en" });
    useWorkspaceStore.setState({
      workspaces: [],
      currentWorkspaceId: null,
      loaded: true,
    });
    getSummary.mockResolvedValue(SUMMARY);
    getRecentWorkflows.mockResolvedValue([]);
    getRecentExecutions.mockResolvedValue([RECENT_EXECUTION]);
  });

  it("row click navigates to the slug-prefixed execution detail when a workspace is active", async () => {
    // slug-누락 회귀 가드: dashboard row-click 은 PR #865 에서 bare-push 였다.
    useWorkspaceStore.setState({
      workspaces: [
        { id: "ws-1", name: "Team", type: "team", slug: "team-x", role: "editor" },
      ],
      currentWorkspaceId: "ws-1",
      loaded: true,
    });
    await renderPage();
    const row = (await screen.findByText("My Workflow")).closest("tr")!;
    fireEvent.click(row);
    expect(mockPush).toHaveBeenCalledWith(
      "/w/team-x/workflows/wf-1/executions/exec-1",
    );
  });

  it("falls back to a bare path when no workspace is active (catch-all absorbs)", async () => {
    await renderPage();
    const row = (await screen.findByText("My Workflow")).closest("tr")!;
    fireEvent.click(row);
    expect(mockPush).toHaveBeenCalledWith(
      "/workflows/wf-1/executions/exec-1",
    );
  });
});

describe("DashboardPage — recent executions run time", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useLocaleStore.setState({ locale: "en" });
    useWorkspaceStore.setState({
      workspaces: [],
      currentWorkspaceId: null,
      loaded: true,
    });
    getSummary.mockResolvedValue(SUMMARY);
    getRecentWorkflows.mockResolvedValue([]);
    getRecentExecutions.mockResolvedValue([
      // 입력을 한 시간 기다리다 취소된 실행: 전체 경과 1시간, 실행 시간 1.2초
      {
        ...RECENT_EXECUTION,
        id: "exec-wait",
        workflowName: "Waited Workflow",
        status: "cancelled",
        durationMs: 3_600_000,
        activeRunningMs: 1_200,
      },
      // 측정되지 않은 실행: 실행 시간이 null 이다
      {
        ...RECENT_EXECUTION,
        id: "exec-unmeasured",
        workflowName: "Unmeasured Workflow",
        durationMs: 5_000,
        activeRunningMs: null,
      },
    ]);
  });

  /** 행의 열 순서: Status · Workflow · Trigger · Duration · Time */
  async function durationCell(workflowName: string): Promise<string | null> {
    const row = (await screen.findByText(workflowName)).closest("tr")!;
    return row.querySelectorAll("td")[3].textContent;
  }

  it("Duration 열은 전체 경과가 아니라 실행 시간(activeRunningMs)을 보인다", async () => {
    await renderPage();
    expect(await durationCell("Waited Workflow")).toBe("1s");
  });

  it("실행 시간이 null 이면 전체 경과로 대신하지 않고 — 를 보인다", async () => {
    await renderPage();
    expect(await durationCell("Unmeasured Workflow")).toBe("\u2014");
  });
});

describe("DashboardPage — recent workflows editor navigation (phase 2)", () => {
  const RECENT_WORKFLOW = {
    id: "wf-9",
    name: "Recent WF",
    isActive: true,
    updatedAt: "2024-01-15T14:02:30Z",
  };

  beforeEach(() => {
    vi.clearAllMocks();
    useLocaleStore.setState({ locale: "en" });
    useWorkspaceStore.setState({
      workspaces: [
        { id: "ws-1", name: "Team", type: "team", slug: "team-x", role: "editor" },
      ],
      currentWorkspaceId: "ws-1",
      loaded: true,
    });
    getSummary.mockResolvedValue(SUMMARY);
    getRecentWorkflows.mockResolvedValue([RECENT_WORKFLOW]);
    getRecentExecutions.mockResolvedValue([]);
  });

  it("recent-workflow click navigates to the slug-prefixed editor (buildEditorHref)", async () => {
    await renderPage();
    fireEvent.click(await screen.findByText("Recent WF"));
    expect(mockPush).toHaveBeenCalledWith("/w/team-x/workflows/wf-9");
  });
});
