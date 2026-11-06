import { act, cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ThemeSync } from "../theme-sync";
import { THEME_STORAGE_KEY } from "../theme-constants";
import { useAuthStore } from "@/lib/stores/auth-store";
import { useThemeStore } from "@/lib/stores/theme-store";
import { htmlThemeClasses, installMatchMedia, removeMatchMedia } from "./match-media-stub";

function signIn(theme: string) {
  useAuthStore.setState({
    user: {
      id: "1",
      email: "a@b.c",
      name: "A",
      locale: "ko",
      theme,
      twoFactorEnabled: false,
    },
    isAuthenticated: true,
    isLoading: false,
  });
}

function resetAll() {
  useAuthStore.setState({ user: null, isAuthenticated: false, isLoading: false });
  useThemeStore.getState().clearPreview();
  useThemeStore.getState().setTheme("light");
  window.localStorage.clear();
  document.documentElement.classList.remove("light", "dark");
}

describe("ThemeSync", () => {
  beforeEach(() => {
    installMatchMedia(false);
    resetAll();
  });

  afterEach(() => {
    cleanup();
    resetAll();
    removeMatchMedia();
  });

  it("사용자 정보가 없으면 이 브라우저에 기억한 테마를 쓴다", () => {
    window.localStorage.setItem(THEME_STORAGE_KEY, "dark");
    render(<ThemeSync />);

    expect(useThemeStore.getState().theme).toBe("dark");
    expect(htmlThemeClasses()).toEqual(["dark"]);
  });

  it("로그인한 사용자의 저장 테마를 앱 전체에 적용하고 기억한다 (REQ-PROFILE-028)", () => {
    render(<ThemeSync />);
    act(() => signIn("dark"));

    expect(useThemeStore.getState().theme).toBe("dark");
    expect(htmlThemeClasses()).toEqual(["dark"]);
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe("dark");
  });

  it("사용자 정보의 테마가 기억한 값보다 앞선다", () => {
    window.localStorage.setItem(THEME_STORAGE_KEY, "dark");
    signIn("light");
    render(<ThemeSync />);

    expect(htmlThemeClasses()).toEqual(["light"]);
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe("light");
  });

  it("system 사용자는 OS 색상 모드 변경을 바로 따른다", () => {
    const media = installMatchMedia(false);
    signIn("system");
    render(<ThemeSync />);
    expect(htmlThemeClasses()).toEqual(["light"]);

    act(() => media.setDark(true));
    expect(htmlThemeClasses()).toEqual(["dark"]);
  });

  it("로그아웃해도 마지막으로 확정한 테마를 지우지 않는다", () => {
    signIn("dark");
    render(<ThemeSync />);
    act(() => useAuthStore.getState().logout());

    expect(htmlThemeClasses()).toEqual(["dark"]);
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe("dark");
  });

  it("알 수 없는 저장값이면 기억한 테마를 쓴다", () => {
    window.localStorage.setItem(THEME_STORAGE_KEY, "dark");
    signIn("sepia");
    render(<ThemeSync />);

    expect(htmlThemeClasses()).toEqual(["dark"]);
  });
});
