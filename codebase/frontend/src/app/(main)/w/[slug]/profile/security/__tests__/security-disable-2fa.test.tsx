import type { ReactNode } from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
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
    post: vi.fn().mockResolvedValue({ data: { data: { ok: true } } }),
  },
  setAccessToken: vi.fn(),
}));

vi.mock("@/lib/stores/auth-store", () => {
  const state = { user: { id: "u1", twoFactorEnabled: true } };
  return {
    useAuthStore: (selector: (s: typeof state) => unknown) => selector(state),
  };
});

vi.mock("../passkey-card", () => ({
  PasskeyCard: () => null,
}));

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}));

import { apiClient } from "@/lib/api/client";
import { toast } from "sonner";
import SecurityPage from "../page";

const security = ko.profile.security;

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return render(<SecurityPage />, { wrapper });
}

function fillAndSubmit(password: string, code: string) {
  fireEvent.change(
    screen.getByPlaceholderText(security.accountPasswordPlaceholder),
    { target: { value: password } },
  );
  fireEvent.change(
    screen.getByPlaceholderText(security.disableCodePlaceholder),
    { target: { value: code } },
  );
  fireEvent.click(screen.getByRole("button", { name: security.disableButton }));
}

beforeEach(() => {
  vi.clearAllMocks();
});

// 2FA 비활성화는 비밀번호와 함께 현재 TOTP 코드나 복구 코드를 받는다
// (NERV CLE-ACCT-SIGNIN, CLE-T-75TDTN).
describe("SecurityPage 2FA 비활성화", () => {
  it("비밀번호와 앞뒤 공백을 지운 6자리 코드를 함께 보낸다", async () => {
    renderPage();
    fillAndSubmit("correct-password", " 123456 ");
    await waitFor(() => {
      expect(apiClient.post).toHaveBeenCalledWith("/auth/2fa/disable", {
        password: "correct-password",
        code: "123456",
      });
    });
    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith(security.disableSuccess);
    });
  });

  it("복구 코드는 형식을 바꾸지 않고 그대로 보낸다", async () => {
    renderPage();
    fillAndSubmit("correct-password", "abcd-efgh-ijkl");
    await waitFor(() => {
      expect(apiClient.post).toHaveBeenCalledWith("/auth/2fa/disable", {
        password: "correct-password",
        code: "abcd-efgh-ijkl",
      });
    });
  });

  it("코드가 비어 있으면 요청하지 않고 코드 입력을 안내한다", () => {
    renderPage();
    fillAndSubmit("correct-password", "   ");
    expect(apiClient.post).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledWith(security.disableCodeRequired);
  });

  it("비밀번호가 8자 미만이면 요청하지 않고 비밀번호 입력을 안내한다", () => {
    renderPage();
    fillAndSubmit("short", "123456");
    expect(apiClient.post).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledWith(security.passwordRequired);
  });
});
