import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { useWidget } from "./use-widget";
import { TOKEN_REFRESH_LEAD_MS } from "./use-token-refresh";

/**
 * 주기 토큰 갱신과 `401` 복구가 같은 창에서 함께 도는 경합(NERV Task CLE-T-76775M).
 *
 * 두 경로가 `refresh-token` 을 부른다. (1) `use-token-refresh` 의 주기 타이머 (2) `seedWaitingFromStatus`
 * 가 `401` 을 받았을 때의 `recoverFromExpiredToken`. 평소에는 (2) 가 돌 일이 없다. `execution.replay_unavailable`
 * 폴백은 스트림이 열린 채 seed 를 fire-and-forget 으로 부르므로 그때만 주기 타이머와 겹친다.
 *
 * 경합이 사고가 되는 것은 **서버의 토큰 회전 규칙** 때문이다. 이 파일의 가짜 서버는 그 규칙만 흉내 낸다.
 * - 갱신 요청이 서버에 닿으면 옛 토큰을 그 자리에서 폐기하고 새 토큰을 발급한다
 *   (`interaction-token.service.ts` `refreshPerExecution` — 옛 jti 를 blacklist 한 뒤 발급).
 * - 폐기된 토큰으로 오는 요청은 상태 조회든 갱신이든 `401` 이다
 *   (`interaction.guard.ts` — blacklisted → `401 TOKEN_REVOKED`).
 *
 * 그래서 주기 갱신이 토큰을 회전시킨 뒤 옛 토큰을 들고 있던 재동기화가 `401` 을 받고, 같은 옛 토큰으로 한 번 더
 * 갱신을 보내 다시 `401` 을 받으면 **살아 있는 대화를 `execution.token_revoked` 로 끝낸다.**
 */

const ENDPOINTS = {
  stream: "/api/external/executions/e1/stream",
  submit: "/api/external/executions/e1/interact",
  status: "/api/external/executions/e1",
  cancel: "/api/external/executions/e1/cancel",
  refresh: "/api/external/executions/e1/refresh-token",
};
const API_BASE = "http://api.test/api";
const STORAGE_KEY = "clemvion-web-chat:session:t1";

/**
 * 주기 갱신 예약까지의 간격. 실경과시간 드리프트(초 단위)가 단계 경계를 흔들 수 없게 크게 잡는다
 * (`use-widget-eager-start.test.ts` 의 `PHASE_SCHEDULE_MS` 와 같은 이유).
 */
const SCHEDULE_MS = 90 * 60 * 1000;
const ADVANCE_PAST_SCHEDULE_MS = SCHEDULE_MS + 60 * 1000;
/** 발급하는 토큰의 수명 — 주기 갱신이 정확히 `SCHEDULE_MS` 뒤에 예약된다. */
const TOKEN_TTL_MS = TOKEN_REFRESH_LEAD_MS + SCHEDULE_MS;

/** 재동기화 스냅샷이 그리는 말풍선 — 재동기화가 실제로 일어났는지 이 문구로 본다. */
const RESYNC_TEXT = "재동기화된 표면";

interface Held {
  release: () => void;
}

/**
 * 토큰 회전 규칙만 흉내 낸 가짜 EIA 서버.
 *
 * 응답을 붙잡는 방식이 둘이다. 경합 창을 만드는 지점이 서로 달라서다.
 * - `holdRefresh`: 갱신은 **서버가 바로 처리**(옛 토큰 폐기 · 새 토큰 발급)하고 응답 전달만 늦춘다.
 *   "서버는 회전했지만 클라이언트는 아직 모른다" 는 창이다.
 * - `holdStatus`: 상태 조회는 **서버 도착 자체를 늦춘다**(놓아줄 때 그 시점 토큰 상태로 판정).
 *   "요청은 옛 토큰으로 떠났는데 서버에 닿기 전에 회전이 끝났다" 는 창이다.
 */
