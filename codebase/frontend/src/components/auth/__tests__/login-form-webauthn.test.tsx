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
const mockRecovery = vi.fn();
vi.mock("@/lib/api/auth", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/auth")>();
  return {
    ...actual,
    authApi: {
      login: (...args: unknown[]) => mockLogin(...args),
      webauthnAuthenticateOptions: (...args: unknown[]) => mockOptions(...args),
      webauthnAuthenticateVerify: (...args: unknown[]) => mockVerify(...args),
      webauthnRecovery: (...args: unknown[]) => mockRecovery(...args),
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

import { toast } from "sonner";
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
    // 로그인 화면은 `WEBAUTHN_INVALID` 코드를 보고 사전 문구를 고른다(서버 문구가 아니다).
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

/**
 * NERV Task `CLE-T-MFWBE1` 항목 2 — Passkey 단계와 Passkey 복구 코드 단계도 에러 봉투
 * `{ error: { code, message } }` 의 코드로 문구를 고른다. 모르는 코드는 봉투의 `error.message` 다.
 */
describe("LoginForm — Passkey 2단계 거부 코드별 안내", () => {
  function apiError(status: number, code: string, message: string) {
    return Object.assign(new Error(message), {
      isAxiosError: true,
      response: { status, data: { error: { code, message } } },
    });
  }

  beforeEach(() => {
    useLocaleStore.setState({ locale: "ko" });
    mockLogin.mockReset();
    mockOptions.mockReset();
    mockVerify.mockReset();
    mockRecovery.mockReset();
    mockStartAuthentication.mockReset();
    vi.mocked(toast.error).mockReset();
    mockLogin.mockResolvedValue({
      data: {
        data: { requires2fa: true, challengeToken: "ch-1", methods: ["webauthn"] },
      },
    });
    mockStartAuthentication.mockResolvedValue({ id: "cred-1" });
    mockOptions.mockResolvedValue(optionsResponse("opts-1"));
  });

  it("Passkey 검증이 CHALLENGE_INVALID 면 다시 로그인하라고 안내한다", async () => {
    mockVerify.mockRejectedValue(
      apiError(401, "CHALLENGE_INVALID", "인증 세션이 만료됐어요. 다시 로그인해 주세요."),
    );
    render(<LoginForm />);

    await reachPasskeyStep();

    expect(
      await screen.findByText("인증 세션이 만료됐어요. 처음부터 다시 로그인해 주세요."),
    ).toBeInTheDocument();
  });

  it("Passkey 검증이 모르는 코드면 에러 봉투의 error.message 를 보여 준다", async () => {
    mockVerify.mockRejectedValue(
      apiError(401, "WEBAUTHN_COUNTER_REGRESSION", "보안 키 카운터가 뒤로 갔어요."),
    );
    render(<LoginForm />);

    await reachPasskeyStep();

    expect(await screen.findByText("보안 키 카운터가 뒤로 갔어요.")).toBeInTheDocument();
  });

  async function submitRecovery() {
    // 자동으로 시작한 Passkey 시도가 끝나야 버튼이 풀린다. 사용자가 Passkey 를 쓸 수 없어
    // 복구 코드로 넘어가는 상황이다.
    mockVerify.mockRejectedValue(
      apiError(401, "WEBAUTHN_INVALID", "WebAuthn 인증에 실패했어요."),
    );
    const user = await reachPasskeyStep();
    await screen.findByText("Passkey 인증에 실패했어요.");
    await user.click(await screen.findByRole("button", { name: "복구 코드 사용하기" }));
    await user.type(screen.getByLabelText("복구 코드"), "abcd-efgh-ijkl");
    await user.click(screen.getByRole("button", { name: "확인" }));
  }

  it.each([
    ["RECOVERY_CODE_INVALID", "Invalid recovery code", "복구 코드가 올바르지 않아요."],
    [
      "CHALLENGE_INVALID",
      "인증 세션이 만료됐어요. 다시 로그인해 주세요.",
      "인증 세션이 만료됐어요. 처음부터 다시 로그인해 주세요.",
    ],
    ["SOMETHING_NEW", "서버가 보낸 안내", "서버가 보낸 안내"],
  ])("복구 코드 검증이 %s 면 그에 맞는 문구를 보여 준다", async (code, serverMessage, shown) => {
    mockRecovery.mockRejectedValue(apiError(401, code, serverMessage));
    render(<LoginForm />);

    await submitRecovery();

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith(shown));
  });
});
