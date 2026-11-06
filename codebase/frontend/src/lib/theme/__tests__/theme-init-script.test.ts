import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { THEME_INIT_SCRIPT } from "../theme-init-script";
import { THEME_STORAGE_KEY, THEMES } from "../theme-constants";
import { useThemeStore } from "@/lib/stores/theme-store";
import { htmlThemeClasses, installMatchMedia, removeMatchMedia } from "./match-media-stub";

/** 브라우저가 `<head>` 에서 실행하듯 스크립트 문자열을 그대로 실행한다. */
function runInitScript() {
  new Function(THEME_INIT_SCRIPT)();
}

function resetDom() {
  window.localStorage.clear();
  document.documentElement.classList.remove("light", "dark");
}

describe("THEME_INIT_SCRIPT", () => {
  beforeEach(() => {
    installMatchMedia(false);
    resetDom();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    useThemeStore.getState().clearPreview();
    useThemeStore.getState().setTheme("light");
    removeMatchMedia();
    resetDom();
  });

  it("기억한 값이 없으면 라이트로 그린다", () => {
    runInitScript();
    expect(htmlThemeClasses()).toEqual(["light"]);
  });

  it("기억한 다크를 첫 화면에 그린다 (REQ-PROFILE-029)", () => {
    window.localStorage.setItem(THEME_STORAGE_KEY, "dark");
    runInitScript();
    expect(htmlThemeClasses()).toEqual(["dark"]);
  });

  it("기억한 system 은 OS 색상 모드로 고른다", () => {
    installMatchMedia(true);
    window.localStorage.setItem(THEME_STORAGE_KEY, "system");
    runInitScript();
    expect(htmlThemeClasses()).toEqual(["dark"]);
  });

  it("잘못된 값은 라이트로 그린다", () => {
    window.localStorage.setItem(THEME_STORAGE_KEY, "</script><script>alert(1)</script>");
    runInitScript();
    expect(htmlThemeClasses()).toEqual(["light"]);
  });

  it("localStorage 를 읽지 못하면 라이트로 그린다", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("SecurityError");
    });
    document.documentElement.classList.add("dark");
    runInitScript();
    expect(htmlThemeClasses()).toEqual(["light"]);
  });

  it("matchMedia 가 없으면 system 을 라이트로 그린다", () => {
    removeMatchMedia();
    window.localStorage.setItem(THEME_STORAGE_KEY, "system");
    runInitScript();
    expect(htmlThemeClasses()).toEqual(["light"]);
  });

  it("스크립트에 닫는 script 태그가 없다", () => {
    expect(THEME_INIT_SCRIPT).not.toMatch(/<\/script/i);
  });

  // 인라인 스크립트는 store 의 적용 규칙을 문자열로 옮긴 것이다. 두 쪽이 갈라지면
  // 새로 고칠 때 첫 화면과 hydrate 뒤 화면이 달라 깜빡인다.
  describe.each([false, true])("store 와 같은 결과 (OS 다크=%s)", (osDark) => {
    it.each([...THEMES, "sepia", null])("기억한 값 %s", (stored) => {
      installMatchMedia(osDark);

      resetDom();
      if (stored !== null) window.localStorage.setItem(THEME_STORAGE_KEY, stored);
      runInitScript();
      const fromScript = htmlThemeClasses();

      resetDom();
      if (stored !== null) window.localStorage.setItem(THEME_STORAGE_KEY, stored);
      useThemeStore.getState().initFromStorage();
      const fromStore = htmlThemeClasses();

      expect(fromScript).toEqual(fromStore);
    });
  });
});
