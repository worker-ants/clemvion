import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const { setThemeStoreMock, setLocaleStoreMock } = vi.hoisted(() => ({
  setThemeStoreMock: vi.fn(),
  setLocaleStoreMock: vi.fn(),
}));

vi.mock("@/lib/api/client", () => ({
  apiClient: {
    patch: vi.fn().mockResolvedValue({ data: {} }),
  },
}));

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}));

vi.mock("@/lib/stores/theme-store", () => {
  const state = { theme: "light" as const, setTheme: setThemeStoreMock };
  function useThemeStore<T>(selector?: (s: typeof state) => T): T {
    return (selector ? selector(state) : state) as T;
  }
  useThemeStore.getState = () => state;
  useThemeStore.subscribe = () => () => {};
  return { useThemeStore };
});

vi.mock("@/lib/stores/locale-store", () => {
  const state = { locale: "ko" as const, setLocale: setLocaleStoreMock };
  function useLocaleStore<T>(selector?: (s: typeof state) => T): T {
    return (selector ? selector(state) : state) as T;
  }
  useLocaleStore.getState = () => state;
  useLocaleStore.subscribe = () => () => {};
  return { useLocaleStore };
});

import { apiClient } from "@/lib/api/client";
import { toast } from "sonner";
import { ProfilePreferencesCard } from "../profile-preferences-card";

function renderCard(
  user: { locale: "ko" | "en"; theme: "light" | "dark" } = {
    locale: "ko",
    theme: "light",
  },
) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={qc}>
      <ProfilePreferencesCard user={user} />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("ProfilePreferencesCard", () => {
  it("renders readonly view with current theme/locale labels", () => {
    renderCard({ locale: "ko", theme: "light" });
    expect(screen.getByTestId("pref-theme-readonly")).toHaveTextContent(/라이트|light/i);
    expect(screen.getByTestId("pref-language-readonly")).toHaveTextContent(/한국어|korean/i);
    expect(screen.getByTestId("profile-pref-edit")).toBeInTheDocument();
  });

  it("clicking [편집] reveals theme buttons and language select", () => {
    renderCard();
    fireEvent.click(screen.getByTestId("profile-pref-edit"));
    expect(screen.getByTestId("pref-theme-light")).toBeInTheDocument();
    expect(screen.getByTestId("pref-theme-dark")).toBeInTheDocument();
    expect(screen.getByTestId("pref-language-select")).toBeInTheDocument();
  });

  it("dark 클릭 시 라이브 프리뷰로 setThemeStore 가 호출된다", () => {
    renderCard({ locale: "ko", theme: "light" });
    fireEvent.click(screen.getByTestId("profile-pref-edit"));
    fireEvent.click(screen.getByTestId("pref-theme-dark"));
    expect(setThemeStoreMock).toHaveBeenCalledWith("dark");
  });

  it("[취소] 시 theme store 가 user.theme 으로 원복되고 view 모드로 돌아간다", () => {
    renderCard({ locale: "ko", theme: "light" });
    fireEvent.click(screen.getByTestId("profile-pref-edit"));
    fireEvent.click(screen.getByTestId("pref-theme-dark"));
    setThemeStoreMock.mockClear();
    fireEvent.click(screen.getByTestId("profile-pref-cancel"));
    expect(setThemeStoreMock).toHaveBeenLastCalledWith("light");
    expect(screen.queryByTestId("pref-theme-dark")).toBeNull();
  });

  it("변경 없이 [저장] 시 noChanges 토스트 후 view 복귀", () => {
    renderCard();
    fireEvent.click(screen.getByTestId("profile-pref-edit"));
    fireEvent.click(screen.getByTestId("profile-pref-save"));
    expect(toast.info).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId("pref-theme-dark")).toBeNull();
  });

  it("변경 후 [저장] → diff 모달 → [확정] 시 PATCH /users/me 가 dirty 항목만 보낸다", async () => {
    renderCard({ locale: "ko", theme: "light" });
    fireEvent.click(screen.getByTestId("profile-pref-edit"));
    fireEvent.click(screen.getByTestId("pref-theme-dark"));
    fireEvent.click(screen.getByTestId("profile-pref-save"));
    expect(screen.getByTestId("diff-after-테마")).toBeInTheDocument();
    fireEvent.click(
      screen.getAllByRole("button", { name: /저장|save/i })[1] ??
        screen.getByRole("button", { name: /저장|save/i }),
    );
    await waitFor(() => {
      expect(apiClient.patch).toHaveBeenCalledWith("/users/me", { theme: "dark" });
    });
    await waitFor(() => {
      expect(toast.success).toHaveBeenCalled();
    });
  });
});
