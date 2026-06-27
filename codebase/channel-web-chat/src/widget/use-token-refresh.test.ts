import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import {
  refreshDelayMs,
  TOKEN_REFRESH_LEAD_MS,
  TOKEN_REFRESH_MIN_DELAY_MS,
  useTokenRefresh,
} from "./use-token-refresh";
import type { PersistedSession } from "@/lib/session-store";

const NINETY_MIN = 90 * 60 * 1000;
const ENDPOINTS = { stream: "/s", submit: "/i", status: "/st", cancel: "/c", refresh: "/r" };

function session(over: Partial<PersistedSession> = {}): PersistedSession {
  return {
    executionId: "e1",
    token: "iext_x",
    expiresAt: new Date(Date.now() + NINETY_MIN).toISOString(),
    endpoints: ENDPOINTS,
    ...over,
  };
}

describe("refreshDelayMs — 토큰 갱신 지연(3-auth-session §3 step7)", () => {
  const now = Date.parse("2026-06-02T00:00:00.000Z");
  it("만료 2h 후 → (만료-30m-now)=90m 에 예약", () => {
    expect(refreshDelayMs(new Date(now + 2 * 60 * 60 * 1000).toISOString(), now)).toBe(90 * 60 * 1000);
  });
  it("이미 lead(30m) 이내 → 최소 지연", () => {
    expect(refreshDelayMs(new Date(now + 10 * 60 * 1000).toISOString(), now)).toBe(TOKEN_REFRESH_MIN_DELAY_MS);
  });
  it("정확히 lead 경계 → 최소 지연 클램프", () => {
    expect(refreshDelayMs(new Date(now + TOKEN_REFRESH_LEAD_MS).toISOString(), now)).toBe(TOKEN_REFRESH_MIN_DELAY_MS);
  });
  it("파싱 불가 → null", () => {
    expect(refreshDelayMs("not-a-date", now)).toBeNull();
  });
});

describe("useTokenRefresh (fake timer)", () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    window.sessionStorage.clear();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  function setup(over: Partial<PersistedSession> = {}) {
    // 매 호출 시 fresh 한 미래 만료시각 반환(실서버 동작) — 재예약이 다음 60m 뒤로 가 61m 점프엔 1회만 발화.
    const refreshToken = vi
      .fn()
      .mockImplementation(() =>
        Promise.resolve({ token: "iext_x2", expiresAt: new Date(Date.now() + NINETY_MIN).toISOString() }),
      );
    const refs = {
      sessionRef: { current: session(over) } as { current: PersistedSession | null },
      clientRef: { current: { refreshToken } },
      configRef: { current: { triggerEndpointPath: "t1", apiBase: "http://api.test/api" } },
    };
    // 부분 mock client — 훅은 client.refreshToken 만 호출하므로 충분.
    const { result, unmount } = renderHook(() =>
      useTokenRefresh(refs as unknown as Parameters<typeof useTokenRefresh>[0]),
    );
    return { result, unmount, refs, refreshToken };
  }

  it("scheduleRefresh → delay(60m) 경과 시 refreshToken 호출 + sessionRef·저장 세션 갱신", async () => {
    const { result, refs, refreshToken } = setup();
    act(() => result.current.scheduleRefresh());
    await act(async () => {
      await vi.advanceTimersByTimeAsync(61 * 60 * 1000);
    });
    expect(refreshToken).toHaveBeenCalledTimes(1);
    expect(refs.sessionRef.current?.token).toBe("iext_x2");
    expect(window.sessionStorage.getItem("clemvion-web-chat:session:t1")).toContain("iext_x2");
  });

  it("clearRefreshTimer → 예약된 refresh 미발화", async () => {
    const { result, refreshToken } = setup();
    act(() => result.current.scheduleRefresh());
    act(() => result.current.clearRefreshTimer());
    await act(async () => {
      await vi.advanceTimersByTimeAsync(61 * 60 * 1000);
    });
    expect(refreshToken).not.toHaveBeenCalled();
  });

  it("언마운트 후 타이머 미발화(cancelled 가드)", async () => {
    const { result, unmount, refreshToken } = setup();
    act(() => result.current.scheduleRefresh());
    unmount();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(61 * 60 * 1000);
    });
    expect(refreshToken).not.toHaveBeenCalled();
  });

  it("세션 없으면 예약 no-op", async () => {
    const { result, refs, refreshToken } = setup();
    refs.sessionRef.current = null;
    act(() => result.current.scheduleRefresh());
    await act(async () => {
      await vi.advanceTimersByTimeAsync(61 * 60 * 1000);
    });
    expect(refreshToken).not.toHaveBeenCalled();
  });
});
