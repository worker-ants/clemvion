import { describe, it, expect, beforeEach, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";

const mockReplace = vi.fn();
// 렌더마다 새 router 객체를 돌려준다. 훅의 이동이 router 참조 변화에 다시 돌지 않는지 본다.
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: mockReplace }),
}));

const mockGetByToken = vi.fn();
vi.mock("@/lib/api/invitations", () => ({
  invitationsApi: {
    getByToken: (...args: unknown[]) => mockGetByToken(...args),
  },
}));

const mockIsRegisteredEmail = vi.fn();
vi.mock("@/lib/auth/registered-email", () => ({
  isRegisteredEmail: (...args: unknown[]) => mockIsRegisteredEmail(...args),
}));

const mockToastInfo = vi.fn();
vi.mock("sonner", () => ({
  toast: { info: (...a: unknown[]) => mockToastInfo(...a) },
}));

import { useInvitationGate } from "../use-invitation-gate";
import { useLocaleStore } from "@/lib/stores/locale-store";

const TOKEN = "tok+/=1";
const ACCEPT_PATH = `/invitations/accept?token=${encodeURIComponent(TOKEN)}`;
const LOGIN_HREF = `/login?redirect=${encodeURIComponent(ACCEPT_PATH)}`;
const META = {
  workspaceName: "Team Alpha",
  invitedByName: null,
  email: "member@example.com",
  role: "editor",
  expiresAt: "2099-01-01T00:00:00Z",
};

function axiosError(status: number, body: object = {}) {
  return Object.assign(new Error("axios error"), {
    isAxiosError: true,
    response: { status, data: body },
  });
}

describe("useInvitationGate", () => {
  beforeEach(() => {
    useLocaleStore.setState({ locale: "ko" });
    document.cookie = "has_session=; max-age=0; path=/";
    mockReplace.mockReset();
    mockGetByToken.mockReset();
    mockIsRegisteredEmail.mockReset();
    mockToastInfo.mockReset();
  });

  it("초대 토큰이 없으면 none 이고 아무것도 묻지 않는다", async () => {
    const { result } = renderHook(() => useInvitationGate(undefined));
    await act(async () => {});

    expect(result.current.state).toEqual({ kind: "none" });
    expect(mockGetByToken).not.toHaveBeenCalled();
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it("로그인 힌트가 있으면 메타를 조회하지 않고 수락 페이지로 보낸다", async () => {
    document.cookie = "has_session=1; path=/";

    const { result } = renderHook(() => useInvitationGate(TOKEN));
    await act(async () => {});

    expect(mockReplace).toHaveBeenCalledWith(ACCEPT_PATH);
    expect(mockGetByToken).not.toHaveBeenCalled();
    expect(mockIsRegisteredEmail).not.toHaveBeenCalled();
    expect(result.current.state).toEqual({ kind: "loading" });
  });

  it("메타 조회가 실패하면 상태 코드와 서버 메시지를 담고 가입 여부를 묻지 않는다", async () => {
    mockGetByToken.mockRejectedValue(
      axiosError(410, { error: { code: "invitation_expired", message: "만료된 초대" } }),
    );

    const { result } = renderHook(() => useInvitationGate(TOKEN));

    await waitFor(() =>
      expect(result.current.state).toEqual({
        kind: "error",
        status: 410,
        message: "만료된 초대",
      }),
    );
    expect(mockIsRegisteredEmail).not.toHaveBeenCalled();
  });

  it("가입되지 않은 이메일이면 ready 로 메타를 넘긴다", async () => {
    mockGetByToken.mockResolvedValue(META);
    mockIsRegisteredEmail.mockResolvedValue(false);

    const { result } = renderHook(() => useInvitationGate(TOKEN));

    await waitFor(() =>
      expect(result.current.state).toEqual({ kind: "ready", meta: META }),
    );
    expect(mockIsRegisteredEmail).toHaveBeenCalledWith("member@example.com");
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it("가입된 이메일이면 안내를 띄우고 로그인 화면으로 한 번만 보낸다", async () => {
    mockGetByToken.mockResolvedValue(META);
    mockIsRegisteredEmail.mockResolvedValue(true);

    const { result, rerender } = renderHook(() => useInvitationGate(TOKEN));
    await waitFor(() =>
      expect(result.current.state).toEqual({ kind: "existingAccount" }),
    );

    rerender();
    await act(async () => {});

    expect(mockReplace).toHaveBeenCalledTimes(1);
    expect(mockReplace).toHaveBeenCalledWith(LOGIN_HREF);
    expect(mockToastInfo).toHaveBeenCalledTimes(1);
    expect(mockToastInfo).toHaveBeenCalledWith(
      "이미 가입된 이메일이에요. 로그인하면 초대를 수락할 수 있어요.",
    );
  });

  it("가입 폼을 띄운 뒤 기존 가입자로 판정되면 같은 안내와 로그인 경로로 보낸다", async () => {
    mockGetByToken.mockResolvedValue(META);
    mockIsRegisteredEmail.mockResolvedValue(false);

    const { result } = renderHook(() => useInvitationGate(TOKEN));
    await waitFor(() => expect(result.current.state.kind).toBe("ready"));

    act(() => result.current.sendExistingAccountToLogin());

    expect(result.current.state).toEqual({ kind: "existingAccount" });
    expect(mockReplace).toHaveBeenCalledWith(LOGIN_HREF);
    expect(mockToastInfo).toHaveBeenCalledTimes(1);
  });

  it("가입 폼이 열리지 않았으면 기존 가입자 판정을 무시한다", async () => {
    mockGetByToken.mockRejectedValue(axiosError(404));

    const { result } = renderHook(() => useInvitationGate(TOKEN));
    await waitFor(() => expect(result.current.state.kind).toBe("error"));

    act(() => result.current.sendExistingAccountToLogin());

    expect(result.current.state.kind).toBe("error");
    expect(mockReplace).not.toHaveBeenCalled();
    expect(mockToastInfo).not.toHaveBeenCalled();
  });
});
