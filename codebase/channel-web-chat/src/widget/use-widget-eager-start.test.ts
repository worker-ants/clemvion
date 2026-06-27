import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { useWidget } from "./use-widget";

// eager 시작(§R6) — 패널 open 시 워크플로우 시작, firstMessage 미동봉, 중복 open 단일 시작.

// I8: 타이밍 대기 상수 추출 — 추가 POST 없음을 검증하는 반-단언 대기 시간.
const NO_EXTRA_CALL_WAIT_MS = 20;
// I9: 토큰 만료 90분(ms) 상수 추출.
const NINETY_MIN_MS = 90 * 60 * 1000;

const ENDPOINTS = {
  stream: "/api/external/executions/e1/stream",
  submit: "/api/external/executions/e1/interact",
  status: "/api/external/executions/e1",
  cancel: "/api/external/executions/e1/cancel",
  refresh: "/api/external/executions/e1/refresh-token",
};

// 이벤트 주입 가능한 FakeEventSource — C1/W7/W8 테스트에서 SSE 이벤트를 수동으로 dispatch 한다.
class ControllableEventSource {
  readonly listeners: Record<string, (e: MessageEvent) => void> = {};
  addEventListener(type: string, listener: (ev: MessageEvent) => void) {
    this.listeners[type] = listener;
  }
  close() {}
  /** SSE 이벤트를 직접 주입 */
  emit(type: string, data: unknown) {
    this.listeners[type]?.({ data: JSON.stringify(data) } as MessageEvent);
  }
}

class FakeEventSource {
  addEventListener() {}
  close() {}
}

