import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  render,
  screen,
  fireEvent,
  act,
  waitFor,
} from "@testing-library/react";
import { Suspense } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useLocaleStore } from "@/lib/stores/locale-store";
import { useWorkspaceStore } from "@/lib/stores/workspace-store";

const mockPush = vi.fn();
const mockBack = vi.fn();
vi.mock("next/navigation", () => ({
  useParams: () => ({}),
  useRouter: () => ({ push: mockPush, back: mockBack }),
}));

vi.mock("@/lib/api/workflows", () => ({
  workflowsApi: {
    get: vi.fn().mockResolvedValue({
      data: { data: { id: "wf-1", name: "Test Workflow" } },
    }),
  },
}));

vi.mock("@/lib/api/executions", () => ({
  executionsApi: {
    getByWorkflow: vi.fn().mockResolvedValue({
          data: [
            {
              id: "exec-1",
              workflowId: "wf-1",
              status: "completed",
              startedAt: "2024-01-15T14:02:30Z",
              finishedAt: "2024-01-15T14:02:33Z",
              // 입력 대기가 들어간 전체 경과(3.2s)와 순수 실행 시간(1.2s)이 다르다.
              durationMs: 3200,
              activeRunningMs: 1200,
              inputData: {},
              outputData: {},
              error: null,
              triggerSource: "manual",
              triggerLabel: "Alice",
              totalNodeCount: 1,
              completedNodeCount: 1,
              failedNodeCount: 0,
              nodeExecutions: [
                { id: "ne-1", nodeId: "n1", status: "completed", startedAt: "2024-01-15T14:02:30Z", finishedAt: "2024-01-15T14:02:31Z", durationMs: 800, inputData: {}, outputData: {}, error: null, retryCount: 0, node: { id: "n1", type: "transform", label: "Transform" } },
              ],
            },
            {
              id: "exec-2",
              workflowId: "wf-1",
              status: "failed",
              startedAt: "2024-01-15T13:55:10Z",
              finishedAt: "2024-01-15T13:55:11Z",
              // 측정되지 않은 실행(V083 이전 등)은 서버가 null 로 보낸다.
              durationMs: 1000,
              activeRunningMs: null,
              inputData: {},
              outputData: null,
              error: { message: "Connection timeout" },
              triggerSource: "schedule",
              triggerLabel: "매일 오전 9시 보고서",
              totalNodeCount: 1,
              completedNodeCount: 0,
              failedNodeCount: 1,
              nodeExecutions: [
                { id: "ne-2", nodeId: "n1", status: "failed", startedAt: "2024-01-15T13:55:10Z", finishedAt: "2024-01-15T13:55:11Z", durationMs: 1000, inputData: {}, outputData: null, error: { message: "Connection timeout" }, retryCount: 0, node: { id: "n1", type: "http_request", label: "API Call" } },
              ],
            },
          ],
          pagination: {
            page: 1,
            limit: 20,
            totalItems: 2,
            totalPages: 1,
          },
    }),
  },
}));

import ExecutionListPage from "../page";
import { executionsApi } from "@/lib/api/executions";

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <Suspense fallback={<div>Loading...</div>}>{children}</Suspense>
      </QueryClientProvider>
    );
  };
}

async function renderPage() {
  await act(async () => {
    render(
      <ExecutionListPage params={Promise.resolve({ id: "wf-1" })} />,
      { wrapper: createWrapper() },
    );
  });
}

