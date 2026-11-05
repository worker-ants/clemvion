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
    post: vi.fn(),
    get: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
  setAccessToken: vi.fn(),
}));

const mockStartRegistration = vi.hoisted(() => vi.fn());

vi.mock("@simplewebauthn/browser", () => ({
  browserSupportsWebAuthn: () => true,
  startRegistration: (...args: unknown[]) => mockStartRegistration(...args),
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
import { PasskeyCard } from "../passkey-card";

const security = ko.profile.security;
const webauthn = security.webauthn;
const post = vi.mocked(apiClient.post);
const get = vi.mocked(apiClient.get);

const PASSWORD = "P@ssw0rd!1";
const OPTIONS_OK = {
  data: { data: { publicKey: { challenge: "c" }, optionsToken: "opt-token" } },
};
const VERIFY_OK = {
  data: { data: { credentialId: "cred-1", webauthnRecoveryCodes: null } },
};
const CREDENTIAL = {
  id: "cred-1",
  deviceName: "회사 노트북",
  transports: [],
  lastUsedAt: null,
  createdAt: "2026-11-01T00:00:00.000Z",
};

function apiError(status: number, code: string) {
  return {
    isAxiosError: true,
    message: `Request failed with status code ${status}`,
    response: { status, data: { error: { code, message: "m" } } },
  };
}

function serveCredentials(items: (typeof CREDENTIAL)[]) {
  get.mockImplementation(async (url: string) => {
    if (url === "/auth/2fa/webauthn/availability") {
      return { data: { data: { enabled: true } } };
    }
    if (url === "/auth/2fa/webauthn/credentials") {
      return { data: { data: { items } } };
    }
    throw new Error(`unexpected GET ${url}`);
  });
}

function renderCard() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return render(<PasskeyCard />, { wrapper });
}

async function submitRegister(password: string, deviceName = "") {
  const passwordInput = await screen.findByLabelText(
    webauthn.registerPasswordLabel,
  );
  fireEvent.change(screen.getByLabelText(webauthn.deviceNameLabel), {
    target: { value: deviceName },
  });
  fireEvent.change(passwordInput, { target: { value: password } });
  fireEvent.click(
    screen.getByRole("button", { name: webauthn.registerButton }),
  );
}

async function submitRegen(password: string) {
  const input = await screen.findByLabelText(webauthn.regenLabel);
  fireEvent.change(input, { target: { value: password } });
  fireEvent.click(screen.getByRole("button", { name: webauthn.regenButton }));
}

beforeEach(() => {
  vi.clearAllMocks();
  serveCredentials([]);
  mockStartRegistration.mockResolvedValue({ id: "attestation" });
});

// Passkey 등록 옵션은 계정 비밀번호를 다시 확인한다(NERV CLE-ACCT-SIGNIN REQ-SIGNIN-080, CLE-T-FRCRF7).
describe("PasskeyCard 등록", () => {
  it("등록 옵션 요청에 입력한 비밀번호를 싣는다", async () => {
    post.mockResolvedValueOnce(OPTIONS_OK).mockResolvedValueOnce(VERIFY_OK);
    renderCard();
    await submitRegister(PASSWORD, "회사 노트북");

    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith(webauthn.registerSuccess);
    });
    expect(post).toHaveBeenNthCalledWith(
      1,
      "/auth/2fa/webauthn/register/options",
      { password: PASSWORD },
    );
    expect(mockStartRegistration).toHaveBeenCalledWith({
      optionsJSON: { challenge: "c" },
    });
    expect(post).toHaveBeenNthCalledWith(
      2,
      "/auth/2fa/webauthn/register/verify",
      {
        optionsToken: "opt-token",
        response: { id: "attestation" },
        deviceName: "회사 노트북",
      },
    );
  });

  it("등록에 성공하면 입력한 비밀번호를 화면에 남기지 않는다", async () => {
    post.mockResolvedValueOnce(OPTIONS_OK).mockResolvedValueOnce(VERIFY_OK);
    renderCard();
    await submitRegister(PASSWORD);

    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith(webauthn.registerSuccess);
    });
    const input = screen.getByLabelText(
      webauthn.registerPasswordLabel,
    ) as HTMLInputElement;
    expect(input.value).toBe("");
  });

  it("비밀번호가 8자보다 짧으면 등록 옵션을 요청하지 않고 비밀번호를 입력하라고 안내한다", async () => {
    renderCard();
    await submitRegister("short");

    expect(toast.error).toHaveBeenCalledWith(security.passwordRequired);
    expect(post).not.toHaveBeenCalled();
    expect(mockStartRegistration).not.toHaveBeenCalled();
  });

  it.each([
    ["PASSWORD_INVALID", security.passwordInvalid],
    ["PASSWORD_REQUIRED", security.passwordNotSet],
  ])(
    "등록 옵션이 401 %s 면 그 이유를 안내하고 인증기를 부르지 않는다",
    async (code, message) => {
      post.mockRejectedValueOnce(apiError(401, code));
      renderCard();
      await submitRegister(PASSWORD);

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith(message);
      });
      expect(toast.error).toHaveBeenCalledTimes(1);
      expect(mockStartRegistration).not.toHaveBeenCalled();
      expect(post).toHaveBeenCalledTimes(1);
    },
  );

  it("등록 옵션이 429 면 잠시 뒤 다시 시도하라고 안내하고 다시 보내지 않는다", async () => {
    post.mockRejectedValueOnce(apiError(429, "RATE_LIMITED"));
    renderCard();
    await submitRegister(PASSWORD);

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(security.rateLimited);
    });
    expect(toast.error).toHaveBeenCalledTimes(1);
    expect(post).toHaveBeenCalledTimes(1);
    expect(mockStartRegistration).not.toHaveBeenCalled();
  });

  it("인증기에서 취소하는 등 다른 실패는 지금처럼 등록 실패로 안내한다", async () => {
    post.mockResolvedValueOnce(OPTIONS_OK);
    mockStartRegistration.mockRejectedValueOnce(
      new DOMException("cancelled", "NotAllowedError"),
    );
    renderCard();
    await submitRegister(PASSWORD);

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(webauthn.registerFailed);
    });
    expect(post).toHaveBeenCalledTimes(1);
  });
});

// Passkey 복구 코드 재발급도 비밀번호 실패 · 429 를 같은 문구로 안내한다(NERV CLE-ACCT-SIGNIN, CLE-T-FRCRF7).
describe("PasskeyCard 복구 코드 재발급", () => {
  beforeEach(() => {
    serveCredentials([CREDENTIAL]);
  });

  it.each([
    ["PASSWORD_INVALID", 401, security.passwordInvalid],
    ["PASSWORD_REQUIRED", 401, security.passwordNotSet],
    ["RATE_LIMITED", 429, security.rateLimited],
    ["INTERNAL_ERROR", 500, webauthn.regenFailed],
  ])("재발급이 %s(%i) 면 맞는 안내를 띄운다", async (code, status, message) => {
    post.mockRejectedValueOnce(apiError(status, code));
    renderCard();
    await submitRegen(PASSWORD);

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(message);
    });
    expect(toast.error).toHaveBeenCalledTimes(1);
    expect(post).toHaveBeenCalledTimes(1);
    expect(post).toHaveBeenCalledWith(
      "/auth/2fa/webauthn/recovery-codes/regenerate",
      { password: PASSWORD },
    );
  });
});
