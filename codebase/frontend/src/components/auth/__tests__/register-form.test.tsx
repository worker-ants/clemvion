import { describe, it, expect, beforeEach, vi } from "vitest";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const mockPush = vi.fn();
const mockReplace = vi.fn();
vi.mock("next/navigation", () => ({
  useParams: () => ({}),
  useRouter: () => ({ push: mockPush, replace: mockReplace }),
}));

const mockRegister = vi.fn();
const mockCheckEmail = vi.fn();
vi.mock("@/lib/api/auth", () => ({
  authApi: {
    register: (...args: unknown[]) => mockRegister(...args),
    checkEmail: (...args: unknown[]) => mockCheckEmail(...args),
  },
}));

const mockGetByToken = vi.fn();
vi.mock("@/lib/api/invitations", () => ({
  invitationsApi: {
    getByToken: (...args: unknown[]) => mockGetByToken(...args),
  },
  INVITATION_ERROR: {
    EMAIL_MISMATCH: "invitation_email_mismatch",
    EXPIRED: "invitation_expired",
    ALREADY_USED: "invitation_already_used",
    NOT_FOUND: "invitation_not_found",
  },
}));

const mockSetAccessToken = vi.fn();
vi.mock("@/lib/api/client", () => ({
  setAccessToken: (...args: unknown[]) => mockSetAccessToken(...args),
}));

const mockToastInfo = vi.fn();
vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: (...a: unknown[]) => mockToastInfo(...a) },
}));

import { RegisterForm } from "../register-form";
import { useLocaleStore } from "@/lib/stores/locale-store";
import { stubLocationHref } from "@/test/stub-location-href";

const VALID_TOKEN = "a".repeat(64);

function axiosError(status: number, body: object = {}) {
  return Object.assign(new Error("axios error"), {
    isAxiosError: true,
    response: { status, data: body },
  });
}

