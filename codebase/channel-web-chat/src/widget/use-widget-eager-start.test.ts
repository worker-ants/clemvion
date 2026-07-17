import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { useWidget } from "./use-widget";
import { TOKEN_REFRESH_LEAD_MS } from "./use-token-refresh";

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
    // interact(제출/취소/종료 명령) → 202. call-count 는 응답 성패와 무관하므로 기존
    // interactCalls().length 단언에 영향 없음(§R9 새 대화 cancel 검증용으로 처리).
    if (u.includes("/interact")) {
      return Promise.resolve({ ok: true, status: 202, json: async () => ({}) } as Response);
    }
    return Promise.reject(new Error(`unexpected fetch ${u}`));
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

/**
 * `ControllableEventSource` 를 반환하는 EventSource stub 만 설치한다 (fetch 는 건드리지 않음).
 * fetch 동작이 케이스마다 다른(deferred hook / interact 410 등) 테스트가 SSE 주입만 공유하려고
 * 쓴다 — fetch 까지 표준으로 묶고 싶으면 {@link installControllableSse} 를 쓴다.
 *
 * constructor 가 자신과 다른 인스턴스를 반환하면 TS 가 instance type 불일치(TS2409)를 내므로
 * `as unknown as this` 로 우회하고, stubGlobal 인자 타입은 `typeof EventSource` 로 캐스팅한다.
 * 런타임 동작 불변.
 *
 * @returns `getEs()` — 가장 최근에 생성된 인스턴스(없으면 null). `getEs()?.emit(...)` 으로 주입.
 */
function installControllableEventSource(): {
  getEs: () => ControllableEventSource | null;
} {
  let latest: ControllableEventSource | null = null;
  vi.stubGlobal("EventSource", class {
    constructor() {
      latest = new ControllableEventSource();
      return latest as unknown as this;
    }
    addEventListener() {}
    close() {}
  } as unknown as typeof EventSource);
  return { getEs: () => latest };
}

/**
 * ControllableEventSource + fetch(embed-config reject, webhook 202, interact 202) 설치.
 * SSE 이벤트를 수동 주입하는 C1 flush/폐기 테스트 공용. `getEs()` 로 최신 인스턴스 접근.
 */
