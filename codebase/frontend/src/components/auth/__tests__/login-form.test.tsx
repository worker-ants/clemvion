import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  useParams: () => ({}),
  useRouter: () => ({ push: mockPush, replace: vi.fn() }),
}));

const mockLogin = vi.fn();
const mockLoginTotp = vi.fn();
vi.mock("@/lib/api/auth", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/auth")>();
  return {
    ...actual,
    authApi: {
      login: (...args: unknown[]) => mockLogin(...args),
      loginTotp: (...args: unknown[]) => mockLoginTotp(...args),
    },
  };
});

vi.mock("@/lib/api/users", () => ({
  usersApi: { getMe: vi.fn().mockRejectedValue(new Error("skip")) },
}));

vi.mock("@/lib/api/client", () => ({
  setAccessToken: vi.fn(),
}));

vi.mock("@simplewebauthn/browser", () => ({
  browserSupportsWebAuthn: () => false,
  startAuthentication: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

import { toast } from "sonner";
import { LoginForm } from "../login-form";
import { useLocaleStore } from "@/lib/stores/locale-store";
import { useAuthStore } from "@/lib/stores/auth-store";
import { usersApi } from "@/lib/api/users";
import { hasSessionHint } from "@/lib/auth/session-hint";
import { OAUTH_REDIRECT_STORAGE_KEY } from "@/lib/auth/post-login-redirect";
import { stubLocationHref } from "@/test/stub-location-href";

async function submitPassword() {
  const user = userEvent.setup();
  await user.type(screen.getByLabelText("이메일"), "alice@example.com");
  await user.type(screen.getByLabelText("비밀번호"), "Password1!");
  await user.click(screen.getByRole("button", { name: "로그인" }));
  return user;
}

/**
 * REQ-SESSION-038 — 로그인에 성공하면 안전한 `redirect` 값으로, 아니면 `/dashboard` 로 간다.
 * 비밀번호 · 2단계 인증 · OAuth 가 같은 값을 쓴다.
 */
describe("LoginForm — 로그인 뒤 돌아갈 경로", () => {
  beforeEach(() => {
    useLocaleStore.setState({ locale: "ko" });
    mockPush.mockReset();
    mockLogin.mockReset();
    mockLoginTotp.mockReset();
    window.sessionStorage.clear();
  });

  it("redirect 가 같은 출처의 상대 경로면 쿼리째 그 경로로 간다", async () => {
    mockLogin.mockResolvedValue({ data: { data: { accessToken: "at" } } });
    render(<LoginForm redirect="/w/team-a/workflows/abc?tab=runs" />);

    await submitPassword();

    await waitFor(() =>
      expect(mockPush).toHaveBeenCalledWith("/w/team-a/workflows/abc?tab=runs"),
    );
  });

  it("redirect 가 없으면 /dashboard 로 간다", async () => {
    mockLogin.mockResolvedValue({ data: { data: { accessToken: "at" } } });
    render(<LoginForm />);

    await submitPassword();

    await waitFor(() => expect(mockPush).toHaveBeenCalledWith("/dashboard"));
  });

  it.each([
    ["외부 URL", "https://evil.example.com/x"],
    ["protocol-relative", "//evil.example.com"],
    ["슬래시 + 백슬래시", "/\\evil.example.com"],
  ])("redirect 가 %s 면 /dashboard 로 간다", async (_label, redirect) => {
    mockLogin.mockResolvedValue({ data: { data: { accessToken: "at" } } });
    render(<LoginForm redirect={redirect} />);

    await submitPassword();

    await waitFor(() => expect(mockPush).toHaveBeenCalledWith("/dashboard"));
    expect(mockPush).not.toHaveBeenCalledWith(redirect);
  });

  it("2단계 인증(TOTP)을 거쳐도 같은 redirect 로 간다", async () => {
    mockLogin.mockResolvedValue({
      data: {
        data: { requires2fa: true, challengeToken: "ch-1", methods: ["totp"] },
      },
    });
    mockLoginTotp.mockResolvedValue({ data: { data: { accessToken: "at" } } });
    render(<LoginForm redirect="/invitations/accept?token=abc" />);

    const user = await submitPassword();
    await user.type(await screen.findByLabelText("인증 코드"), "123456");
    await user.click(screen.getByRole("button", { name: "확인" }));

    await waitFor(() =>
      expect(mockLoginTotp).toHaveBeenCalledWith("ch-1", "123456"),
    );
    await waitFor(() =>
      expect(mockPush).toHaveBeenCalledWith("/invitations/accept?token=abc"),
    );
  });

  it("초대 수락 페이지로 돌아갈 때는 초대 안내 문구를 보여 준다", () => {
    render(<LoginForm redirect="/invitations/accept?token=abc" />);
    expect(
      screen.getByText("로그인하면 초대 수락 화면으로 이동해요."),
    ).toBeDefined();
  });

  it("다른 경로로 돌아갈 때는 기본 문구를 보여 준다", () => {
    render(<LoginForm redirect="/workflows" />);
    expect(
      screen.queryByText("로그인하면 초대 수락 화면으로 이동해요."),
    ).toBeNull();
  });

  it("OAuth 로그인을 시작하면 redirect 를 sessionStorage 에 남긴다", async () => {
    const hrefStub = stubLocationHref();
    try {
      render(
        <LoginForm
          enabledProviders={["google"]}
          redirect="/invitations/accept?token=abc"
        />,
      );
      await userEvent.setup().click(screen.getByRole("button", { name: "Google" }));

      expect(hrefStub.assign).toHaveBeenCalledWith(
        expect.stringContaining("/auth/oauth/google?mode=login"),
      );
      expect(window.sessionStorage.getItem(OAUTH_REDIRECT_STORAGE_KEY)).toBe(
        "/invitations/accept?token=abc",
      );
    } finally {
      hrefStub.restore();
    }
  });

  // 로그인 화면에서 OAuth 를 시작했다 그만둔 값이 남으면 다음 콜백의 목적지가 된다. redirect 가 없는
  // 시작은 남은 값을 지워야 한다.
  it("redirect 없이 OAuth 로그인을 시작하면 남아 있던 복귀 경로를 지운다", async () => {
    window.sessionStorage.setItem(OAUTH_REDIRECT_STORAGE_KEY, "/workflows?stale=1");
    const hrefStub = stubLocationHref();
    try {
      render(<LoginForm enabledProviders={["google"]} />);
      await userEvent.setup().click(screen.getByRole("button", { name: "Google" }));

      expect(hrefStub.assign).toHaveBeenCalledWith(
        expect.stringContaining("/auth/oauth/google?mode=login"),
      );
      expect(window.sessionStorage.getItem(OAUTH_REDIRECT_STORAGE_KEY)).toBeNull();
    } finally {
      hrefStub.restore();
    }
  });
});

/**
 * REQ-SESSION-037 — 토큰을 받으면 establishSession 이 로그인 상태와 `has_session` 힌트 쿠키를 둔다
 * (CLE-T-1X7DMR). 비밀번호 · 2단계 인증 · 복구 코드가 모두 completeLogin 을 거친다.
 */
describe("LoginForm — 로그인 힌트 쿠키", () => {
  const ME = {
    id: "u1",
    email: "alice@example.com",
    name: "Alice",
    locale: "ko",
    theme: "light",
    twoFactorEnabled: false,
  };

  beforeEach(() => {
    useLocaleStore.setState({ locale: "ko" });
    mockPush.mockReset();
    mockLogin.mockReset();
    mockLoginTotp.mockReset();
    document.cookie = "has_session=; max-age=0; path=/";
    useAuthStore.setState({ user: null, isAuthenticated: false, isLoading: true });
    vi.mocked(usersApi.getMe).mockReset().mockResolvedValue({
      data: { data: ME },
    } as never);
  });

  it("비밀번호 로그인은 이동하기 전에 로그인 상태와 힌트 쿠키를 둔다", async () => {
    mockLogin.mockResolvedValue({ data: { data: { accessToken: "at" } } });
    render(<LoginForm />);

    await submitPassword();

    await waitFor(() => expect(mockPush).toHaveBeenCalledWith("/dashboard"));
    expect(hasSessionHint()).toBe(true);
    expect(useAuthStore.getState()).toMatchObject({ isAuthenticated: true, user: ME });
  });

  it("2단계 인증(TOTP)을 마쳐도 같은 진입점으로 힌트 쿠키를 둔다", async () => {
    mockLogin.mockResolvedValue({
      data: {
        data: { requires2fa: true, methods: ["totp"], challengeToken: "ch" },
      },
    });
    mockLoginTotp.mockResolvedValue({ data: { data: { accessToken: "at2" } } });
    render(<LoginForm />);

    const user = await submitPassword();
    await user.type(await screen.findByLabelText("인증 코드"), "123456");
    await user.click(screen.getByRole("button", { name: "확인" }));

    await waitFor(() => expect(mockPush).toHaveBeenCalledWith("/dashboard"));
    expect(hasSessionHint()).toBe(true);
    expect(useAuthStore.getState().isAuthenticated).toBe(true);
  });

  it("사용자 조회가 실패해도 힌트 쿠키를 두고 이동한다(목적지의 AuthProvider 가 복원한다)", async () => {
    vi.mocked(usersApi.getMe).mockRejectedValue(new Error("network"));
    mockLogin.mockResolvedValue({ data: { data: { accessToken: "at" } } });
    render(<LoginForm />);

    await submitPassword();

    await waitFor(() => expect(mockPush).toHaveBeenCalledWith("/dashboard"));
    expect(hasSessionHint()).toBe(true);
    expect(useAuthStore.getState().isAuthenticated).toBe(false);
  });
});

/**
 * NERV CLE-ACCT-SIGNIN 「로그인 처리」 7 · 9번 — 화면은 메시지가 아닌 코드로 안내를 고른다
 * (CLE-T-AYT4VB · CLE-T-RFSJXQ).
 */
describe("LoginForm — 로그인 거부 코드별 안내", () => {
  function apiError(status: number, code: string, message: string) {
    return Object.assign(new Error(message), {
      isAxiosError: true,
      response: { status, data: { error: { code, message } } },
    });
  }

  beforeEach(() => {
    useLocaleStore.setState({ locale: "ko" });
    mockPush.mockReset();
    mockLogin.mockReset();
    vi.mocked(toast.error).mockReset();
  });

  it.each([
    [
      "EMAIL_VERIFICATION_REQUIRED",
      401,
      "Please verify your email before logging in",
      "이메일을 먼저 인증해 주세요",
    ],
    [
      "WEBAUTHN_DISABLED",
      503,
      "Passkey login is disabled",
      "지금은 Passkey 로 로그인할 수 없어요. 운영자에게 문의해 주세요.",
    ],
  ])("%s 이면 그 안내를 보여 준다", async (code, status, serverMessage, shown) => {
    mockLogin.mockRejectedValue(apiError(status, code, serverMessage));
    render(<LoginForm />);

    await submitPassword();

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith(shown));
    expect(mockPush).not.toHaveBeenCalled();
  });

  /**
   * NERV Task `CLE-T-MFWBE1` 항목 2 — 에러 봉투는 `{ error: { code, message } }` 다. 예전 화면은
   * `data.message` 를 읽어 늘 기본 문구만 보였다. 아는 코드는 사전 문구로, 모르는 코드는 봉투의
   * `error.message` 로, 그것도 없으면 기본 문구로 안내한다.
   */
  it.each([
    ["LOGIN_FAILED", 401, "Invalid email or password", "이메일 또는 비밀번호가 올바르지 않습니다"],
    [
      "ACCOUNT_LOCKED",
      401,
      "Account locked. Try again in 10 minutes.",
      "계정이 잠겼어요. 10분 뒤 다시 시도해 주세요.",
    ],
  ])("%s 이면 사전 문구로 안내한다", async (code, status, serverMessage, shown) => {
    mockLogin.mockRejectedValue(apiError(status, code, serverMessage));
    render(<LoginForm />);

    await submitPassword();

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith(shown));
  });

  it("모르는 코드면 에러 봉투의 error.message 를 보여 준다", async () => {
    mockLogin.mockRejectedValue(
      apiError(429, "RATE_LIMITED", "Too many requests. Please retry later."),
    );
    render(<LoginForm />);

    await submitPassword();

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith("Too many requests. Please retry later."),
    );
  });

  it("응답 본문이 없으면(네트워크 오류) 기본 문구를 보여 준다", async () => {
    mockLogin.mockRejectedValue(
      Object.assign(new Error("Network Error"), { isAxiosError: true }),
    );
    render(<LoginForm />);

    await submitPassword();

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith("로그인에 실패했어요. 다시 시도해 주세요."),
    );
  });
});