describe("RegisterForm — invitation token flow", () => {
  beforeEach(() => {
    useLocaleStore.setState({ locale: "ko" });
    // has_session 힌트 쿠키 정리 — 초대-리다이렉트 테스트 간 누수 방지.
    document.cookie = "has_session=; max-age=0; path=/";
    mockPush.mockReset();
    mockReplace.mockReset();
    mockRegister.mockReset();
    mockCheckEmail.mockReset();
    mockGetByToken.mockReset();
    mockSetAccessToken.mockReset();
    mockToastInfo.mockReset();
    // 초대 흐름은 메타 조회 뒤 가입 여부를 묻는다. 기본은 «가입 안 함» 이다.
    mockCheckEmail.mockResolvedValue({ data: { data: { available: true } } });
  });

  it("renders no banner when invitationToken is absent", () => {
    render(<RegisterForm />);
    expect(mockGetByToken).not.toHaveBeenCalled();
    expect(screen.queryByText(/초대받으셨어요/)).toBeNull();
  });

  it("shows a 410 'invitation gone' banner and disables submit when token is expired", async () => {
    mockGetByToken.mockRejectedValue(axiosError(410, { code: "invitation_expired" }));

    render(<RegisterForm invitationToken={VALID_TOKEN} />);

    await waitFor(() => expect(mockGetByToken).toHaveBeenCalledWith(VALID_TOKEN));
    expect(
      await screen.findByText(/이 초대는 만료되었거나 이미 사용됐어요/),
    ).toBeDefined();
    // 에러 상태에서는 submit 버튼이 비활성화되어야 한다.
    const submit = screen.getByRole("button", { name: /계정 만들기/ });
    expect((submit as HTMLButtonElement).disabled).toBe(true);
  });

  it("shows a 404 'not found' banner when token is unknown", async () => {
    mockGetByToken.mockRejectedValue(axiosError(404, { code: "invitation_not_found" }));
    render(<RegisterForm invitationToken={VALID_TOKEN} />);
    expect(
      await screen.findByText(/초대 링크를 확인할 수 없어요/),
    ).toBeDefined();
  });

  it("prefills email read-only and shows workspace banner when meta is ready", async () => {
    mockGetByToken.mockResolvedValue({
      workspaceName: "Team Alpha",
      invitedByName: "Alice",
      email: "invited@example.com",
      role: "editor",
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
    });

    render(<RegisterForm invitationToken={VALID_TOKEN} />);

    expect(
      await screen.findByText(/Team Alpha 워크스페이스에 초대받으셨어요/),
    ).toBeDefined();
    expect(screen.getByText(/Alice님이 보낸 초대예요/)).toBeDefined();

    const email = screen.getByLabelText("이메일") as HTMLInputElement;
    await waitFor(() => expect(email.value).toBe("invited@example.com"));
    expect(email.readOnly).toBe(true);
  });

  it("on successful invitation register, stores accessToken and pushes /dashboard (no /verify-email)", async () => {
    mockGetByToken.mockResolvedValue({
      workspaceName: "Team Alpha",
      invitedByName: null,
      email: "invited@example.com",
      role: "editor",
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
    });
    mockRegister.mockResolvedValue({
      data: { data: { message: "ok", accessToken: "fresh-access" } },
    });

    const user = userEvent.setup();
    render(<RegisterForm invitationToken={VALID_TOKEN} />);

    // 메타 prefetch 완료 대기
    const email = (await screen.findByLabelText("이메일")) as HTMLInputElement;
    await waitFor(() => expect(email.value).toBe("invited@example.com"));

    await user.type(screen.getByLabelText("이름"), "Invitee");
    await user.type(screen.getByLabelText("비밀번호"), "Aa1!aaaa");
    await user.click(screen.getByRole("checkbox"));
    await user.click(screen.getByRole("button", { name: /계정 만들기/ }));

    await waitFor(() => expect(mockRegister).toHaveBeenCalledTimes(1));
    expect(mockRegister.mock.calls[0][0]).toMatchObject({
      name: "Invitee",
      email: "invited@example.com",
      invitationToken: VALID_TOKEN,
    });
    await waitFor(() => expect(mockSetAccessToken).toHaveBeenCalledWith("fresh-access"));
    expect(mockPush).toHaveBeenCalledWith("/dashboard");
    expect(mockPush).not.toHaveBeenCalledWith("/verify-email");
  });

  it("on register without accessToken (no invitation), goes to /verify-email", async () => {
    mockRegister.mockResolvedValue({
      data: { data: { message: "ok" } },
    });

    const user = userEvent.setup();
    render(<RegisterForm />);

    await user.type(screen.getByLabelText("이름"), "Newbie");
    await user.type(screen.getByLabelText("이메일"), "newbie@example.com");
    await user.type(screen.getByLabelText("비밀번호"), "Aa1!aaaa");
    await user.click(screen.getByRole("checkbox"));
    await user.click(screen.getByRole("button", { name: /계정 만들기/ }));

    await waitFor(() =>
      expect(mockPush).toHaveBeenCalledWith(
        "/verify-email?email=newbie%40example.com",
      ),
    );
    expect(mockSetAccessToken).not.toHaveBeenCalled();
  });

  it("on email blur, calls checkEmail and shows a 'taken' error when unavailable", async () => {
    mockCheckEmail.mockResolvedValue({ data: { data: { available: false } } });

    const user = userEvent.setup();
    render(<RegisterForm />);

    const email = screen.getByLabelText("이메일");
    await user.type(email, "taken@example.com");
    await user.tab(); // blur

    await waitFor(() =>
      expect(mockCheckEmail).toHaveBeenCalledWith("taken@example.com"),
    );
    expect(await screen.findByText(/이미 사용 중인 이메일/)).toBeDefined();
  });

  it("on email blur with an available email, shows no 'taken' error", async () => {
    mockCheckEmail.mockResolvedValue({ data: { data: { available: true } } });

    const user = userEvent.setup();
    render(<RegisterForm />);

    await user.type(screen.getByLabelText("이메일"), "free@example.com");
    await user.tab();

    await waitFor(() =>
      expect(mockCheckEmail).toHaveBeenCalledWith("free@example.com"),
    );
    expect(screen.queryByText(/이미 사용 중인 이메일/)).toBeNull();
  });

  it("does NOT call checkEmail on blur for an empty/invalid email", async () => {
    const user = userEvent.setup();
    render(<RegisterForm />);

    const email = screen.getByLabelText("이메일");
    await user.click(email);
    await user.tab(); // blur with empty value
    expect(mockCheckEmail).not.toHaveBeenCalled();

    await user.type(email, "not-an-email");
    await user.tab();
    expect(mockCheckEmail).not.toHaveBeenCalled();
  });

  it("redirects an already-logged-in user with a token to the accept page (§1.5.3 entry, V-09)", async () => {
    // (auth) 그룹엔 AuthProvider 가 없어 store 하이드레이션이 없다 — 기존 세션은
    // proxy.ts 와 동일하게 has_session 힌트 쿠키로 감지한다.
    document.cookie = "has_session=1; path=/";
    mockGetByToken.mockResolvedValue({
      workspaceName: "WS",
      invitedByName: null,
      email: "x@y.com",
      role: "editor",
      expiresAt: "2099-01-01T00:00:00Z",
    });
    render(<RegisterForm invitationToken="tok-9" />);
    await waitFor(() =>
      expect(mockReplace).toHaveBeenCalledWith(
        "/invitations/accept?token=tok-9",
      ),
    );
  });
});