function installRotatingServer() {
  const valid = new Set<string>();
  let issued = 0;
  const issue = () => {
    issued += 1;
    const token = `iext_${issued}`;
    valid.add(token);
    return { token, expiresAt: new Date(Date.now() + TOKEN_TTL_MS).toISOString() };
  };
  const refreshTokensSent: string[] = [];
  const statusTokensSent: string[] = [];
  const heldRefresh: Held[] = [];
  const heldStatus: Held[] = [];
  const server = {
    holdRefresh: false,
    holdStatus: false,
    /** 재동기화 조회부터 대기 표면을 준다. 시작 직후 시드는 `running` 이라 표면이 없다. */
    waitingSurface: false,
    refreshTokensSent,
    statusTokensSent,
    heldRefresh,
    heldStatus,
    isValid: (token: string) => valid.has(token),
    /** 실행 종료 — 서버는 이 실행의 토큰을 모두 폐기한다. */
    revokeAll: () => valid.clear(),
  };

  const bearer = (init?: RequestInit) =>
    String((init?.headers as Record<string, string> | undefined)?.authorization ?? "").replace(/^Bearer /, "");
  const unauthorized = () => ({ ok: false, status: 401, json: async () => ({}) }) as Response;
  const ok = (data: unknown) => ({ ok: true, status: 200, json: async () => ({ data }) }) as Response;

  const statusResponse = (token: string): Response => {
    if (!valid.has(token)) return unauthorized();
    if (!server.waitingSurface) return ok({ executionId: "e1", status: "running" });
    return ok({
      executionId: "e1",
      status: "waiting_for_input",
      context: {
        interactionType: "ai_conversation",
        waitingNodeId: "n-resync",
        conversationThread: { turns: [{ source: "ai_assistant", text: RESYNC_TEXT }] },
      },
    });
  };

  const fetchMock = vi.fn((url: unknown, init?: RequestInit) => {
    const u = String(url);
    if (u.includes("/embed-config")) return Promise.reject(new Error("no embed-config"));
    if (u.includes("/api/hooks/") && init?.method === "POST") {
      return Promise.resolve({
        ok: true,
        status: 202,
        json: async () => ({
          data: { executionId: "e1", status: "pending", interaction: { ...issue(), endpoints: ENDPOINTS } },
        }),
      } as Response);
    }
    if (u.endsWith("/refresh-token") && init?.method === "POST") {
      const token = bearer(init);
      refreshTokensSent.push(token);
      // 서버 처리는 요청이 닿은 즉시 끝난다 — 응답을 붙잡아도 회전은 이미 일어났다.
      let response: Response;
      if (valid.has(token)) {
        valid.delete(token);
        response = ok(issue());
      } else {
        response = unauthorized();
      }
      if (!server.holdRefresh) return Promise.resolve(response);
      return new Promise<Response>((resolve) => heldRefresh.push({ release: () => resolve(response) }));
    }
    if (u.endsWith("/api/external/executions/e1") && (init?.method ?? "GET") === "GET") {
      const token = bearer(init);
      statusTokensSent.push(token);
      if (!server.holdStatus) return Promise.resolve(statusResponse(token));
      // 서버 도착을 늦춘다 — 판정은 놓아주는 시점의 토큰 상태로 한다.
      return new Promise<Response>((resolve) => heldStatus.push({ release: () => resolve(statusResponse(token)) }));
    }
    if (u.includes("/interact")) {
      return Promise.resolve({ ok: true, status: 202, json: async () => ({}) } as Response);
    }
    return Promise.reject(new Error(`unexpected fetch ${u}`));
  });
  vi.stubGlobal("fetch", fetchMock);
  return server;
}

class ControllableEventSource {
  readonly listeners: Record<string, (e: MessageEvent) => void> = {};
  addEventListener(type: string, listener: (ev: MessageEvent) => void) {
    this.listeners[type] = listener;
  }
  close() {}
  emit(type: string, data: unknown) {
    this.listeners[type]?.({ data: JSON.stringify(data) } as MessageEvent);
  }
}

function installEventSource() {
  let latest: ControllableEventSource | null = null;
  vi.stubGlobal("EventSource", class {
    constructor() {
      latest = new ControllableEventSource();
      return latest as unknown as this;
    }
  } as unknown as typeof EventSource);
  return { getEs: () => latest };
}

function boot() {
  act(() => {
    window.dispatchEvent(
      new MessageEvent("message", {
        origin: "http://host.test",
        data: { type: "wc:boot", payload: { apiBase: API_BASE, triggerEndpointPath: "t1", profile: {} } },
      }),
    );
  });
}

/** 대기 중인 비동기 체인을 전부 배출한다(macrotask 한 틱이 그 시점 microtask 큐를 비운다). */
async function flushAsync() {
  await act(async () => {
    await new Promise((r) => setTimeout(r, 0));
  });
}

