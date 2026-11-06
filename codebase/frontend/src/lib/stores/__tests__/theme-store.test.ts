import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { useThemeStore } from "../theme-store";
import { THEME_STORAGE_KEY } from "@/lib/theme/theme-constants";
import {
  htmlThemeClasses,
  installMatchMedia,
  removeMatchMedia,
} from "@/lib/theme/__tests__/match-media-stub";

function resetStore() {
  // 리스너가 남지 않게 라이트로 돌린 뒤 상태를 지운다.
  useThemeStore.getState().clearPreview();
  useThemeStore.getState().setTheme("light");
  useThemeStore.setState({ theme: "light", preview: null });
  window.localStorage.clear();
  document.documentElement.classList.remove("light", "dark");
}

describe("useThemeStore", () => {
  beforeEach(() => {
    installMatchMedia(false);
    resetStore();
  });

  afterEach(() => {
    resetStore();
    removeMatchMedia();
  });

  it("기본값은 라이트다", () => {
    expect(useThemeStore.getState().theme).toBe("light");
    expect(useThemeStore.getState().preview).toBeNull();
  });

  it("setTheme 은 <html> 클래스를 하나만 남기고 localStorage 에 기억한다", () => {
    useThemeStore.getState().setTheme("dark");

    expect(useThemeStore.getState().theme).toBe("dark");
    expect(htmlThemeClasses()).toEqual(["dark"]);
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe("dark");

    useThemeStore.getState().setTheme("light");
    expect(htmlThemeClasses()).toEqual(["light"]);
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe("light");
  });

  it("system 은 OS 가 다크면 다크로 그리고 저장값은 system 으로 기억한다", () => {
    installMatchMedia(true);
    useThemeStore.getState().setTheme("system");

    expect(htmlThemeClasses()).toEqual(["dark"]);
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe("system");
  });

  it("system 이면 OS 색상 모드가 바뀔 때 새로 고치지 않아도 따라 바꾼다 (REQ-PROFILE-023)", () => {
    const media = installMatchMedia(false);
    useThemeStore.getState().setTheme("system");
    expect(htmlThemeClasses()).toEqual(["light"]);

    media.setDark(true);
    expect(htmlThemeClasses()).toEqual(["dark"]);

    media.setDark(false);
    expect(htmlThemeClasses()).toEqual(["light"]);
  });

  it("system 이 아닌 테마로 바꾸면 OS 변경 구독을 끊는다", () => {
    const media = installMatchMedia(false);
    useThemeStore.getState().setTheme("system");
    expect(media.listenerCount()).toBe(1);

    useThemeStore.getState().setTheme("light");
    expect(media.listenerCount()).toBe(0);

    media.setDark(true);
    expect(htmlThemeClasses()).toEqual(["light"]);
  });

  it("system 을 여러 번 적용해도 구독은 하나다", () => {
    const media = installMatchMedia(false);
    useThemeStore.getState().setTheme("system");
    useThemeStore.getState().setTheme("system");
    useThemeStore.getState().initFromStorage();

    expect(media.listenerCount()).toBe(1);
  });

  it("matchMedia 가 없는 환경에서 system 은 라이트로 그린다", () => {
    removeMatchMedia();
    useThemeStore.getState().setTheme("system");

    expect(htmlThemeClasses()).toEqual(["light"]);
  });

  describe("미리보기", () => {
    it("미리보기는 화면만 바꾸고 확정한 테마와 기억한 값은 그대로 둔다", () => {
      useThemeStore.getState().setTheme("light");
      useThemeStore.getState().previewTheme("dark");

      expect(htmlThemeClasses()).toEqual(["dark"]);
      expect(useThemeStore.getState().theme).toBe("light");
      expect(useThemeStore.getState().preview).toBe("dark");
      expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe("light");
    });

    it("clearPreview 는 확정한 테마로 돌린다", () => {
      useThemeStore.getState().setTheme("dark");
      useThemeStore.getState().previewTheme("light");
      useThemeStore.getState().clearPreview();

      expect(htmlThemeClasses()).toEqual(["dark"]);
      expect(useThemeStore.getState().preview).toBeNull();
    });

    it("미리보기 중에 확정한 테마가 바뀌어도 미리보기를 계속 그린다", () => {
      useThemeStore.getState().previewTheme("dark");
      useThemeStore.getState().setTheme("light");

      expect(htmlThemeClasses()).toEqual(["dark"]);

      useThemeStore.getState().clearPreview();
      expect(htmlThemeClasses()).toEqual(["light"]);
    });

    it("system 미리보기도 OS 변경을 따르고 미리보기를 거두면 구독을 끊는다", () => {
      const media = installMatchMedia(false);
      useThemeStore.getState().setTheme("light");
      useThemeStore.getState().previewTheme("system");

      media.setDark(true);
      expect(htmlThemeClasses()).toEqual(["dark"]);

      useThemeStore.getState().clearPreview();
      expect(htmlThemeClasses()).toEqual(["light"]);
      expect(media.listenerCount()).toBe(0);
    });
  });

  describe("initFromStorage", () => {
    it("기억한 테마를 적용하고 상태에 싣는다", () => {
      window.localStorage.setItem(THEME_STORAGE_KEY, "dark");
      useThemeStore.getState().initFromStorage();

      expect(useThemeStore.getState().theme).toBe("dark");
      expect(htmlThemeClasses()).toEqual(["dark"]);
    });

    it("기억한 값이 없거나 잘못되면 라이트로 그린다", () => {
      window.localStorage.setItem(THEME_STORAGE_KEY, "sepia");
      useThemeStore.getState().initFromStorage();

      expect(useThemeStore.getState().theme).toBe("light");
      expect(htmlThemeClasses()).toEqual(["light"]);
    });

    it("기억한 값이 system 이면 OS 변경 구독을 붙인다", () => {
      const media = installMatchMedia(true);
      window.localStorage.setItem(THEME_STORAGE_KEY, "system");
      useThemeStore.getState().initFromStorage();

      expect(htmlThemeClasses()).toEqual(["dark"]);
      media.setDark(false);
      expect(htmlThemeClasses()).toEqual(["light"]);
    });
  });
});
