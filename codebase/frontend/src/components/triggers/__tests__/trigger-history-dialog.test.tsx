import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  render,
  screen,
  cleanup,
  fireEvent,
  waitFor,
} from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useLocaleStore } from "@/lib/stores/locale-store";

const apiGetMock = vi.fn();
vi.mock("@/lib/api/client", () => ({
  apiClient: {
    get: (...args: unknown[]) => apiGetMock(...args),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}));

import { TriggerHistoryDialog } from "../trigger-history-dialog";

function renderDialog(
  override?: Partial<Parameters<typeof TriggerHistoryDialog>[0]>,
) {
  const props = {
    triggerId: "t-1",
    triggerName: "order-hook",
    workflowId: "wf-1" as string | null,
    open: true,
    onClose: vi.fn(),
    onOpenFullDetail: undefined as undefined | (() => void),
    ...override,
  } as const;
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  render(
    <QueryClientProvider client={client}>
      <TriggerHistoryDialog {...props} />
    </QueryClientProvider>,
  );
  return props;
}

describe("TriggerHistoryDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    cleanup();
    useLocaleStore.setState({ locale: "en" });
  });

  it("trigger 이름이 다이얼로그 타이틀에 보간된다", async () => {
    apiGetMock.mockResolvedValueOnce({ data: { data: [] } });
    renderDialog();
    expect(
      await screen.findByText(/Recent calls — order-hook/),
    ).toBeInTheDocument();
  });

  it("히스토리가 비어있으면 empty 메시지를 노출한다", async () => {
    apiGetMock.mockResolvedValueOnce({ data: { data: [] } });
    renderDialog();
    await waitFor(() => {
      expect(screen.getByText(/no recent calls/i)).toBeInTheDocument();
    });
  });

  it("히스토리 정상 응답 시 시각과 상태 Badge 를 노출한다", async () => {
    apiGetMock.mockResolvedValueOnce({
      data: {
        data: [
          {
            id: "e-1",
            startedAt: "2026-05-22T14:32:00.000Z",
            status: "success",
          },
          {
            id: "e-2",
            startedAt: "2026-05-22T14:21:00.000Z",
            status: "failed",
          },
        ],
      },
    });
    renderDialog();
    expect(await screen.findByText(/success/i)).toBeInTheDocument();
    expect(screen.getByText(/failed/i)).toBeInTheDocument();
  });

  it("workflowId 가 있으면 각 항목이 실행 상세 페이지로 링크된다", async () => {
    apiGetMock.mockResolvedValueOnce({
      data: {
        data: [
          {
            id: "exec-1",
            startedAt: "2026-05-22T14:32:00.000Z",
            status: "success",
          },
          {
            id: "exec-2",
            startedAt: "2026-05-22T14:21:00.000Z",
            status: "failed",
          },
        ],
      },
    });
    renderDialog({ workflowId: "wf-99" });
    const links = await screen.findAllByRole("link");
    const hrefs = links.map((a) => a.getAttribute("href"));
    expect(hrefs).toEqual(
      expect.arrayContaining([
        "/workflows/wf-99/executions/exec-1",
        "/workflows/wf-99/executions/exec-2",
      ]),
    );
  });

  it("workflowId 가 없으면 항목은 링크 없이 read-only 로 표시된다", async () => {
    apiGetMock.mockResolvedValueOnce({
      data: {
        data: [
          {
            id: "exec-1",
            startedAt: "2026-05-22T14:32:00.000Z",
            status: "success",
          },
        ],
      },
    });
    renderDialog({ workflowId: null });
    await screen.findByText(/success/i);
    // 푸터의 onOpenFullDetail Button 만이 link 역할일 수 있으므로 href 패턴으로 단정.
    const links = screen
      .queryAllByRole("link")
      .filter((a) => a.getAttribute("href")?.includes("/executions/"));
    expect(links).toHaveLength(0);
  });

  it("실행 상세 링크 클릭 시 onClose 가 호출되어 dialog 가 닫힌다", async () => {
    apiGetMock.mockResolvedValueOnce({
      data: {
        data: [
          {
            id: "exec-1",
            startedAt: "2026-05-22T14:32:00.000Z",
            status: "success",
          },
        ],
      },
    });
    const onClose = vi.fn();
    renderDialog({ workflowId: "wf-99", onClose });
    const link = (await screen.findAllByRole("link")).find((a) =>
      a.getAttribute("href")?.includes("/executions/exec-1"),
    )!;
    fireEvent.click(link);
    expect(onClose).toHaveBeenCalled();
  });

  it("올바른 endpoint 와 limit=10 으로 호출한다", async () => {
    apiGetMock.mockResolvedValueOnce({ data: { data: [] } });
    renderDialog({ triggerId: "abc-123" });
    await waitFor(() => {
      expect(apiGetMock).toHaveBeenCalledWith(
        "/triggers/abc-123/history",
        expect.objectContaining({ params: { limit: 10 } }),
      );
    });
  });

  it("`onOpenFullDetail` prop 이 있을 때만 'View full detail' 버튼이 노출된다", async () => {
    apiGetMock.mockResolvedValue({ data: { data: [] } });
    const onOpenFullDetail = vi.fn();

    const { rerender } = render(
      <QueryClientProvider
        client={
          new QueryClient({
            defaultOptions: { queries: { retry: false } },
          })
        }
      >
        <TriggerHistoryDialog
          triggerId="t-1"
          triggerName="hook"
          open={true}
          onClose={vi.fn()}
        />
      </QueryClientProvider>,
    );
    expect(
      screen.queryByRole("button", { name: /view full detail/i }),
    ).toBeNull();

    rerender(
      <QueryClientProvider
        client={
          new QueryClient({
            defaultOptions: { queries: { retry: false } },
          })
        }
      >
        <TriggerHistoryDialog
          triggerId="t-1"
          triggerName="hook"
          open={true}
          onClose={vi.fn()}
          onOpenFullDetail={onOpenFullDetail}
        />
      </QueryClientProvider>,
    );
    const btn = screen.getByRole("button", { name: /view full detail/i });
    fireEvent.click(btn);
    expect(onOpenFullDetail).toHaveBeenCalled();
  });

  it("로딩 중에는 Loader2 가 표시된다", () => {
    apiGetMock.mockReturnValue(new Promise(() => {}));
    renderDialog();
    expect(document.querySelector(".animate-spin")).toBeInTheDocument();
  });

  // W-1: isError 분기 검증
  it("API 오류 시 loadFailed 메시지를 노출한다", async () => {
    apiGetMock.mockRejectedValueOnce(new Error("network error"));
    renderDialog();
    await waitFor(() => {
      expect(screen.getByText(/failed to load history/i)).toBeInTheDocument();
    });
  });

  // W-2: onClose 콜백 호출 검증
  // Dialog 내부에 X 아이콘 버튼의 sr-only "Close" span 과 푸터 Close 버튼이 공존한다.
  // getAllByRole("button") 중 텍스트 콘텐츠가 정확히 "Close" 인 버튼을 필터링한다.
  it("'Close' 버튼 클릭 시 onClose 가 호출된다", async () => {
    apiGetMock.mockResolvedValueOnce({ data: { data: [] } });
    const onClose = vi.fn();
    renderDialog({ onClose });
    // 푸터 Close 버튼: textContent 가 "Close" 이고 sr-only span 이 없는 버튼
    await waitFor(() => {
      const buttons = screen.getAllByRole("button");
      const footerClose = buttons.find(
        (btn) => btn.textContent?.trim() === "Close",
      );
      expect(footerClose).toBeDefined();
    });
    const buttons = screen.getAllByRole("button");
    const footerClose = buttons.find(
      (btn) => btn.textContent?.trim() === "Close",
    )!;
    fireEvent.click(footerClose);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  // W-3: open=false 시 쿼리 비활성화 검증
  it("open=false 이면 API 를 호출하지 않는다", () => {
    renderDialog({ open: false });
    expect(apiGetMock).not.toHaveBeenCalled();
  });
});
