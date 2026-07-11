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
  // EventSource stub: constructor 가 ControllableEventSource 인스턴스를 반환해 테스트가
  // latest.emit() 으로 SSE 이벤트를 주입한다. anonymous class constructor 가 자신과 다른
  // 인스턴스를 반환하면 TS 가 instance type 불일치(TS2409)를 내므로 `as unknown as this` 로
  // 우회하고, stubGlobal 인자 타입은 `typeof EventSource` 로 캐스팅한다. 런타임 동작 불변.
  vi.stubGlobal("EventSource", class {
    constructor() {
      latest = new ControllableEventSource();
      return latest as unknown as this;
    }
    addEventListener() {}
    close() {}
  } as unknown as typeof EventSource);
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
  window.sessionStorage.clear();
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
    window.sessionStorage.setItem(
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
      constructor() { latestEs = new ControllableEventSource(); return latestEs as unknown as this; }
      addEventListener() {}
      close() {}
    } as unknown as typeof EventSource);

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

  // W1 — start 실패 시 UI 에러 문구는 일반화되어 서버/내부 원문을 노출하지 않는다(4-security §5).
  it("W1: webhook 실패 → state.error 는 일반화 문구(서버/예외 원문 미노출)", async () => {
    const fetchMock = installFetch({ webhookStatus: 500 });
    const { result } = renderHook(() => useWidget());
    boot();
    await waitFor(() => expect(result.current.config).not.toBeNull());

    act(() => result.current.actions.open());
    await waitFor(() => expect(result.current.state.phase).toBe("ended"));

    const err = result.current.state.error ?? "";
    // 일반화 문구 노출.
    expect(err).toContain("잠시 후 새 대화로 다시 시도");
    // 내부 원문(HTTP status·예외 message 등) 미노출.
    expect(err).not.toMatch(/500|EiaError|fetch|undefined/i);
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

describe("useWidget — 대화 종료(endConversation, §3.1)", () => {
  it("대기 중 ai_conversation(nodeId 보유) → end_conversation(graceful) 전송 후 ended + 저장세션 정리", async () => {
    const { fetchMock, getEs } = installControllableSse();
    const { result } = renderHook(() => useWidget());
    boot();
    await waitFor(() => expect(result.current.config).not.toBeNull());
    act(() => result.current.actions.open());
    await waitFor(() => expect(webhookPosts(fetchMock).length).toBe(1));
    // ai_conversation waiting 진입 — waitingNodeId 포함 → pending.nodeId 확정.
    act(() =>
      getEs()?.emit("execution.waiting_for_input", {
        interactionType: "ai_conversation",
        waitingNodeId: "n1",
        nodeOutput: { conversationConfig: {} },
        conversationThread: { turns: [] },
      }),
    );
    await waitFor(() => expect(result.current.state.phase).toBe("awaiting_user_message"));

    await act(async () => {
      await result.current.actions.endConversation();
    });
    await waitFor(() => expect(interactCalls(fetchMock).length).toBe(1));
    const body = JSON.parse((interactCalls(fetchMock)[0][1] as RequestInit).body as string);
    expect(body.command).toBe("end_conversation");
    expect(body.nodeId).toBe("n1");
    expect(result.current.state.phase).toBe("ended");
    expect(window.sessionStorage.getItem("clemvion-web-chat:session:t1")).toBeNull();
  });

  it("진행 중(streaming, 비 ai_conversation) → 범용 cancel 전송 후 ended", async () => {
    const { fetchMock } = installControllableSse();
    const { result } = renderHook(() => useWidget());
    boot();
    await waitFor(() => expect(result.current.config).not.toBeNull());
    act(() => result.current.actions.open());
    // webhook 202 후 waiting 미도착 → phase streaming, pending null.
    await waitFor(() => expect(result.current.state.phase).toBe("streaming"));

    await act(async () => {
      await result.current.actions.endConversation();
    });
    await waitFor(() => expect(interactCalls(fetchMock).length).toBe(1));
    const body = JSON.parse((interactCalls(fetchMock)[0][1] as RequestInit).body as string);
    expect(body.command).toBe("cancel");
    expect(result.current.state.phase).toBe("ended");
  });

  it("endConversation 2회 연속 호출 → 재진입 가드로 두 번째는 no-op(명령 미중복)", async () => {
    const { fetchMock, getEs } = installControllableSse();
    const { result } = renderHook(() => useWidget());
    boot();
    await waitFor(() => expect(result.current.config).not.toBeNull());
    act(() => result.current.actions.open());
    await waitFor(() => expect(webhookPosts(fetchMock).length).toBe(1));
    act(() =>
      getEs()?.emit("execution.waiting_for_input", {
        interactionType: "ai_conversation",
        waitingNodeId: "n1",
        nodeOutput: { conversationConfig: {} },
        conversationThread: { turns: [] },
      }),
    );
    await waitFor(() => expect(result.current.state.phase).toBe("awaiting_user_message"));

    await act(async () => {
      await result.current.actions.endConversation();
    });
    expect(result.current.state.phase).toBe("ended");
    const interactAfterFirst = interactCalls(fetchMock).length; // end_conversation 1회.
    // 두 번째 호출 — 이미 `ended` 라 phase 가드로 즉시 반환, 추가 명령 발사 없음.
    await act(async () => {
      await result.current.actions.endConversation();
    });
    await new Promise((r) => setTimeout(r, NO_EXTRA_CALL_WAIT_MS));
    expect(interactCalls(fetchMock).length).toBe(interactAfterFirst);
  });

  it("대기 중 buttons(비 ai_conversation) → graceful 아님, 범용 cancel 전송", async () => {
    const { fetchMock, getEs } = installControllableSse();
    const { result } = renderHook(() => useWidget());
    boot();
    await waitFor(() => expect(result.current.config).not.toBeNull());
    act(() => result.current.actions.open());
    await waitFor(() => expect(webhookPosts(fetchMock).length).toBe(1));
    // buttons waiting 진입 — pending.type=buttons(비 ai_conversation) → end_conversation 조건 불충족.
    act(() =>
      getEs()?.emit("execution.waiting_for_input", {
        interactionType: "buttons",
        waitingNodeId: "n1",
        buttonConfig: { buttons: [{ buttonId: "b1", label: "예" }] },
        conversationThread: { turns: [] },
      }),
    );
    await waitFor(() => expect(result.current.state.phase).toBe("awaiting_user_message"));

    await act(async () => {
      await result.current.actions.endConversation();
    });
    await waitFor(() => expect(interactCalls(fetchMock).length).toBe(1));
    const body = JSON.parse((interactCalls(fetchMock)[0][1] as RequestInit).body as string);
    expect(body.command).toBe("cancel");
    expect(result.current.state.phase).toBe("ended");
  });

  it("ai_conversation 대기이지만 waitingNodeId 부재 → graceful 조건 불충족, cancel 폴백", async () => {
    const { fetchMock, getEs } = installControllableSse();
    const { result } = renderHook(() => useWidget());
    boot();
    await waitFor(() => expect(result.current.config).not.toBeNull());
    act(() => result.current.actions.open());
    await waitFor(() => expect(webhookPosts(fetchMock).length).toBe(1));
    // waitingNodeId 없이 ai_conversation waiting → pending.nodeId 미확정 → end_conversation 불가.
    act(() =>
      getEs()?.emit("execution.waiting_for_input", {
        interactionType: "ai_conversation",
        nodeOutput: { conversationConfig: {} },
        conversationThread: { turns: [] },
      }),
    );
    await waitFor(() => expect(result.current.state.phase).toBe("awaiting_user_message"));

    await act(async () => {
      await result.current.actions.endConversation();
    });
    await waitFor(() => expect(interactCalls(fetchMock).length).toBe(1));
    const body = JSON.parse((interactCalls(fetchMock)[0][1] as RequestInit).body as string);
    expect(body.command).toBe("cancel");
    expect(result.current.state.phase).toBe("ended");
  });

  it("종료 명령이 실패(410)해도 optimistic 로컬 종료 유지 — phase=ended, 저장세션 정리", async () => {
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
      // interact 는 410 Gone 으로 실패 — endConversation 은 이를 삼키고 로컬 종료를 유지해야 한다.
      if (u.includes("/interact")) {
        return Promise.resolve({ ok: false, status: 410, json: async () => ({}) } as Response);
      }
      return Promise.reject(new Error(`unexpected fetch ${u}`));
    });
    vi.stubGlobal("fetch", fetchMock);
    vi.stubGlobal("EventSource", class {
      constructor() { latest = new ControllableEventSource(); return latest as unknown as this; }
      addEventListener() {}
      close() {}
    } as unknown as typeof EventSource);

    const { result } = renderHook(() => useWidget());
    boot();
    await waitFor(() => expect(result.current.config).not.toBeNull());
    act(() => result.current.actions.open());
    await waitFor(() => expect(result.current.state.phase).toBe("streaming"));

    await act(async () => {
      await result.current.actions.endConversation();
    });
    // 명령은 410 으로 실패했지만 로컬은 종료 상태를 유지하고 저장세션도 정리됐다.
    expect(result.current.state.phase).toBe("ended");
    expect(window.sessionStorage.getItem("clemvion-web-chat:session:t1")).toBeNull();
    expect(latest).not.toBeNull();
  });

  it("booting 중(webhook in-flight) 종료 → 뒤늦게 도착한 start 결과가 세션을 되살리지 않음(gen guard)", async () => {
    let resolveWebhook: ((v: unknown) => void) | null = null;
    let esCreated = 0;
    const fetchMock = vi.fn((url: unknown, init?: RequestInit) => {
      const u = String(url);
      if (u.includes("/embed-config")) return Promise.reject(new Error("no embed-config"));
      if (u.includes("/api/hooks/") && init?.method === "POST") {
        return new Promise((r) => {
          resolveWebhook = r as (v: unknown) => void;
        });
      }
      if (u.includes("/interact")) {
        return Promise.resolve({ ok: true, status: 202, json: async () => ({}) } as Response);
      }
      return Promise.reject(new Error(`unexpected fetch ${u}`));
    });
    vi.stubGlobal("fetch", fetchMock);
    vi.stubGlobal(
      "EventSource",
      class {
        constructor() {
          esCreated++;
        }
        addEventListener() {}
        close() {}
      },
    );

    const { result } = renderHook(() => useWidget());
    boot();
    await waitFor(() => expect(result.current.config).not.toBeNull());
    act(() => result.current.actions.open());
    // webhook POST 가 아직 pending — booting 상태(세션 미persist).
    await waitFor(() => expect(result.current.state.phase).toBe("booting"));

    // booting 중 종료 → 세션 없음이라 명령 없이 로컬 ended.
    await act(async () => {
      await result.current.actions.endConversation();
    });
    expect(result.current.state.phase).toBe("ended");

    // 뒤늦게 webhook 이 202 로 resolve — in-flight start 는 gen stale 이라 persist/openStream 을 건너뛴다.
    await act(async () => {
      resolveWebhook?.({
        ok: true,
        status: 202,
        json: async () => ({
          data: {
            executionId: "e1",
            status: "pending",
            interaction: { token: "iext_x", expiresAt: new Date(Date.now() + NINETY_MIN_MS).toISOString(), endpoints: ENDPOINTS },
          },
        }),
      });
      await Promise.resolve();
    });
    await new Promise((r) => setTimeout(r, NO_EXTRA_CALL_WAIT_MS));

    // 되살아나지 않음: ended 유지, SSE 미개설, 저장세션 없음.
    expect(result.current.state.phase).toBe("ended");
    expect(esCreated).toBe(0);
    expect(window.sessionStorage.getItem("clemvion-web-chat:session:t1")).toBeNull();
  });

  it("booting 중 종료 후 옛 webhook 이 뒤늦게 실패(reject)해도 stale start catch 가 상태를 덮지 않음", async () => {
    let rejectWebhook: ((e: unknown) => void) | null = null;
    const fetchMock = vi.fn((url: unknown, init?: RequestInit) => {
      const u = String(url);
      if (u.includes("/embed-config")) return Promise.reject(new Error("no embed-config"));
      if (u.includes("/api/hooks/") && init?.method === "POST") {
        return new Promise((_res, rej) => {
          rejectWebhook = rej as (e: unknown) => void;
        });
      }
      if (u.includes("/interact")) {
        return Promise.resolve({ ok: true, status: 202, json: async () => ({}) } as Response);
      }
      return Promise.reject(new Error(`unexpected fetch ${u}`));
    });
    vi.stubGlobal("fetch", fetchMock);
    vi.stubGlobal("EventSource", class {
      addEventListener() {}
      close() {}
    });

    const { result } = renderHook(() => useWidget());
    boot();
    await waitFor(() => expect(result.current.config).not.toBeNull());
    act(() => result.current.actions.open());
    await waitFor(() => expect(result.current.state.phase).toBe("booting"));
    // 종료 → 로컬 ended + in-flight start 무효화(gen++).
    await act(async () => {
      await result.current.actions.endConversation();
    });
    expect(result.current.state.phase).toBe("ended");

    // 옛 webhook 이 뒤늦게 reject → stale start 의 catch. gen 검사로 early-return → 상태 무변.
    await act(async () => {
      rejectWebhook?.(new Error("late 503"));
      await Promise.resolve();
    });
    await new Promise((r) => setTimeout(r, NO_EXTRA_CALL_WAIT_MS));
    // 옛 실패가 phase 를 덮거나(ERROR) error 를 세팅하지 않는다(가드 없으면 error 세팅됨).
    expect(result.current.state.phase).toBe("ended");
    expect(result.current.state.error).toBeUndefined();
  });

  it("submit_message 명령이 410(Gone) → phase ended (대화 종료됨, host conversationEnded 통지 경로)", async () => {
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
      // 명령은 410 Gone — sendCommand 가 ENDED(reason gone) + host conversationEnded 통지.
      if (u.includes("/interact")) {
        return Promise.resolve({ ok: false, status: 410, json: async () => ({}) } as Response);
      }
      return Promise.reject(new Error(`unexpected fetch ${u}`));
    });
    vi.stubGlobal("fetch", fetchMock);
    vi.stubGlobal("EventSource", class {
      constructor() { latest = new ControllableEventSource(); return latest as unknown as this; }
      addEventListener() {}
      close() {}
    } as unknown as typeof EventSource);

    const { result } = renderHook(() => useWidget());
    boot();
    await waitFor(() => expect(result.current.config).not.toBeNull());
    act(() => result.current.actions.open());
    await waitFor(() => expect(webhookPosts(fetchMock).length).toBe(1));
    act(() =>
      latest?.emit("execution.waiting_for_input", {
        interactionType: "ai_conversation",
        waitingNodeId: "n1",
        nodeOutput: { conversationConfig: {} },
        conversationThread: { turns: [] },
      }),
    );
    await waitFor(() => expect(result.current.state.phase).toBe("awaiting_user_message"));

    await act(async () => {
      result.current.actions.submitMessage("안녕");
    });
    // interact 410 → ENDED(reason gone) → phase ended.
    await waitFor(() => expect(result.current.state.phase).toBe("ended"));
    expect(window.sessionStorage.getItem("clemvion-web-chat:session:t1")).toBeNull();
  });
});
