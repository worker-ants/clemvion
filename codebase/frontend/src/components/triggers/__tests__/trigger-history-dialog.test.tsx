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
});
