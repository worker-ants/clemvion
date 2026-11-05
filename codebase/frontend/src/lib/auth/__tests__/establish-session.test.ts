import { describe, it, expect, beforeEach, vi } from "vitest";

const setAccessToken = vi.fn();
vi.mock("@/lib/api/client", () => ({
  setAccessToken: (token: string | null) => setAccessToken(token),
}));

const getMe = vi.fn();
vi.mock("@/lib/api/users", () => ({
  usersApi: { getMe: (config?: unknown) => getMe(config) },
}));

const switchWorkspaceApi = vi.fn();
vi.mock("@/lib/api/auth", () => ({
  switchWorkspaceApi: (id: string) => switchWorkspaceApi(id),
}));

import {
  ESTABLISH_SESSION_TIMEOUT_MS,
  establishSession,
} from "../establish-session";
import { useAuthStore } from "@/lib/stores/auth-store";
import { hasSessionHint } from "../session-hint";

const USER = {
  id: "u1",
  email: "a@b.com",
  name: "A",
  locale: "ko",
  theme: "light",
  twoFactorEnabled: false,
};

// NERV CLE-ACCT-SESSION REQ-SESSION-037 · 「로그인 힌트 쿠키」 (CLE-T-1X7DMR).
describe("establishSession", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    document.cookie = "has_session=; max-age=0; path=/";
    useAuthStore.setState({ user: null, isAuthenticated: false, isLoading: true });
  });

  it("사용자 조회에 성공하면 로그인 상태를 표시하고 힌트 쿠키를 심는다", async () => {
    getMe.mockResolvedValue({ data: { data: USER } });

    const user = await establishSession("access-1");

    expect(user).toEqual(USER);
    expect(setAccessToken).toHaveBeenCalledWith("access-1");
    expect(hasSessionHint()).toBe(true);
    expect(useAuthStore.getState()).toMatchObject({
      user: USER,
      isAuthenticated: true,
      isLoading: false,
    });
  });

  it("사용자 조회에 시간 상한을 둔다", async () => {
    getMe.mockResolvedValue({ data: { data: USER } });

    await establishSession("access-1");

    expect(getMe).toHaveBeenCalledWith({ timeout: ESTABLISH_SESSION_TIMEOUT_MS });
    expect(ESTABLISH_SESSION_TIMEOUT_MS).toBeGreaterThan(0);
  });

  it.each([
    ["조회 실패", () => getMe.mockRejectedValue(new Error("network"))],
    ["시간 초과", () => getMe.mockRejectedValue(new Error("timeout of 10000ms exceeded"))],
    ["응답에 사용자가 없음", () => getMe.mockResolvedValue({ data: { data: null } })],
  ])(
    "%s 이면 토큰과 힌트 쿠키는 두고 로그인 상태는 표시하지 않는다",
    async (_label, arrange) => {
      arrange();

      const user = await establishSession("access-1");

      expect(user).toBeNull();
      // 토큰이 이미 발급돼 리프레시 쿠키가 있으므로 힌트 쿠키를 심는다. 이동한 화면의 AuthProvider 가
      // 로그인 상태를 다시 복원하고, 그것도 실패하면 로그아웃해 힌트 쿠키를 지운다.
      expect(setAccessToken).toHaveBeenCalledWith("access-1");
      expect(hasSessionHint()).toBe(true);
      expect(useAuthStore.getState().isAuthenticated).toBe(false);
    },
  );

  it("워크스페이스 정합은 하지 않는다 (`[slug]` layout 과 slug 없는 경로의 리다이렉트가 맡는다)", async () => {
    getMe.mockResolvedValue({ data: { data: USER } });

    await establishSession("access-1");

    expect(switchWorkspaceApi).not.toHaveBeenCalled();
  });
});
