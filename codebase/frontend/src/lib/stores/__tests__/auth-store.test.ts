import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("../../api/client", () => ({
  setAccessToken: vi.fn(),
}));

import { useAuthStore } from "../auth-store";
import { setAccessToken } from "../../api/client";

const initialState = {
  user: null,
  isAuthenticated: false,
  isLoading: true,
};

describe("useAuthStore", () => {
  beforeEach(() => {
    useAuthStore.setState(initialState);
    vi.clearAllMocks();
  });

  it("has correct initial state", () => {
    const state = useAuthStore.getState();
    expect(state.user).toBeNull();
    expect(state.isAuthenticated).toBe(false);
    expect(state.isLoading).toBe(true);
  });

  it("setUser sets the user", () => {
    const user = { id: "1", email: "test@test.com", name: "Test", locale: "en", theme: "light" };
    useAuthStore.getState().setUser(user);
    expect(useAuthStore.getState().user).toEqual(user);
  });

  it("setUser can clear user with null", () => {
    const user = { id: "1", email: "test@test.com", name: "Test", locale: "en", theme: "light" };
    useAuthStore.getState().setUser(user);
    useAuthStore.getState().setUser(null);
    expect(useAuthStore.getState().user).toBeNull();
  });

  it("setAuthenticated sets token, user, and flags", () => {
    const user = { id: "1", email: "test@test.com", name: "Test", locale: "en", theme: "light" };
    useAuthStore.getState().setAuthenticated("token-123", user);

    const state = useAuthStore.getState();
    expect(setAccessToken).toHaveBeenCalledWith("token-123");
    expect(state.user).toEqual(user);
    expect(state.isAuthenticated).toBe(true);
    expect(state.isLoading).toBe(false);
  });

  it("logout clears state and token", () => {
    const user = { id: "1", email: "test@test.com", name: "Test", locale: "en", theme: "light" };
    useAuthStore.getState().setAuthenticated("token-123", user);
    useAuthStore.getState().logout();

    const state = useAuthStore.getState();
    expect(setAccessToken).toHaveBeenCalledWith(null);
    expect(state.user).toBeNull();
    expect(state.isAuthenticated).toBe(false);
    expect(state.isLoading).toBe(false);
  });

  // REQ-SESSION-037 — proxy 는 `has_session` 힌트 쿠키로 보호 경로를 가른다.
  it("setAuthenticated sets the has_session hint cookie and logout clears it", () => {
    const user = { id: "1", email: "test@test.com", name: "Test", locale: "en", theme: "light" };
    useAuthStore.getState().setAuthenticated("token-123", user);
    expect(document.cookie.split("; ")).toContain("has_session=1");

    useAuthStore.getState().logout();
    expect(document.cookie.split("; ")).not.toContain("has_session=1");
  });

  it("setLoading updates isLoading", () => {
    useAuthStore.getState().setLoading(false);
    expect(useAuthStore.getState().isLoading).toBe(false);
    useAuthStore.getState().setLoading(true);
    expect(useAuthStore.getState().isLoading).toBe(true);
  });
});
