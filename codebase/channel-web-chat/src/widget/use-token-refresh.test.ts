import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import {
  refreshDelayMs,
  retryDelayMs,
  TOKEN_REFRESH_LEAD_MS,
  TOKEN_REFRESH_MIN_DELAY_MS,
  TOKEN_REFRESH_RETRY_BASE_MS,
  TOKEN_REFRESH_RETRY_MAX_DELAY_MS,
  useTokenRefresh,
} from "./use-token-refresh";
import { EiaError, type EiaClient } from "@/lib/eia-client";
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
    apiBase: "http://api.test/api",
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

describe("retryDelayMs — 일시적 갱신 실패 백오프", () => {
  it("연속 실패마다 2배로 늘어난다", () => {
    expect(retryDelayMs(1)).toBe(TOKEN_REFRESH_RETRY_BASE_MS);
    expect(retryDelayMs(2)).toBe(TOKEN_REFRESH_RETRY_BASE_MS * 2);
    expect(retryDelayMs(3)).toBe(TOKEN_REFRESH_RETRY_BASE_MS * 4);
  });
  it("상한에서 클램프된다 — 무기한 재시도하되 폭주하지 않는다", () => {
    expect(retryDelayMs(50)).toBe(TOKEN_REFRESH_RETRY_MAX_DELAY_MS);
  });
  it("0·음수도 base 로 수렴한다(호출부 계약 위반 시 5초 폭주 대신 안전한 하한)", () => {
    expect(retryDelayMs(0)).toBe(TOKEN_REFRESH_RETRY_BASE_MS);
    expect(retryDelayMs(-3)).toBe(TOKEN_REFRESH_RETRY_BASE_MS);
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

  function setup(
    over: Partial<PersistedSession> = {},
    refreshImpl?: () => Promise<unknown>,
    onRefreshed?: (s: PersistedSession) => void,
  ) {
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
      onRefreshed,
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
    // **발급 origin 보존** — 현재는 `{...currentSession, token, expiresAt}` spread 라 암묵
    // 보존되지만, 필드 나열 방식으로 리팩터하면 `apiBase` 가 조용히 탈락한다. 그러면 다음
    // 새로고침에서 fail-safe 폐기가 발동해 **정상 세션이 매번 리셋되는** 회귀가 된다
    // (ai-review testing W5).
    const stored = JSON.parse(
      window.sessionStorage.getItem("clemvion-web-chat:session:t1") ?? "{}",
    ) as { apiBase?: string };
    expect(stored.apiBase).toBe("http://api.test/api");
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
    // 실패해도 토큰은 유지되고(SSE 는 hard expiry 까지) 예외가 밖으로 새지 않는다.
    // (재시도 여부는 아래 두 테스트가 축별로 가른다.)
    expect(refs.sessionRef.current?.token).toBe(before);
  });

  /**
   * **한 번의 일시적 실패로 갱신 사이클이 죽으면 안 된다.**
   *
   * 종전 `.catch()` 는 `console.warn` 만 하고 재예약을 하지 않았다. 재로드 복구가 실패해
   * `SeedOutcome` 이 `"refresh_deferred"` 를 돌려준 경로는 **이 훅의 예약에 복구를 통째로
   * 맡기므로**, 여기서 포기하면 위젯이 스피너에 영구 고착된다
   * (ai-review `17_15_33_2` requirement CRITICAL).
   *
   * **한 번에 61분을 점프하면 이 결함을 못 가른다** — 백오프 재시도가 그 창 안에서 전부
   * 발화해 "고쳐진 코드"와 "재예약 없는 코드"가 둘 다 `호출≥1` 로 보인다. 발화 지점을
   * 백오프 간격대로 끊어 **횟수의 증가**를 관측한다.
   */
  it("일시적 실패(네트워크) → 백오프로 재예약 — 사이클이 죽지 않는다", async () => {
    const { result, refreshToken } = setup({}, () => Promise.reject(new TypeError("network down")));
    act(() => result.current.scheduleRefresh());

    // 최초 예약(만료 90m - lead 30m = 60m) 발화.
    await act(async () => { await vi.advanceTimersByTimeAsync(60 * 60 * 1000 + 1); });
    expect(refreshToken).toHaveBeenCalledTimes(1);

    // 1차 백오프(base) 뒤 재발화 — 재예약이 없으면 여기서 멈춘다.
    await act(async () => { await vi.advanceTimersByTimeAsync(TOKEN_REFRESH_RETRY_BASE_MS); });
    expect(refreshToken).toHaveBeenCalledTimes(2);

    // 2차 백오프는 **2배** — base 만큼만 밀면 아직 안 온다(백오프가 자란다는 관측).
    await act(async () => { await vi.advanceTimersByTimeAsync(TOKEN_REFRESH_RETRY_BASE_MS); });
    expect(refreshToken).toHaveBeenCalledTimes(2);
    await act(async () => { await vi.advanceTimersByTimeAsync(TOKEN_REFRESH_RETRY_BASE_MS); });
    expect(refreshToken).toHaveBeenCalledTimes(3);
  });

  /**
   * 위 테스트의 **반대 축** — `401`/`410` 은 재시도해도 살아나지 않는다(만료·jti blacklist·종료).
   * 이 경계가 없으면 죽은 토큰으로 5분마다 영구히 두드린다. 재시도 조건을 `true` 로 넓히는
   * 뮤턴트를 이 테스트가 잡는다.
   */
  it("`401` 실패는 재시도하지 않는다 — 복구 불가 축", async () => {
    const { result, refreshToken } = setup({}, () => Promise.reject(new EiaError("revoked", 401)));
    act(() => result.current.scheduleRefresh());
    await act(async () => { await vi.advanceTimersByTimeAsync(60 * 60 * 1000 + 1); });
    expect(refreshToken).toHaveBeenCalledTimes(1);
    // 백오프 상한을 훌쩍 넘겨도 두 번째 시도가 없다.
    await act(async () => { await vi.advanceTimersByTimeAsync(TOKEN_REFRESH_RETRY_MAX_DELAY_MS * 3); });
    expect(refreshToken).toHaveBeenCalledTimes(1);
  });

  /** 세계가 바뀐 뒤(새 대화·종료) 도착한 실패는 재시도도 하지 않는다 — 옛 세션의 백그라운드 폭주 방지. */
  it("실패 응답 도착 시 세대가 바뀌어 있으면 재시도하지 않는다", async () => {
    let rejectRefresh: ((e: unknown) => void) | null = null;
    const { result, refs, refreshToken } = setup({}, () => new Promise((_, rj) => { rejectRefresh = rj; }));
    act(() => result.current.scheduleRefresh());
    await act(async () => { await vi.advanceTimersByTimeAsync(60 * 60 * 1000 + 1); });
    expect(refreshToken).toHaveBeenCalledTimes(1);

    refs.worldGenRef.current += 1; // 새 대화 — 이 세계는 폐기됐다.
    await act(async () => {
      rejectRefresh?.(new TypeError("network down"));
      await vi.advanceTimersByTimeAsync(0);
    });
    await act(async () => { await vi.advanceTimersByTimeAsync(TOKEN_REFRESH_RETRY_MAX_DELAY_MS * 2); });
    expect(refreshToken).toHaveBeenCalledTimes(1);
  });

  /**
   * 갱신 성공은 소유자에게 통지된다 — `refresh_deferred` 로 **미뤄 둔 스트림**을 여는 유일한 신호다.
   * 이 콜백이 없으면 토큰이 살아나도 스트림이 영영 안 열린다(같은 CRITICAL 의 나머지 절반).
   */
  it("갱신 성공 → onRefreshed 가 **갱신된** 세션으로 불린다", async () => {
    const seen: PersistedSession[] = [];
    const { result } = setup({}, undefined, (s) => { seen.push(s); });
    act(() => result.current.scheduleRefresh());
    await act(async () => { await vi.advanceTimersByTimeAsync(OVER_SIXTY_MIN_MS); });
    expect(seen).toHaveLength(1);
    // **갱신 전 세션이 아니라 갱신 후 세션** — 옛 토큰을 받으면 호출부가 죽은 토큰으로 스트림을 연다.
    expect(seen[0]?.token).toBe("iext_x2");
  });

  it("갱신 실패 시에는 onRefreshed 가 불리지 않는다", async () => {
    const seen: PersistedSession[] = [];
    const { result } = setup({}, () => Promise.reject(new EiaError("revoked", 401)), (s) => { seen.push(s); });
    act(() => result.current.scheduleRefresh());
    await act(async () => { await vi.advanceTimersByTimeAsync(OVER_SIXTY_MIN_MS); });
    expect(seen).toHaveLength(0);
  });
});
