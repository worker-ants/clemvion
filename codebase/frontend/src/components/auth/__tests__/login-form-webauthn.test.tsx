import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("next/navigation", () => ({
  useParams: () => ({}),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

const mockLogin = vi.fn();
const mockOptions = vi.fn();
const mockVerify = vi.fn();
vi.mock("@/lib/api/auth", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/auth")>();
  return {
    ...actual,
    authApi: {
      login: (...args: unknown[]) => mockLogin(...args),
      webauthnAuthenticateOptions: (...args: unknown[]) => mockOptions(...args),
      webauthnAuthenticateVerify: (...args: unknown[]) => mockVerify(...args),
    },
  };
});

vi.mock("@/lib/api/users", () => ({
  usersApi: { getMe: vi.fn().mockRejectedValue(new Error("skip")) },
}));

vi.mock("@/lib/api/client", () => ({
  setAccessToken: vi.fn(),
}));

const mockStartAuthentication = vi.fn();
vi.mock("@simplewebauthn/browser", () => ({
  browserSupportsWebAuthn: () => true,
  startAuthentication: (...args: unknown[]) => mockStartAuthentication(...args),
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

import { LoginForm } from "../login-form";
import { useLocaleStore } from "@/lib/stores/locale-store";

function optionsResponse(optionsToken: string) {
  return {
    data: { data: { publicKey: { challenge: optionsToken }, optionsToken } },
  };
}

// 서버 응답이 끝나지 않는 검증 중 상태. 응답을 기다리는 동안의 화면을 확인하는 데 쓴다.
const verifyPending = new Promise<never>(() => {});

async function reachPasskeyStep() {
  const user = userEvent.setup();
  await user.type(screen.getByLabelText("이메일"), "alice@example.com");
  await user.type(screen.getByLabelText("비밀번호"), "Password1!");
  await user.click(screen.getByRole("button", { name: "로그인" }));
  return user;
}

/**
 * CLE-ACCT-SIGNIN 「Passkey 등록·인증 흐름」 — Passkey 인증 챌린지는 한 번만 쓴다.
 * 로그인 화면은 검증 중에 버튼을 잠그고, 시도할 때마다 옵션(새 챌린지)을 받는다.
 * 같은 챌린지로 다시 보내면 서버가 401 `WEBAUTHN_INVALID` 로 거부하기 때문이다.
 */
describe("LoginForm — Passkey 2단계", () => {
  beforeEach(() => {
    useLocaleStore.setState({ locale: "ko" });
    mockLogin.mockReset();
    mockOptions.mockReset();
    mockVerify.mockReset();
    mockStartAuthentication.mockReset();
    mockLogin.mockResolvedValue({
      data: {
        data: {
          requires2fa: true,
          challengeToken: "ch-1",
          methods: ["webauthn"],
        },
      },
    });
    mockStartAuthentication.mockResolvedValue({ id: "cred-1" });
  });

  it("검증 응답을 기다리는 동안 버튼을 잠가 같은 시도를 다시 보내지 않는다", async () => {
    mockOptions.mockResolvedValue(optionsResponse("opts-1"));
    mockVerify.mockReturnValue(verifyPending);
    render(<LoginForm />);

    const user = await reachPasskeyStep();

    const button = await screen.findByRole("button", { name: "인증 중..." });
    await waitFor(() => expect(mockVerify).toHaveBeenCalledTimes(1));
    expect(button).toBeDisabled();
    await user.click(button);
    expect(mockOptions).toHaveBeenCalledTimes(1);
    expect(mockVerify).toHaveBeenCalledTimes(1);
  });

  it("검증이 실패한 뒤 다시 시도하면 새 옵션을 받아 그 옵션 토큰으로 검증한다", async () => {
    mockOptions
      .mockResolvedValueOnce(optionsResponse("opts-1"))
      .mockResolvedValueOnce(optionsResponse("opts-2"));
    // 서버가 보내는 실제 에러 봉투는 `{ error: { code, message, requestId } }` 이다.
    // 로그인 화면은 `data.message` 를 읽으므로 서버 문구 대신 폴백 문구가 보인다.
    mockVerify
      .mockRejectedValueOnce({
        response: {
          status: 401,
          data: {
            error: {
              code: "WEBAUTHN_INVALID",
              message: "WebAuthn 인증에 실패했어요.",
            },
          },
        },
      })
      .mockReturnValueOnce(verifyPending);
    render(<LoginForm />);

    const user = await reachPasskeyStep();

    expect(
      await screen.findByText("Passkey 인증에 실패했어요."),
    ).toBeInTheDocument();
    await user.click(
      screen.getByRole("button", { name: "Passkey · 보안 키로 인증" }),
    );

    await waitFor(() => expect(mockVerify).toHaveBeenCalledTimes(2));
    expect(mockOptions).toHaveBeenCalledTimes(2);
    expect(mockOptions).toHaveBeenNthCalledWith(2, "ch-1");
    expect(mockVerify).toHaveBeenNthCalledWith(1, "ch-1", "opts-1", {
      id: "cred-1",
    });
    expect(mockVerify).toHaveBeenNthCalledWith(2, "ch-1", "opts-2", {
      id: "cred-1",
    });
  });
});
