import { StrictMode } from "react";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, cleanup, waitFor } from "@testing-library/react";

const push = vi.fn();
vi.mock("next/navigation", () => ({
  useParams: () => ({}),
  useRouter: () => ({ push, replace: vi.fn(), back: vi.fn() }),
}));
vi.mock("next/link", () => ({
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
vi.mock("@/lib/i18n", () => ({
  useT: () => (key: string) => key,
}));

const refreshAccessToken = vi.fn();
vi.mock("@/lib/api/client", () => ({
  refreshAccessToken: () => refreshAccessToken(),
  setAccessToken: vi.fn(),
}));

const getMe = vi.fn();
vi.mock("@/lib/api/users", () => ({
  usersApi: { getMe: () => getMe() },
}));

import { CallbackContent } from "../callback-content";
import { useAuthStore } from "@/lib/stores/auth-store";

const REDIRECT_KEY = "clemvion.postLoginRedirect";
const USER = { id: "u1", email: "a@b.com", name: "A", locale: "ko", theme: "light" };

describe("CallbackContent (decision A — refresh-cookie reuse)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    cleanup();
    window.sessionStorage.clear();
    document.cookie = "has_session=; max-age=0; path=/";
    useAuthStore.setState({ user: null, isAuthenticated: false, isLoading: true });
    getMe.mockResolvedValue({ data: { data: USER } });
  });

  it("calls refreshAccessToken on success and routes to /dashboard", async () => {
    refreshAccessToken.mockResolvedValue("new-access-token");
    render(<CallbackContent success="true" />);

    await waitFor(() => expect(refreshAccessToken).toHaveBeenCalled());
    await waitFor(() => expect(push).toHaveBeenCalledWith("/dashboard"));
  });

  it("shows error when refresh returns null (no token) — no dashboard route", async () => {
    refreshAccessToken.mockResolvedValue(null);
    render(<CallbackContent success="true" />);

    await waitFor(() => expect(refreshAccessToken).toHaveBeenCalled());
    // refresh 가 token 을 못 주면 대시보드로 이동하지 않는다 (error 상태).
    expect(push).not.toHaveBeenCalled();
  });

  it("does not route to dashboard when refresh rejects (catch branch)", async () => {
    refreshAccessToken.mockRejectedValue(new Error("network down"));
    render(<CallbackContent success="true" />);

    await waitFor(() => expect(refreshAccessToken).toHaveBeenCalled());
    expect(push).not.toHaveBeenCalled();
  });

  it("shows error and does not refresh when error param is present", async () => {
    render(<CallbackContent error="access_denied" />);
    // initialError 분기 — refresh 호출 없음
    expect(refreshAccessToken).not.toHaveBeenCalled();
    expect(push).not.toHaveBeenCalled();
  });

  it("treats missing success as error (no refresh)", () => {
    render(<CallbackContent />);
    expect(refreshAccessToken).not.toHaveBeenCalled();
    expect(push).not.toHaveBeenCalled();
  });

  // REQ-SESSION-045 — OAuth 는 `?redirect=` 를 들고 갈 수 없어 로그인 화면이 sessionStorage 에 남긴다.
  it("routes to the stored post-login path and clears it", async () => {
    window.sessionStorage.setItem(REDIRECT_KEY, "/invitations/accept?token=abc");
    refreshAccessToken.mockResolvedValue("new-access-token");
    render(<CallbackContent success="true" />);

    await waitFor(() =>
      expect(push).toHaveBeenCalledWith("/invitations/accept?token=abc"),
    );
    expect(window.sessionStorage.getItem(REDIRECT_KEY)).toBeNull();
  });

  // 개발 서버의 StrictMode 는 effect 를 두 번 돌린다. 첫 effect 가 sessionStorage 에서 값을 꺼내 지운 뒤
  // 두 번째 effect 가 다시 꺼내면 복귀 경로가 사라지고 /dashboard 가 된다. 한 번 꺼낸 값을 ref 로 지킨다.
  it("keeps the stored path when StrictMode runs the effect twice", async () => {
    window.sessionStorage.setItem(REDIRECT_KEY, "/invitations/accept?token=abc");
    refreshAccessToken.mockResolvedValue("new-access-token");
    render(
      <StrictMode>
        <CallbackContent success="true" />
      </StrictMode>,
    );

    await waitFor(() => expect(push).toHaveBeenCalled());
    expect(push).toHaveBeenCalledTimes(1);
    expect(push).toHaveBeenCalledWith("/invitations/accept?token=abc");
    expect(window.sessionStorage.getItem(REDIRECT_KEY)).toBeNull();
  });

  it("ignores an unsafe stored path and routes to /dashboard", async () => {
    window.sessionStorage.setItem(REDIRECT_KEY, "https://evil.example.com");
    refreshAccessToken.mockResolvedValue("new-access-token");
    render(<CallbackContent success="true" />);

    await waitFor(() => expect(push).toHaveBeenCalledWith("/dashboard"));
  });

  it("clears the stored path on the error branch too", () => {
    window.sessionStorage.setItem(REDIRECT_KEY, "/workflows");
    render(<CallbackContent error="access_denied" />);
    expect(window.sessionStorage.getItem(REDIRECT_KEY)).toBeNull();
  });

  // REQ-SESSION-037 — proxy 는 `has_session` 힌트 쿠키로 보호 경로를 가른다. 쿠키 없이 이동하면
  // 첫 OAuth 로그인이 다시 /login 으로 돌아간다.
  it("marks the session as authenticated (has_session hint cookie) before routing", async () => {
    refreshAccessToken.mockResolvedValue("new-access-token");
    render(<CallbackContent success="true" />);

    await waitFor(() => expect(push).toHaveBeenCalled());
    expect(document.cookie.split("; ")).toContain("has_session=1");
    expect(useAuthStore.getState().isAuthenticated).toBe(true);
  });

  // 사용자 조회가 실패하면 힌트 쿠키를 심지 못한다. 이동은 그대로 하고(정책은 CLE-T-1X7DMR) 그 한계를 고정한다.
  // proxy 가 보호 경로를 /login?redirect=<경로와 쿼리> 로 돌려보내므로 돌아갈 경로는 잃지 않는다.
  it("still routes when /users/me fails, but cannot set the has_session hint", async () => {
    refreshAccessToken.mockResolvedValue("new-access-token");
    getMe.mockRejectedValue(new Error("network"));
    render(<CallbackContent success="true" />);

    await waitFor(() => expect(push).toHaveBeenCalledWith("/dashboard"));
    expect(document.cookie.split("; ")).not.toContain("has_session=1");
    expect(useAuthStore.getState().isAuthenticated).toBe(false);
  });
});