/** embed-config → fail-open(reject), webhook POST → 202 enveloped({data}). */
function installFetch(overrides?: { webhookStatus?: number }) {
  const fetchMock = vi.fn((url: unknown, init?: RequestInit) => {
    const u = String(url);
    if (u.includes("/embed-config")) return Promise.reject(new Error("no embed-config"));
    if (u.includes("/api/hooks/") && init?.method === "POST") {
      const status = overrides?.webhookStatus ?? 202;
      if (status >= 400) {
        return Promise.resolve({ ok: false, status, json: async () => ({}) } as Response);
      }
      return Promise.resolve({
        ok: true,
        status: 202,
        json: async () => ({
          data: {
            executionId: "e1",
            status: "pending",
            interaction: { token: "iext_x", expiresAt: new Date(Date.now() + NINETY_MIN_MS).toISOString(), endpoints: ENDPOINTS },
          },
        }),
      } as Response);
    }
    return Promise.reject(new Error(`unexpected fetch ${u}`));
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

/**
 * ControllableEventSource + fetch(embed-config reject, webhook 202, interact 202) 설치.
 * SSE 이벤트를 수동 주입하는 C1 flush/폐기 테스트 공용. `getEs()` 로 최신 인스턴스 접근.
 */
function installControllableSse() {
  let latest: ControllableEventSource | null = null;
  const fetchMock = vi.fn((url: unknown, init?: RequestInit) => {
    const u = String(url);
    if (u.includes("/embed-config")) return Promise.reject(new Error("no embed-config"));
    if (u.includes("/api/hooks/") && init?.method === "POST") {
      return Promise.resolve({
        ok: true,
        status: 202,
        json: async () => ({
          data: {
            executionId: "e1",
            status: "pending",
            interaction: { token: "iext_x", expiresAt: new Date(Date.now() + NINETY_MIN_MS).toISOString(), endpoints: ENDPOINTS },
          },
        }),
      } as Response);
    }
    if (u.includes("/interact")) {
      return Promise.resolve({ ok: true, status: 202, json: async () => ({}) } as Response);
    }
    return Promise.reject(new Error(`unexpected fetch ${u}`));
  });
  vi.stubGlobal("fetch", fetchMock);
  vi.stubGlobal("EventSource", class {
    constructor() {
      latest = new ControllableEventSource();
      return latest;
    }
    addEventListener() {}
    close() {}
  });
  return { fetchMock, getEs: () => latest };
}

function boot() {
  act(() => {
    window.dispatchEvent(
      new MessageEvent("message", {
        // host origin 핀 — 미지정 시 jsdom 의 e.origin="" 가 bridge.sendEvent 의 postMessage targetOrigin 을
        // 깨뜨린다(open() 이 sendEvent("open") 호출). 실제 브라우저에선 실 origin.
        origin: "http://host.test",
        data: {
          type: "wc:boot",
          payload: { apiBase: "http://api.test/api", triggerEndpointPath: "t1", profile: { plan: "free" } },
        },
      }),
    );
  });
}

function webhookPosts(fetchMock: ReturnType<typeof installFetch>) {
  return fetchMock.mock.calls.filter(
    (c) => String(c[0]).includes("/api/hooks/") && (c[1] as RequestInit | undefined)?.method === "POST",
  );
}

function interactCalls(fetchMock: ReturnType<typeof installFetch>) {
  return fetchMock.mock.calls.filter(
    (c) => String(c[0]).includes("/interact"),
  );
}

beforeEach(() => {
  vi.stubGlobal("EventSource", FakeEventSource);
  window.localStorage.clear();
});
afterEach(() => {
  vi.unstubAllGlobals();
});

describe("useWidget — eager 시작(§R6)", () => {
  it("open() → 워크플로우 시작(POST hooks), firstMessage 미포함·profile 포함", async () => {
    const fetchMock = installFetch();
    const { result } = renderHook(() => useWidget());
    boot();
    await waitFor(() => expect(result.current.config).not.toBeNull());

    act(() => result.current.actions.open());
    await waitFor(() => expect(webhookPosts(fetchMock).length).toBe(1));

    const body = JSON.parse((webhookPosts(fetchMock)[0][1] as RequestInit).body as string);
    expect(body).toHaveProperty("profile");
    expect(body).not.toHaveProperty("firstMessage"); // §R6 — firstMessage 폐기
  });

  it("open() 중복 호출 → execution 1회만 시작(startedRef 가드)", async () => {
    const fetchMock = installFetch();
    const { result } = renderHook(() => useWidget());
    boot();
    await waitFor(() => expect(result.current.config).not.toBeNull());

    act(() => {
      result.current.actions.open();
      result.current.actions.open();
    });
    await waitFor(() => expect(webhookPosts(fetchMock).length).toBe(1));
    // 잠시 더 기다려도 추가 POST 없음.
    await new Promise((r) => setTimeout(r, NO_EXTRA_CALL_WAIT_MS));
    expect(webhookPosts(fetchMock).length).toBe(1);
  });

  it("저장 세션 복원 시 open() 은 새 execution 을 시작하지 않음", async () => {
    // 사전 저장된 세션 — applyConfig 가 RESTORED 로 복원하고 startedRef=true.
    window.localStorage.setItem(
      "clemvion-web-chat:session:t1",
      JSON.stringify({ executionId: "prev", token: "iext_prev", expiresAt: new Date(Date.now() + NINETY_MIN_MS).toISOString(), endpoints: ENDPOINTS }),
    );
    const fetchMock = installFetch();
    const { result } = renderHook(() => useWidget());
    boot();
    await waitFor(() => expect(result.current.state.executionId).toBe("prev"));

    act(() => result.current.actions.open());
    await new Promise((r) => setTimeout(r, NO_EXTRA_CALL_WAIT_MS));
    expect(webhookPosts(fetchMock).length).toBe(0); // 복원 세션 → 신규 시작 없음
  });

  // C1 회귀 테스트 — 런처 버블/추천질문 탭 후 텍스트 유실 없음(queue-and-flush).
  it("C1: open 직후(booting) submitMessage → 첫 ai_conversation waiting 도착 시 submit_message 로 flush(텍스트 유실 없음)", async () => {
    // ControllableEventSource 로 SSE 이벤트를 수동 주입.
    let latestEs: ControllableEventSource | null = null;
    const fetchMock = vi.fn((url: unknown, init?: RequestInit) => {
      const u = String(url);
      if (u.includes("/embed-config")) return Promise.reject(new Error("no embed-config"));
      if (u.includes("/api/hooks/") && init?.method === "POST") {
        return Promise.resolve({
          ok: true,
          status: 202,
          json: async () => ({
            data: {
              executionId: "e1",
              status: "pending",
              interaction: { token: "iext_x", expiresAt: new Date(Date.now() + NINETY_MIN_MS).toISOString(), endpoints: ENDPOINTS },
            },
          }),
        } as Response);
      }
      if (u.includes("/interact")) {
        return Promise.resolve({ ok: true, status: 202, json: async () => ({}) } as Response);
      }
      return Promise.reject(new Error(`unexpected fetch ${u}`));
    });
    vi.stubGlobal("fetch", fetchMock);
    vi.stubGlobal("EventSource", class {
      constructor() { latestEs = new ControllableEventSource(); return latestEs; }
      addEventListener() {}
      close() {}
    });

    const { result } = renderHook(() => useWidget());
    boot();
    await waitFor(() => expect(result.current.config).not.toBeNull());

    // open() 후 즉시 submitMessage — 이 시점 booting 중이라 sessionRef.current 가 없거나 phase !== awaiting.
    act(() => result.current.actions.open());
    // open → webhook POST 완료 대기 후 submitMessage 를 큐에 넣는다(상태가 streaming/booting 인 시점).
    await waitFor(() => expect(webhookPosts(fetchMock).length).toBe(1));
    // phase 가 아직 awaiting_user_message 가 아닌 상태(streaming)에서 submitMessage → 큐.
    act(() => result.current.actions.submitMessage("큐 텍스트"));
    // interact 가 아직 호출되지 않아야 함(큐에만 있음).
    expect(interactCalls(fetchMock).length).toBe(0);

    // SSE waiting_for_input 이벤트 주입 → awaiting_user_message 진입 → flush effect 가 submit_message 호출.
    act(() => {
      latestEs?.emit("execution.waiting_for_input", {
        type: "ai_conversation",
        nodeId: "n1",
        config: {},
        conversationThread: [],
      });
    });
    // flush effect 가 submit_message 를 sendCommand 로 전송해야 한다.
    await waitFor(() => expect(interactCalls(fetchMock).length).toBe(1));
    const interactBody = JSON.parse((interactCalls(fetchMock)[0][1] as RequestInit).body as string);
    expect(interactBody).toMatchObject({ command: "submit_message", message: "큐 텍스트" });
  });

  // C1 폐기 — 첫 표면이 buttons/form 이면 큐된 자유 텍스트를 폐기(잘못된 표면 오제출 방지, §R6).
  it("C1 폐기: open 직후 큐된 텍스트는 첫 waiting 이 buttons 면 폐기(submit_message 미전송)", async () => {
    const { fetchMock, getEs } = installControllableSse();
    const { result } = renderHook(() => useWidget());
    boot();
    await waitFor(() => expect(result.current.config).not.toBeNull());

    act(() => result.current.actions.open());
    await waitFor(() => expect(webhookPosts(fetchMock).length).toBe(1));
    // booting/streaming 중 submitMessage → 큐에만 보관(interact 미발생).
    act(() => result.current.actions.submitMessage("폐기될 텍스트"));
    expect(interactCalls(fetchMock).length).toBe(0);

    // 첫 waiting 표면이 buttons → 자유 텍스트 제출 비대상 → 큐 폐기(flush effect 의 else 분기).
    // SSE wire 형식: interactionType/waitingNodeId/buttonConfig (eia-events.parseWaitingForInput).
    act(() => {
      getEs()?.emit("execution.waiting_for_input", {
        interactionType: "buttons",
        waitingNodeId: "n1",
        buttonConfig: { buttons: [{ id: "b1", label: "예" }] },
        conversationThread: [],
      });
    });
    await waitFor(() => expect(result.current.state.pending?.type).toBe("buttons"));
    // 큐가 폐기됐으므로 interact(submit_message)는 끝까지 발생하지 않는다.
    await new Promise((r) => setTimeout(r, NO_EXTRA_CALL_WAIT_MS));
    expect(interactCalls(fetchMock).length).toBe(0);
  });

  // W7 — newChat() 후 기존 세션 정리 + 새 webhook POST 1회.
  it("W7: newChat() → 기존 세션 정리 후 새 webhook POST 1회", async () => {
    const fetchMock = installFetch();
    const { result } = renderHook(() => useWidget());
    boot();
    await waitFor(() => expect(result.current.config).not.toBeNull());

    // 첫 open → POST 1회.
    act(() => result.current.actions.open());
    await waitFor(() => expect(webhookPosts(fetchMock).length).toBe(1));

    // newChat → 기존 세션 정리 + 새 POST.
    act(() => result.current.actions.newChat());
    await waitFor(() => expect(webhookPosts(fetchMock).length).toBe(2));
    await new Promise((r) => setTimeout(r, NO_EXTRA_CALL_WAIT_MS));
    // 3회째 POST 없음.
    expect(webhookPosts(fetchMock).length).toBe(2);
  });

  // W8 — webhook 500 실패 → ERROR → 재open 시 새 POST 발생(startedRef 복구).
  it("W8: webhook 500 실패 → ERROR phase → 재open 시 새 POST 발생(startedRef 복구)", async () => {
    let callCount = 0;
    const fetchMock = vi.fn((url: unknown, init?: RequestInit) => {
      const u = String(url);
      if (u.includes("/embed-config")) return Promise.reject(new Error("no embed-config"));
      if (u.includes("/api/hooks/") && init?.method === "POST") {
        callCount++;
        if (callCount === 1) {
          // 첫 번째 POST → 500 실패.
          return Promise.resolve({ ok: false, status: 500, json: async () => ({}) } as Response);
        }
        // 두 번째 POST(재시도) → 성공.
        return Promise.resolve({
          ok: true,
          status: 202,
          json: async () => ({
            data: {
              executionId: "e2",
              status: "pending",
              interaction: { token: "iext_y", expiresAt: new Date(Date.now() + NINETY_MIN_MS).toISOString(), endpoints: ENDPOINTS },
            },
          }),
        } as Response);
      }
      return Promise.reject(new Error(`unexpected fetch ${u}`));
    });
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() => useWidget());
    boot();
    await waitFor(() => expect(result.current.config).not.toBeNull());

    // 첫 open → 500 실패 → ERROR phase.
    act(() => result.current.actions.open());
    await waitFor(() => expect(result.current.state.phase).toBe("ended")); // ERROR → ended

    // 재open → startedRef 가 false 로 복구됐으므로 새 POST 발생.
    act(() => result.current.actions.open());
    // executionId state 커밋을 직접 대기 — callCount===2(fetch 호출)는 두 번째
    // POST 가 resolve 되어 executionId 가 state 에 반영되기 *전*에 도달하므로,
    // callCount 를 기다린 뒤 곧바로 executionId 를 단언하면 race 로 flaky 했다.
    await waitFor(() => expect(result.current.state.executionId).toBe("e2"));
    expect(callCount).toBe(2);
  });

  // race fix(§R6) — start 직후 빠른 첫 노드(buttons)의 waiting 이벤트를 SSE 구독 전 놓쳐도
  // getStatus 시드로 현재 표면을 복원한다(미리보기 캐러셀 미표시 회귀 방지).
  it("race fix: getStatus 가 buttons waiting 표면을 주면 SSE 없이도 pending=buttons 로 시드", async () => {
    const fetchMock = vi.fn((url: unknown, init?: RequestInit) => {
      const u = String(url);
      if (u.includes("/embed-config")) return Promise.reject(new Error("no embed-config"));
      if (u.includes("/api/hooks/") && init?.method === "POST") {
        return Promise.resolve({
          ok: true,
          status: 202,
          json: async () => ({
            data: {
              executionId: "e1",
              status: "pending",
              interaction: { token: "iext_x", expiresAt: new Date(Date.now() + NINETY_MIN_MS).toISOString(), endpoints: ENDPOINTS },
            },
          }),
        } as Response);
      }
      // getStatus(GET status) — waiting buttons 표면(SSE wire 형식)을 반환.
      if (u.endsWith("/api/external/executions/e1") && (init?.method ?? "GET") === "GET") {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({
            data: {
              id: "e1",
              status: "waiting_for_input",
              seq: 1,
              context: {
                interactionType: "buttons",
                waitingNodeId: "n1",
                buttonConfig: { buttons: [{ id: "b1", label: "문의" }] },
              },
            },
          }),
        } as Response);
      }
      return Promise.reject(new Error(`unexpected fetch ${u}`));
    });
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() => useWidget());
    boot();
    await waitFor(() => expect(result.current.config).not.toBeNull());
    act(() => result.current.actions.open());
    // SSE 이벤트 주입 없이 getStatus 시드만으로 buttons 표면이 복원돼야 한다.
    await waitFor(() => expect(result.current.state.pending?.type).toBe("buttons"));
    expect(result.current.state.phase).toBe("awaiting_user_message");
  });

  // 토큰 자동 갱신 타이머(3-auth-session §3 step7) — refreshDelayMs 순수계산은 use-widget.test.ts 가
  // 검증하고, 여기서는 실제 setTimeout 발화 → refresh-token 호출까지를 fake timer 로 결정적 검증한다.
  it("fake timer: BOOTED 후 refresh delay(만료 30분 전) 경과 → refresh-token 호출", async () => {
    // shouldAdvanceTime: RTL waitFor 내부 폴링이 동작하도록 실시간과 함께 진행하되,
    // 60분 refresh 지연은 advanceTimersByTimeAsync 로 점프해 결정적으로 발화시킨다.
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      const fetchMock = vi.fn((url: unknown, init?: RequestInit) => {
        const u = String(url);
        if (u.includes("/embed-config")) return Promise.reject(new Error("no embed-config"));
        if (u.includes("/api/hooks/") && init?.method === "POST") {
          return Promise.resolve({
            ok: true,
            status: 202,
            json: async () => ({
              data: {
                executionId: "e1",
                status: "pending",
                interaction: { token: "iext_x", expiresAt: new Date(Date.now() + NINETY_MIN_MS).toISOString(), endpoints: ENDPOINTS },
              },
            }),
          } as Response);
        }
        if (u.includes("/refresh-token") && init?.method === "POST") {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: async () => ({ data: { token: "iext_x2", expiresAt: new Date(Date.now() + NINETY_MIN_MS).toISOString() } }),
          } as Response);
        }
        // getStatus(GET status) — 비-waiting 으로 무난히 응답(시드 dispatch 없음).
        return Promise.resolve({ ok: true, status: 200, json: async () => ({ data: { id: "e1", status: "streaming" } }) } as Response);
      });
      vi.stubGlobal("fetch", fetchMock);

      const { result } = renderHook(() => useWidget());
      boot();
      await waitFor(() => expect(result.current.config).not.toBeNull());
      act(() => result.current.actions.open());
      await waitFor(() => expect(result.current.state.executionId).toBe("e1"));

      // refresh delay = 90분 - 30분 lead = 60분. 그 너머로 점프 → refresh-token 1회 발화.
      await act(async () => {
        await vi.advanceTimersByTimeAsync(61 * 60 * 1000);
      });
      // `>= 1`: 갱신 성공 후 scheduleRefresh 가 다음 만료 기준(~+60분)으로 재예약하므로, 61분 점프가
      // 경계에서 2회째를 스칠 수 있어 정확히 1회로 못박지 않는다(재귀 재예약 동작 자체는 정상).
      const refreshCalls = fetchMock.mock.calls.filter((c) => String(c[0]).includes("/refresh-token"));
      expect(refreshCalls.length).toBeGreaterThanOrEqual(1);
    } finally {
      vi.useRealTimers();
    }
  });

  // race fix — openStream 을 lastEventId="0" 으로 열어 buffer 의 누락 이벤트(seq≥1)를 replay 받는다.
  it("race fix: openStream 을 lastEventId=0 으로 열어 buffer replay 를 요청", async () => {
    let esUrl = "";
    vi.stubGlobal(
      "EventSource",
      class {
        constructor(url: string) {
          esUrl = url;
        }
        addEventListener() {}
        close() {}
      },
    );
    installFetch();
    const { result } = renderHook(() => useWidget());
    boot();
    await waitFor(() => expect(result.current.config).not.toBeNull());
    act(() => result.current.actions.open());
    await waitFor(() => expect(esUrl).toContain("/stream"));
    expect(esUrl).toContain("lastEventId=0");
  });
});