function installControllableSse() {
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
  const { getEs } = installControllableEventSource();
  return { fetchMock, getEs };
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

/**
 * 대기 중인 비동기 체인 배출 — 수동 resolve 직후 단언 전에 쓴다.
 *
 * 종전의 `await Promise.resolve()` 고정 반복(1~2회)은 **체인 길이에 대한 추측**이다. 프로덕션
 * 코드가 `await fetch → await res.json() → 세대 검사 → dispatch` 처럼 3틱 이상을 소비하면 단언이
 * 먼저 실행돼 **산발적으로만** 실패한다(스케줄링에 따라 달라져 로컬에선 안 보이고 CI 에서 터지는
 * 부류). macrotask 한 틱은 그 시점의 microtask 큐를 **전부** 배출하므로 틱 수를 몰라도 된다.
 * 파일 내 fake timer 는 모두 `shouldAdvanceTime: true` 라 이 `setTimeout` 도 정상 발화한다.
 * (ai-review 2026-07-17 08_29_33 CRITICAL#2 — 제기된 간헐 실패는 65회 재현 실패했으나, 지적된
 * 관용구 취약성 자체는 실재하므로 선제 제거. RESOLUTION.md §C2 참조.)
 */
async function flushAsync() {
  await new Promise((r) => setTimeout(r, 0));
}

/** host → 위젯 `wc:command` postMessage 주입 — 실제 bridge.onCommand 경로 검증용(boot() 과 동형 origin 핀). */
function sendHostCommand(action: string, extra?: Record<string, unknown>) {
  act(() => {
    window.dispatchEvent(
      new MessageEvent("message", {
        origin: "http://host.test",
        data: { type: "wc:command", payload: { action, ...extra } },
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
  // 안전망 — assert 실패로 테스트가 중단돼도 전역 상태(fake timer·spy)가 다음 테스트로 새지
  // 않게 한다. 개별 테스트의 try/finally 보다 여기 두는 편이 향후 테스트까지 자동 보호한다
  // (ai-review 2026-07-17 06_53_03 W4).
  vi.useRealTimers();
  vi.restoreAllMocks();
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

  /**
   * 복원 대상 세션이 이미 terminal 이면 seed 가 대화를 종료시킨다 — 그 뒤 openStream/scheduleRefresh 를
   * 하면 (a) 무효화된 토큰으로 SSE 를 열고 (b) refreshToken 성공 시 방금 clearSession() 한 storage 를
   * 종료된 세션으로 되살린다. `start()` 는 세대 가드로 우연히 보호됐으나 이 경로는 무방비였다.
   * (ai-review 02_04_13 CRITICAL#1.)
   */
  it("복원된 세션이 이미 terminal → ENDED 전이 + SSE 미오픈 + storage 부활 없음", async () => {
    // 만료를 lead(TOKEN_REFRESH_LEAD_MS) + 6초 뒤로 → refreshDelayMs ≈ 6초. fake timer 로 그 시점을 넘겨야
    // "scheduleRefresh 가 예약됐는가" 를 실제로 단언할 수 있다. 90분(=60분 뒤 발화)이면 타이머가
    // 영영 안 와서 refreshCalls===0 이 게이팅과 무관하게 항상 참인 decorative 단언이 된다
    // (ai-review 2026-07-17 02_31_18 W6).
    vi.useFakeTimers({ shouldAdvanceTime: true });
    window.sessionStorage.setItem(
      "clemvion-web-chat:session:t1",
      JSON.stringify({ executionId: "prev", token: "iext_prev", expiresAt: new Date(Date.now() + TOKEN_REFRESH_LEAD_MS + 6_000).toISOString(), endpoints: ENDPOINTS }),
    );
    let refreshCalls = 0;
    const fetchMock = vi.fn((url: unknown, init?: RequestInit) => {
      const u = String(url);
      if (u.includes("/embed-config")) return Promise.reject(new Error("no embed-config"));
      if (u.includes("/refresh-token")) {
        refreshCalls += 1;
        return Promise.resolve({ ok: true, status: 200, json: async () => ({ data: {} }) } as Response);
      }
      if (u.endsWith("/api/external/executions/e1") && (init?.method ?? "GET") === "GET") {
        // 복원 시점에 이미 종료된 execution.
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({ data: { executionId: "prev", status: "completed" } }),
        } as Response);
      }
      return Promise.reject(new Error(`unexpected fetch ${u}`));
    });
    vi.stubGlobal("fetch", fetchMock);
    const { getEs } = installControllableEventSource();

    const { result } = renderHook(() => useWidget());
    boot();

    await waitFor(() => expect(result.current.state.phase).toBe("ended"));
    // SSE 를 열지 않는다(무효 토큰 재오픈 방지) — ControllableEventSource 가 생성된 적 없어야 한다.
    expect(getEs()).toBeNull();
    // 저장 세션이 되살아나지 않는다.
    expect(window.sessionStorage.getItem("clemvion-web-chat:session:t1")).toBeNull();
    // 종료된 세션 기준 토큰 갱신을 예약/호출하지 않는다 — 예약됐다면 아래 진행에서 발화한다.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10_000);
    });
    expect(refreshCalls).toBe(0);
    vi.useRealTimers();
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
    const { getEs } = installControllableEventSource();

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
      getEs()?.emit("execution.waiting_for_input", {
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

  // R9-A — booting(webhook POST in-flight, 세션 미확립) 중 resetSession/newChat 은
  // in-flight start() 에 coalesce 되어 2번째 POST 를 발사하지 않는다(중복 webhook·첫 노드 부작용 2회 제거).
  it("R9-A: booting 중 newChat(=host resetSession) → coalesce(2번째 POST 미발사, 흡수)", async () => {
    let resolveHook!: (v: Response) => void;
    const hookResponse = () =>
      ({
        ok: true,
        status: 202,
        json: async () => ({
          data: {
            executionId: "e1",
            status: "pending",
            interaction: { token: "iext_x", expiresAt: new Date(Date.now() + NINETY_MIN_MS).toISOString(), endpoints: ENDPOINTS },
          },
        }),
      }) as Response;
    // webhook POST 를 수동 resolve 까지 in-flight 로 유지해 booting 창을 연다.
    const fetchMock = vi.fn((url: unknown, init?: RequestInit) => {
      const u = String(url);
      if (u.includes("/embed-config")) return Promise.reject(new Error("no embed-config"));
      if (u.includes("/api/hooks/") && init?.method === "POST") {
        return new Promise<Response>((r) => {
          resolveHook = r;
        });
      }
      if (u.includes("/interact")) return Promise.resolve({ ok: true, status: 202, json: async () => ({}) } as Response);
      return Promise.reject(new Error(`unexpected fetch ${u}`));
    });
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() => useWidget());
    boot();
    await waitFor(() => expect(result.current.config).not.toBeNull());

    // open → start() → webhook POST in-flight(booting, 미resolve).
    act(() => result.current.actions.open());
    await waitFor(() => expect(webhookPosts(fetchMock).length).toBe(1));
    expect(result.current.state.phase).toBe("booting");

    // booting 중 newChat(host resetSession 경로) → coalesce: 2번째 POST·interact 미발사.
    act(() => result.current.actions.newChat());
    await new Promise((r) => setTimeout(r, NO_EXTRA_CALL_WAIT_MS));
    expect(webhookPosts(fetchMock).length).toBe(1); // 흡수 — 여전히 1
    expect(interactCalls(fetchMock).length).toBe(0); // booting 엔 취소 대상 세션 없음
    expect(result.current.state.phase).toBe("booting"); // 흡수돼 여전히 booting

    // in-flight POST resolve → 흡수된 booting 이 정상 streaming 확립(추가 POST 없음).
    await act(async () => {
      resolveHook(hookResponse());
      await flushAsync();
    });
    await waitFor(() => expect(result.current.state.executionId).toBe("e1"));
    expect(webhookPosts(fetchMock).length).toBe(1);
  });

  // R9-B-1 — 확립 세션(streaming/awaiting)발 새 대화는 새 start 전에 이전 execution 을
  // best-effort cancel(범용, graceful 아님)로 종료한다(서버 orphan 근원 제거).
  it("R9-B-1: 확립 세션발 newChat → 이전 execution best-effort cancel + 새 POST", async () => {
    const fetchMock = installFetch();
    const { result } = renderHook(() => useWidget());
    boot();
    await waitFor(() => expect(result.current.config).not.toBeNull());

    // 첫 open → POST 1, 세션 e1 확립.
    act(() => result.current.actions.open());
    await waitFor(() => expect(result.current.state.executionId).toBe("e1"));
    expect(interactCalls(fetchMock).length).toBe(0);

    // 확립 세션발 newChat → 이전 세션(e1) cancel + 새 POST.
    act(() => result.current.actions.newChat());
    await waitFor(() => expect(interactCalls(fetchMock).length).toBe(1));
    // 범용 cancel 명령이 이전 세션 엔드포인트로 발사됐는지.
    const cancelCall = interactCalls(fetchMock)[0];
    // interact 는 joinUrl(apiBase, endpoints.submit) 로 발사 — 이전 세션(e1) interact 엔드포인트 포함.
    expect(String(cancelCall[0])).toContain(ENDPOINTS.submit);
    const cancelBody = JSON.parse((cancelCall[1] as RequestInit).body as string);
    expect(cancelBody).toMatchObject({ command: "cancel" });
    // 그리고 새 대화용 새 webhook POST(총 2회).
    await waitFor(() => expect(webhookPosts(fetchMock).length).toBe(2));
  });

  // R9-B-1 optimistic — cancel 명령이 실패해도 로컬 새 대화(새 POST)는 되돌리지 않는다.
  it("R9-B-1: newChat cancel 명령 실패해도 새 대화(새 POST) 진행", async () => {
    // /interact → reject(취소 실패), /api/hooks → 202.
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
      if (u.includes("/interact")) return Promise.reject(new Error("cancel network fail"));
      return Promise.reject(new Error(`unexpected fetch ${u}`));
    });
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() => useWidget());
    boot();
    await waitFor(() => expect(result.current.config).not.toBeNull());
    act(() => result.current.actions.open());
    await waitFor(() => expect(result.current.state.executionId).toBe("e1"));

    act(() => result.current.actions.newChat());
    // cancel 이 시도되고(실패해도) 새 POST 는 발사된다.
    await waitFor(() => expect(interactCalls(fetchMock).length).toBe(1));
    await waitFor(() => expect(webhookPosts(fetchMock).length).toBe(2));
  });

  // R9-A W1 — booting 중 큐잉된 텍스트는 coalesce(clearQueue)로 폐기되어 흡수 세션으로 누수되지 않는다(I1).
  it("R9-A: booting 중 큐잉 텍스트는 coalesce 시 폐기(흡수 세션 누수 없음, I1)", async () => {
    let resolveHook!: (v: Response) => void;
    const fetchMock = vi.fn((url: unknown, init?: RequestInit) => {
      const u = String(url);
      if (u.includes("/embed-config")) return Promise.reject(new Error("no embed-config"));
      if (u.includes("/api/hooks/") && init?.method === "POST") {
        return new Promise<Response>((r) => {
          resolveHook = r;
        });
      }
      if (u.includes("/interact")) return Promise.resolve({ ok: true, status: 202, json: async () => ({}) } as Response);
      return Promise.reject(new Error(`unexpected fetch ${u}`)); // getStatus seed → soft-fail
    });
    vi.stubGlobal("fetch", fetchMock);
    const { getEs } = installControllableEventSource();

    const { result } = renderHook(() => useWidget());
    boot();
    await waitFor(() => expect(result.current.config).not.toBeNull());
    act(() => result.current.actions.open());
    await waitFor(() => expect(webhookPosts(fetchMock).length).toBe(1)); // booting(미resolve)

    // booting 중 텍스트 큐잉(아직 미발사 — 큐에만).
    act(() => result.current.actions.submitMessage("누수되면 안 되는 텍스트"));
    expect(interactCalls(fetchMock).length).toBe(0);

    // booting 중 newChat → coalesce: 2번째 POST 없음 + 큐 폐기.
    act(() => result.current.actions.newChat());
    expect(webhookPosts(fetchMock).length).toBe(1);

    // 흡수된 booting 세션 확립.
    await act(async () => {
      resolveHook({
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
      await flushAsync();
    });
    await waitFor(() => expect(result.current.state.executionId).toBe("e1"));
    await waitFor(() => expect(getEs()).not.toBeNull());

    // 첫 ai_conversation(텍스트 표면) 도달 → 큐가 남아있었다면 여기서 submit_message flush.
    act(() => {
      getEs()?.emit("execution.waiting_for_input", { interactionType: "ai_conversation", waitingNodeId: "n1", conversationThread: [] });
    });
    await waitFor(() => expect(result.current.state.pending?.type).toBe("ai_conversation"));
    await new Promise((r) => setTimeout(r, NO_EXTRA_CALL_WAIT_MS));

    // coalesce 가 큐를 비웠으므로 이전 텍스트의 submit_message flush 는 발생하지 않는다.
    const submits = interactCalls(fetchMock).filter((c) => {
      try {
        return JSON.parse((c[1] as RequestInit).body as string).command === "submit_message";
      } catch {
        return false;
      }
    });
    expect(submits.length).toBe(0);
  });

  // R9-B-1 W5 — 실제 host `wc:command {action:"resetSession"}` 브릿지 경로가 newChat 을 구동하는지
  // (기존 R9 테스트는 actions.newChat() 직접 호출만 검증).
  it("R9-B-1: host wc:command resetSession(브릿지 경로) → 확립세션 cancel + 새 POST", async () => {
    const fetchMock = installFetch();
    const { result } = renderHook(() => useWidget());
    boot();
    await waitFor(() => expect(result.current.config).not.toBeNull());
    act(() => result.current.actions.open());
    await waitFor(() => expect(result.current.state.executionId).toBe("e1"));

    // actions.newChat() 직접 호출이 아니라 실제 host postMessage → bridge.onCommand → newChat().
    sendHostCommand("resetSession");
    await waitFor(() => expect(interactCalls(fetchMock).length).toBe(1)); // 이전 세션 best-effort cancel
    const body = JSON.parse((interactCalls(fetchMock)[0][1] as RequestInit).body as string);
    expect(body).toMatchObject({ command: "cancel" });
    await waitFor(() => expect(webhookPosts(fetchMock).length).toBe(2)); // 새 대화 POST
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

  // 새로고침 복원(N1, §R6) 통합 — 저장 세션 → applyConfig RESTORED → seedWaitingFromStatus →
  // WAITING dispatch → mergeMessages → state.messages. 부품(conversation.threadToMessages·getStatus 시드
  // 표면)만 개별 테스트돼 있어, 다중 turn conversationThread 가 실제 복원 시 올바른 role/text/순서로
  // 메시지 타임라인에 시드되는지 e2e-lite 로 고정한다(복원 히스토리 유실·순서역전·role 오분류 회귀 방지).
  it("복원 통합: getStatus 다중 turn conversationThread → state.messages 를 role/text/순서대로 시드", async () => {
    // 저장 세션 pre-seed — applyConfig 가 이를 로드해 RESTORED + getStatus 시드 경로를 탄다.
    window.sessionStorage.setItem(
      "clemvion-web-chat:session:t1",
      JSON.stringify({ executionId: "prev", token: "iext_prev", expiresAt: new Date(Date.now() + NINETY_MIN_MS).toISOString(), endpoints: ENDPOINTS }),
    );
    const fetchMock = vi.fn((url: unknown, init?: RequestInit) => {
      const u = String(url);
      if (u.includes("/embed-config")) return Promise.reject(new Error("no embed-config"));
      // getStatus(GET status) — waiting_for_input + 다중 turn thread(복원 wire: role 없이 source 만).
      if (u.endsWith("/api/external/executions/e1") && (init?.method ?? "GET") === "GET") {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({
            data: {
              id: "prev",
              status: "waiting_for_input",
              seq: 4,
              context: {
                interactionType: "ai_conversation",
                waitingNodeId: "n1",
                conversationThread: {
                  turns: [
                    // ai_user → user. [user-input] 마커는 표시 전 strip 되어야 한다.
                    { source: "ai_user", text: "[user-input]반품하고 싶어요[/user-input]" },
                    { source: "ai_assistant", text: "어떤 상품인가요?" },
                    { source: "ai_user", text: "신발입니다" },
                    { source: "ai_assistant", text: "확인했습니다. 반품 접수를 도와드릴게요." },
                  ],
                },
              },
            },
          }),
        } as Response);
      }
      // 복원 경로는 신규 webhook 을 쏘지 않아야 한다 — 방어적으로 핸들만 두고 호출 0 을 단언한다.
      if (u.includes("/api/hooks/") && init?.method === "POST") {
        return Promise.resolve({ ok: true, status: 202, json: async () => ({ data: {} }) } as Response);
      }
      return Promise.reject(new Error(`unexpected fetch ${u}`));
    });
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() => useWidget());
    boot(); // boot → applyConfig → 저장 세션 복원 → getStatus 시드(open() 불필요).
    await waitFor(() => expect(result.current.state.messages).toHaveLength(4));

    const msgs = result.current.state.messages;
    expect(msgs.map((m) => m.role)).toEqual(["user", "assistant", "user", "assistant"]);
    expect(msgs.map((m) => m.text)).toEqual([
      "반품하고 싶어요", // 마커 strip
      "어떤 상품인가요?",
      "신발입니다",
      "확인했습니다. 반품 접수를 도와드릴게요.",
    ]);
    expect(msgs[0].text).not.toContain("user-input"); // strip 검증(정규식 마커 잔존 없음)
    expect(result.current.state.phase).toBe("awaiting_user_message");
    expect(result.current.state.pending?.type).toBe("ai_conversation");
    expect(result.current.state.executionId).toBe("prev");
    expect(webhookPosts(fetchMock).length).toBe(0); // 복원 세션 → 신규 시작 없음
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
    const { getEs } = installControllableEventSource();

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
    expect(getEs()).not.toBeNull();
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
      await flushAsync();
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
      await flushAsync();
    });
    await new Promise((r) => setTimeout(r, NO_EXTRA_CALL_WAIT_MS));
    // 옛 실패가 phase 를 덮거나(ERROR) error 를 세팅하지 않는다(가드 없으면 error 세팅됨).
    expect(result.current.state.phase).toBe("ended");
    expect(result.current.state.error).toBeUndefined();
  });

  it("submit_message 명령이 410(Gone) → phase ended (대화 종료됨, host conversationEnded 통지 경로)", async () => {
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
    const { getEs } = installControllableEventSource();

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
      result.current.actions.submitMessage("안녕");
    });
    // interact 410 → ENDED(reason gone) → phase ended.
    await waitFor(() => expect(result.current.state.phase).toBe("ended"));
    expect(window.sessionStorage.getItem("clemvion-web-chat:session:t1")).toBeNull();
  });
});

