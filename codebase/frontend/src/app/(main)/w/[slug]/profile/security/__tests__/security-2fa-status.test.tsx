import type { ReactNode } from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ko } from "@/lib/i18n/dict/ko";

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
    get: vi.fn(),
    post: vi.fn(),
  },
  setAccessToken: vi.fn(),
}));

vi.mock("../passkey-card", () => ({
  PasskeyCard: () => null,
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

import { apiClient } from "@/lib/api/client";
import { usersApi, type UserProfile } from "@/lib/api/users";
import { useAuthStore } from "@/lib/stores/auth-store";
import SecurityPage from "../page";

const security = ko.profile.security;

/** `GET /api/users/me` 응답의 `data` 모양 그대로다. */
function serverProfile(twoFactorEnabled: boolean): UserProfile {
  return {
    id: "u1",
    email: "user@example.com",
    name: "User",
    locale: "ko",
    theme: "light",
    twoFactorEnabled,
    pendingEmail: null,
  };
}

/** 앱이 로그인 · 새로 고침 때 하는 것처럼 `/users/me` 응답으로 실제 store 를 채운 뒤 화면을 그린다. */
async function renderWithServerProfile(twoFactorEnabled: boolean) {
  vi.mocked(apiClient.get).mockResolvedValue({
    data: { data: serverProfile(twoFactorEnabled) },
  });
  useAuthStore.getState().setUser((await usersApi.getMe()).data.data);

  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return render(<SecurityPage />, { wrapper });
}

beforeEach(() => {
  vi.clearAllMocks();
  useAuthStore.getState().setUser(null);
});

// 화면은 `/users/me` 의 twoFactorEnabled 로 TOTP 카드를 고른다(NERV CLE-ACCT-PROFILE REQ-PROFILE-027, CLE-T-KTZ9YV).
describe("SecurityPage TOTP 켜짐 여부", () => {
  it("켜진 계정은 설정 카드 대신 끄기 폼을 보여 준다", async () => {
    await renderWithServerProfile(true);
    expect(
      screen.getByRole("button", { name: security.disableButton }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: security.startSetup }),
    ).not.toBeInTheDocument();
  });

  it("꺼진 계정은 설정 카드를 보여 주고 끄기 폼은 없다", async () => {
    await renderWithServerProfile(false);
    expect(
      screen.getByRole("button", { name: security.startSetup }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: security.disableButton }),
    ).not.toBeInTheDocument();
  });
});
