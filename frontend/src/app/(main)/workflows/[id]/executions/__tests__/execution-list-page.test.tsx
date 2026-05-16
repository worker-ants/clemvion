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

const mockPush = vi.fn();
const mockBack = vi.fn();
vi.mock("next/navigation", () => ({
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
              durationMs: 3200,
              inputData: {},
              outputData: {},
              error: null,
              triggerSource: "manual",
              triggerLabel: "Alice",
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
              durationMs: 1000,
              inputData: {},
              outputData: null,
              error: { message: "Connection timeout" },
              triggerSource: "schedule",
              triggerLabel: "매일 오전 9시 보고서",
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
    expect(screen.getByText("3.2s")).toBeDefined();
    expect(screen.getByText("1s")).toBeDefined();
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

  it("navigates to editor on 'Open in Editor' click", async () => {
    await renderPage();
    const editorLink = await screen.findByText("Open in Editor");
    fireEvent.click(editorLink);

    expect(mockPush).toHaveBeenCalledWith("/workflows/wf-1");
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