describe("useWidget — 버퍼 만료 재동기화(execution.replay_unavailable, §3.1)", () => {
  /**
   * EIA 5분 버퍼 만료 신호를 받으면 getStatus snapshot 으로 폴백해 재동기화한다.
   * spec `7-channel-web-chat/1-widget-app.md §3.1` — 서버 emit·리스너 등록은 기존에
   * 있었으나 소비 분기가 없어 no-op 이던 것을 배선(2026-07-17).
   */
  it("replay_unavailable 수신 → getStatus 재조회로 현재 표면 재동기화(스트림 유지)", async () => {
    let statusCalls = 0;
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
      // getStatus(= endpoints.status, GET) — 버퍼 만료 후 폴백이 조회하는 스냅샷.
      // 첫 호출(start 직후 seed)은 waiting 표면 없음, 2번째(replay_unavailable 폴백)에서 표면 반환.
      if (u.endsWith("/api/external/executions/e1") && (init?.method ?? "GET") === "GET") {
        statusCalls += 1;
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({
            data:
              statusCalls === 1
                ? { executionId: "e1", status: "running" }
                : {
                    executionId: "e1",
                    status: "waiting_for_input",
                    context: {
                      interactionType: "ai_conversation",
                      waitingNodeId: "n-resync",
                      conversationThread: {
                        turns: [{ source: "ai_assistant", text: "버퍼 만료 후 복구된 메시지" }],
                      },
                    },
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
    const { getEs } = installControllableEventSource();

    const { result } = renderHook(() => useWidget());
    boot();
    await waitFor(() => expect(result.current.config).not.toBeNull());
    act(() => result.current.actions.open());
    await waitFor(() => expect(getEs()).not.toBeNull());
    await waitFor(() => expect(statusCalls).toBe(1)); // start 직후 seed 1회

    // 서버가 버퍼 만료를 알림 → 폴백 재동기화가 getStatus 를 1회 더 호출해야 한다.
    act(() => {
      getEs()?.emit("execution.replay_unavailable", { executionId: "e1" });
    });

    await waitFor(() => expect(statusCalls).toBe(2));
    // 스냅샷의 현재 표면이 반영된다 — 종료가 아니므로 phase 는 ended 가 아니다.
    await waitFor(() =>
      expect(result.current.state.messages.some((m) => m.text === "버퍼 만료 후 복구된 메시지")).toBe(true),
    );
    expect(result.current.state.phase).not.toBe("ended");
  });

  /**
   * 버퍼 만료 gap(≥5분) 안에 execution 이 종료됐다면 그 terminal SSE 이벤트도 버퍼에서 함께
   * 유실돼 다시 오지 않는다(서버는 신호 후 연결만 유지 — EIA R-replay-unavailable). 폴백이
   * terminal 상태를 반영하지 않으면 위젯이 streaming 스피너에 무기한 멈춘다.
   * (ai-review 01_42_44 requirement WARNING.)
   */
  it("replay_unavailable 폴백에서 execution 이 이미 종료됐으면 → ENDED 전이(무기한 streaming 방지)", async () => {
    let statusCalls = 0;
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
      if (u.endsWith("/api/external/executions/e1") && (init?.method ?? "GET") === "GET") {
        statusCalls += 1;
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({
            // gap 사이에 완료됨 — terminal 이벤트는 버퍼와 함께 유실된 상태.
            data: { executionId: "e1", status: statusCalls === 1 ? "running" : "completed" },
          }),
        } as Response);
      }
      if (u.includes("/interact")) {
        return Promise.resolve({ ok: true, status: 202, json: async () => ({}) } as Response);
      }
      return Promise.reject(new Error(`unexpected fetch ${u}`));
    });
    vi.stubGlobal("fetch", fetchMock);
    const { getEs } = installControllableEventSource();

    const { result } = renderHook(() => useWidget());
    boot();
    await waitFor(() => expect(result.current.config).not.toBeNull());
    act(() => result.current.actions.open());
    await waitFor(() => expect(getEs()).not.toBeNull());
    await waitFor(() => expect(statusCalls).toBe(1));

    act(() => {
      getEs()?.emit("execution.replay_unavailable", { executionId: "e1" });
    });

    // terminal 스냅샷 → ENDED 전이 + 저장 세션 정리.
    await waitFor(() => expect(result.current.state.phase).toBe("ended"));
    expect(window.sessionStorage.getItem("clemvion-web-chat:session:t1")).toBeNull();
  });

  /** 폴백(getStatus) 자체가 실패해도 크래시 없이 기존 상태를 유지해야 한다(soft-fail). */
  it("replay_unavailable 폴백의 getStatus 가 실패해도 크래시 없이 유지", async () => {
    let statusCalls = 0;
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
      if (u.endsWith("/api/external/executions/e1") && (init?.method ?? "GET") === "GET") {
        statusCalls += 1;
        // 첫 seed 는 성공(running), 폴백 재조회는 네트워크 실패.
        if (statusCalls === 1) {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: async () => ({ data: { executionId: "e1", status: "running" } }),
          } as Response);
        }
        return Promise.reject(new Error("network down"));
      }
      if (u.includes("/interact")) {
        return Promise.resolve({ ok: true, status: 202, json: async () => ({}) } as Response);
      }
      return Promise.reject(new Error(`unexpected fetch ${u}`));
    });
    vi.stubGlobal("fetch", fetchMock);
    const { getEs } = installControllableEventSource();

    const { result } = renderHook(() => useWidget());
    boot();
    await waitFor(() => expect(result.current.config).not.toBeNull());
    act(() => result.current.actions.open());
    await waitFor(() => expect(getEs()).not.toBeNull());
    await waitFor(() => expect(statusCalls).toBe(1));

    act(() => {
      getEs()?.emit("execution.replay_unavailable", { executionId: "e1" });
    });

    await waitFor(() => expect(statusCalls).toBe(2));
    // soft-fail — 종료로 오판하지 않고 기존 흐름 유지(스트림도 살아있다).
    expect(result.current.state.phase).not.toBe("ended");
    expect(getEs()).not.toBeNull();
  });
});

