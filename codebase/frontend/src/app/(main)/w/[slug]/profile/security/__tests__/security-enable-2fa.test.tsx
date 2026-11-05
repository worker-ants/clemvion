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
  },
  setAccessToken: vi.fn(),
}));

type StoreUser = { id: string; twoFactorEnabled: boolean };

// 켜기 · 끄기 뒤 화면이 store 의 user 로 다시 그려지는지 보려고 setUser 가 실제로 값을 바꾸는 store 를 둔다.
const auth = vi.hoisted(() => {
  const listeners = new Set<() => void>();
  const state = {
    user: { id: "u1", twoFactorEnabled: false } as StoreUser,
    setUser: vi.fn((u: StoreUser) => {
      state.user = u;
      listeners.forEach((l) => l());
    }),
  };
  return { state, listeners };
});

vi.mock("@/lib/stores/auth-store", async () => {
  const { useSyncExternalStore } = await import("react");
  return {
    useAuthStore: <T,>(selector: (s: typeof auth.state) => T): T =>
      useSyncExternalStore(
        (listener) => {
          auth.listeners.add(listener);
          return () => auth.listeners.delete(listener);
        },
        () => selector(auth.state),
      ),
  };
});

vi.mock("../passkey-card", () => ({
  PasskeyCard: () => null,
}));