/** 대화를 시작해 스트림을 열고 주기 갱신이 예약된 상태까지 간다. 첫 토큰은 `iext_1` 이다. */
async function startConversation() {
  const ended = recordEndedNotices();
  const server = installRotatingServer();
  const { getEs } = installEventSource();
  const { result } = renderHook(() => useWidget());
  boot();
  await waitFor(() => expect(result.current.config).not.toBeNull());
  act(() => result.current.actions.open());
  await waitFor(() => expect(getEs()).not.toBeNull());
  await waitFor(() => expect(server.statusTokensSent).toEqual(["iext_1"]));
  await flushAsync();
  return { server, getEs, result, ended };
}

/**
 * host 로 나간 `conversationEnded` 통지를 모은다. bridge 는
 * `parent.postMessage({ type: "wc:event", payload: { name, data } }, target)` 로 보낸다.
 */
function recordEndedNotices(): unknown[] {
  const ended: unknown[] = [];
  vi.spyOn(window.parent, "postMessage").mockImplementation(((msg: unknown) => {
    const m = msg as { type?: string; payload?: { name?: string } };
    if (m?.type === "wc:event" && m?.payload?.name === "conversationEnded") ended.push(m);
  }) as never);
  return ended;
}

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  window.sessionStorage.clear();
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("useWidget — 주기 갱신과 401 복구의 refresh 경합(replay_unavailable)", () => {
  it("창 A: 주기 갱신 응답이 오기 전에 재동기화가 401 을 받아도 대화를 끝내지 않는다", async () => {
    const { server, getEs, result, ended } = await startConversation();

    // (c) 주기 타이머 발화 — 서버는 iext_1 을 폐기하고 iext_2 를 발급했지만 응답은 아직 오지 않았다.
    server.holdRefresh = true;
    await act(async () => {
      await vi.advanceTimersByTimeAsync(ADVANCE_PAST_SCHEDULE_MS);
    });
    expect(server.refreshTokensSent).toEqual(["iext_1"]);
    expect(server.heldRefresh).toHaveLength(1);
    expect(server.isValid("iext_1")).toBe(false);

    // (a) 버퍼 만료 폴백 발화 → (b) 위젯은 아직 iext_1 을 들고 있어 상태 조회가 401 이다.
    server.waitingSurface = true;
    act(() => {
      getEs()?.emit("execution.replay_unavailable", { executionId: "e1" });
    });
    await flushAsync();
    expect(server.statusTokensSent.at(-1)).toBe("iext_1");

    // 주기 갱신의 응답이 도착한다.
    for (const held of server.heldRefresh.splice(0)) held.release();
    server.holdRefresh = false;
    await flushAsync();
    await flushAsync();

    // 대화는 살아 있다. 옛 토큰으로 갱신을 한 번 더 보내 401 을 받고 종료로 확정하면 안 된다.
    expect(result.current.state.phase).not.toBe("ended");
    expect(ended).toHaveLength(0);
    // 갱신 요청은 한 번만 나간다 — 두 경로가 같은 회전을 나눠 받는다.
    expect(server.refreshTokensSent).toEqual(["iext_1"]);
    expect(window.sessionStorage.getItem(STORAGE_KEY)).toContain("iext_2");
    // 재동기화는 새 토큰으로 다시 조회해 표면을 맞춘다(REQ-WCWIDGET-029).
    expect(server.statusTokensSent.at(-1)).toBe("iext_2");
    await waitFor(() =>
      expect(result.current.state.messages.some((m) => m.text === RESYNC_TEXT)).toBe(true),
    );

    // 주기 갱신 사이클도 살아 있다 — 다음 갱신은 새 토큰으로 나간다.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(ADVANCE_PAST_SCHEDULE_MS);
    });
    expect(server.refreshTokensSent).toEqual(["iext_1", "iext_2"]);
    expect(window.sessionStorage.getItem(STORAGE_KEY)).toContain("iext_3");
  });

  it("창 B: 상태 조회가 서버에 닿기 전에 주기 갱신이 회전을 끝내도 대화를 끝내지 않는다", async () => {
    const { server, getEs, result, ended } = await startConversation();

    // (a) 버퍼 만료 폴백 발화 — 상태 조회는 iext_1 로 떠났지만 아직 서버에 닿지 않았다.
    server.holdStatus = true;
    server.waitingSurface = true;
    act(() => {
      getEs()?.emit("execution.replay_unavailable", { executionId: "e1" });
    });
    await flushAsync();
    expect(server.heldStatus).toHaveLength(1);

    // (c) 주기 타이머 발화 — 회전이 끝나 위젯은 iext_2 를 갖는다.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(ADVANCE_PAST_SCHEDULE_MS);
    });
    expect(server.refreshTokensSent).toEqual(["iext_1"]);
    expect(window.sessionStorage.getItem(STORAGE_KEY)).toContain("iext_2");

    // (b) 상태 조회가 이제 서버에 닿는다 — iext_1 은 폐기돼 401 이다.
    server.holdStatus = false;
    for (const held of server.heldStatus.splice(0)) held.release();
    await flushAsync();
    await flushAsync();

    expect(result.current.state.phase).not.toBe("ended");
    expect(ended).toHaveLength(0);
    // 이미 회전된 옛 토큰으로 갱신을 다시 보내지 않는다.
    expect(server.refreshTokensSent).toEqual(["iext_1"]);
    expect(window.sessionStorage.getItem(STORAGE_KEY)).toContain("iext_2");
    expect(server.statusTokensSent.at(-1)).toBe("iext_2");
    await waitFor(() =>
      expect(result.current.state.messages.some((m) => m.text === RESYNC_TEXT)).toBe(true),
    );
  });
  // 대조군: 단일화가 진짜 폐기까지 삼키면 안 된다. 실행이 끝나 토큰이 모두 폐기됐으면 종전처럼 종료로 확정한다.
  it("대조 A: 합류한 주기 갱신이 거부되면(실행 종료) 복구도 종료로 확정하고 갱신은 한 번만 나간다", async () => {
    const { server, getEs, result, ended } = await startConversation();

    server.revokeAll();
    server.holdRefresh = true;
    await act(async () => {
      await vi.advanceTimersByTimeAsync(ADVANCE_PAST_SCHEDULE_MS);
    });
    expect(server.refreshTokensSent).toEqual(["iext_1"]);
    expect(server.heldRefresh).toHaveLength(1);

    act(() => {
      getEs()?.emit("execution.replay_unavailable", { executionId: "e1" });
    });
    await flushAsync();
    expect(server.statusTokensSent.at(-1)).toBe("iext_1");

    for (const held of server.heldRefresh.splice(0)) held.release();
    server.holdRefresh = false;
    await flushAsync();
    await flushAsync();

    await waitFor(() => expect(result.current.state.phase).toBe("ended"));
    expect(ended).toHaveLength(1);
    expect(ended[0]).toMatchObject({ payload: { data: { reason: "execution.token_revoked" } } });
    expect(server.refreshTokensSent).toEqual(["iext_1"]);
  });

  it("대조 B: 회전 뒤 실행이 끝났으면 새 토큰으로 다시 조회 · 갱신해 보고 종료로 확정한다", async () => {
    const { server, getEs, result, ended } = await startConversation();

    server.holdStatus = true;
    act(() => {
      getEs()?.emit("execution.replay_unavailable", { executionId: "e1" });
    });
    await flushAsync();
    expect(server.heldStatus).toHaveLength(1);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(ADVANCE_PAST_SCHEDULE_MS);
    });
    expect(window.sessionStorage.getItem(STORAGE_KEY)).toContain("iext_2");

    // 회전 직후 실행이 끝났다 — iext_2 도 폐기됐다.
    server.revokeAll();
    server.holdStatus = false;
    for (const held of server.heldStatus.splice(0)) held.release();
    await flushAsync();
    await flushAsync();

    await waitFor(() => expect(result.current.state.phase).toBe("ended"));
    expect(ended).toHaveLength(1);
    expect(ended[0]).toMatchObject({ payload: { data: { reason: "execution.token_revoked" } } });
    // 옛 토큰은 다시 보내지 않고, 새 토큰으로 조회 한 번 · 갱신 한 번을 해 본 뒤 끝낸다.
    expect(server.refreshTokensSent).toEqual(["iext_1", "iext_2"]);
    expect(server.statusTokensSent.slice(-2)).toEqual(["iext_1", "iext_2"]);
  });
});
