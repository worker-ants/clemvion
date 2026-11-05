import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("next/navigation", () => ({
  useParams: () => ({}),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

const mockResetPassword = vi.fn();
vi.mock("@/lib/api/auth", () => ({
  authApi: {
    resetPassword: (...args: unknown[]) => mockResetPassword(...args),
  },
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

import { toast } from "sonner";
import { ResetPasswordForm } from "../reset-password-form";
import { useLocaleStore } from "@/lib/stores/locale-store";

function apiError(status: number, code: string, message: string) {
  return Object.assign(new Error(message), {
    isAxiosError: true,
    response: { status, data: { error: { code, message } } },
  });
}

async function submitNewPassword() {
  const user = userEvent.setup();
  await user.type(screen.getByLabelText("새 비밀번호"), "NewPass123!@#");
  await user.type(screen.getByLabelText("비밀번호 확인"), "NewPass123!@#");
  await user.click(screen.getByRole("button", { name: "비밀번호 재설정" }));
}

/**
 * NERV Task `CLE-T-MFWBE1` 항목 2 — 에러 봉투는 `{ error: { code, message } }` 다. 예전 화면은
 * `data.message` 를 읽어 늘 기본 문구만 보였다. 재설정 실패는 모두 400 `VALIDATION_ERROR` 이고
 * 클라이언트는 `details` 유무로 원인을 가르지 않으므로(CLE-ACCT-SIGNIN 「API」) 봉투의
 * `error.message` 를 그대로 보인다.
 */
describe("ResetPasswordForm — 재설정 실패 안내", () => {
  beforeEach(() => {
    useLocaleStore.setState({ locale: "ko" });
    mockResetPassword.mockReset();
    vi.mocked(toast.error).mockReset();
  });

  it("에러 봉투의 error.message 를 보여 준다", async () => {
    mockResetPassword.mockRejectedValue(
      apiError(400, "VALIDATION_ERROR", "Invalid or expired reset token"),
    );
    render(<ResetPasswordForm token="reset-token" />);

    await submitNewPassword();

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith("Invalid or expired reset token"),
    );
    expect(mockResetPassword).toHaveBeenCalledWith("reset-token", "NewPass123!@#");
  });

  it("응답 본문이 없으면(네트워크 오류) 기본 문구를 보여 준다", async () => {
    mockResetPassword.mockRejectedValue(
      Object.assign(new Error("Network Error"), { isAxiosError: true }),
    );
    render(<ResetPasswordForm token="reset-token" />);

    await submitNewPassword();

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith(
        "비밀번호 재설정에 실패했어요. 다시 시도해 주세요.",
      ),
    );
  });
});