vi.mock("next/image", () => ({
  // eslint-disable-next-line @next/next/no-img-element
  default: (props: { src: string; alt: string }) => <img src={props.src} alt={props.alt} />,
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
const post = vi.mocked(apiClient.post);
const get = vi.mocked(apiClient.get);

const PASSWORD = "P@ssw0rd!1";
const ENABLED_ME: StoreUser = { id: "u1", twoFactorEnabled: true };
const DISABLED_ME: StoreUser = { id: "u1", twoFactorEnabled: false };
const SETUP_OK = {
  data: { data: { otpauthUrl: "otpauth://x", qrCodeDataUrl: "data:image/png;base64,AA" } },
};
const RECOVERY_CODE = "aaaa-bbbb-cccc";

function apiError(status: number, code: string) {
  return {
    isAxiosError: true,
    message: `Request failed with status code ${status}`,
    response: { status, data: { error: { code, message: "m" } } },
  };
}

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return render(<SecurityPage />, { wrapper });
}

function startSetup(password: string = PASSWORD) {
  fireEvent.change(screen.getByPlaceholderText(security.accountPasswordPlaceholder), {
    target: { value: password },
  });
  fireEvent.click(screen.getByRole("button", { name: security.startSetup }));
}

async function startSetupAndSubmitCode(code: string) {
  startSetup();
  const input = await screen.findByPlaceholderText(security.codePlaceholder);
  fireEvent.change(input, { target: { value: code } });
  fireEvent.click(screen.getByRole("button", { name: security.verifyActivateButton }));
}

beforeEach(() => {
  vi.clearAllMocks();
  auth.state.user = { ...DISABLED_ME };
  get.mockResolvedValue({ data: { data: ENABLED_ME } });
});

// 설정 시작은 비밀번호를 다시 확인하고, TOTP 가 켜진 계정의 설정 재실행은 409 TOTP_ALREADY_ENABLED 로 거부된다
// (NERV CLE-ACCT-SIGNIN, CLE-T-94FTMV).
describe("SecurityPage 2FA 설정", () => {
  it("설정 시작은 입력한 비밀번호를 함께 보낸다", async () => {
    post.mockResolvedValueOnce(SETUP_OK);
    renderPage();
    startSetup();

    expect(await screen.findByAltText(security.qrAlt)).toBeTruthy();
    expect(post).toHaveBeenCalledWith("/auth/2fa/setup", { password: PASSWORD });
  });

  it("비밀번호가 8자보다 짧으면 요청하지 않고 비밀번호를 입력하라고 안내한다", () => {
    renderPage();
    startSetup("short");

    expect(toast.error).toHaveBeenCalledWith(security.passwordRequired);
    expect(post).not.toHaveBeenCalled();
  });

  it.each([
    ["PASSWORD_INVALID", security.passwordInvalid],
    ["PASSWORD_REQUIRED", security.passwordNotSet],
  ])("설정 시작이 401 %s 면 그 이유를 안내한다", async (code, message) => {
    post.mockRejectedValueOnce(apiError(401, code));
    renderPage();
    startSetup();

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(message);
    });
    expect(screen.queryByAltText(security.qrAlt)).toBeNull();
    expect(get).not.toHaveBeenCalled();
  });

  it("설정 시작이 409 TOTP_ALREADY_ENABLED 면 이미 켜졌다고 안내하고 켜진 상태로 다시 그린다", async () => {
    post.mockRejectedValueOnce(apiError(409, "TOTP_ALREADY_ENABLED"));
    renderPage();
    startSetup();

    await waitFor(() => {
      expect(toast.info).toHaveBeenCalledWith(security.alreadyEnabled);
    });
    expect(toast.error).not.toHaveBeenCalled();
    // usersApi.getMe 는 요청 설정(timeout 등)을 두 번째 인자로 넘긴다. 이 화면은 설정 없이 부른다.
    expect(get).toHaveBeenCalledWith("/users/me", undefined);
    expect(await screen.findByText(security.active)).toBeTruthy();
  });

  it("설정 시작이 409 TOTP_ALREADY_ENABLED 면 입력해 둔 비밀번호를 화면에 남기지 않는다", async () => {
    // 서버가 켜짐 여부를 아직 돌려주지 않아 설정 화면이 그대로 남는 경우에도 입력값은 비운다.
    get.mockResolvedValue({ data: { data: DISABLED_ME } });
    post.mockRejectedValueOnce(apiError(409, "TOTP_ALREADY_ENABLED"));
    renderPage();
    startSetup();

    await waitFor(() => {
      expect(toast.info).toHaveBeenCalledWith(security.alreadyEnabled);
    });
    const input = screen.getByPlaceholderText(
      security.accountPasswordPlaceholder,
    ) as HTMLInputElement;
    expect(input.value).toBe("");
  });

  it("활성화 검증이 409 TOTP_ALREADY_ENABLED 면 QR 을 닫고 이미 켜졌다고 안내한다", async () => {
    post
      .mockResolvedValueOnce(SETUP_OK)
      .mockRejectedValueOnce(apiError(409, "TOTP_ALREADY_ENABLED"));
    renderPage();
    await startSetupAndSubmitCode("123456");

    await waitFor(() => {
      expect(toast.info).toHaveBeenCalledWith(security.alreadyEnabled);
    });
    expect(toast.error).not.toHaveBeenCalled();
    expect(screen.queryByAltText(security.qrAlt)).toBeNull();
    expect(await screen.findByText(security.active)).toBeTruthy();
  });

  // 설정 시작 뒤 10분이 지나면 서버가 대기 secret 을 버리고 400 TOTP_NOT_INITIALIZED 로 거부한다
  // (NERV CLE-ACCT-SIGNIN REQ-SIGNIN-085, CLE-T-FRCRF7).
  it("활성화 검증이 400 TOTP_NOT_INITIALIZED 면 설정 시간이 지났다고 안내하고 비밀번호 입력 단계로 돌아간다", async () => {
    post
      .mockResolvedValueOnce(SETUP_OK)
      .mockRejectedValueOnce(apiError(400, "TOTP_NOT_INITIALIZED"));
    renderPage();
    await startSetupAndSubmitCode("123456");

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(security.setupExpired);
    });
    expect(toast.error).toHaveBeenCalledTimes(1);
    expect(screen.queryByAltText(security.qrAlt)).toBeNull();
    expect(screen.queryByPlaceholderText(security.codePlaceholder)).toBeNull();
    expect(
      screen.getByRole("button", { name: security.startSetup }),
    ).toBeTruthy();
    expect(get).not.toHaveBeenCalled();
  });

  it("설정 시간이 지나 다시 시작하면 이전에 입력한 인증 코드를 남기지 않는다", async () => {
    post
      .mockResolvedValueOnce(SETUP_OK)
      .mockRejectedValueOnce(apiError(400, "TOTP_NOT_INITIALIZED"))
      .mockResolvedValueOnce(SETUP_OK);
    renderPage();
    await startSetupAndSubmitCode("123456");
    await screen.findByRole("button", { name: security.startSetup });

    startSetup();
    const input = (await screen.findByPlaceholderText(
      security.codePlaceholder,
    )) as HTMLInputElement;
    expect(input.value).toBe("");
  });

  // 설정 시작 · 활성화 검증은 사용자당 분당 10회로 제한한다. 429 는 자동으로 다시 보내지 않고 안내만 한다
  // (NERV CLE-ACCT-SIGNIN, CLE-T-FRCRF7).
  it("설정 시작이 429 면 잠시 뒤 다시 시도하라고 안내하고 다시 보내지 않는다", async () => {
    post.mockRejectedValueOnce(apiError(429, "RATE_LIMITED"));
    renderPage();
    startSetup();

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(security.rateLimited);
    });
    expect(toast.error).toHaveBeenCalledTimes(1);
    expect(post).toHaveBeenCalledTimes(1);
  });

  it("활성화 검증이 429 면 잠시 뒤 다시 시도하라고 안내하고 QR 을 그대로 둔다", async () => {
    post
      .mockResolvedValueOnce(SETUP_OK)
      .mockRejectedValueOnce(apiError(429, "RATE_LIMITED"));
    renderPage();
    await startSetupAndSubmitCode("123456");

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(security.rateLimited);
    });
    expect(toast.error).toHaveBeenCalledTimes(1);
    expect(post).toHaveBeenCalledTimes(2);
    expect(screen.getByAltText(security.qrAlt)).toBeTruthy();
  });

  it("다른 실패는 지금처럼 실패 안내를 띄우고 사용자 정보를 다시 읽지 않는다", async () => {
    post
      .mockRejectedValueOnce(apiError(500, "INTERNAL_ERROR"))
      .mockResolvedValueOnce(SETUP_OK)
      .mockRejectedValueOnce(apiError(401, "TOTP_INVALID"));
    renderPage();
    startSetup();
    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(security.setupStartFailed);
    });

    await startSetupAndSubmitCode("000000");
    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(security.verifyFailed);
    });
    expect(toast.info).not.toHaveBeenCalled();
    expect(get).not.toHaveBeenCalled();
  });

  it("활성화에 성공하면 켜진 상태로 바뀌어도 한 번만 보여 주는 복구 코드를 계속 보여 준다", async () => {
    post
      .mockResolvedValueOnce(SETUP_OK)
      .mockResolvedValueOnce({ data: { data: { recoveryCodes: [RECOVERY_CODE] } } });
    renderPage();
    await startSetupAndSubmitCode("123456");

    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith(security.verifySuccess);
    });
    expect(post).toHaveBeenLastCalledWith("/auth/2fa/verify", { code: "123456" });
    expect(await screen.findByText(security.active)).toBeTruthy();
    expect(screen.getByText(security.recoveryCodesTitle)).toBeTruthy();
    expect(screen.getByText(RECOVERY_CODE)).toBeTruthy();
  });

  it("끄면 남아 있던 복구 코드도 화면에서 지운다", async () => {
    post
      .mockResolvedValueOnce(SETUP_OK)
      .mockResolvedValueOnce({ data: { data: { recoveryCodes: [RECOVERY_CODE] } } })
      .mockResolvedValueOnce({ data: { data: { ok: true } } });
    renderPage();
    await startSetupAndSubmitCode("123456");
    await screen.findByText(security.active);

    get.mockResolvedValue({ data: { data: DISABLED_ME } });
    fireEvent.change(screen.getByPlaceholderText(security.accountPasswordPlaceholder), {
      target: { value: PASSWORD },
    });
    fireEvent.change(screen.getByPlaceholderText(security.disableCodePlaceholder), {
      target: { value: RECOVERY_CODE },
    });
    fireEvent.click(screen.getByRole("button", { name: security.disableButton }));

    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith(security.disableSuccess);
    });
    expect(await screen.findByRole("button", { name: security.startSetup })).toBeTruthy();
    expect(screen.queryByText(RECOVERY_CODE)).toBeNull();
  });
});
