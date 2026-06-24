// 웹채팅 이름 변경 다이얼로그 — PATCH name 호출·no-op 가드·성공 시 닫힘 검증
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, act, cleanup, fireEvent } from "@testing-library/react";
import { useLocaleStore } from "@/lib/stores/locale-store";

const h = vi.hoisted(() => ({
  mutateAsync: vi.fn(),
  isPending: false,
}));

vi.mock("../use-web-chat", () => ({
  useUpdateWebChatMeta: () => ({
    mutateAsync: h.mutateAsync,
    isPending: h.isPending,
  }),
}));

const toastSuccess = vi.fn();
const toastError = vi.fn();
vi.mock("sonner", () => ({
  toast: {
    success: (...a: unknown[]) => toastSuccess(...a),
    error: (...a: unknown[]) => toastError(...a),
  },
}));

import { WebChatRenameDialog } from "../web-chat-rename-dialog";

beforeEach(() => {
  useLocaleStore.setState({ locale: "en" });
  h.isPending = false;
  h.mutateAsync.mockReset();
  toastSuccess.mockReset();
  toastError.mockReset();
});
afterEach(() => cleanup());

const saveBtn = () => screen.getByRole("button", { name: /^save$/i });
const nameInput = () => screen.getByLabelText(/^name$/i);

describe("WebChatRenameDialog", () => {
  it("초기엔 현재 이름이 채워지고 변경 전 저장 버튼이 비활성이다", () => {
    render(
      <WebChatRenameDialog
        instanceId="t-1"
        currentName="Old"
        open
        onOpenChange={() => {}}
      />,
    );
    expect((nameInput() as HTMLInputElement).value).toBe("Old");
    expect(saveBtn()).toBeDisabled();
  });

  it("이름을 바꾸면 PATCH name 으로 mutate 하고 닫는다", async () => {
    h.mutateAsync.mockResolvedValue(undefined);
    const onOpenChange = vi.fn();
    render(
      <WebChatRenameDialog
        instanceId="t-1"
        currentName="Old"
        open
        onOpenChange={onOpenChange}
      />,
    );
    fireEvent.change(nameInput(), { target: { value: "New" } });
    await act(async () => {
      fireEvent.click(saveBtn());
    });
    expect(h.mutateAsync).toHaveBeenCalledWith({
      instanceId: "t-1",
      name: "New",
    });
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(toastSuccess).toHaveBeenCalled();
  });

  it("앞뒤 공백을 트림해 전송한다", async () => {
    h.mutateAsync.mockResolvedValue(undefined);
    render(
      <WebChatRenameDialog
        instanceId="t-1"
        currentName="Old"
        open
        onOpenChange={() => {}}
      />,
    );
    fireEvent.change(nameInput(), { target: { value: "  New  " } });
    await act(async () => {
      fireEvent.click(saveBtn());
    });
    expect(h.mutateAsync).toHaveBeenCalledWith({
      instanceId: "t-1",
      name: "New",
    });
  });

  it("트림 후 현재 이름과 같으면 저장 비활성 (no-op PATCH 방지)", () => {
    render(
      <WebChatRenameDialog
        instanceId="t-1"
        currentName="Old"
        open
        onOpenChange={() => {}}
      />,
    );
    fireEvent.change(nameInput(), { target: { value: "  Old  " } });
    expect(saveBtn()).toBeDisabled();
  });

  it("빈 이름은 저장 비활성이다", () => {
    render(
      <WebChatRenameDialog
        instanceId="t-1"
        currentName="Old"
        open
        onOpenChange={() => {}}
      />,
    );
    fireEvent.change(nameInput(), { target: { value: "   " } });
    expect(saveBtn()).toBeDisabled();
  });

  it("실패 시 에러 토스트를 띄우고 다이얼로그를 닫지 않는다", async () => {
    h.mutateAsync.mockRejectedValue(new Error("boom"));
    const onOpenChange = vi.fn();
    render(
      <WebChatRenameDialog
        instanceId="t-1"
        currentName="Old"
        open
        onOpenChange={onOpenChange}
      />,
    );
    fireEvent.change(nameInput(), { target: { value: "New" } });
    await act(async () => {
      fireEvent.click(saveBtn());
    });
    expect(toastError).toHaveBeenCalled();
    expect(onOpenChange).not.toHaveBeenCalled();
  });
});
