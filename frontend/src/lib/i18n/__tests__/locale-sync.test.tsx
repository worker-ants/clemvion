import { act, cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { LocaleSync } from "../locale-sync";
import { useAuthStore } from "@/lib/stores/auth-store";
import { useLocaleStore } from "@/lib/stores/locale-store";

function resetStores() {
  useLocaleStore.setState({ locale: "ko" });
  useAuthStore.setState({ user: null, isAuthenticated: false, isLoading: false });
}

function setUser(locale: string) {
  useAuthStore.setState({
    user: {
      id: "1",
      email: "a@b.c",
      name: "A",
      locale,
      theme: "light",
    },
    isAuthenticated: true,
    isLoading: false,
  });
}

describe("LocaleSync", () => {
  beforeEach(() => {
    window.localStorage.clear();
    document.documentElement.lang = "";
    resetStores();
  });

  afterEach(() => {
    cleanup();
    window.localStorage.clear();
    document.documentElement.lang = "";
    resetStores();
  });

  it("initializes from localStorage on mount and mirrors lang onto <html>", () => {
    window.localStorage.setItem("idea-workflow.locale", "en");

    render(<LocaleSync />);

    expect(useLocaleStore.getState().locale).toBe("en");
    expect(document.documentElement.lang).toBe("en");
  });

  it("syncs to the user's locale when the auth store is populated", () => {
    render(<LocaleSync />);

    act(() => {
      setUser("en");
    });

    expect(useLocaleStore.getState().locale).toBe("en");
    expect(document.documentElement.lang).toBe("en");
  });

  it("ignores unknown locale values on the user object and falls back to storage", () => {
    window.localStorage.setItem("idea-workflow.locale", "en");
    render(<LocaleSync />);

    act(() => {
      setUser("jp");
    });

    // Unknown value is rejected → we reuse the previously stored en.
    expect(useLocaleStore.getState().locale).toBe("en");
  });

  it("flips locale when the signed-in user switches their profile language", () => {
    render(<LocaleSync />);

    act(() => {
      setUser("en");
    });
    expect(useLocaleStore.getState().locale).toBe("en");

    act(() => {
      setUser("ko");
    });
    expect(useLocaleStore.getState().locale).toBe("ko");
    expect(document.documentElement.lang).toBe("ko");
  });

  it("keeps the last known locale on logout (user → null)", () => {
    render(<LocaleSync />);

    act(() => {
      setUser("en");
    });
    expect(useLocaleStore.getState().locale).toBe("en");

    act(() => {
      useAuthStore.setState({ user: null, isAuthenticated: false, isLoading: false });
    });

    // Logout falls back to storage; we wrote "en" when the user signed in,
    // so the previous UI language stays until a new user overrides it.
    expect(useLocaleStore.getState().locale).toBe("en");
  });

  it("prefers the user.locale over a different localStorage value", () => {
    window.localStorage.setItem("idea-workflow.locale", "ko");

    render(<LocaleSync />);
    act(() => {
      setUser("en");
    });

    expect(useLocaleStore.getState().locale).toBe("en");
  });
});
