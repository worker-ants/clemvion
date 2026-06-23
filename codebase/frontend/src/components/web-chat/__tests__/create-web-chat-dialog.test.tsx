import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, act, cleanup, fireEvent } from "@testing-library/react";
import { useLocaleStore } from "@/lib/stores/locale-store";

// 권한 게이트는 항상 통과시킨다(생성 다이얼로그 자체는 RoleGate 밖에서 제어).
vi.mock("@/components/auth/role-gate", () => ({
  RoleGate: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useHasRole: () => true,
}));

const h = vi.hoisted(() => ({
  workflowsData: undefined as Array<{ id: string; name: string }> | undefined,
  mutateAsync: vi.fn(),
  isPending: false,
}));

vi.mock("../use-web-chat", () => ({
  useWorkflowOptions: () => ({ data: h.workflowsData }),
  useCreateWebChat: () => ({ mutateAsync: h.mutateAsync, isPending: h.isPending }),
  extractCreatedId: (c: { id?: string; data?: { id?: string } } | undefined) =>
    c?.data?.id ?? c?.id,
}));

const toastSuccess = vi.fn();
const toastError = vi.fn();
vi.mock("sonner", () => ({ toast: { success: (...a: unknown[]) => toastSuccess(...a), error: (...a: unknown[]) => toastError(...a) } }));

import { CreateWebChatDialog } from "../create-web-chat-dialog";

beforeEach(() => {
  useLocaleStore.setState({ locale: "en" });
  h.workflowsData = [{ id: "wf-1", name: "FAQ Bot" }];
  h.isPending = false;
  h.mutateAsync.mockReset();
  toastSuccess.mockReset();
  toastError.mockReset();
});
afterEach(() => cleanup());

describe("CreateWebChatDialog", () => {
  it("워크플로우가 없으면 안내를 노출하고 제출을 막는다", () => {
    h.workflowsData = [];
    render(<CreateWebChatDialog open onOpenChange={vi.fn()} />);
    expect(screen.getByText(/create a workflow first/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^create$/i })).toBeDisabled();
  });

  it("워크플로우 선택 + 이름 입력 전에는 제출 비활성, 둘 다 채우면 활성", () => {
    render(<CreateWebChatDialog open onOpenChange={vi.fn()} />);
    const submit = screen.getByRole("button", { name: /^create$/i });
    expect(submit).toBeDisabled();

    fireEvent.change(screen.getByLabelText(/workflow/i), { target: { value: "wf-1" } });
    fireEvent.change(screen.getByLabelText(/name/i), { target: { value: "Support bot" } });
    expect(submit).toBeEnabled();
  });

  it("제출 시 생성 후 onCreated(id) 호출 + 다이얼로그 닫기", async () => {
    h.mutateAsync.mockResolvedValue({ data: { id: "t-new" } });
    const onOpenChange = vi.fn();
    const onCreated = vi.fn();
    render(<CreateWebChatDialog open onOpenChange={onOpenChange} onCreated={onCreated} />);

    fireEvent.change(screen.getByLabelText(/workflow/i), { target: { value: "wf-1" } });
    fireEvent.change(screen.getByLabelText(/name/i), { target: { value: "  Support bot  " } });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /^create$/i }));
    });

    // 이름은 trim 되어 전달
    expect(h.mutateAsync).toHaveBeenCalledWith({ workflowId: "wf-1", name: "Support bot" });
    expect(onCreated).toHaveBeenCalledWith("t-new");
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(toastSuccess).toHaveBeenCalled();
  });

  it("생성 실패 시 에러 토스트 + 다이얼로그 유지", async () => {
    h.mutateAsync.mockRejectedValue(new Error("boom"));
    const onOpenChange = vi.fn();
    render(<CreateWebChatDialog open onOpenChange={onOpenChange} onCreated={vi.fn()} />);

    fireEvent.change(screen.getByLabelText(/workflow/i), { target: { value: "wf-1" } });
    fireEvent.change(screen.getByLabelText(/name/i), { target: { value: "Bot" } });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /^create$/i }));
    });

    expect(toastError).toHaveBeenCalled();
    // 실패 경로에서는 onOpenChange(false) 호출 안 함(다이얼로그 유지).
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
  });
});