describe("useWidget — 종료/staleness 가드 (ai-review 2026-07-17 02_31_18 W5·W6·W7)", () => {
  /** W5 — start() 직후 첫 getStatus 가 곧바로 terminal 이면 SSE 를 열지 않고 즉시 종료해야 한다. */
  it("start() 직후 스냅샷이 terminal → openStream 미호출 + 즉시 ended", async () => {
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
      if (u.endsWith("/api/external/executions/e1") && (init?.method ?? "GET") === "GET") {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({ data: { executionId: "e1", status: "failed" } }),
        } as Response);
      }
      return Promise.reject(new Error(`unexpected fetch ${u}`));
    });
    vi.stubGlobal("fetch", fetchMock);
    const { getEs } = installControllableEventSource();

    const { result } = renderHook(() => useWidget());
    boot();
    await waitFor(() => expect(result.current.config).not.toBeNull());
    act(() => result.current.actions.open());

    await waitFor(() => expect(result.current.state.phase).toBe("ended"));
    expect(getEs()).toBeNull(); // start() 게이팅이 openStream 을 막았다.
  });

  /**
   * W7(a) — staleness 가드. getStatus 를 pending 으로 잡아둔 채 "새 대화"로 세션을 교체한 뒤 resolve
   * 시키면, 지연 도착한 옛 응답이 새 대화 상태를 건드리면 안 된다(유령 WAITING / 오탐 ENDED).
   */
  it("stale 응답(세션 교체 후 도착)은 폐기된다 — 유령 WAITING/오탐 ENDED 없음", async () => {
    let resolveStatus: ((r: Response) => void) | null = null;
    let statusCalls = 0;
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
      if (u.endsWith("/api/external/executions/e1") && (init?.method ?? "GET") === "GET") {
        statusCalls += 1;
        if (statusCalls === 1) {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: async () => ({ data: { executionId: "e1", status: "running" } }),
          } as Response);
        }
        // 2번째(폴백) 호출은 테스트가 수동으로 resolve — 그 사이 세션을 교체한다.
        return new Promise<Response>((r) => {
          resolveStatus = r;
        });
      }
      if (u.includes("/interact")) {
        return Promise.resolve({ ok: true, status: 202, json: async () => ({}) } as Response);
      }
      return Promise.reject(new Error(`unexpected fetch ${u}`));
    });
    vi.stubGlobal("fetch", fetchMock);
    const { getEs } = installControllableEventSource();

    const { result } = renderHook(() => useWidget());
    boot();
    await waitFor(() => expect(result.current.config).not.toBeNull());
    act(() => result.current.actions.open());
    await waitFor(() => expect(statusCalls).toBe(1));

    // 폴백 getStatus 를 in-flight 로 띄운다.
    act(() => {
      getEs()?.emit("execution.replay_unavailable", { executionId: "e1" });
    });
    await waitFor(() => expect(statusCalls).toBe(2));

    // 응답 도착 전에 세션 교체(새 대화) — sessionRef 가 바뀐다.
    act(() => result.current.actions.newChat());

    // 이제 옛 응답이 도착: terminal 스냅샷이지만 stale 이므로 무시돼야 한다.
    await act(async () => {
      resolveStatus?.({
        ok: true,
        status: 200,
        json: async () => ({ data: { executionId: "e1", status: "completed" } }),
      } as Response);
      await flushAsync();
    });

    // stale 폐기 — 살아있는 새 대화를 종료시키지 않는다.
    expect(result.current.state.phase).not.toBe("ended");
  });

  /**
   * **유령 표면 회귀** — `worldGen` 단일화 이전 실재하던 버그.
   * `teardownSession()` 은 `sessionRef` 를 null 하지 않으므로, 종전의 `sessionRef` 동일성 가드는
   * SSE terminal 종료를 감지하지 못했다 → 종료된 위젯이 stale seed 응답으로 부활했다.
   * (구조 검토 2026-07-17, 재현 후 세대 가드로 fix.)
   */
  it("seed in-flight 중 SSE terminal → stale 응답이 ended 위젯을 부활시키지 않는다", async () => {
    let resolveStatus: ((r: Response) => void) | null = null;
    let statusCalls = 0;
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
      if (u.endsWith("/api/external/executions/e1") && (init?.method ?? "GET") === "GET") {
        statusCalls += 1;
        if (statusCalls === 1) {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: async () => ({ data: { executionId: "e1", status: "running" } }),
          } as Response);
        }
        // 폴백 seed — 수동 resolve 로 in-flight 유지.
        return new Promise<Response>((r) => {
          resolveStatus = r;
        });
      }
      return Promise.reject(new Error(`unexpected fetch ${u}`));
    });
    vi.stubGlobal("fetch", fetchMock);
    const { getEs } = installControllableEventSource();

    const { result } = renderHook(() => useWidget());
    boot();
    await waitFor(() => expect(result.current.config).not.toBeNull());
    act(() => result.current.actions.open());
    await waitFor(() => expect(getEs()).not.toBeNull());
    await waitFor(() => expect(statusCalls).toBe(1));

    // 1) 버퍼 만료 → seed in-flight (fire-and-forget)
    act(() => {
      getEs()?.emit("execution.replay_unavailable", { executionId: "e1" });
    });
    await waitFor(() => expect(statusCalls).toBe(2));

    // 2) seed 응답 전에 SSE terminal → finalizeEnded → teardownSession (sessionRef 는 그대로!)
    act(() => {
      getEs()?.emit("execution.completed", { executionId: "e1" });
    });
    await waitFor(() => expect(result.current.state.phase).toBe("ended"));

    // 3) 이제 stale seed 가 waiting_for_input 으로 resolve — 세대가 바뀌었으므로 폐기돼야 한다.
    await act(async () => {
      resolveStatus?.({
        ok: true,
        status: 200,
        json: async () => ({
          data: {
            executionId: "e1",
            status: "waiting_for_input",
            context: { interactionType: "ai_conversation", waitingNodeId: "ghost", conversationThread: { turns: [] } },
          },
        }),
      } as Response);
      await flushAsync();
    });

    expect(result.current.state.phase).toBe("ended"); // 부활하면 실패
  });

  /**
   * W5 — `applyConfig`(세션 복원) 고유의 `"stale"` 게이팅. 복원 seed 가 in-flight 인 동안 host 가
   * 새 대화를 시작하면, 지연 도착한 옛 응답이 **새 대화의 SSE 스트림을 옛 토큰으로 탈취**하면 안 된다.
   */
  it("복원 seed 가 in-flight 인 동안 새 대화 시작 → stale 응답이 새 세션 스트림을 덮지 않는다", async () => {
    window.sessionStorage.setItem(
      "clemvion-web-chat:session:t1",
      JSON.stringify({ executionId: "prev", token: "iext_prev", expiresAt: new Date(Date.now() + NINETY_MIN_MS).toISOString(), endpoints: ENDPOINTS }),
    );
    let resolveStatus: ((r: Response) => void) | null = null;
    let hookPosts = 0;
    const fetchMock = vi.fn((url: unknown, init?: RequestInit) => {
      const u = String(url);
      if (u.includes("/embed-config")) return Promise.reject(new Error("no embed-config"));
      if (u.includes("/api/hooks/") && init?.method === "POST") {
        hookPosts += 1;
        return Promise.resolve({
          ok: true,
          status: 202,
          json: async () => ({
            data: {
              executionId: "fresh",
              status: "pending",
              interaction: { token: "iext_fresh", expiresAt: new Date(Date.now() + NINETY_MIN_MS).toISOString(), endpoints: ENDPOINTS },
            },
          }),
        } as Response);
      }
      // 복원 seed 의 getStatus 를 수동 resolve 로 잡아둔다.
      if (u.endsWith("/api/external/executions/e1") && (init?.method ?? "GET") === "GET") {
        if (!resolveStatus) {
          return new Promise<Response>((r) => {
            resolveStatus = r;
          });
        }
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({ data: { executionId: "fresh", status: "running" } }),
        } as Response);
      }
      if (u.includes("/interact")) {
        return Promise.resolve({ ok: true, status: 202, json: async () => ({}) } as Response);
      }
      return Promise.reject(new Error(`unexpected fetch ${u}`));
    });
    vi.stubGlobal("fetch", fetchMock);
    const { getEs } = installControllableEventSource();

    const { result } = renderHook(() => useWidget());
    boot();
    await waitFor(() => expect(resolveStatus).not.toBeNull()); // 복원 seed in-flight.

    // seed 응답 전에 새 대화 시작 → sessionRef 교체.
    await act(async () => {
      result.current.actions.newChat();
      await flushAsync();
    });
    await waitFor(() => expect(hookPosts).toBe(1));
    const esAfterNewChat = getEs();

    // 이제 옛(복원) 세션의 seed 응답이 도착 — stale 이므로 openStream 을 하면 안 된다.
    await act(async () => {
      resolveStatus?.({
        ok: true,
        status: 200,
        json: async () => ({ data: { executionId: "prev", status: "waiting_for_input", context: { interactionType: "ai_conversation", waitingNodeId: "old", conversationThread: { turns: [] } } } }),
      } as Response);
      await flushAsync();
    });

    // 새 대화의 스트림이 옛 세션 토큰으로 재오픈되지 않았다(EventSource 인스턴스 불변).
    expect(getEs()).toBe(esAfterNewChat);
    expect(result.current.state.phase).not.toBe("ended");
  });

  // 위 테스트의 **soft-fail 변종** (ai-review 2026-07-17 08_29_33 W2). 위는 seed 가 정상 resolve 하는 경로라 `seedWaitingFromStatus`
  // 내부 세대 검사가 `"stale"` 을 반환해 걸러진다. 그러나 getStatus 가 **reject** 하면 catch 는
  // 세대와 무관하게 `"continue"`(soft-fail — 종료로 오판하지 않는다)를 반환했다. `start()` 는 호출
  // 직후 `if (worldGenRef.current !== gen) return;` 로 한 번 더 걸러 무사했지만, `applyConfig` 는
  // `outcome !== "continue"` 검사뿐이라 **그대로 통과** → 옛 세션으로 `openStream` + `scheduleRefresh`
  // → 스트림 탈취·방금 지운 storage 부활. 네트워크 오류는 정상 조건이라 실제로 닿는 경로다.
  // (ai-review 2026-07-17 08_29_33 W2 — reviewer 는 "현재 활성 버그 아님"으로 봤으나 soft-fail
  // 분기 때문에 이미 활성이었다. RESOLUTION.md §W2 참조.)
  it("복원 seed 가 network 오류로 soft-fail 해도 새 대화 스트림을 옛 세션이 탈취하지 않는다", async () => {
    window.sessionStorage.setItem(
      "clemvion-web-chat:session:t1",
      JSON.stringify({ executionId: "prev", token: "iext_prev", expiresAt: new Date(Date.now() + NINETY_MIN_MS).toISOString(), endpoints: ENDPOINTS }),
    );
    let rejectStatus: ((e: Error) => void) | null = null;
    let hookPosts = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn((url: unknown, init?: RequestInit) => {
        const u = String(url);
        if (u.includes("/embed-config")) return Promise.reject(new Error("no embed-config"));
        if (u.includes("/api/hooks/") && init?.method === "POST") {
          hookPosts += 1;
          return Promise.resolve({
            ok: true,
            status: 202,
            json: async () => ({
              data: {
                executionId: "fresh",
                status: "pending",
                interaction: { token: "iext_fresh", expiresAt: new Date(Date.now() + NINETY_MIN_MS).toISOString(), endpoints: ENDPOINTS },
              },
            }),
          } as Response);
        }
        // 복원 seed 의 getStatus 를 in-flight 로 잡아둔다 — 나중에 **reject**(네트워크 오류).
        if (u.endsWith("/api/external/executions/e1") && (init?.method ?? "GET") === "GET") {
          if (!rejectStatus) {
            return new Promise<Response>((_res, rej) => {
              rejectStatus = rej;
            });
          }
          return Promise.resolve({
            ok: true,
            status: 200,
            json: async () => ({ data: { executionId: "fresh", status: "running" } }),
          } as Response);
        }
        return Promise.reject(new Error(`unexpected fetch ${u}`));
      }),
    );
    const { getEs } = installControllableEventSource();
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    const { result } = renderHook(() => useWidget());
    boot();
    await waitFor(() => expect(rejectStatus).not.toBeNull()); // 복원 seed in-flight.

    // seed 응답 전에 새 대화 시작 → 세대 증가 + 새 세션 스트림 확립.
    await act(async () => {
      result.current.actions.newChat();
      await flushAsync();
    });
    await waitFor(() => expect(hookPosts).toBe(1));
    const esAfterNewChat = getEs();

    // 이제 옛 seed 가 네트워크 오류로 reject → soft-fail 경로 진입.
    await act(async () => {
      rejectStatus?.(new Error("network down"));
      await flushAsync();
    });

    // 옛 세션이 스트림을 다시 열지 않았다 — EventSource 인스턴스가 그대로여야 한다.
    expect(getEs()).toBe(esAfterNewChat);
    // 새 대화의 세션이 옛 세션으로 덮여 storage 에 되살아나지 않았다.
    const stored = JSON.parse(window.sessionStorage.getItem("clemvion-web-chat:session:t1") ?? "{}");
    expect(stored.executionId).not.toBe("prev");
    warnSpy.mockRestore();
  });

  /**
   * CRITICAL (ai-review 2026-07-17 06_53_03) — cross-session stale 410.
   * in-flight 명령이 뜬 사이 "새 대화" 로 세션이 교체되면, 옛 세션의 지연 410 이 **살아있는 새
   * 세션을 오종료**시키면 안 된다. `seedWaitingFromStatus` 의 staleness 가드와 대칭.
   */
  it("세션 교체 후 도착한 옛 명령의 410 은 새 세션을 종료시키지 않는다", async () => {
    let resolveInteract: ((r: Response) => void) | null = null;
    let hookPosts = 0;
    const fetchMock = vi.fn((url: unknown, init?: RequestInit) => {
      const u = String(url);
      if (u.includes("/embed-config")) return Promise.reject(new Error("no embed-config"));
      if (u.includes("/api/hooks/") && init?.method === "POST") {
        hookPosts += 1;
        return Promise.resolve({
          ok: true,
          status: 202,
          json: async () => ({
            data: {
              executionId: `e${hookPosts}`,
              status: "pending",
              interaction: { token: `iext_${hookPosts}`, expiresAt: new Date(Date.now() + NINETY_MIN_MS).toISOString(), endpoints: ENDPOINTS },
            },
          }),
        } as Response);
      }
      if (u.endsWith("/api/external/executions/e1") && (init?.method ?? "GET") === "GET") {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({ data: { executionId: "e1", status: "running" } }),
        } as Response);
      }
      // 첫 명령은 in-flight 로 잡아두고, 새 대화의 cancel 등 이후 명령은 즉시 202.
      if (u.includes("/interact")) {
        if (!resolveInteract) {
          return new Promise<Response>((r) => {
            resolveInteract = r;
          });
        }
        return Promise.resolve({ ok: true, status: 202, json: async () => ({}) } as Response);
      }
      return Promise.reject(new Error(`unexpected fetch ${u}`));
    });
    vi.stubGlobal("fetch", fetchMock);
    const { getEs } = installControllableEventSource();

    const { result } = renderHook(() => useWidget());
    boot();
    await waitFor(() => expect(result.current.config).not.toBeNull());
    act(() => result.current.actions.open());
    await waitFor(() => expect(getEs()).not.toBeNull());

    act(() => {
      getEs()?.emit("execution.waiting_for_input", {
        interactionType: "ai_conversation",
        waitingNodeId: "n1",
        conversationThread: { turns: [] },
      });
    });
    await waitFor(() => expect(result.current.state.phase).toBe("awaiting_user_message"));
    act(() => result.current.actions.submitMessage("옛 세션 명령"));
    await waitFor(() => expect(resolveInteract).not.toBeNull());

    // 명령이 떠 있는 동안 새 대화 → 세션 교체.
    await act(async () => {
      result.current.actions.newChat();
      await flushAsync();
    });
    await waitFor(() => expect(hookPosts).toBe(2)); // 새 execution 시작됨.
    const phaseBefore = result.current.state.phase;

    // 이제 옛 세션의 410 이 도착 — 새 세션을 건드리면 안 된다.
    await act(async () => {
      resolveInteract?.({ ok: false, status: 410, json: async () => ({}) } as Response);
      await flushAsync();
    });

    expect(result.current.state.phase).not.toBe("ended");
    expect(result.current.state.phase).toBe(phaseBefore);
  });

  /**
   * W7(b) — endedRef dedup. **in-flight** 명령이 SSE terminal 로 종료된 *뒤* 410 을 받는 경우,
   * host `conversationEnded` 가 SSE 경로와 410 경로에서 각각 발사되면 안 된다(1회만).
   */
  it("in-flight 명령의 410 이 SSE terminal 뒤 도착해도 conversationEnded 는 1회만", async () => {
    const endedEvents: unknown[] = [];
    // bridge 는 `parent.postMessage({ type: "wc:event", payload: { name, data } }, target)` 로 보낸다.
    const postSpy = vi.spyOn(window.parent, "postMessage").mockImplementation(((msg: unknown) => {
      const m = msg as { type?: string; payload?: { name?: string } };
      if (m?.type === "wc:event" && m?.payload?.name === "conversationEnded") endedEvents.push(m);
    }) as never);

    let resolveInteract: ((r: Response) => void) | null = null;
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
      if (u.endsWith("/api/external/executions/e1") && (init?.method ?? "GET") === "GET") {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({ data: { executionId: "e1", status: "running" } }),
        } as Response);
      }
      // 명령을 in-flight 로 잡아둔다 — terminal 뒤에 410 으로 resolve.
      if (u.includes("/interact")) {
        return new Promise<Response>((r) => {
          resolveInteract = r;
        });
      }
      return Promise.reject(new Error(`unexpected fetch ${u}`));
    });
    vi.stubGlobal("fetch", fetchMock);
    const { getEs } = installControllableEventSource();

    const { result } = renderHook(() => useWidget());
    boot();
    await waitFor(() => expect(result.current.config).not.toBeNull());
    act(() => result.current.actions.open());
    await waitFor(() => expect(getEs()).not.toBeNull());

    // ai_conversation 대기 표면 → submitMessage 가 sendCommand 로 즉시 전송된다.
    act(() => {
      getEs()?.emit("execution.waiting_for_input", {
        interactionType: "ai_conversation",
        waitingNodeId: "n1",
        conversationThread: { turns: [] },
      });
    });
    await waitFor(() => expect(result.current.state.phase).toBe("awaiting_user_message"));
    act(() => result.current.actions.submitMessage("in-flight 명령"));
    await waitFor(() => expect(resolveInteract).not.toBeNull());

    // (1) 명령이 떠 있는 동안 SSE terminal 도착 → finalizeEnded 1회.
    act(() => {
      getEs()?.emit("execution.completed", { executionId: "e1" });
    });
    await waitFor(() => expect(result.current.state.phase).toBe("ended"));
    expect(endedEvents.length).toBe(1);

    // (2) 이제 in-flight 명령이 410 으로 resolve — endedRef 가드가 재발사를 막아야 한다.
    await act(async () => {
      resolveInteract?.({ ok: false, status: 410, json: async () => ({}) } as Response);
      await flushAsync();
    });
    expect(endedEvents.length).toBe(1);
    postSpy.mockRestore();
  });

  // 언마운트 세대 증가의 회귀 테스트 (ai-review 2026-07-17 08_29_33 W3). 이 지점은 커밋 메시지가 "리뷰 W6(unmount-after-await
  // SSE leak) 도 함께 해소"라 주장했으나 실제로는 **어떤 테스트도 검증하지 않았다**(mutation 실증:
  // 제거해도 364개 중 0건 실패). webhook POST 가 떠 있는 동안 언마운트되면, 세대 증가가 없을 때
  // 지연 응답이 `persist()` 로 storage 를 쓰고 `openStream`/`scheduleRefresh` 로 스트림·타이머를
  // 되살린다 — 사라진 컴포넌트가 남긴 유령 세션. (ai-review 2026-07-17 08_29_33 W3)
  it("webhook POST in-flight 중 언마운트 → 지연 응답이 storage·SSE 를 되살리지 않는다", async () => {
    let resolveHook: ((r: Response) => void) | null = null;
    vi.stubGlobal(
      "fetch",
      vi.fn((url: unknown, init?: RequestInit) => {
        const u = String(url);
        if (u.includes("/embed-config")) return Promise.reject(new Error("no embed-config"));
        // 시작 webhook 을 in-flight 로 잡아둔다 — 언마운트 뒤에 resolve.
        if (u.includes("/api/hooks/") && init?.method === "POST") {
          return new Promise<Response>((r) => {
            resolveHook = r;
          });
        }
        return Promise.reject(new Error(`unexpected fetch ${u}`));
      }),
    );
    const { getEs } = installControllableEventSource();

    const { result, unmount } = renderHook(() => useWidget());
    boot();
    await waitFor(() => expect(result.current.config).not.toBeNull());
    act(() => result.current.actions.open());
    await waitFor(() => expect(resolveHook).not.toBeNull()); // start() 의 webhook in-flight.

    unmount();

    // 사라진 위젯의 start 응답이 뒤늦게 도착.
    await act(async () => {
      resolveHook?.({
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
      await flushAsync();
    });

    // 세션이 storage 에 남지 않았고 SSE 도 열리지 않았다.
    expect(window.sessionStorage.getItem("clemvion-web-chat:session:t1")).toBeNull();
    expect(getEs()).toBeNull();
  });

  // embed-config 왕복(부팅) 중 host resetSession 이 들어와도 config 는 확립돼야 한다
  // (ai-review 2026-07-17 08_29_33 CRITICAL#1).
  //
  // 세대 단일화가 만든 회귀의 회귀 테스트: `teardownSession()` 이 무조건 세대를 올리면 아직
  // 부팅 중인 `applyConfig` 가 stale 로 판정돼 죽고, `configRef`/`clientRef`/`setConfig` 가 영영
  // 세팅되지 않아 **런처만 뜨고 패널이 영원히 안 열린다**(콘솔 경고 없는 silent hang, 자가 회복
  // 경로 없음). 기존 R9-A 의 "booting" 은 config 확립 **후** webhook POST in-flight 라 이 창을
  // 못 덮는다 (ai-review 2026-07-17 08_29_33 CRITICAL#1).
  it("embed-config in-flight 중 host resetSession → config 확립(패널 정상 개방)", async () => {
    let resolveEmbed: ((r: Response) => void) | null = null;
    vi.stubGlobal(
      "fetch",
      vi.fn((url: unknown) => {
        const u = String(url);
        // embed-config 를 in-flight 로 잡아둔다 — 이 창이 취약 구간이다.
        if (u.includes("/embed-config")) {
          return new Promise<Response>((r) => {
            resolveEmbed = r;
          });
        }
        if (u.includes("/api/hooks/")) {
          return Promise.resolve({
            ok: true,
            status: 202,
            json: async () => ({ data: { executionId: "e1", status: "pending" } }),
          } as Response);
        }
        return Promise.reject(new Error(`unexpected fetch ${u}`));
      }),
    );
    installControllableEventSource();

    const { result } = renderHook(() => useWidget());
    boot();
    await waitFor(() => expect(resolveEmbed).not.toBeNull());

    // 부팅이 끝나기 전에 host 가 새 대화를 명령 → teardownSession 경유.
    act(() => {
      window.dispatchEvent(
        new MessageEvent("message", {
          origin: "http://host.test",
          data: { type: "wc:command", payload: { action: "resetSession" } },
        }),
      );
    });

    // 뒤늦게 embed-config 가 resolve — applyConfig 는 살아남아 config 를 확립해야 한다.
    await act(async () => {
      resolveEmbed?.({
        ok: true,
        status: 200,
        json: async () => ({ data: { allowlist: [], enforce: false } }),
      } as Response);
      await flushAsync();
    });

    // 소비처가 패널을 여는 조건이 곧 이 두 값이다 — widget-app.tsx 의
    // `expanded = visible && state.open && !!config`. config 가 null 로 굳으면 open() 을 눌러도
    // 영원히 collapsed 다.
    expect(result.current.config).not.toBeNull();
    act(() => result.current.actions.open());
    await waitFor(() => expect(result.current.state.open).toBe(true));
  });

  // 위 fix 는 "부팅 전엔 정리할 게 없다"는 전제에 서는데, 그건 **메모리**에만 참이다.
  // `sessionStorage` 에는 이전 마운트/페이지 로드의 세션이 남아있을 수 있어, 그냥 조기 return 하면
  // 그 값이 복원돼 host 가 요청한 "새 대화"가 조용히 무시되고 옛 대화가 이어진다(재현 확인 —
  // 영구 정지가 리셋 무시로 바뀐 것). 위 C1 테스트는 `beforeEach` 의 sessionStorage.clear() 로
  // 시작해 이 창을 덮지 못했다. (ai-review 2026-07-17 09_36_01 — side_effect·security 독립 지적)
  it("저장 세션이 있는 채로 부팅 중 resetSession → 옛 대화가 부활하지 않는다", async () => {
    // 이전 대화가 저장소에 만료 전 세션으로 남아있다.
    window.sessionStorage.setItem(
      "clemvion-web-chat:session:t1",
      JSON.stringify({ executionId: "OLD", token: "iext_old", expiresAt: new Date(Date.now() + NINETY_MIN_MS).toISOString(), endpoints: ENDPOINTS }),
    );
    let resolveEmbed: ((r: Response) => void) | null = null;
    let hookPosts = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn((url: unknown, init?: RequestInit) => {
        const u = String(url);
        if (u.includes("/embed-config")) {
          return new Promise<Response>((r) => {
            resolveEmbed = r;
          });
        }
        if (u.includes("/api/hooks/") && init?.method === "POST") {
          hookPosts += 1;
          return Promise.resolve({
            ok: true,
            status: 202,
            json: async () => ({
              data: {
                executionId: "NEW",
                status: "pending",
                interaction: { token: "iext_new", expiresAt: new Date(Date.now() + NINETY_MIN_MS).toISOString(), endpoints: ENDPOINTS },
              },
            }),
          } as Response);
        }
        // 옛 세션이 복원되면 여기로 seed 가 온다 — 복원 자체가 없어야 정상.
        if (u.endsWith("/api/external/executions/e1")) {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: async () => ({ data: { executionId: "NEW", status: "running" } }),
          } as Response);
        }
        return Promise.reject(new Error(`unexpected fetch ${u}`));
      }),
    );
    installControllableEventSource();

    const { result } = renderHook(() => useWidget());
    boot();
    await waitFor(() => expect(resolveEmbed).not.toBeNull()); // embed-config in-flight.

    // 부팅 중 host 가 "대화를 처음부터 다시 시작" 을 명시 요청.
    sendHostCommand("resetSession");

    await act(async () => {
      resolveEmbed?.({
        ok: true,
        status: 200,
        json: async () => ({ data: { allowlist: [], enforce: false } }),
      } as Response);
      await flushAsync();
    });

    // (1) C1 fix 유지 — config 는 확립된다(영구 정지 없음).
    expect(result.current.config).not.toBeNull();
    // (2) 옛 세션이 복원되지 않았다 — 저장소에서도 지워졌거나 새 세션으로 대체됐다.
    expect(result.current.state.executionId).not.toBe("OLD");
    expect(window.sessionStorage.getItem("clemvion-web-chat:session:t1") ?? "").not.toContain("OLD");
    // (3) 요청된 "새 대화" 가 실제로 시작됐다 — 저장소만 지우고 멈추면 패널만 열린 빈 화면이 된다.
    await waitFor(() => expect(hookPosts).toBe(1));
  });
});
