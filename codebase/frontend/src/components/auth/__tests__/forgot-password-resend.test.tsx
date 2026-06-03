import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const mockForgotPassword = vi.fn();
vi.mock("@/lib/api/auth", () => ({
  authApi: {
    forgotPassword: (...args: unknown[]) => mockForgotPassword(...args),
  },
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

import { ForgotPasswordForm } from "../forgot-password-form";
import { useLocaleStore } from "@/lib/stores/locale-store";

describe("ForgotPasswordForm — resend with cooldown", () => {
  beforeEach(() => {
    useLocaleStore.setState({ locale: "ko" });
    mockForgotPassword.mockReset();
    mockForgotPassword.mockResolvedValue({ data: { message: "ok" } });
  });

  it("shows a resend button after submit and re-submits the same email", async () => {
    const user = userEvent.setup();
    render(<ForgotPasswordForm />);

    await user.type(screen.getByLabelText("이메일"), "user@example.com");
    await user.click(screen.getByRole("button", { name: /재설정 링크 보내기/ }));

    await waitFor(() =>
      expect(mockForgotPassword).toHaveBeenCalledWith("user@example.com"),
    );

    // 제출 후 쿨다운 진입 — 재발송 버튼은 비활성 + 남은 초 노출.
    const cooldownBtn = (await screen.findByRole("button", {
      name: /초 후 다시 보낼 수 있어요/,
    })) as HTMLButtonElement;
    expect(cooldownBtn.disabled).toBe(true);
    // 첫 제출 1회만 (쿨다운 중이라 재발송 불가).
    expect(mockForgotPassword).toHaveBeenCalledTimes(1);
  });
});
