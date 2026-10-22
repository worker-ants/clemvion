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

import { LoginForm } from "../login-form";
import { useLocaleStore } from "@/lib/stores/locale-store";
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
      expect(window.sessionStorage.getItem("clemvion.postLoginRedirect")).toBe(
        "/invitations/accept?token=abc",
      );
    } finally {
      hrefStub.restore();
    }
  });

  // 로그인 화면에서 OAuth 를 시작했다 그만둔 값이 남으면 다음 콜백의 목적지가 된다. redirect 가 없는
  // 시작은 남은 값을 지워야 한다.
  it("redirect 없이 OAuth 로그인을 시작하면 남아 있던 복귀 경로를 지운다", async () => {
    window.sessionStorage.setItem("clemvion.postLoginRedirect", "/workflows?stale=1");
    const hrefStub = stubLocationHref();
    try {
      render(<LoginForm enabledProviders={["google"]} />);
      await userEvent.setup().click(screen.getByRole("button", { name: "Google" }));

      expect(hrefStub.assign).toHaveBeenCalledWith(
        expect.stringContaining("/auth/oauth/google?mode=login"),
      );
      expect(window.sessionStorage.getItem("clemvion.postLoginRedirect")).toBeNull();
    } finally {
      hrefStub.restore();
    }
  });
});
