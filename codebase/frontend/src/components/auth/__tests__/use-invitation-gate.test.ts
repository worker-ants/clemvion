import { StrictMode, createElement } from "react";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { act, render, renderHook, screen, waitFor } from "@testing-library/react";

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

/** 테스트가 풀어 주는 시점까지 끝나지 않는 promise. 응답이 늦게 오는 상황을 만든다. */
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

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

  // 가입 여부 확인은 최대 5초 걸린다. 그 사이 사용자가 «로그인» 링크를 눌러 화면을 떠났거나 토큰이 바뀌었는데
  // 늦게 온 응답이 이동과 안내를 일으키면 사용자의 이동을 덮는다. 두 단계 사이의 `cancelled` 확인이 막는다.
  it("메타 조회가 끝나기 전에 언마운트하면 늦게 온 메타로 가입 여부를 묻거나 이동하지 않는다", async () => {
    const meta = deferred<typeof META>();
    mockGetByToken.mockReturnValue(meta.promise);
    mockIsRegisteredEmail.mockResolvedValue(true);

    const { unmount } = renderHook(() => useInvitationGate(TOKEN));
    await waitFor(() => expect(mockGetByToken).toHaveBeenCalledTimes(1));

    unmount();
    await act(async () => {
      meta.resolve(META);
    });

    expect(mockIsRegisteredEmail).not.toHaveBeenCalled();
    expect(mockReplace).not.toHaveBeenCalled();
    expect(mockToastInfo).not.toHaveBeenCalled();
  });

  it("가입 여부 확인이 끝나기 전에 언마운트하면 늦게 온 응답으로 안내하거나 이동하지 않는다", async () => {
    const registered = deferred<boolean>();
    mockGetByToken.mockResolvedValue(META);
    mockIsRegisteredEmail.mockReturnValue(registered.promise);

    const { unmount } = renderHook(() => useInvitationGate(TOKEN));
    await waitFor(() => expect(mockIsRegisteredEmail).toHaveBeenCalledTimes(1));

    unmount();
    await act(async () => {
      registered.resolve(true);
    });

    expect(mockReplace).not.toHaveBeenCalled();
    expect(mockToastInfo).not.toHaveBeenCalled();
  });

  it("토큰이 바뀌면 이전 토큰의 늦은 응답을 버리고 새 토큰의 판정만 따른다", async () => {
    const first = deferred<typeof META>();
    const SECOND_META = { ...META, email: "second@example.com" };
    mockGetByToken
      .mockReturnValueOnce(first.promise)
      .mockResolvedValueOnce(SECOND_META);
    // 이전 토큰의 이메일만 가입돼 있다. 그 응답이 살아 있으면 로그인으로 보내는 이동이 일어난다.
    mockIsRegisteredEmail.mockImplementation(
      async (email: string) => email === META.email,
    );

    const { result, rerender } = renderHook(
      ({ token }: { token: string }) => useInvitationGate(token),
      { initialProps: { token: TOKEN } },
    );
    await waitFor(() => expect(mockGetByToken).toHaveBeenCalledTimes(1));

    rerender({ token: "tok-2" });
    await waitFor(() =>
      expect(result.current.state).toEqual({ kind: "ready", meta: SECOND_META }),
    );

    await act(async () => {
      first.resolve(META);
    });

    expect(result.current.state).toEqual({ kind: "ready", meta: SECOND_META });
    expect(mockIsRegisteredEmail).not.toHaveBeenCalledWith(META.email);
    expect(mockReplace).not.toHaveBeenCalled();
    expect(mockToastInfo).not.toHaveBeenCalled();
  });
});

/**
 * 개발 서버의 StrictMode 는 effect 를 mount, cleanup, mount 로 돌린다. 첫 실행의 응답은 `cancelled` 로
 * 버려지고 두 번째 실행의 응답만 쓰여야 한다. `renderHook` 의 `wrapper` 로 StrictMode 를 씌우면 effect 가
 * 두 번 돌지 않았다(프로브에서 `getByToken` 1회). 그래서 `render` 로 감싼 컴포넌트를 쓴다.
 */
describe("useInvitationGate — StrictMode", () => {
  function Probe({ token }: { token: string }) {
    const { state } = useInvitationGate(token);
    return createElement("p", { "data-testid": "kind" }, state.kind);
  }

  function renderStrict() {
    return render(
      createElement(StrictMode, null, createElement(Probe, { token: TOKEN })),
    );
  }

  beforeEach(() => {
    useLocaleStore.setState({ locale: "ko" });
    document.cookie = "has_session=; max-age=0; path=/";
    mockReplace.mockReset();
    mockGetByToken.mockReset();
    mockIsRegisteredEmail.mockReset();
    mockToastInfo.mockReset();
  });

  it("가입된 이메일이면 effect 가 두 번 돌아도 안내와 이동은 한 번만 일어난다", async () => {
    mockGetByToken.mockResolvedValue(META);
    mockIsRegisteredEmail.mockResolvedValue(true);

    renderStrict();

    await waitFor(() =>
      expect(screen.getByTestId("kind").textContent).toBe("existingAccount"),
    );
    await act(async () => {});
    // effect 가 실제로 두 번 돌았는지 먼저 확인한다. 한 번만 돌았다면 아래 단언은 가드를 보지 못한다.
    expect(mockGetByToken).toHaveBeenCalledTimes(2);
    expect(mockReplace).toHaveBeenCalledTimes(1);
    expect(mockReplace).toHaveBeenCalledWith(LOGIN_HREF);
    expect(mockToastInfo).toHaveBeenCalledTimes(1);
  });

  it("가입되지 않은 이메일이면 effect 가 두 번 돌아도 loading 에 머물지 않고 ready 가 된다", async () => {
    mockGetByToken.mockResolvedValue(META);
    mockIsRegisteredEmail.mockResolvedValue(false);

    renderStrict();

    await waitFor(() =>
      expect(screen.getByTestId("kind").textContent).toBe("ready"),
    );
    expect(mockGetByToken).toHaveBeenCalledTimes(2);
    expect(mockReplace).not.toHaveBeenCalled();
  });

  // 로그인 힌트 경로는 메타를 묻지 않아 취소할 것이 없다. effect 가 두 번 돌면 `replace` 도 두 번 불린다.
  // 두 호출이 같은 목적지라 사용자에게 해롭지 않고, 목적지가 갈리지 않는 것만 지킨다.
  it("로그인 힌트가 있으면 effect 가 두 번 돌아도 이동은 같은 수락 페이지로만 간다", async () => {
    document.cookie = "has_session=1; path=/";

    renderStrict();
    await act(async () => {});

    expect(mockReplace).toHaveBeenCalled();
    for (const call of mockReplace.mock.calls) {
      expect(call).toEqual([ACCEPT_PATH]);
    }
    expect(mockGetByToken).not.toHaveBeenCalled();
  });
});
