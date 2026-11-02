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

import { toast } from "sonner";
import { sessionsApi } from "@/lib/api/sessions";
import { useAuthStore } from "@/lib/stores/auth-store";
import { SessionsPanel } from "../sessions-panel";

const sessions = ko.profile.sessions;
const revokeOthers = vi.mocked(sessionsApi.revokeOtherSessions);
const revokeOne = vi.mocked(sessionsApi.revokeSession);

const SESSION_BASE = {
  deviceLabel: null,
  ipAddress: null,
  lastUsedAt: null,
  createdAt: "2026-11-01T00:00:00.000Z",
  expiresAt: "2026-12-01T00:00:00.000Z",
};

const SESSION_LIST = [
  { ...SESSION_BASE, familyId: "current", isCurrent: true },
  { ...SESSION_BASE, familyId: "other", isCurrent: false },
];

function apiError(status: number, code: string) {
  return {
    isAxiosError: true,
    message: `Request failed with status code ${status}`,
    response: { status, data: { error: { code, message: "m" } } },
  };
}

async function openRevokeWith(
  twoFactorEnabled: boolean,
  scope: "all" | "single" = "all",
) {
  useAuthStore.getState().setUser({
    id: "u1",
    email: "user@example.com",
    name: "User",
    locale: "ko",
    theme: "light",
    twoFactorEnabled,
  });
  vi.mocked(sessionsApi.listSessions).mockResolvedValue(SESSION_LIST);

  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  render(<SessionsPanel />, { wrapper });
  fireEvent.click(
    await screen.findByRole("button", {
      name: scope === "all" ? sessions.revokeAllOthers : sessions.revoke,
    }),
  );
  return within(await screen.findByRole("dialog"));
}

function submit(dialog: ReturnType<typeof within>) {
  fireEvent.click(dialog.getByRole("button", { name: sessions.dialogConfirm }));
}

// 실패한 요청의 후처리(모드 전환 · toast · 인라인 오류)가 모두 지나간 뒤에 돌아온다.
// 모드를 바꾸지 않았다는 부정 단언은 이 뒤에 걸어야 상태 갱신 전에 통과하지 않는다.
async function submitAndSettle(dialog: ReturnType<typeof within>) {
  submit(dialog);
  await waitFor(() => expect(toast.error).toHaveBeenCalled());
  await dialog.findByRole("alert");
}