/**
 * CLE-ACCT-WS 「초대 가입 화면」 선택지 (a) — 초대 토큰의 이메일이 이미 가입돼 있으면 로그인으로 보내고
 * 로그인 뒤 초대 수락 페이지로 돌아오게 한다. 가입 여부는 메타 조회가 성공한 뒤에만 묻는다.
 */
describe("RegisterForm — 이미 가입된 이메일로 온 초대", () => {
  const TOKEN = "tok+/=1";
  const LOGIN_HREF = `/login?redirect=${encodeURIComponent(
    `/invitations/accept?token=${encodeURIComponent(TOKEN)}`,
  )}`;
  const META = {
    workspaceName: "Team Alpha",
    invitedByName: null,
    email: "member@example.com",
    role: "editor",
    expiresAt: "2099-01-01T00:00:00Z",
  };

  beforeEach(() => {
    useLocaleStore.setState({ locale: "ko" });
    document.cookie = "has_session=; max-age=0; path=/";
    mockPush.mockReset();
    mockReplace.mockReset();
    mockRegister.mockReset();
    mockCheckEmail.mockReset();
    mockGetByToken.mockReset();
    mockToastInfo.mockReset();
    window.sessionStorage.clear();
  });

  it("가입된 이메일이면 로그인 화면으로 보내고 돌아올 곳을 초대 수락 페이지로 둔다", async () => {
    mockGetByToken.mockResolvedValue(META);
    mockCheckEmail.mockResolvedValue({ data: { data: { available: false } } });

    render(<RegisterForm invitationToken={TOKEN} />);

    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith(LOGIN_HREF));
    expect(mockCheckEmail).toHaveBeenCalledWith("member@example.com", {
      timeout: expect.any(Number),
    });
    expect(mockToastInfo).toHaveBeenCalledWith(
      "이미 가입된 이메일이에요. 로그인하면 초대를 수락할 수 있어요.",
    );
    const submit = screen.getByRole("button", { name: /계정 만들기/ });
    expect((submit as HTMLButtonElement).disabled).toBe(true);
  });

  // 이 테스트의 `useRouter` mock 은 렌더마다 새 객체를 돌려줘 effect 의 `router` 의존성이 바뀐다.
  // 재렌더로 effect 가 다시 돌아도 안내와 이동은 한 번만 일어나야 한다.
  it("재렌더로 effect 가 다시 돌아도 안내와 이동은 한 번만 일어난다", async () => {
    mockGetByToken.mockResolvedValue(META);
    mockCheckEmail.mockResolvedValue({ data: { data: { available: false } } });

    const { rerender } = render(<RegisterForm invitationToken={TOKEN} />);
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith(LOGIN_HREF));

    rerender(<RegisterForm invitationToken={TOKEN} />);
    await act(async () => {});

    expect(mockReplace).toHaveBeenCalledTimes(1);
    expect(mockToastInfo).toHaveBeenCalledTimes(1);
  });

  it("가입되지 않은 이메일이면 가입 폼을 그대로 둔다", async () => {
    mockGetByToken.mockResolvedValue(META);
    mockCheckEmail.mockResolvedValue({ data: { data: { available: true } } });

    render(<RegisterForm invitationToken={TOKEN} />);

    await waitFor(() => expect(mockCheckEmail).toHaveBeenCalled());
    const email = screen.getByLabelText("이메일") as HTMLInputElement;
    await waitFor(() => expect(email.value).toBe("member@example.com"));
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it("가입 여부를 확인하지 못하면(429 등) 가입 폼을 그대로 둔다", async () => {
    mockGetByToken.mockResolvedValue(META);
    mockCheckEmail.mockRejectedValue(axiosError(429));

    render(<RegisterForm invitationToken={TOKEN} />);

    await waitFor(() => expect(mockCheckEmail).toHaveBeenCalled());
    const email = screen.getByLabelText("이메일") as HTMLInputElement;
    await waitFor(() => expect(email.value).toBe("member@example.com"));
    expect(mockReplace).not.toHaveBeenCalled();
  });

  // `apiClient` 에는 기본 timeout 이 없다. 응답이 오지 않는 확인이 폼을 loading 에 붙잡으면 안 된다.
  it("가입 여부 확인이 시간 안에 끝나지 않으면 확인 실패로 보고 가입 폼을 연다", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      mockGetByToken.mockResolvedValue(META);
      // axios 의 `timeout` 옵션처럼 응답이 없으면 그 시간 뒤 ECONNABORTED 로 끝나는 요청이다.
      mockCheckEmail.mockImplementation(
        (_email: string, config?: { timeout?: number }) =>
          new Promise((_resolve, reject) => {
            if (config?.timeout) {
              setTimeout(
                () =>
                  reject(
                    Object.assign(
                      new Error(`timeout of ${config.timeout}ms exceeded`),
                      { isAxiosError: true, code: "ECONNABORTED" },
                    ),
                  ),
                config.timeout,
              );
            }
          }),
      );

      render(<RegisterForm invitationToken={TOKEN} />);

      await waitFor(() => expect(mockCheckEmail).toHaveBeenCalled());
      const timeout = (mockCheckEmail.mock.calls[0][1] as { timeout: number })
        .timeout;
      // 짧은 시간 제한이 이 호출에 걸려 있다.
      expect(timeout).toBeGreaterThan(0);
      expect(timeout).toBeLessThanOrEqual(10_000);

      // 시간 제한 전에는 아직 확인 중이라 제출할 수 없다.
      const submit = screen.getByRole("button", { name: /계정 만들기/ });
      expect((submit as HTMLButtonElement).disabled).toBe(true);

      await act(async () => {
        await vi.advanceTimersByTimeAsync(timeout);
      });

      const email = screen.getByLabelText("이메일") as HTMLInputElement;
      await waitFor(() => expect(email.value).toBe("member@example.com"));
      expect((submit as HTMLButtonElement).disabled).toBe(false);
      expect(mockReplace).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  it("토큰 메타 조회가 실패하면 가입 여부를 묻지 않는다", async () => {
    mockGetByToken.mockRejectedValue(axiosError(404, { code: "invitation_not_found" }));

    render(<RegisterForm invitationToken={TOKEN} />);

    expect(await screen.findByText(/초대 링크를 확인할 수 없어요/)).toBeDefined();
    expect(mockCheckEmail).not.toHaveBeenCalled();
  });

  it("이미 로그인한 사용자는 가입 여부를 묻지 않고 수락 페이지로 보낸다", async () => {
    document.cookie = "has_session=1; path=/";
    mockGetByToken.mockResolvedValue(META);

    render(<RegisterForm invitationToken={TOKEN} />);

    await waitFor(() =>
      expect(mockReplace).toHaveBeenCalledWith(
        `/invitations/accept?token=${encodeURIComponent(TOKEN)}`,
      ),
    );
    await waitFor(() => expect(mockGetByToken).toHaveBeenCalled());
    expect(mockCheckEmail).not.toHaveBeenCalled();
  });

  it("제출이 409 RESOURCE_CONFLICT 로 끝나면 같은 로그인 경로로 보낸다", async () => {
    mockGetByToken.mockResolvedValue(META);
    mockCheckEmail.mockRejectedValue(axiosError(429));
    mockRegister.mockRejectedValue(
      axiosError(409, { error: { code: "RESOURCE_CONFLICT", message: "Email already registered" } }),
    );

    const user = userEvent.setup();
    render(<RegisterForm invitationToken={TOKEN} />);

    const email = screen.getByLabelText("이메일") as HTMLInputElement;
    await waitFor(() => expect(email.value).toBe("member@example.com"));
    await user.type(screen.getByLabelText("이름"), "Member");
    await user.type(screen.getByLabelText("비밀번호"), "Aa1!aaaa");
    await user.click(screen.getByRole("checkbox"));
    await user.click(screen.getByRole("button", { name: /계정 만들기/ }));

    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith(LOGIN_HREF));
    expect(mockToastInfo).toHaveBeenCalled();
  });

  it("초대 없이 받은 409 는 로그인으로 보내지 않는다", async () => {
    mockRegister.mockRejectedValue(
      axiosError(409, { error: { code: "RESOURCE_CONFLICT", message: "Email already registered" } }),
    );

    const user = userEvent.setup();
    render(<RegisterForm />);

    await user.type(screen.getByLabelText("이름"), "Newbie");
    await user.type(screen.getByLabelText("이메일"), "newbie@example.com");
    await user.type(screen.getByLabelText("비밀번호"), "Aa1!aaaa");
    await user.click(screen.getByRole("checkbox"));
    await user.click(screen.getByRole("button", { name: /계정 만들기/ }));

    await waitFor(() => expect(mockRegister).toHaveBeenCalled());
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it("초대 흐름의 로그인 링크는 초대 수락 페이지로 돌아오는 경로를 담는다", async () => {
    mockGetByToken.mockResolvedValue(META);
    render(<RegisterForm invitationToken={TOKEN} />);
    const link = screen.getByRole("link", { name: "로그인" });
    expect(link.getAttribute("href")).toBe(LOGIN_HREF);
    await waitFor(() => expect(mockCheckEmail).toHaveBeenCalled());
  });

  it("초대 없는 가입 화면의 로그인 링크는 /login 이다", () => {
    render(<RegisterForm />);
    expect(screen.getByRole("link", { name: "로그인" }).getAttribute("href")).toBe("/login");
  });
});

/**
 * 로그인 화면에서 OAuth 를 시작했다 그만둔 복귀 경로가 남아 있으면 다음 콜백의 목적지가 된다.
 * 가입 화면의 OAuth 시작은 그 값을 지운다.
 */
describe("RegisterForm — OAuth 가입 시작", () => {
  beforeEach(() => {
    useLocaleStore.setState({ locale: "ko" });
    window.sessionStorage.clear();
  });

  it("OAuth 가입을 시작하면 남아 있던 로그인 복귀 경로를 지운다", async () => {
    window.sessionStorage.setItem("clemvion.postLoginRedirect", "/workflows?stale=1");
    const hrefStub = stubLocationHref();
    try {
      render(<RegisterForm enabledProviders={["google"]} />);
      await userEvent.setup().click(screen.getByRole("button", { name: "Google" }));

      expect(hrefStub.assign).toHaveBeenCalledWith(
        expect.stringContaining("/auth/oauth/google?mode=register"),
      );
      expect(window.sessionStorage.getItem("clemvion.postLoginRedirect")).toBeNull();
    } finally {
      hrefStub.restore();
    }
  });
});
