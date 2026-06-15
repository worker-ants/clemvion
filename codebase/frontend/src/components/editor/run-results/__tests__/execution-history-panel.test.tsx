/**
 * §7 인-에디터 실행 히스토리 패널 (spec/3-workflow-editor/3-execution.md §7).
 * 커버리지: 목록 렌더(§7.2), 항목 클릭 → 상세 조회 후 loadHistoricalExecution
 * 적재 + 패널 닫기(§7.3 / §10.10), 빈 목록, 상세 조회 실패 토스트.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  render,
  screen,
  cleanup,
  fireEvent,
  waitFor,
} from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useLocaleStore } from "@/lib/stores/locale-store";

const getByWorkflowMock = vi.fn();
const getByIdMock = vi.fn();
vi.mock("@/lib/api/executions", () => ({
  executionsApi: {
    getByWorkflow: (...a: unknown[]) => getByWorkflowMock(...a),
    getById: (...a: unknown[]) => getByIdMock(...a),
  },
}));

const loadHistoricalExecutionMock = vi.fn();
vi.mock("@/lib/websocket/apply-execution-snapshot", () => ({
  loadHistoricalExecution: (...a: unknown[]) =>
    loadHistoricalExecutionMock(...a),
}));

const toastError = vi.fn();
vi.mock("sonner", () => ({
  toast: { error: (m: string) => toastError(m), success: vi.fn() },
}));

import { ExecutionHistoryPanel } from "../execution-history-panel";

function renderPanel(props?: Partial<React.ComponentProps<typeof ExecutionHistoryPanel>>) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const onClose = props?.onClose ?? vi.fn();
  render(
    <QueryClientProvider client={qc}>
      <ExecutionHistoryPanel
        workflowId="wf-1"
        open
        onClose={onClose}
        {...props}
      />
    </QueryClientProvider>,
  );
  return { onClose };
}

const SAMPLE = {
  id: "ex-1",
  workflowId: "wf-1",
  status: "completed",
  startedAt: "2026-06-15T10:00:00.000Z",
  finishedAt: "2026-06-15T10:00:03.000Z",
  durationMs: 3200,
  triggerSource: "manual",
  triggerLabel: "Gehrig",
  totalNodeCount: 5,
  completedNodeCount: 5,
  failedNodeCount: 0,
};

describe("ExecutionHistoryPanel (§7)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    cleanup();
    useLocaleStore.setState({ locale: "en" });
  });

  it("open=false 면 아무것도 렌더하지 않는다", () => {
    renderPanel({ open: false });
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(getByWorkflowMock).not.toHaveBeenCalled();
  });

  it("조회 중에는 로딩 UI 를 렌더한다", async () => {
    getByWorkflowMock.mockReturnValue(new Promise(() => {})); // 미해소 → 로딩 유지
    renderPanel();
    expect(await screen.findByText(/Loading/i)).toBeInTheDocument();
  });

  it("\"전체 실행\" 링크가 전용 페이지 href 를 가진다", async () => {
    getByWorkflowMock.mockResolvedValue({
      data: [],
      pagination: { page: 1, limit: 20, totalItems: 0, totalPages: 0 },
    });
    renderPanel();
    const link = await screen.findByRole("link", { name: /all executions/i });
    expect(link).toHaveAttribute("href", "/workflows/wf-1/executions");
  });

  it("failedNodeCount > 0 이면 (N failed) 보조 표기를 렌더한다", async () => {
    getByWorkflowMock.mockResolvedValue({
      data: [
        {
          ...SAMPLE,
          status: "failed",
          completedNodeCount: 2,
          totalNodeCount: 5,
          failedNodeCount: 1,
        },
      ],
      pagination: { page: 1, limit: 20, totalItems: 1, totalPages: 1 },
    });
    renderPanel();
    expect(await screen.findByText(/2\/5/)).toBeInTheDocument();
    expect(screen.getByText(/1 failed/)).toBeInTheDocument();
  });

  it("목록(§7.2)을 조회해 트리거·소요시간·노드수와 함께 렌더한다", async () => {
    getByWorkflowMock.mockResolvedValue({
      data: [SAMPLE],
      pagination: { page: 1, limit: 20, totalItems: 1, totalPages: 1 },
    });
    renderPanel();

    await waitFor(() =>
      expect(getByWorkflowMock).toHaveBeenCalledWith("wf-1", {
        limit: 20,
        sort: "started_at",
        order: "desc",
      }),
    );
    // 트리거 출처 라벨 + 소요시간 + 노드 카운트
    expect(await screen.findByText(/Manual/)).toBeInTheDocument();
    expect(screen.getByText("3.2s")).toBeInTheDocument();
    expect(screen.getByText(/5\/5/)).toBeInTheDocument();
  });

  it("항목 클릭(§7.3) → 상세 조회 후 loadHistoricalExecution 적재 + 패널 닫기", async () => {
    getByWorkflowMock.mockResolvedValue({
      data: [SAMPLE],
      pagination: { page: 1, limit: 20, totalItems: 1, totalPages: 1 },
    });
    const detail = { ...SAMPLE, nodeExecutions: [] };
    getByIdMock.mockResolvedValue(detail);
    const { onClose } = renderPanel();

    const row = await screen.findByText(/Manual/);
    fireEvent.click(row);

    await waitFor(() => expect(getByIdMock).toHaveBeenCalledWith("ex-1"));
    await waitFor(() =>
      expect(loadHistoricalExecutionMock).toHaveBeenCalledWith(detail),
    );
    expect(onClose).toHaveBeenCalled();
  });

  it("목록 조회 실패(isError) → 에러 메시지 렌더", async () => {
    getByWorkflowMock.mockRejectedValue(new Error("network"));
    renderPanel();
    expect(
      await screen.findByText(/Failed to load execution history/i),
    ).toBeInTheDocument();
  });

  it("적재 진행 중(loadingId)에는 항목 버튼이 disabled 된다", async () => {
    getByWorkflowMock.mockResolvedValue({
      data: [
        SAMPLE,
        { ...SAMPLE, id: "ex-2", triggerSource: "schedule", triggerLabel: null },
      ],
      pagination: { page: 1, limit: 20, totalItems: 2, totalPages: 1 },
    });
    // getById 를 미해소 Promise 로 두어 클릭 후 loadingId 가 유지되게 한다.
    let resolveDetail: ((v: unknown) => void) | undefined;
    getByIdMock.mockReturnValue(
      new Promise((res) => {
        resolveDetail = res;
      }),
    );
    renderPanel();

    // 목록이 렌더된 뒤 항목 버튼만 추린다(닫기 버튼 제외 — 트리거 라벨 포함 행).
    await screen.findByText(/Manual/);
    const itemButtons = screen
      .getAllByRole("button")
      .filter((b) => /Manual|Schedule/.test(b.textContent ?? ""));
    expect(itemButtons.length).toBe(2);
    fireEvent.click(itemButtons[0]);

    await waitFor(() =>
      itemButtons.forEach((b) => expect(b).toBeDisabled()),
    );
    resolveDetail?.({ ...SAMPLE, nodeExecutions: [] });
  });

  it("빈 목록 → empty state 렌더", async () => {
    getByWorkflowMock.mockResolvedValue({
      data: [],
      pagination: { page: 1, limit: 20, totalItems: 0, totalPages: 0 },
    });
    renderPanel();
    expect(await screen.findByText(/No executions yet/i)).toBeInTheDocument();
  });

  it("상세 조회 실패 → 에러 토스트, 패널 유지", async () => {
    getByWorkflowMock.mockResolvedValue({
      data: [SAMPLE],
      pagination: { page: 1, limit: 20, totalItems: 1, totalPages: 1 },
    });
    getByIdMock.mockRejectedValue(new Error("boom"));
    const { onClose } = renderPanel();

    fireEvent.click(await screen.findByText(/Manual/));
    await waitFor(() => expect(toastError).toHaveBeenCalled());
    expect(loadHistoricalExecutionMock).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });
});
