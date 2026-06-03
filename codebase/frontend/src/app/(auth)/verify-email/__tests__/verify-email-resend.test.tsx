import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

let searchParams = new URLSearchParams();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  useSearchParams: () => searchParams,
}));

const mockVerifyEmail = vi.fn();
const mockResendVerification = vi.fn();
vi.mock("@/lib/api/auth", () => ({
  authApi: {
    verifyEmail: (...args: unknown[]) => mockVerifyEmail(...args),
    resendVerification: (...args: unknown[]) => mockResendVerification(...args),
  },
}));

vi.mock("@/lib/api/client", () => ({
  setAccessToken: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

import { VerifyEmailContent } from "../verify-email-content";
import { useLocaleStore } from "@/lib/stores/locale-store";

describe("VerifyEmailContent — resend with cooldown", () => {
  beforeEach(() => {
    useLocaleStore.setState({ locale: "ko" });
    searchParams = new URLSearchParams();
    mockVerifyEmail.mockReset();
    mockResendVerification.mockReset();
  });

  it("shows a resend button in check-email state and resends + starts a 60s cooldown", async () => {
    const user = userEvent.setup();
    searchParams = new URLSearchParams({ email: "user@example.com" });
    mockResendVerification.mockResolvedValue({ data: { message: "ok" } });

    render(<VerifyEmailContent />);

    const resendBtn = screen.getByRole("button", {
      name: /인증 메일 재전송/,
    });
    await user.click(resendBtn);

    await waitFor(() =>
      expect(mockResendVerification).toHaveBeenCalledWith("user@example.com"),
    );

    // 쿨다운 진입 — 버튼은 비활성 + 남은 초 노출.
    const cooldownBtn = (await screen.findByRole("button", {
      name: /초 후 다시 보낼 수 있어요/,
    })) as HTMLButtonElement;
    expect(cooldownBtn.disabled).toBe(true);
  });

  it("renders no resend button when the email query param is missing", () => {
    searchParams = new URLSearchParams();
    render(<VerifyEmailContent />);
    expect(
      screen.queryByRole("button", { name: /인증 메일 재전송/ }),
    ).toBeNull();
  });
});
