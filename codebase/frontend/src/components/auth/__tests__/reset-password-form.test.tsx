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
 * 클라이언트는 `details` 유무로 원인을 가르지 않는다(CLE-ACCT-SIGNIN 「API」). 서버 문구는 영문이라 화면은
 * 링크 만료와 비밀번호 규칙을 함께 안내하는 사전 문구를 고른다(CLE-T-7QQPK7).
 */
describe("ResetPasswordForm — 재설정 실패 안내", () => {
  beforeEach(() => {
    useLocaleStore.setState({ locale: "ko" });
    mockResetPassword.mockReset();
    vi.mocked(toast.error).mockReset();
  });

  // CLE-T-7QQPK7 — 서버 `message` 는 영문이라 보이지 않고 링크 만료와 비밀번호 규칙을 함께 안내하는 화면 문구를 고른다.
  it.each([
    "Invalid or expired reset token",
    "Reset token has expired",
    "Password must contain at least one special character",
  ])(
    "VALIDATION_ERROR(%s)는 링크 만료와 비밀번호 규칙을 함께 안내한다",
    async (serverMessage) => {
      mockResetPassword.mockRejectedValue(
        apiError(400, "VALIDATION_ERROR", serverMessage),
      );
      render(<ResetPasswordForm token="reset-token" />);

      await submitNewPassword();

      await waitFor(() =>
        expect(toast.error).toHaveBeenCalledWith(
          "재설정 링크가 만료됐거나 새 비밀번호가 규칙에 맞지 않아요. 비밀번호 규칙을 확인하고, 그래도 안 되면 새 링크를 요청해 주세요.",
        ),
      );
      expect(toast.error).not.toHaveBeenCalledWith(serverMessage);
      expect(mockResetPassword).toHaveBeenCalledWith(
        "reset-token",
        "NewPass123!@#",
      );
    },
  );

  it("공용 표에 있는 코드는 공용 문구를 고른다", async () => {
    mockResetPassword.mockRejectedValue(
      apiError(429, "RATE_LIMITED", "Too many requests"),
    );
    render(<ResetPasswordForm token="reset-token" />);

    await submitNewPassword();

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith(
        "요청이 너무 많아요. 잠시 뒤 다시 시도해 주세요.",
      ),
    );
  });

  it("제출 전에는 재요청 링크를 보여 주지 않는다", () => {
    render(<ResetPasswordForm token="reset-token" />);

    expect(
      screen.queryByRole("link", { name: "새 링크 요청하기" }),
    ).not.toBeInTheDocument();
  });

  // REQ-SIGNIN-035 — 만료 · 무효 토큰을 서버가 거부하면 화면에 재요청 링크를 보인다.
  // 거부 사유는 모두 400 VALIDATION_ERROR 라 화면은 서버가 거부한 모든 경우에 링크를 보인다.
  it("서버가 거부하면 /forgot-password 재요청 링크를 보여 준다", async () => {
    mockResetPassword.mockRejectedValue(
      apiError(400, "VALIDATION_ERROR", "Reset token has expired"),
    );
    render(<ResetPasswordForm token="reset-token" />);

    await submitNewPassword();

    const link = await screen.findByRole("link", { name: "새 링크 요청하기" });
    expect(link).toHaveAttribute("href", "/forgot-password");
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
    // 응답을 받지 못했으면 토큰 문제인지 알 수 없으므로 재요청 링크를 보이지 않는다.
    expect(
      screen.queryByRole("link", { name: "새 링크 요청하기" }),
    ).not.toBeInTheDocument();
  });
});
