import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
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

function renderDialog(trigger: TriggerDeleteTarget) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  render(
    <QueryClientProvider client={client}>
      <TriggerDeleteDialog trigger={trigger} open={true} onClose={() => {}} />
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

  it("삭제 성공 시 DELETE api 가 호출되고 success toast", async () => {
    apiDeleteMock.mockResolvedValueOnce({});
    renderDialog(webhook);
    const input = screen.getByLabelText(/type the trigger name/i);
    fireEvent.change(input, { target: { value: "order-webhook" } });
    fireEvent.click(screen.getByRole("button", { name: /^delete$/i }));

    // microtask drain
    await Promise.resolve();
    await Promise.resolve();

    expect(apiDeleteMock).toHaveBeenCalledWith("/triggers/tr-1");
  });
});
