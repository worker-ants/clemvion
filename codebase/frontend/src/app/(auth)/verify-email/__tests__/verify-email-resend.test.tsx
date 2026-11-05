import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

let searchParams = new URLSearchParams();
vi.mock("next/navigation", () => ({
  useParams: () => ({}),
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

const mockSetAccessToken = vi.fn();
vi.mock("@/lib/api/client", () => ({
  setAccessToken: (...args: unknown[]) => mockSetAccessToken(...args),
}));

const mockGetMe = vi.fn();
vi.mock("@/lib/api/users", () => ({
  usersApi: { getMe: (...args: unknown[]) => mockGetMe(...args) },
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

import { VerifyEmailContent } from "../verify-email-content";
import { useLocaleStore } from "@/lib/stores/locale-store";
import { useAuthStore } from "@/lib/stores/auth-store";
import { hasSessionHint } from "@/lib/auth/session-hint";

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

/**
 * REQ-SESSION-037 — 이메일 인증 자동 로그인도 로그인 상태와 힌트 쿠키를 둔다. 없으면 `/dashboard`
 * 이동을 proxy 가 /login 으로 되돌린다(CLE-T-1X7DMR).
 */
describe("VerifyEmailContent — 자동 로그인", () => {
  beforeEach(() => {
    useLocaleStore.setState({ locale: "ko" });
    mockVerifyEmail.mockReset();
    mockSetAccessToken.mockReset();
    mockGetMe.mockReset().mockResolvedValue({
      data: {
        data: {
          id: "u1",
          email: "a@b.com",
          name: "A",
          locale: "ko",
          theme: "light",
          twoFactorEnabled: false,
        },
      },
    });
    document.cookie = "has_session=; max-age=0; path=/";
    useAuthStore.setState({ user: null, isAuthenticated: false, isLoading: true });
  });

  it("인증 토큰으로 받은 액세스 토큰으로 로그인 상태와 힌트 쿠키를 둔다", async () => {
    searchParams = new URLSearchParams({ token: "verify-token" });
    mockVerifyEmail.mockResolvedValue({
      data: { data: { accessToken: "auto-access" } },
    });

    render(<VerifyEmailContent />);

    await waitFor(() => expect(useAuthStore.getState().isAuthenticated).toBe(true));
    expect(mockVerifyEmail).toHaveBeenCalledWith("verify-token");
    expect(mockSetAccessToken).toHaveBeenCalledWith("auto-access");
    expect(hasSessionHint()).toBe(true);
  });
});
