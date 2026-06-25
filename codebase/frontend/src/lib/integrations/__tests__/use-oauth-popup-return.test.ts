/**
 * `useOauthPopupReturn` 단위 테스트 — ai-review m-3 W1.
 * 회귀 민감 타이밍 로직(5분 타임아웃·popup.closed 폴링·postMessage 수신)을 커버.
 *  - 성공 postMessage → previewToken 설정 + onAuthorized 호출
 *  - 에러 postMessage → oauthError 설정 + onAuthorized 미호출
 *  - 다른 origin → 무시
 *  - startPopup → oauthWaiting; 5분 타임아웃 시 종료 + 팝업 close
 *  - popup.closed (previewToken 없음) → bail 종료 + 에러
 *  - unmount → message 리스너 제거
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";

const hoisted = vi.hoisted(() => ({
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
  toastMessage: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: {
    success: hoisted.toastSuccess,
    error: hoisted.toastError,
    message: hoisted.toastMessage,
  },
}));

import { useOauthPopupReturn } from "../use-oauth-popup-return";

const t = ((k: string) => k) as unknown as Parameters<
  typeof useOauthPopupReturn
>[0]["t"];

function makePopup(): Window & {
  closed: boolean;
  close: ReturnType<typeof vi.fn>;
} {
  return { closed: false, close: vi.fn() } as unknown as Window & {
    closed: boolean;
    close: ReturnType<typeof vi.fn>;
  };
}

function dispatchOAuthMessage(data: unknown, origin = window.location.origin) {
  act(() => {
    window.dispatchEvent(new MessageEvent("message", { origin, data }));
  });
}

describe("useOauthPopupReturn", () => {
  let openSpy: ReturnType<typeof vi.spyOn>;
  let popup: ReturnType<typeof makePopup>;

  beforeEach(() => {
    vi.useFakeTimers();
    hoisted.toastSuccess.mockClear();
    hoisted.toastError.mockClear();
    hoisted.toastMessage.mockClear();
    popup = makePopup();
    openSpy = vi.spyOn(window, "open").mockReturnValue(popup);
  });
  afterEach(() => {
    vi.useRealTimers();
    openSpy.mockRestore();
  });

  it("성공 postMessage → previewToken 설정 + onAuthorized 호출", () => {
    const onAuthorized = vi.fn();
    const { result } = renderHook(() =>
      useOauthPopupReturn({ t, onAuthorized }),
    );
    dispatchOAuthMessage({
      type: "oauth_callback",
      status: "success",
      previewToken: "pt-1",
    });
    expect(result.current.previewToken).toBe("pt-1");
    expect(result.current.oauthError).toBeNull();
    expect(hoisted.toastSuccess).toHaveBeenCalled();
    expect(onAuthorized).toHaveBeenCalledTimes(1);
  });

  it("에러 postMessage → oauthError 설정 + onAuthorized 미호출", () => {
    const onAuthorized = vi.fn();
    const { result } = renderHook(() =>
      useOauthPopupReturn({ t, onAuthorized }),
    );
    dispatchOAuthMessage({
      type: "oauth_callback",
      status: "error",
      error: "boom",
    });
    expect(result.current.oauthError).toBe("boom");
    expect(hoisted.toastError).toHaveBeenCalledWith("boom");
    expect(onAuthorized).not.toHaveBeenCalled();
  });

  it("다른 origin 메시지는 무시한다", () => {
    const onAuthorized = vi.fn();
    const { result } = renderHook(() =>
      useOauthPopupReturn({ t, onAuthorized }),
    );
    dispatchOAuthMessage(
      { type: "oauth_callback", status: "success", previewToken: "pt-x" },
      "https://evil.example",
    );
    expect(result.current.previewToken).toBeNull();
    expect(onAuthorized).not.toHaveBeenCalled();
  });

  it("startPopup → oauthWaiting, 5분 타임아웃 시 종료 + 팝업 close", () => {
    const { result } = renderHook(() =>
      useOauthPopupReturn({ t, onAuthorized: vi.fn() }),
    );
    act(() => {
      result.current.startPopup("https://auth.example");
    });
    expect(result.current.oauthWaiting).toBe(true);
    expect(hoisted.toastMessage).toHaveBeenCalled();
    act(() => {
      vi.advanceTimersByTime(5 * 60 * 1000);
    });
    expect(result.current.oauthWaiting).toBe(false);
    expect(result.current.oauthError).toBe("integrations.oauthTimedOutShort");
    expect(popup.close).toHaveBeenCalled();
  });

  it("팝업이 닫히면(previewToken 없음) bail → 종료 + 에러", () => {
    const { result } = renderHook(() =>
      useOauthPopupReturn({ t, onAuthorized: vi.fn() }),
    );
    act(() => {
      result.current.startPopup("https://auth.example");
    });
    popup.closed = true;
    act(() => {
      vi.advanceTimersByTime(500); // poll observes closed
    });
    act(() => {
      vi.advanceTimersByTime(1500); // deferred bail
    });
    expect(result.current.oauthWaiting).toBe(false);
    expect(result.current.oauthError).toBe(
      "integrations.oauthPopupClosedNoResult",
    );
  });

  it("unmount 후 message 는 무시된다(리스너 제거)", () => {
    const onAuthorized = vi.fn();
    const { unmount } = renderHook(() =>
      useOauthPopupReturn({ t, onAuthorized }),
    );
    unmount();
    dispatchOAuthMessage({
      type: "oauth_callback",
      status: "success",
      previewToken: "pt-after",
    });
    expect(onAuthorized).not.toHaveBeenCalled();
  });
});