function typePassword(dialog: ReturnType<typeof within>) {
  fireEvent.change(dialog.getByPlaceholderText(sessions.passwordPlaceholder), {
    target: { value: "any-password" },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  useAuthStore.getState().setUser(null);
});

// 계정 재인증은 비밀번호가 있으면 비밀번호로 받는다(NERV CLE-ACCT-SESSION REQ-SESSION-025, CLE-T-KTZ9YV).
describe("SessionsPanel 계정 재인증 입력", () => {
  it("TOTP 를 켠 계정도 처음에는 비밀번호를 받는다", async () => {
    const dialog = await openRevokeWith(true);
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
    const dialog = await openRevokeWith(true);

    typePassword(dialog);
    submit(dialog);

    const code = await dialog.findByPlaceholderText(sessions.totpPlaceholder);
    fireEvent.change(code, { target: { value: "123456" } });
    submit(dialog);

    await waitFor(() => expect(revokeOthers).toHaveBeenCalledTimes(2));
    expect(revokeOthers).toHaveBeenNthCalledWith(1, { password: "any-password" });
    expect(revokeOthers).toHaveBeenNthCalledWith(2, { totpCode: "123456" });
  });

  it("인증 코드로 끊은 뒤 다시 열면 비밀번호부터 받는다", async () => {
    revokeOthers
      .mockRejectedValueOnce(apiError(400, "REAUTH_REQUIRED"))
      .mockResolvedValueOnce(SESSION_LIST);
    const dialog = await openRevokeWith(true);

    typePassword(dialog);
    submit(dialog);
    const code = await dialog.findByPlaceholderText(sessions.totpPlaceholder);
    fireEvent.change(code, { target: { value: "123456" } });
    submit(dialog);
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());

    fireEvent.click(
      await screen.findByRole("button", { name: sessions.revokeAllOthers }),
    );
    const reopened = within(await screen.findByRole("dialog"));
    expect(
      reopened.getByPlaceholderText(sessions.passwordPlaceholder),
    ).toBeInTheDocument();
    expect(
      reopened.queryByPlaceholderText(sessions.totpPlaceholder),
    ).not.toBeInTheDocument();
  });

  it("선택한 세션 하나를 끊을 때도 같은 순서로 비밀번호 다음 인증 코드를 보낸다", async () => {
    revokeOne
      .mockRejectedValueOnce(apiError(400, "REAUTH_REQUIRED"))
      .mockResolvedValueOnce([]);
    const dialog = await openRevokeWith(true, "single");

    typePassword(dialog);
    submit(dialog);

    const code = await dialog.findByPlaceholderText(sessions.totpPlaceholder);
    fireEvent.change(code, { target: { value: "123456" } });
    submit(dialog);

    await waitFor(() => expect(revokeOne).toHaveBeenCalledTimes(2));
    expect(revokeOne).toHaveBeenNthCalledWith(1, "other", {
      password: "any-password",
    });
    expect(revokeOne).toHaveBeenNthCalledWith(2, "other", { totpCode: "123456" });
    expect(revokeOthers).not.toHaveBeenCalled();
  });

  it("TOTP 가 꺼진 계정은 REAUTH_REQUIRED 를 받아도 비밀번호 입력을 유지한다", async () => {
    revokeOthers.mockRejectedValueOnce(apiError(400, "REAUTH_REQUIRED"));
    const dialog = await openRevokeWith(false);

    typePassword(dialog);
    await submitAndSettle(dialog);

    expect(revokeOthers).toHaveBeenCalledTimes(1);
    expect(
      dialog.getByPlaceholderText(sessions.passwordPlaceholder),
    ).toBeInTheDocument();
    expect(
      dialog.queryByPlaceholderText(sessions.totpPlaceholder),
    ).not.toBeInTheDocument();
  });

  // 비밀번호가 있는 TOTP 계정이 비밀번호를 틀렸을 때(401)나 다른 400 을 받았을 때 인증 코드 입력으로
  // 바뀌면, 비밀번호를 다시 입력할 수 없게 된다.
  it.each([
    [401, "PASSWORD_INVALID"],
    [400, "VALIDATION_ERROR"],
    [401, "REAUTH_REQUIRED"],
  ])(
    "TOTP 를 켠 계정이 %i %s 를 받으면 비밀번호 입력을 유지한다",
    async (status, errorCode) => {
      revokeOthers.mockRejectedValueOnce(apiError(status, errorCode));
      const dialog = await openRevokeWith(true);

      typePassword(dialog);
      await submitAndSettle(dialog);

      expect(revokeOthers).toHaveBeenCalledTimes(1);
      expect(
        dialog.getByPlaceholderText(sessions.passwordPlaceholder),
      ).toBeInTheDocument();
      expect(
        dialog.queryByPlaceholderText(sessions.totpPlaceholder),
      ).not.toBeInTheDocument();
    },
  );

  it("REAUTH_NOT_AVAILABLE 를 받으면 입력 없이 재인증 불가 안내로 바꾼다", async () => {
    revokeOthers.mockRejectedValueOnce(apiError(403, "REAUTH_NOT_AVAILABLE"));
    const dialog = await openRevokeWith(true);

    typePassword(dialog);
    await submitAndSettle(dialog);

    expect(dialog.getByText(sessions.dialogReauthUnavailable)).toBeInTheDocument();
    expect(
      dialog.queryByPlaceholderText(sessions.passwordPlaceholder),
    ).not.toBeInTheDocument();
    expect(
      dialog.queryByPlaceholderText(sessions.totpPlaceholder),
    ).not.toBeInTheDocument();
    expect(
      dialog.getByRole("button", { name: sessions.dialogConfirm }),
    ).toBeDisabled();
  });
});
