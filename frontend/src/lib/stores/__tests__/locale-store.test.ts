import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useLocaleStore } from "../locale-store";

const STORAGE_KEY = "idea-workflow.locale";

function resetStore() {
  useLocaleStore.setState({ locale: "ko" });
}

describe("useLocaleStore", () => {
  beforeEach(() => {
    window.localStorage.clear();
    document.documentElement.lang = "";
    resetStore();
  });

  afterEach(() => {
    window.localStorage.clear();
    document.documentElement.lang = "";
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
