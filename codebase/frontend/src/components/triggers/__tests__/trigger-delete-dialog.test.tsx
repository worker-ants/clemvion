import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  render,
  screen,
  fireEvent,
  cleanup,
  waitFor,
} from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useLocaleStore } from "@/lib/stores/locale-store";

const apiDeleteMock = vi.fn();
vi.mock("@/lib/api/client", () => ({
  apiClient: {
    delete: (...args: unknown[]) => apiDeleteMock(...args),
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
  },
}));

const toastSuccess = vi.fn();
const toastError = vi.fn();
const toastMessage = vi.fn();
vi.mock("sonner", () => ({
  toast: {
    success: (msg: string) => toastSuccess(msg),
    error: (msg: string) => toastError(msg),
    message: (msg: string) => toastMessage(msg),
  },
}));

import {
  TriggerDeleteDialog,
  type TriggerDeleteTarget,
} from "../trigger-delete-dialog";

function renderDialog(
  trigger: TriggerDeleteTarget,
  onClose: () => void = vi.fn(),
) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  render(
    <QueryClientProvider client={client}>
      <TriggerDeleteDialog trigger={trigger} open={true} onClose={onClose} />
    </QueryClientProvider>,
  );
}

describe("TriggerDeleteDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    cleanup();
    useLocaleStore.setState({ locale: "en" });
  });

  const webhook: TriggerDeleteTarget = {
    id: "tr-1",
    name: "order-webhook",
    type: "webhook",
    workflowName: "Order WF",
    webhookUrl: "https://example.test/api/hooks/abc",
  };

  // ── 본문 분기 ───────────────────────────────────────────────────

  it("webhook 타입 본문 텍스트가 URL 을 포함한다", () => {
    renderDialog(webhook);
    expect(
      screen.getByText(/https:\/\/example\.test\/api\/hooks\/abc/),
    ).toBeInTheDocument();
  });

  it("schedule 타입은 cascade 경고와 cron 표현식을 함께 노출한다", () => {
    renderDialog({
      id: "tr-2",
      name: "daily-report",
      type: "schedule",
      workflowName: "Daily WF",
      cronExpression: "0 9 * * *",
      nextRunAt: "2026-05-23T09:00:00.000Z",
    });
    // cascade 경고 (alert role)
    expect(screen.getByRole("alert")).toHaveTextContent(/schedule/i);
    expect(screen.getByText(/0 9 \* \* \*/)).toBeInTheDocument();
  });

  // W5: manual 타입 본문 분기
  it("manual 타입 본문 텍스트가 workflowName 을 포함한다", () => {
    renderDialog({
      id: "tr-3",
      name: "manual-entry",
      type: "manual",
      workflowName: "Approval WF",
    });
    expect(screen.getByText(/Approval WF/)).toBeInTheDocument();
  });

  // ── confirm gate ─────────────────────────────────────────────────

  it("trigger 이름을 정확히 타이핑하기 전까지 삭제 버튼은 disabled", () => {
    renderDialog(webhook);
    const deleteBtn = screen.getByRole("button", { name: /^delete$/i });
    expect(deleteBtn).toBeDisabled();

    const input = screen.getByLabelText(/type the trigger name/i);
    fireEvent.change(input, { target: { value: "wrong-name" } });
    expect(deleteBtn).toBeDisabled();

    fireEvent.change(input, { target: { value: "order-webhook" } });
    expect(deleteBtn).not.toBeDisabled();
  });

  // ── 삭제 성공 경로 (W2: toastSuccess + onClose 검증 추가) ─────────

  it("삭제 성공 시 DELETE api 가 호출되고 success toast 와 onClose 가 실행된다", async () => {
    // W3: Promise.resolve() drain 대신 waitFor 패턴 사용
    apiDeleteMock.mockResolvedValueOnce({});
    const onClose = vi.fn();
    renderDialog(webhook, onClose);

    const input = screen.getByLabelText(/type the trigger name/i);
    fireEvent.change(input, { target: { value: "order-webhook" } });
    fireEvent.click(screen.getByRole("button", { name: /^delete$/i }));

    await waitFor(() => {
      expect(apiDeleteMock).toHaveBeenCalledWith("/triggers/tr-1");
    });
    expect(toastSuccess).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  // ── 에러 경로 (W1: 404 + 5xx 경로 추가) ────────────────────────────

  it("404 응답 시 silent invalidate + notFoundOnDelete toast (toastError 는 호출되지 않음)", async () => {
    apiDeleteMock.mockRejectedValueOnce({ response: { status: 404 } });
    const onClose = vi.fn();
    renderDialog(webhook, onClose);

    const input = screen.getByLabelText(/type the trigger name/i);
    fireEvent.change(input, { target: { value: "order-webhook" } });
    fireEvent.click(screen.getByRole("button", { name: /^delete$/i }));

    await waitFor(() => {
      expect(toastMessage).toHaveBeenCalled();
    });
    expect(toastError).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  it("서버 오류(5xx) 시 deleteFailed toast 가 호출된다", async () => {
    apiDeleteMock.mockRejectedValueOnce({ response: { status: 500 } });
    renderDialog(webhook);

    const input = screen.getByLabelText(/type the trigger name/i);
    fireEvent.change(input, { target: { value: "order-webhook" } });
    fireEvent.click(screen.getByRole("button", { name: /^delete$/i }));

    await waitFor(() => {
      expect(toastError).toHaveBeenCalled();
    });
    expect(toastMessage).not.toHaveBeenCalled();
  });
});