describe("LoginForm — 2단계 인증(TOTP) 거부 코드별 안내", () => {
  function apiError(status: number, code: string, message: string) {
    return Object.assign(new Error(message), {
      isAxiosError: true,
      response: { status, data: { error: { code, message } } },
    });
  }

  beforeEach(() => {
    useLocaleStore.setState({ locale: "ko" });
    mockPush.mockReset();
    mockLogin.mockReset();
    mockLoginTotp.mockReset();
    vi.mocked(toast.error).mockReset();
    mockLogin.mockResolvedValue({
      data: {
        data: { requires2fa: true, challengeToken: "ch-1", methods: ["totp"] },
      },
    });
  });

  async function submitTotp() {
    const user = await submitPassword();
    await user.type(await screen.findByLabelText("인증 코드"), "123456");
    await user.click(screen.getByRole("button", { name: "확인" }));
  }

  it.each([
    ["TOTP_INVALID", "Invalid code", "인증 코드가 올바르지 않아요."],
    [
      "CHALLENGE_INVALID",
      "인증 세션이 만료됐어요. 다시 로그인해 주세요.",
      "인증 세션이 만료됐어요. 처음부터 다시 로그인해 주세요.",
    ],
  ])("%s 이면 사전 문구로 안내한다", async (code, serverMessage, shown) => {
    mockLoginTotp.mockRejectedValue(apiError(401, code, serverMessage));
    render(<LoginForm />);

    await submitTotp();

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith(shown));
  });

  it("모르는 코드면 에러 봉투의 error.message 를 보여 준다", async () => {
    mockLoginTotp.mockRejectedValue(
      apiError(401, "TOTP_NOT_ENABLED", "이 계정은 TOTP 가 꺼져 있어요."),
    );
    render(<LoginForm />);

    await submitTotp();

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith("이 계정은 TOTP 가 꺼져 있어요."),
    );
  });
});