describe("ExecutionListPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useLocaleStore.setState({ locale: "en" });
    // slug 는 store 파생 — 케이스 간 누수 방지(기본 empty → slug null → bare path).
    useWorkspaceStore.setState({
      workspaces: [],
      currentWorkspaceId: null,
      loaded: true,
    });
  });

  it("renders workflow name and executions title", async () => {
    await renderPage();
    expect(await screen.findByText(/Test Workflow/)).toBeDefined();
    expect(screen.getByText(/Executions/)).toBeDefined();
  });

  it("renders execution rows with status and duration", async () => {
    await renderPage();
    // 격리 실행 시 "Completed" 가 1개만 (filter 버튼) 매칭되고 row badge 가
    // 비동기로 늦게 들어오는 환경이 있어, findAllByText 로 최소 1개 이상만
    // 확인 (multi-match throw 회피). row badge 의 실재성은 tbody DOM 으로
    // 직접 검증 — locale store 가 비동기로 propagate 되는 케이스에도 안전.
    await screen.findAllByText("Completed");
    await waitFor(() => {
      expect(
        document.querySelectorAll("tbody tr").length,
      ).toBeGreaterThan(0);
    });
    // "Failed" 도 filter 버튼 + row badge — 1개 이상 매칭만 확인.
    expect(screen.getAllByText("Failed").length).toBeGreaterThanOrEqual(1);
  });

  it("Duration 열은 전체 경과가 아니라 실행 시간(activeRunningMs)을 보인다", async () => {
    await renderPage();
    await waitFor(() => {
      expect(document.querySelectorAll("tbody tr").length).toBe(2);
    });
    const rows = document.querySelectorAll("tbody tr");
    // 열 순서: Status · Trigger · Started At · Duration · Nodes
    expect(rows[0].querySelectorAll("td")[3].textContent).toBe("1.2s");
    // 실행 시간이 null 이면 전체 경과(1s)로 대신하지 않고 — 를 보인다.
    expect(rows[1].querySelectorAll("td")[3].textContent).toBe("\u2014");
    expect(screen.queryByText("3.2s")).toBeNull();
    expect(screen.queryByText("1s")).toBeNull();
  });

  it("Duration 열 머리를 누르면 active_running_ms 로 정렬해 다시 조회한다", async () => {
    await renderPage();
    await waitFor(() => {
      expect(document.querySelectorAll("tbody tr").length).toBe(2);
    });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /Duration/ }));
    });
    await waitFor(() => {
      expect(vi.mocked(executionsApi.getByWorkflow)).toHaveBeenLastCalledWith(
        "wf-1",
        expect.objectContaining({ sort: "active_running_ms", order: "desc" }),
      );
    });
  });

  it("renders filter buttons", async () => {
    await renderPage();
    // 버튼 자체를 직접 기다림 — text-only 셀렉터(`findByText("Completed")`)는
    // row status 와 다중 매칭되어 multi-match throw 위험.
    await screen.findByRole("button", { name: "Completed" });

    expect(screen.getByRole("button", { name: "All" })).toBeDefined();
    expect(screen.getByRole("button", { name: "Failed" })).toBeDefined();
    expect(screen.getByRole("button", { name: "Running" })).toBeDefined();
    expect(screen.getByRole("button", { name: "Cancelled" })).toBeDefined();
  });

  it("navigates to execution detail on row click", async () => {
    await renderPage();
    // tbody 의 행이 렌더링될 때까지 대기 — `findByText("Completed")` 는
    // filter 버튼과도 매칭되어 multi-match throw 가 발생할 수 있다 (suite
    // 전체 실행 시 flaky 의 원인이었음).
    await waitFor(() => {
      expect(
        document.querySelectorAll("tbody tr").length,
      ).toBeGreaterThan(0);
    });
    const rows = document.querySelectorAll("tbody tr");
    fireEvent.click(rows[0]);

    expect(mockPush).toHaveBeenCalledWith("/workflows/wf-1/executions/exec-1");
  });

  it("navigates to the slug-prefixed detail on row click when a workspace is active", async () => {
    // slug-누락 회귀 가드: 활성 워크스페이스가 있으면 `/w/<slug>/...` 로 이동해야 한다.
    // (위 테스트는 slug=null 폴백 = bare path 를 검증하므로, 이 케이스가 없으면
    //  buildExecutionHref 로의 배선이 slug 를 빠뜨려도(PR #865 회귀) 통과해버린다.)
    useWorkspaceStore.setState({
      workspaces: [
        { id: "ws-1", name: "Team", type: "team", slug: "team-x", role: "editor" },
      ],
      currentWorkspaceId: "ws-1",
      loaded: true,
    });
    await renderPage();
    await waitFor(() => {
      expect(
        document.querySelectorAll("tbody tr").length,
      ).toBeGreaterThan(0);
    });
    fireEvent.click(document.querySelectorAll("tbody tr")[0]);

    expect(mockPush).toHaveBeenCalledWith(
      "/w/team-x/workflows/wf-1/executions/exec-1",
    );
  });

  it("navigates to editor on 'Open in Editor' click", async () => {
    await renderPage();
    const editorLink = await screen.findByText("Open in Editor");
    fireEvent.click(editorLink);

    expect(mockPush).toHaveBeenCalledWith("/workflows/wf-1");
  });

  it("navigates to the slug-prefixed editor on 'Open in Editor' when a workspace is active", async () => {
    // slug 라우팅 phase 2: 에디터 링크(buildEditorHref)도 활성 slug 를 붙여야 한다.
    useWorkspaceStore.setState({
      workspaces: [
        { id: "ws-1", name: "Team", type: "team", slug: "team-x", role: "editor" },
      ],
      currentWorkspaceId: "ws-1",
      loaded: true,
    });
    await renderPage();
    const editorLink = await screen.findByText("Open in Editor");
    fireEvent.click(editorLink);

    expect(mockPush).toHaveBeenCalledWith("/w/team-x/workflows/wf-1");
  });

  it("displays node execution counts", async () => {
    await renderPage();
    await screen.findAllByText("Completed");
    expect(screen.getByText(/1 failed/)).toBeDefined();
  });

  it("renders Trigger column with source label and secondary label", async () => {
    await renderPage();
    // findAllByText 로 multi-match 안전망 — filter 버튼 + row badge 모두 매칭.
    await screen.findAllByText("Completed");
    // exec-1 → manual / Alice
    expect(screen.getByText("Manual")).toBeDefined();
    expect(screen.getByText("Alice")).toBeDefined();
    // exec-2 → schedule / 매일 오전 9시 보고서
    expect(screen.getByText("Schedule")).toBeDefined();
    expect(screen.getByText("매일 오전 9시 보고서")).toBeDefined();
  });
});
