import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import {
  refreshDelayMs,
  TOKEN_REFRESH_LEAD_MS,
  TOKEN_REFRESH_MIN_DELAY_MS,
  useTokenRefresh,
} from "./use-token-refresh";
import type { EiaClient } from "@/lib/eia-client";
import type { PersistedSession } from "@/lib/session-store";
import type { BootMessage } from "./host-bridge";

const NINETY_MIN = 90 * 60 * 1000;
/** refresh delay(만료90m-lead30m=60m)를 넘기는 점프 — 타이머 1회 발화 보장. */
const OVER_SIXTY_MIN_MS = 61 * 60 * 1000;
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
  it("이미 만료된 토큰(과거 시각) → 최소 지연 클램프", () => {
    expect(refreshDelayMs(new Date(now - 60 * 1000).toISOString(), now)).toBe(TOKEN_REFRESH_MIN_DELAY_MS);
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

  function setup(over: Partial<PersistedSession> = {}, refreshImpl?: () => Promise<unknown>) {
    // 매 호출 시 fresh 한 미래 만료시각 반환(실서버 동작) — 재예약이 다음 60m 뒤로 가 61m 점프엔 1회만 발화.
    const refreshToken = vi
      .fn()
      .mockImplementation(
        refreshImpl ??
          (() =>
            Promise.resolve({ token: "iext_x2", expiresAt: new Date(Date.now() + NINETY_MIN).toISOString() })),
      );
    // 훅이 client.refreshToken 만 호출하므로 부분 mock 으로 충분 — 캐스트는 mock 생성부에 국소화(전역 우회 회피).
    const clientRef: { current: EiaClient | null } = {
      current: { refreshToken } as Pick<EiaClient, "refreshToken"> as EiaClient,
    };
    const refs: Parameters<typeof useTokenRefresh>[0] = {
      sessionRef: { current: session(over) },
      clientRef,
      configRef: { current: { triggerEndpointPath: "t1", apiBase: "http://api.test/api" } as BootMessage },
      // 실제 소유자(useWidget)가 무효화 시 증가시키는 세대 — 테스트는 직접 조작해 "세계가 바뀜"을 흉내낸다.
      worldGenRef: { current: 0 },
    };
    const { result, unmount } = renderHook(() => useTokenRefresh(refs));
    return { result, unmount, refs, refreshToken };
  }

  it("scheduleRefresh → delay(60m) 경과 시 refreshToken 호출 + sessionRef·저장 세션 갱신", async () => {
    const { result, refs, refreshToken } = setup();
    act(() => result.current.scheduleRefresh());
    await act(async () => {
      await vi.advanceTimersByTimeAsync(OVER_SIXTY_MIN_MS);
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
      await vi.advanceTimersByTimeAsync(OVER_SIXTY_MIN_MS);
    });
    expect(refreshToken).not.toHaveBeenCalled();
  });

  // `refreshToken` 이 in-flight 인 동안 세계가 바뀌면(새 대화·종료·언마운트) 지연 응답이
  // 새 세션을 옛 세션으로 덮거나 방금 지운 storage 를 되살리면 안 된다. 종전 `cancelledRef` 는
  // 언마운트에서만 set 이라 `teardownSession()`(새 대화·대화 종료) 경로를 통째로 놓쳤다.
  // (ai-review 2026-07-17 08_29_33 W5)
  it("refresh in-flight 중 세대 변경(새 대화) → 지연 응답이 세션·storage 를 되살리지 않는다", async () => {
    let resolveRefresh: ((v: { token: string; expiresAt: string }) => void) | null = null;
    const { result, refs, refreshToken } = setup({}, () => new Promise((r) => { resolveRefresh = r; }));

    act(() => result.current.scheduleRefresh());
    await act(async () => {
      await vi.advanceTimersByTimeAsync(OVER_SIXTY_MIN_MS);
    });
    expect(refreshToken).toHaveBeenCalledTimes(1);
    expect(resolveRefresh).not.toBeNull(); // 갱신 요청 in-flight.

    // 새 대화 — 소유자가 teardownSession 에서 세대를 올리고 세션을 교체한다.
    refs.worldGenRef.current += 1;
    refs.sessionRef.current = session({ executionId: "fresh", token: "iext_fresh" });
    window.sessionStorage.removeItem("clemvion-web-chat:session:t1");

    // 옛 세계의 갱신 응답이 뒤늦게 도착. 고정 횟수 microtask flush(`await Promise.resolve()` 반복)는
    // 체인 길이를 추측하는 것이라 쓰지 않는다 — 이 파일의 fake timer 는 `shouldAdvanceTime: true` 라
    // 타이머를 0ms 전진시키면 대기 중인 microtask 가 전부 배출된다(다른 테스트와 동일 관례).
    await act(async () => {
      resolveRefresh?.({ token: "iext_stale", expiresAt: new Date(Date.now() + NINETY_MIN).toISOString() });
      await vi.advanceTimersByTimeAsync(0);
    });

    // 새 세션이 옛 토큰으로 덮이지 않았고, 지운 storage 도 되살아나지 않았다.
    expect(refs.sessionRef.current?.token).toBe("iext_fresh");
    expect(window.sessionStorage.getItem("clemvion-web-chat:session:t1")).toBeNull();
  });

  it("언마운트 후 타이머 미발화", async () => {
    const { result, unmount, refreshToken } = setup();
    act(() => result.current.scheduleRefresh());
    unmount();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(OVER_SIXTY_MIN_MS);
    });
    expect(refreshToken).not.toHaveBeenCalled();
  });

  it("세션 없으면 예약 no-op", async () => {
    const { result, refs, refreshToken } = setup();
    refs.sessionRef.current = null;
    act(() => result.current.scheduleRefresh());
    await act(async () => {
      await vi.advanceTimersByTimeAsync(OVER_SIXTY_MIN_MS);
    });
    expect(refreshToken).not.toHaveBeenCalled();
  });

  it("refresh 실패(reject) → sessionRef 미변경, throw 전파 없음", async () => {
    const { result, refs } = setup({}, () => Promise.reject(new Error("401")));
    const before = refs.sessionRef.current?.token;
    act(() => result.current.scheduleRefresh());
    await act(async () => {
      await vi.advanceTimersByTimeAsync(OVER_SIXTY_MIN_MS);
    });
    // 실패는 console.warn 만 — 토큰 유지(SSE 는 hard expiry 까지), 예외 미전파.
    expect(refs.sessionRef.current?.token).toBe(before);
  });
});
