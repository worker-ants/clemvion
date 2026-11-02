import type { ReactNode } from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  render,
  screen,
  fireEvent,
  waitFor,
  within,
} from "@testing-library/react";
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
    revokeOtherSessions: vi.fn(),
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
const revokeOthers = vi.mocked(sessionsApi.revokeOtherSessions);

const SESSION_BASE = {
  deviceLabel: null,
  ipAddress: null,
  lastUsedAt: null,
  createdAt: "2026-11-01T00:00:00.000Z",
  expiresAt: "2026-12-01T00:00:00.000Z",
};

function apiError(status: number, code: string) {
  return {
    isAxiosError: true,
    message: `Request failed with status code ${status}`,
    response: { status, data: { error: { code, message: "m" } } },
  };
}

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
  return within(await screen.findByRole("dialog"));
}

function submit(dialog: ReturnType<typeof within>) {
  fireEvent.click(dialog.getByRole("button", { name: sessions.dialogConfirm }));
}

beforeEach(() => {
  vi.clearAllMocks();
  useAuthStore.getState().setUser(null);
});

// 계정 재인증은 비밀번호가 있으면 비밀번호로 받는다(NERV CLE-ACCT-SESSION REQ-SESSION-025, CLE-T-KTZ9YV).
describe("SessionsPanel 계정 재인증 입력", () => {
  it("TOTP 를 켠 계정도 처음에는 비밀번호를 받는다", async () => {
    const dialog = await openRevokeAllWith(true);
    expect(
      dialog.getByPlaceholderText(sessions.passwordPlaceholder),
    ).toBeInTheDocument();
    expect(
      dialog.queryByPlaceholderText(sessions.totpPlaceholder),
    ).not.toBeInTheDocument();
  });

  it("TOTP 를 켠 계정이 REAUTH_REQUIRED 를 받으면 인증 코드 입력으로 바꾸고 코드를 보낸다", async () => {
    revokeOthers
      .mockRejectedValueOnce(apiError(400, "REAUTH_REQUIRED"))
      .mockResolvedValueOnce([]);
    const dialog = await openRevokeAllWith(true);

    fireEvent.change(dialog.getByPlaceholderText(sessions.passwordPlaceholder), {
      target: { value: "any-password" },
    });
    submit(dialog);

    const code = await dialog.findByPlaceholderText(sessions.totpPlaceholder);
    fireEvent.change(code, { target: { value: "123456" } });
    submit(dialog);

    await waitFor(() => {
      expect(revokeOthers).toHaveBeenLastCalledWith({ totpCode: "123456" });
    });
  });

  it("TOTP 가 꺼진 계정은 REAUTH_REQUIRED 를 받아도 비밀번호 입력을 유지한다", async () => {
    revokeOthers.mockRejectedValueOnce(apiError(400, "REAUTH_REQUIRED"));
    const dialog = await openRevokeAllWith(false);

    fireEvent.change(dialog.getByPlaceholderText(sessions.passwordPlaceholder), {
      target: { value: "any-password" },
    });
    submit(dialog);

    await waitFor(() => expect(revokeOthers).toHaveBeenCalledTimes(1));
    expect(
      dialog.getByPlaceholderText(sessions.passwordPlaceholder),
    ).toBeInTheDocument();
    expect(
      dialog.queryByPlaceholderText(sessions.totpPlaceholder),
    ).not.toBeInTheDocument();
  });
});
