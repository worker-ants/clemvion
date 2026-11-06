import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const {
  setThemeStoreMock,
  previewThemeMock,
  clearPreviewMock,
  setLocaleStoreMock,
} = vi.hoisted(() => ({
  setThemeStoreMock: vi.fn(),
  previewThemeMock: vi.fn(),
  clearPreviewMock: vi.fn(),
  setLocaleStoreMock: vi.fn(),
}));

vi.mock("@/lib/i18n", async () => {
  const { ko } = await import("@/lib/i18n/dict/ko");
  const tFromKo = (key: string): string => {
    const parts = key.split(".");
    let cur: unknown = ko;
    for (const p of parts) {
      if (!cur || typeof cur !== "object") return key;
      cur = (cur as Record<string, unknown>)[p];
    }
    return typeof cur === "string" ? cur : key;
  };
  return { useT: () => tFromKo, useLocale: () => "ko" as const };
});

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
  const state = {
    theme: "light" as const,
    preview: null,
    setTheme: setThemeStoreMock,
    previewTheme: previewThemeMock,
    clearPreview: clearPreviewMock,
  };
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
    expect(screen.getByTestId("pref-theme-readonly")).toHaveTextContent(
      /라이트|light/i,
    );
    expect(screen.getByTestId("pref-language-readonly")).toHaveTextContent(
      /한국어|korean/i,
    );
    expect(screen.getByTestId("profile-pref-edit")).toBeInTheDocument();
  });

  it("clicking [편집] reveals theme buttons and language select", () => {
    renderCard();
    fireEvent.click(screen.getByTestId("profile-pref-edit"));
    expect(screen.getByTestId("pref-theme-light")).toBeInTheDocument();
    expect(screen.getByTestId("pref-theme-dark")).toBeInTheDocument();
    expect(screen.getByTestId("pref-language-select")).toBeInTheDocument();
  });

  it("dark 클릭은 미리보기만 하고 확정한 테마는 바꾸지 않는다", () => {
    renderCard({ locale: "ko", theme: "light" });
    fireEvent.click(screen.getByTestId("profile-pref-edit"));
    fireEvent.click(screen.getByTestId("pref-theme-dark"));
    expect(previewThemeMock).toHaveBeenCalledWith("dark");
    expect(setThemeStoreMock).not.toHaveBeenCalled();
  });

  it("[취소] 시 미리보기를 거두고 view 모드로 돌아간다", () => {
    renderCard({ locale: "ko", theme: "light" });
    fireEvent.click(screen.getByTestId("profile-pref-edit"));
    fireEvent.click(screen.getByTestId("pref-theme-dark"));
    clearPreviewMock.mockClear();
    fireEvent.click(screen.getByTestId("profile-pref-cancel"));
    expect(clearPreviewMock).toHaveBeenCalled();
    expect(setThemeStoreMock).not.toHaveBeenCalled();
    expect(screen.queryByTestId("pref-theme-dark")).toBeNull();
  });

  it("diff 모달 [취소] 시에도 미리보기를 거둔다", () => {
    renderCard({ locale: "ko", theme: "light" });
    fireEvent.click(screen.getByTestId("profile-pref-edit"));
    fireEvent.click(screen.getByTestId("pref-theme-dark"));
    fireEvent.click(screen.getByTestId("profile-pref-save"));
    clearPreviewMock.mockClear();
    fireEvent.click(screen.getByTestId("diff-cancel"));
    expect(clearPreviewMock).toHaveBeenCalled();
    expect(setThemeStoreMock).not.toHaveBeenCalled();
  });

  it("편집 중에 화면을 떠나면 미리보기를 거둔다", () => {
    const { unmount } = renderCard({ locale: "ko", theme: "light" });
    fireEvent.click(screen.getByTestId("profile-pref-edit"));
    fireEvent.click(screen.getByTestId("pref-theme-dark"));
    clearPreviewMock.mockClear();
    unmount();
    expect(clearPreviewMock).toHaveBeenCalled();
  });

  it("변경 없이 [저장] 시 noChanges 토스트 후 view 복귀", () => {
    renderCard();
    fireEvent.click(screen.getByTestId("profile-pref-edit"));
    fireEvent.click(screen.getByTestId("profile-pref-save"));
    expect(toast.info).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId("pref-theme-dark")).toBeNull();
  });

  it("변경 후 [저장] → diff → [확정] 시 PATCH /users/me 가 dirty 항목만 보낸다", async () => {
    renderCard({ locale: "ko", theme: "light" });
    fireEvent.click(screen.getByTestId("profile-pref-edit"));
    fireEvent.click(screen.getByTestId("pref-theme-dark"));
    fireEvent.click(screen.getByTestId("profile-pref-save"));
    expect(screen.getByTestId("diff-after-테마")).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("diff-confirm"));
    await waitFor(() => {
      expect(apiClient.patch).toHaveBeenCalledWith("/users/me", {
        theme: "dark",
      });
      expect(toast.success).toHaveBeenCalled();
    });
    // 저장해야 확정한 테마(와 이 브라우저에 기억한 값)가 바뀌고 미리보기를 거둔다.
    expect(setThemeStoreMock).toHaveBeenCalledWith("dark");
    expect(clearPreviewMock).toHaveBeenCalled();
  });

  it("locale 변경 → 확정 시 setLocaleStore 가 새 locale 로 호출된다", async () => {
    renderCard({ locale: "ko", theme: "light" });
    fireEvent.click(screen.getByTestId("profile-pref-edit"));
    fireEvent.change(screen.getByTestId("pref-language-select"), {
      target: { value: "en" },
    });
    fireEvent.click(screen.getByTestId("profile-pref-save"));
    fireEvent.click(screen.getByTestId("diff-confirm"));
    await waitFor(() => {
      expect(apiClient.patch).toHaveBeenCalledWith("/users/me", {
        locale: "en",
      });
      expect(setLocaleStoreMock).toHaveBeenCalledWith("en");
    });
  });

  it("PATCH 실패 시 error 토스트 후 편집 모드 유지", async () => {
    (apiClient.patch as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new Error("oops"),
    );
    renderCard({ locale: "ko", theme: "light" });
    fireEvent.click(screen.getByTestId("profile-pref-edit"));
    fireEvent.click(screen.getByTestId("pref-theme-dark"));
    fireEvent.click(screen.getByTestId("profile-pref-save"));
    fireEvent.click(screen.getByTestId("diff-confirm"));
    await waitFor(() => {
      expect(toast.error).toHaveBeenCalled();
    });
    expect(screen.getByTestId("pref-theme-dark")).toBeInTheDocument();
  });
});
