import type { ReactNode } from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
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
  apiClient: { get: vi.fn(), post: vi.fn() },
  setAccessToken: vi.fn(),
}));

vi.mock("@/lib/api/sessions", () => ({
  sessionsApi: {
    listSessions: vi.fn(),
    revokeSession: vi.fn(),
    revokeOthers: vi.fn(),
  },
}));

vi.mock("../components/login-history-list", () => ({
  LoginHistoryList: () => null,
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

import { sessionsApi } from "@/lib/api/sessions";
import { useAuthStore } from "@/lib/stores/auth-store";
import { SessionsPanel } from "../sessions-panel";

const sessions = ko.profile.sessions;

const SESSION_BASE = {
  deviceLabel: null,
  ipAddress: null,
  lastUsedAt: null,
  createdAt: "2026-11-01T00:00:00.000Z",
  expiresAt: "2026-12-01T00:00:00.000Z",
};

async function openRevokeAllWith(twoFactorEnabled: boolean) {
  useAuthStore.getState().setUser({
    id: "u1",
    email: "user@example.com",
    name: "User",
    locale: "ko",
    theme: "light",
    twoFactorEnabled,
  });
  vi.mocked(sessionsApi.listSessions).mockResolvedValue([
    { ...SESSION_BASE, familyId: "current", isCurrent: true },
    { ...SESSION_BASE, familyId: "other", isCurrent: false },
  ]);

  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  render(<SessionsPanel />, { wrapper });
  fireEvent.click(
    await screen.findByRole("button", { name: sessions.revokeAllOthers }),
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  useAuthStore.getState().setUser(null);
});

// 계정 재인증 입력은 `/users/me` 의 twoFactorEnabled 로 고른다(NERV CLE-ACCT-PROFILE REQ-PROFILE-027, CLE-T-KTZ9YV).
describe("SessionsPanel 계정 재인증 입력", () => {
  it("TOTP 가 켜진 계정은 인증 코드를 받는다", async () => {
    await openRevokeAllWith(true);
    expect(
      await screen.findByPlaceholderText(sessions.totpPlaceholder),
    ).toBeInTheDocument();
    expect(
      screen.queryByPlaceholderText(sessions.passwordPlaceholder),
    ).not.toBeInTheDocument();
  });

  it("TOTP 가 꺼진 계정은 비밀번호를 받는다", async () => {
    await openRevokeAllWith(false);
    expect(
      await screen.findByPlaceholderText(sessions.passwordPlaceholder),
    ).toBeInTheDocument();
    expect(
      screen.queryByPlaceholderText(sessions.totpPlaceholder),
    ).not.toBeInTheDocument();
  });
});
