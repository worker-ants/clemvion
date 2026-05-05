import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useLocaleStore } from "../locale-store";

const STORAGE_KEY = "clemvion.locale";
const COOKIE_KEY = "clemvion.locale";

function resetStore() {
  useLocaleStore.setState({ locale: "ko" });
}

function clearCookies() {
  for (const entry of document.cookie.split(";")) {
    const name = entry.split("=")[0]?.trim();
    if (name) {
      document.cookie = `${name}=; Path=/; Max-Age=0; SameSite=Lax`;
    }
  }
}

function readCookie(name: string): string | null {
  for (const entry of document.cookie.split(";")) {
    const [rawKey, ...rawValue] = entry.split("=");
    if (rawKey?.trim() === name) return rawValue.join("=").trim();
  }
  return null;
}

describe("useLocaleStore", () => {
  beforeEach(() => {
    window.localStorage.clear();
    document.documentElement.lang = "";
    clearCookies();
    resetStore();
  });

  afterEach(() => {
    window.localStorage.clear();
    document.documentElement.lang = "";
    clearCookies();
  });

  it("defaults to Korean", () => {
    expect(useLocaleStore.getState().locale).toBe("ko");
  });

  it("persists locale to localStorage and updates <html lang>", () => {
    useLocaleStore.getState().setLocale("en");

    expect(useLocaleStore.getState().locale).toBe("en");
    expect(window.localStorage.getItem(STORAGE_KEY)).toBe("en");
    expect(document.documentElement.lang).toBe("en");
  });

  it("mirrors locale to a cookie so SSR can read it", () => {
    useLocaleStore.getState().setLocale("en");
    expect(readCookie(COOKIE_KEY)).toBe("en");

    useLocaleStore.getState().setLocale("ko");
    expect(readCookie(COOKIE_KEY)).toBe("ko");
  });

  it("seeds the cookie on initFromStorage so first-session SSR has a value", () => {
    window.localStorage.setItem(STORAGE_KEY, "en");

    useLocaleStore.getState().initFromStorage();

    expect(readCookie(COOKIE_KEY)).toBe("en");
  });

  it("swallows localStorage write errors (e.g. private mode / quota)", () => {
    const spy = vi
      .spyOn(Storage.prototype, "setItem")
      .mockImplementationOnce(() => {
        throw new Error("QuotaExceededError");
      });

    expect(() => useLocaleStore.getState().setLocale("en")).not.toThrow();
    // State and DOM should still flip even if persistence failed.
    expect(useLocaleStore.getState().locale).toBe("en");
    expect(document.documentElement.lang).toBe("en");

    spy.mockRestore();
  });

  it("reads a previously stored locale on init", () => {
    window.localStorage.setItem(STORAGE_KEY, "en");

    useLocaleStore.getState().initFromStorage();

    expect(useLocaleStore.getState().locale).toBe("en");
    expect(document.documentElement.lang).toBe("en");
  });

  it("falls back to the default when stored value is invalid", () => {
    window.localStorage.setItem(STORAGE_KEY, "jp");

    useLocaleStore.getState().initFromStorage();

    expect(useLocaleStore.getState().locale).toBe("ko");
    expect(document.documentElement.lang).toBe("ko");
  });

  it("falls back to the default when nothing is stored", () => {
    useLocaleStore.getState().initFromStorage();

    expect(useLocaleStore.getState().locale).toBe("ko");
    expect(document.documentElement.lang).toBe("ko");
  });

  it("notifies subscribers on locale change", () => {
    const observed: string[] = [];
    const unsubscribe = useLocaleStore.subscribe((state) =>
      observed.push(state.locale),
    );

    useLocaleStore.getState().setLocale("en");
    useLocaleStore.getState().setLocale("ko");

    unsubscribe();
    expect(observed).toEqual(["en", "ko"]);
  });
});
