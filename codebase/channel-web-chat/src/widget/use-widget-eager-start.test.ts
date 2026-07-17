import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { StrictMode } from "react";
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
  // 같은 이유로 `document.referrer` 오버라이드도 여기서 되돌린다. 테스트 본문 끝에 두면 **assert
  // 실패 시 실행되지 않아** 다음 테스트로 샌다(`widget-app.test.tsx` 가 이미 쓰는 컨벤션과 동형).
  // 기본값 `""` 이면 `detectHostOrigin` 이 null → 임베드 검증 fail-open(4-security §3-①) 으로
  // 되돌아가, 이 오버라이드를 안 쓰는 테스트들의 전제가 보존된다
  // (ai-review 2026-07-17 12_04_49 testing W2).
  Object.defineProperty(window.document, "referrer", { value: "", configurable: true });
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

  // **React StrictMode(dev) 에서 위젯이 부팅된다.**
  //
  // 이 앱은 `next.config.ts` 에서 `reactStrictMode: true` 를 켠다 → dev 는 effect 를
  // **mount → unmount → mount** 로 이중 호출한다. `unmountedRef` 를 마운트에서 되돌리지 않으면
  // 두 번째 마운트가 영구히 stale 로 판정돼 **위젯이 어떤 `wc:boot` 도 적용하지 못한다**
  // (재현 확인 — `config = null`, dev 에서 위젯이 아예 뜨지 않았다).
  //
  // `unmountedRef` 는 "이 마운트가 끝났나" 이지 "한 번이라도 끝났나" 가 아니다 — 1회성 래치로 두면
  // 안 된다. (ai-review 2026-07-17 18_39_11 security WARNING)
  it("StrictMode(dev 이중 마운트) 에서도 wc:boot 이 적용된다", async () => {
    const embedResolvers: Array<(r: Response) => void> = [];
    vi.stubGlobal(
      "fetch",
      vi.fn((url: unknown) => {
        const u = String(url);
        if (u.includes("/embed-config")) {
          return new Promise<Response>((r) => {
            embedResolvers.push(r);
          });
        }
        return Promise.reject(new Error(`unexpected fetch ${u}`));
      }),
    );
    installControllableEventSource();

    const { result } = renderHook(() => useWidget(), { wrapper: StrictMode });
    boot();
    await waitFor(() => expect(embedResolvers.length).toBeGreaterThan(0));
    await act(async () => {
      embedResolvers.forEach((r) =>
        r({ ok: true, status: 200, json: async () => ({ data: { allowlist: [], enforce: false } }) } as Response),
      );
      await flushAsync();
    });

    expect(result.current.config).not.toBeNull();
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

  // **계약: 접수된 리셋은 다음 성공하는 부팅이 이행한다.**
  //
  // 부팅이 차단(BLOCKED)돼도 의도는 남아 이후 성공하는 부팅이 이행한다. 그 부팅이 "리셋을 요청한 적
  // 없어" 보여도 같은 host·같은 위젯 인스턴스이고 요청은 실재했다.
  //
  // 이 테스트는 **"실패한 부팅이 자기 리셋을 폐기한다"는 설계를 다시 넣지 못하게** 막는다. 그 설계는
  // 직관적이지만 원리적으로 불가능하다 — 지금 지워도 되는지는 다른 겹친 시도가 나중에 성공할지에
  // 달렸고 그건 그 시점에 알 수 없다. 네 번 시도해 네 번 다 반대편 구멍이 났다.
  // (ai-review 2026-07-17 11_38_14 · 12_04_49 · 12_34_03 · 13_03_59, 설계 결정은 사용자)
  //
  // `document.referrer` 를 세우는 이유: 미설정 시 `detectHostOrigin` 이 null 을 반환해 임베드 검증이
  // **fail-open**(4-security §3-① 의 soft 컨트롤 설계) 하므로 BLOCKED 자체에 도달하지 못한다.
  it("차단된 부팅 중의 resetSession 은 이후 성공하는 부팅이 이행한다", async () => {
    // host origin 을 탐지 가능하게 만들어야 allowlist 검증이 실제로 동작한다(미탐지 시 fail-open).
    // 복원은 전역 afterEach 가 담당 — 아래 단언이 실패해도 다음 테스트로 새지 않도록.
    Object.defineProperty(window.document, "referrer", {
      value: "http://host.test/page",
      configurable: true,
    });
    const embedResolvers: Array<(r: Response) => void> = [];
    let hookPosts = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn((url: unknown, init?: RequestInit) => {
        const u = String(url);
        if (u.includes("/embed-config")) {
          return new Promise<Response>((r) => {
            embedResolvers.push(r);
          });
        }
        if (u.includes("/api/hooks/") && init?.method === "POST") {
          hookPosts += 1;
          return Promise.resolve({
            ok: true,
            status: 202,
            json: async () => ({
              data: {
                executionId: "forced-new",
                status: "pending",
                interaction: { token: "iext_forced", expiresAt: new Date(Date.now() + NINETY_MIN_MS).toISOString(), endpoints: ENDPOINTS },
              },
            }),
          } as Response);
        }
        if (u.endsWith("/api/external/executions/e1")) {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: async () => ({ data: { executionId: "legit", status: "running" } }),
          } as Response);
        }
        return Promise.reject(new Error(`unexpected fetch ${u}`));
      }),
    );
    installControllableEventSource();

    const { result } = renderHook(() => useWidget());

    // 1차 부팅 — 진행 중에 host 가 리셋을 요청한다.
    boot();
    await waitFor(() => expect(embedResolvers.length).toBe(1));
    sendHostCommand("resetSession");

    // 1차 부팅이 allowlist 불일치로 차단된다 → 리셋은 이 시도와 함께 죽어야 한다.
    await act(async () => {
      embedResolvers[0]({
        ok: true,
        status: 200,
        json: async () => ({ data: { allowlist: ["http://other.test"], enforce: true } }),
      } as Response);
      await flushAsync();
    });
    expect(result.current.state.phase).toBe("blocked"); // 전제 — 여기 못 오면 테스트가 무의미

    // 그 사이 정상 세션이 존재한다(다른 탭·이전 대화).
    window.sessionStorage.setItem(
      "clemvion-web-chat:session:t1",
      JSON.stringify({ executionId: "legit", token: "iext_legit", expiresAt: new Date(Date.now() + NINETY_MIN_MS).toISOString(), endpoints: ENDPOINTS }),
    );

    // 2차 부팅 — allowlist 를 고쳐 재전송(재마운트 없음). **이 host 는 리셋을 요청한 적이 없다.**
    boot();
    await waitFor(() => expect(embedResolvers.length).toBe(2));
    await act(async () => {
      embedResolvers[1]({
        ok: true,
        status: 200,
        json: async () => ({ data: { allowlist: [], enforce: false } }),
      } as Response);
      await flushAsync();
    });

    // **2차 전제 고정** — 2차 boot 이 (무관한 이유로) 또 차단되면 아래 단언이 "아무 일도 안 일어나서"
    // 통과해버릴 수 있다. 2차가 실제로 정상 진행됐음을 먼저 못박는다
    // (ai-review 2026-07-17 12_04_49 testing W1).
    await waitFor(() => expect(result.current.state.phase).not.toBe("blocked"));

    // 1차 부팅 구간에 접수된 리셋이 이제 이행된다 — 새 대화 webhook 1회(구 세션 복원이 아니라).
    await waitFor(() => expect(hookPosts).toBe(1));
    expect(window.sessionStorage.getItem("clemvion-web-chat:session:t1") ?? "").not.toContain("legit");
  });

  // 위 테스트의 **정반대 방향** — 리셋 폐기를 넓히다 정당한 요청을 삼키지 않는지.
  //
  // 두 테스트는 한 쌍으로만 의미가 있다. 폐기를 `applyConfig` **진입 시 일괄**로 바꾸면 위 테스트는
  // 통과하지만 이 테스트가 죽는다(실제로 그렇게 고쳤다가 이 결함을 만들었다 — 재현 확인). 지금
  // 구조가 성립하는 이유는 **먼저 소비한 쪽이 `newChat`→세대 증가로 나머지 부팅을 stale 화**하는
  // 자기치유다. (ai-review 2026-07-17 12_04_49 side_effect W1)
  it("겹친 부팅(boot 재전송)이 그 사이 접수한 정당한 리셋을 삼키지 않는다", async () => {
    // 구 세션이 있는 채로 부팅 — 리셋이 소실되면 이 세션이 그대로 복원돼버린다.
    window.sessionStorage.setItem(
      "clemvion-web-chat:session:t1",
      JSON.stringify({ executionId: "old", token: "iext_old", expiresAt: new Date(Date.now() + NINETY_MIN_MS).toISOString(), endpoints: ENDPOINTS }),
    );
    const embedResolvers: Array<(r: Response) => void> = [];
    let hookPosts = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn((url: unknown, init?: RequestInit) => {
        const u = String(url);
        if (u.includes("/embed-config")) {
          return new Promise<Response>((r) => {
            embedResolvers.push(r);
          });
        }
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
        if (u.endsWith("/api/external/executions/e1")) {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: async () => ({ data: { executionId: "old", status: "running" } }),
          } as Response);
        }
        return Promise.reject(new Error(`unexpected fetch ${u}`));
      }),
    );
    installControllableEventSource();

    renderHook(() => useWidget());
    boot();
    await waitFor(() => expect(embedResolvers.length).toBe(1));

    // 1차 부팅이 아직 embed-config 왕복 중일 때 정당한 리셋 요청이 접수된다.
    sendHostCommand("resetSession");

    // 그 상태에서 host 가 config 를 갱신(2-sdk §3(재전송)) — 1차는 아직 in-flight.
    boot();
    await waitFor(() => expect(embedResolvers.length).toBe(2));

    // 두 부팅이 모두 허용으로 resolve.
    await act(async () => {
      embedResolvers[0]({ ok: true, status: 200, json: async () => ({ data: { allowlist: [], enforce: false } }) } as Response);
      embedResolvers[1]({ ok: true, status: 200, json: async () => ({ data: { allowlist: [], enforce: false } }) } as Response);
      await flushAsync();
    });

    // 리셋이 이행됐다 — 새 대화 webhook 이 정확히 1회(구 세션 복원이 아니라).
    await waitFor(() => expect(hookPosts).toBe(1));
  });

  // 위 둘의 **혼합** — 겹친 두 부팅의 결과가 갈리고 **차단된 쪽이 먼저 resolve** 되는 경우.
  //
  // 이 케이스가 별도로 필요한 이유: BLOCKED 분기는 `worldGenRef` 를 올리지 않는다(세계가 바뀐 게
  // 아니라 이 시도가 실패했을 뿐). 그래서 성공 경로의 자기치유("먼저 소비한 쪽이 나머지를 stale 화")가
  // 여기엔 성립하지 않아, **폐기가 있으면** 차단된 시도가 아직 살아있는 다른 시도의 리셋 의도까지
  // 지운다(재현 확인).
  //
  // 이 테스트가 지키는 것은 어떤 가드 조건이 아니라 **폐기 로직의 완전한 부재**다 — 폐기가 없으므로
  // 이 실패 유형이 존재할 수 없다. 폐기를 어떤 형태로든 재도입하면(BLOCKED 한정이든 세대 소유권이든)
  // 이 테스트가 깨진다. 그게 의도다 — `use-widget.ts` 의 `pendingResetRef` JSDoc §계약 참조.
  // (ai-review 2026-07-17 12_34_03 발견 · 13_03_59 에서 설계 자체를 폐기 · 14_30_15 주석 정정)
  it("겹친 부팅의 결과가 갈릴 때, 차단된 쪽이 살아있는 쪽의 리셋을 지우지 않는다", async () => {
    Object.defineProperty(window.document, "referrer", {
      value: "http://host.test/page",
      configurable: true,
    });
    window.sessionStorage.setItem(
      "clemvion-web-chat:session:t1",
      JSON.stringify({ executionId: "old", token: "iext_old", expiresAt: new Date(Date.now() + NINETY_MIN_MS).toISOString(), endpoints: ENDPOINTS }),
    );
    const embedResolvers: Array<(r: Response) => void> = [];
    let hookPosts = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn((url: unknown, init?: RequestInit) => {
        const u = String(url);
        if (u.includes("/embed-config")) {
          return new Promise<Response>((r) => {
            embedResolvers.push(r);
          });
        }
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
        if (u.endsWith("/api/external/executions/e1")) {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: async () => ({ data: { executionId: "old", status: "running" } }),
          } as Response);
        }
        return Promise.reject(new Error(`unexpected fetch ${u}`));
      }),
    );
    installControllableEventSource();

    const { result } = renderHook(() => useWidget());
    boot();
    await waitFor(() => expect(embedResolvers.length).toBe(1));
    sendHostCommand("resetSession"); // 1차 부팅 구간에 접수된 정당한 요청.
    boot(); // 2차 부팅(예: 다른 triggerEndpointPath 로 전환) — 1차는 아직 in-flight.
    await waitFor(() => expect(embedResolvers.length).toBe(2));

    // **1차(차단)가 먼저** resolve — 여기서 리셋 의도를 지워버리면 안 된다(2차가 아직 살아있다).
    await act(async () => {
      embedResolvers[0]({ ok: true, status: 200, json: async () => ({ data: { allowlist: ["http://other.test"], enforce: true } }) } as Response);
      await flushAsync();
    });
    // **superseded 시도는 아무것도 디스패치하지 않는다** — 1차는 2차에 대체됐으므로 차단 응답이
    // 와도 `BLOCKED` 로 전이시키지 않는다. 살아있는 2차의 결과가 화면을 정한다(§3(재전송)).
    // (supersede 도입 전에는 여기서 `phase === "blocked"` 였다 — 대체된 시도가 화면을 덮었다.)
    expect(result.current.state.phase).not.toBe("blocked");
    // 2차(허용)가 나중에 resolve — 살아있는 시도이므로 이쪽이 리셋을 이행한다.
    await act(async () => {
      embedResolvers[1]({ ok: true, status: 200, json: async () => ({ data: { allowlist: [], enforce: false } }) } as Response);
      await flushAsync();
    });

    await waitFor(() => expect(hookPosts).toBe(1));
  });

  // 위 테스트의 **반대 절반** — 겹친 두 부팅 중 **나중에 진입한** 쪽이 차단으로 먼저 끝나고,
  // **먼저 진입한** 쪽이 허용으로 나중에 끝나는 순서.
  //
  // 이게 별도로 필요한 이유(리뷰어 실측): 위 "혼합 순서" 테스트는 `bootGenRef` 소유권 설계를 **원본
  // 그대로 재도입해도 통과한다** — 그 설계의 안전한 절반만 고정하기 때문이다. 실제로 결함을 냈던
  // 절반(소유권자=최신 진입이 차단으로 먼저 끝나며 폐기 → 아직 살아있는 이전 진입의 리셋이 소실)은
  // **겹침 케이스 중에선** 이 테스트만 잡는다.
  //
  // 단 스위트 전체로 보면 유일한 가드가 아니다 — 순차 케이스인 "차단된 부팅 중의 resetSession…"도
  // 같은 mutation 을 독립적으로 잡는다(겹침이 없어 소유권 조건이 참이 되고, 그래서 그쪽도 폐기가
  // 발동한다). **의도치 않은 이중 방어선이니 어느 쪽도 "중복"으로 지우지 말 것** — 둘은 순차/겹침
  // 이라는 서로 다른 시나리오로 같은 결함을 잡는다.
  // (ai-review 2026-07-17 14_30_15 concurrency PROBE 승격 · 14_56_27 testing 문구 정정)
  it("겹친 부팅에서 나중 진입이 차단으로 먼저 끝나도 먼저 진입한 쪽이 리셋을 이행한다", async () => {
    Object.defineProperty(window.document, "referrer", {
      value: "http://host.test/page",
      configurable: true,
    });
    window.sessionStorage.setItem(
      "clemvion-web-chat:session:t1",
      JSON.stringify({ executionId: "old", token: "iext_old", expiresAt: new Date(Date.now() + NINETY_MIN_MS).toISOString(), endpoints: ENDPOINTS }),
    );
    const embedResolvers: Array<(r: Response) => void> = [];
    let hookPosts = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn((url: unknown, init?: RequestInit) => {
        const u = String(url);
        if (u.includes("/embed-config")) {
          return new Promise<Response>((r) => {
            embedResolvers.push(r);
          });
        }
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
        if (u.endsWith("/api/external/executions/e1")) {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: async () => ({ data: { executionId: "old", status: "running" } }),
          } as Response);
        }
        return Promise.reject(new Error(`unexpected fetch ${u}`));
      }),
    );
    installControllableEventSource();

    const { result } = renderHook(() => useWidget());
    boot(); // 1차 진입.
    await waitFor(() => expect(embedResolvers.length).toBe(1));
    sendHostCommand("resetSession"); // 1차 구간에 접수된 정당한 요청.
    boot(); // 2차 진입 — 1차는 아직 in-flight.
    await waitFor(() => expect(embedResolvers.length).toBe(2));

    // **2차(나중 진입)가 차단으로 먼저** 끝난다 — 옛 소유권 설계라면 여기서 폐기가 일어났다.
    await act(async () => {
      embedResolvers[1]({ ok: true, status: 200, json: async () => ({ data: { allowlist: ["http://other.test"], enforce: true } }) } as Response);
      await flushAsync();
    });
    // **전제 고정** — 2차가 실제로 BLOCKED 에 도달했어야 이 테스트가 의미를 갖는다. 없으면
    // `document.referrer` 가 빠지는 것만으로 fail-open 하여 "둘 다 ALLOWED"(이미 다른 테스트가
    // 덮는 시나리오)로 조용히 퇴화하는데도 통과한다 — 실측 확인
    // (ai-review 2026-07-17 14_56_27 testing).
    expect(result.current.state.phase).toBe("blocked");
    // **1차(먼저 진입)가 허용으로 나중에** 끝난다 — 그러나 2차에 **대체됐으므로 물러난다**.
    await act(async () => {
      embedResolvers[0]({ ok: true, status: 200, json: async () => ({ data: { allowlist: [], enforce: false } }) } as Response);
      await flushAsync();
    });

    // superseded 시도는 "성공하는 부팅" 이 아니므로 리셋을 이행하지 않는다 — 이 라운드엔 새 대화가
    // 시작되지 않는다(`pendingResetRef` JSDoc §계약).
    expect(hookPosts).toBe(0);

    // **그러나 소실이 아니라 이월이다** — 이어서 성공하는 부팅이 오면 그때 이행된다.
    // 이 단언이 없으면 위 `toBe(0)` 은 "리셋이 조용히 사라짐" 과 구분되지 않는다.
    boot();
    await waitFor(() => expect(embedResolvers.length).toBe(3));
    await act(async () => {
      embedResolvers[2]({ ok: true, status: 200, json: async () => ({ data: { allowlist: [], enforce: false } }) } as Response);
      await flushAsync();
    });
    await waitFor(() => expect(hookPosts).toBe(1));
  });

  // spec 2-sdk §3(재전송) — "host 는 iframe 을 재생성하지 않고 wc:boot 을 다시 보내 boot config 를 갱신할 수
  // 있다. 위젯은 **마지막 wc:boot 의 config 를 적용**한다."
  //
  // 세대가 없으면 `embed-config` 왕복의 **resolve 순서가 승자를 정한다** — 먼저 보낸 config 가 나중에
  // resolve 하면 그게 이겨 §3(재전송) 을 어긴다(도입 전 실측: plan A→B 로 보내고 순서를 역전시키니 A 가
  // 적용됐다). `beginBootAttempt`/`isAttemptStale` 이 그걸 막는다.
  it("§3(재전송): resolve 순서가 역전돼도 마지막 wc:boot 의 config 가 적용된다", async () => {
    const embedResolvers: Array<(r: Response) => void> = [];
    vi.stubGlobal(
      "fetch",
      vi.fn((url: unknown) => {
        const u = String(url);
        if (u.includes("/embed-config")) {
          return new Promise<Response>((r) => {
            embedResolvers.push(r);
          });
        }
        return Promise.reject(new Error(`unexpected fetch ${u}`));
      }),
    );
    installControllableEventSource();
    const bootWithPlan = (plan: string) =>
      act(() => {
        window.dispatchEvent(
          new MessageEvent("message", {
            origin: "http://host.test",
            data: {
              type: "wc:boot",
              payload: { apiBase: "http://api.test/api", triggerEndpointPath: "t1", profile: { plan } },
            },
          }),
        );
      });

    const { result } = renderHook(() => useWidget());
    bootWithPlan("first");
    await waitFor(() => expect(embedResolvers.length).toBe(1));
    bootWithPlan("last"); // 재전송 — 이게 마지막이므로 이 config 가 적용돼야 한다.
    await waitFor(() => expect(embedResolvers.length).toBe(2));

    // **resolve 순서 역전** — 마지막 boot 이 먼저, 첫 boot 이 나중에 응답한다.
    const allow = () =>
      ({ ok: true, status: 200, json: async () => ({ data: { allowlist: [], enforce: false } }) }) as Response;
    await act(async () => {
      embedResolvers[1](allow());
      await flushAsync();
      embedResolvers[0](allow());
      await flushAsync();
    });

    const applied = (result.current.config?.profile as { plan?: string } | undefined)?.plan;
    expect(applied).toBe("last");
  });

  // §3(재전송) — **대체된 시도의 종료 확정이 살아있는 마지막 부팅을 죽이지 않는다.**
  //
  // 재현된 결함(ai-review 17_36_57 concurrency CRITICAL): 대체된 1차가 복원 seed 에서 "이미 종료됨"을
  // 발견하면 `finalizeEnded` → `teardownSession` → **world 세대 증가**가 일어난다. 그 무효화는 정당하나
  // (세션이 실제로 종료됐다), 아직 살아있는 2차가 그걸 "내 world 가 사라졌다"로 오독하고 물러나
  // **마지막 config 가 적용되지 않았다**(plan=A 고착). 2차는 그때까지 어떤 세션도 건드리지 않았다.
  //
  // fix: 대체된 시도의 seed 는 종료를 **확정하지 않는다**(`"stale"` 반환). 종료가 유실되진 않는다 —
  // 저장 세션이 남아 살아있는 시도가 자기 복원 분기에서 같은 스냅샷을 보고 확정한다. **주체만 바뀐다.**
  it("§3(재전송): 대체된 시도의 종료 확정이 마지막 부팅을 죽이지 않는다", async () => {
    window.sessionStorage.setItem(
      "clemvion-web-chat:session:t1",
      JSON.stringify({ executionId: "e1", token: "iext_old", expiresAt: new Date(Date.now() + NINETY_MIN_MS).toISOString(), endpoints: ENDPOINTS }),
    );
    const embedResolvers: Array<(r: Response) => void> = [];
    const statusResolvers: Array<(r: Response) => void> = [];
    vi.stubGlobal(
      "fetch",
      vi.fn((url: unknown, init?: RequestInit) => {
        const u = String(url);
        if (u.includes("/embed-config")) {
          return new Promise<Response>((r) => {
            embedResolvers.push(r);
          });
        }
        if (u.endsWith("/api/external/executions/e1") && (init?.method ?? "GET") === "GET") {
          return new Promise<Response>((r) => {
            statusResolvers.push(r);
          });
        }
        return Promise.reject(new Error(`unexpected fetch ${u}`));
      }),
    );
    installControllableEventSource();
    const allow = () =>
      ({ ok: true, status: 200, json: async () => ({ data: { allowlist: [], enforce: false } }) }) as Response;
    const terminal = () =>
      ({ ok: true, status: 200, json: async () => ({ data: { executionId: "e1", status: "completed" } }) }) as Response;
    const bootWithPlan = (plan: string) =>
      act(() => {
        window.dispatchEvent(
          new MessageEvent("message", {
            origin: "http://host.test",
            data: {
              type: "wc:boot",
              payload: { apiBase: "http://api.test/api", triggerEndpointPath: "t1", profile: { plan } },
            },
          }),
        );
      });

    const { result } = renderHook(() => useWidget());
    bootWithPlan("first");
    await waitFor(() => expect(embedResolvers.length).toBe(1));
    await act(async () => {
      embedResolvers[0](allow());
      await flushAsync();
    });
    await waitFor(() => expect(statusResolvers.length).toBe(1)); // 1차가 복원 seed 진입.

    bootWithPlan("last"); // 2차 재전송 — 1차를 대체한다.
    await waitFor(() => expect(embedResolvers.length).toBe(2));

    // 1차의 seed 가 "이미 종료됨" 으로 응답 — 대체됐으므로 종료를 확정하면 안 된다.
    await act(async () => {
      statusResolvers[0](terminal());
      await flushAsync();
    });
    // 2차가 뒤늦게 resolve — 1차의 종료 확정에 휩쓸려 물러나면 안 된다.
    await act(async () => {
      embedResolvers[1](allow());
      await flushAsync();
    });
    if (statusResolvers.length > 1) {
      await act(async () => {
        statusResolvers[1](terminal());
        await flushAsync();
      });
    }

    // 마지막 boot 의 config 가 적용됐다(§3(재전송)).
    expect((result.current.config?.profile as { plan?: string } | undefined)?.plan).toBe("last");
    // 그리고 종료는 유실되지 않았다 — 살아있는 시도가 확정했다(주체만 바뀜).
    expect(result.current.state.phase).toBe("ended");
  });

  // §3(재전송) — **재전송은 config 만 갱신한다. 살아있는 대화를 되감지 않는다.**
  //
  // 재현된 결함(ai-review 17_36_57 requirement): 재전송마다 복원 분기를 다시 타서, 입력 대기 중이던
  // 사용자의 `phase` 가 `RESTORED` 로 `streaming` 이 되며 **입력창이 사라졌다가** seed 응답 후 돌아왔다.
  // 관리자 라이브 미리보기는 외형 폼 변경마다 **디바운스 없이** 재전송하므로 키 입력마다 발생한다.
  // 덤으로 `getStatus`·SSE·토큰 갱신도 매번 재실행됐다.
  it("§3(재전송): 활성 대화 중 재전송은 입력창을 되감지 않는다", async () => {
    window.sessionStorage.setItem(
      "clemvion-web-chat:session:t1",
      JSON.stringify({ executionId: "e1", token: "iext_old", expiresAt: new Date(Date.now() + NINETY_MIN_MS).toISOString(), endpoints: ENDPOINTS }),
    );
    const embedResolvers: Array<(r: Response) => void> = [];
    let statusCalls = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn((url: unknown, init?: RequestInit) => {
        const u = String(url);
        if (u.includes("/embed-config")) {
          return new Promise<Response>((r) => {
            embedResolvers.push(r);
          });
        }
        if (u.endsWith("/api/external/executions/e1") && (init?.method ?? "GET") === "GET") {
          statusCalls += 1;
          return Promise.resolve({
            ok: true,
            status: 200,
            json: async () => ({
              data: {
                executionId: "e1",
                status: "waiting_for_input",
                context: { interactionType: "ai_conversation", waitingNodeId: "n1", conversationThread: { turns: [] } },
              },
            }),
          } as Response);
        }
        return Promise.reject(new Error(`unexpected fetch ${u}`));
      }),
    );
    const { getEs } = installControllableEventSource();
    const allow = () =>
      ({ ok: true, status: 200, json: async () => ({ data: { allowlist: [], enforce: false } }) }) as Response;

    const { result } = renderHook(() => useWidget());
    boot();
    await waitFor(() => expect(embedResolvers.length).toBe(1));
    await act(async () => {
      embedResolvers[0](allow());
      await flushAsync();
    });
    // 복원 seed 가 대기 표면을 시드 → 사용자가 입력할 수 있는 상태.
    await waitFor(() => expect(result.current.state.phase).toBe("awaiting_user_message"));
    const statusBefore = statusCalls;
    const esBefore = getEs();

    // 관리자가 미리보기 폼에 키를 입력 → 디바운스 없이 wc:boot 재전송.
    boot();
    await waitFor(() => expect(embedResolvers.length).toBe(2));
    await act(async () => {
      embedResolvers[1](allow());
      await flushAsync();
    });

    // 입력창이 그대로다(되감기 없음).
    expect(result.current.state.phase).toBe("awaiting_user_message");
    // 세션도 건드리지 않는다 — getStatus 재조회·SSE 재오픈 없음.
    expect(statusCalls).toBe(statusBefore);
    expect(getEs()).toBe(esBefore);
  });

  // 위 fix 의 **반대 방향** — 재전송이 복원을 건너뛰는 판정이 과하면 연결이 영영 안 선다.
  //
  // 내가 이 스킵을 `startedRef`(시작했나)로 처음 썼다가 낸 결함(재현 확인): `startedRef` 는 복원
  // **시작** 시점에 서므로, 대체된 시도가 seed 도중 물러나면(스트림을 못 연 채) 그 플래그만 남아
  // **살아있는 시도까지 복원을 건너뛰게** 만들어 `streaming` 인데 연결이 0개로 고착됐다.
  // 판정은 `streamRef`(연결이 살아있나)여야 한다 — 두 테스트가 그 경계를 양쪽에서 지킨다.
  it("§3(재전송): 대체된 시도가 연결 전에 물러나도 살아있는 시도가 연결을 세운다", async () => {
    window.sessionStorage.setItem(
      "clemvion-web-chat:session:t1",
      JSON.stringify({ executionId: "e1", token: "iext_old", expiresAt: new Date(Date.now() + NINETY_MIN_MS).toISOString(), endpoints: ENDPOINTS }),
    );
    const embedResolvers: Array<(r: Response) => void> = [];
    const statusResolvers: Array<(r: Response) => void> = [];
    vi.stubGlobal(
      "fetch",
      vi.fn((url: unknown, init?: RequestInit) => {
        const u = String(url);
        if (u.includes("/embed-config")) {
          return new Promise<Response>((r) => {
            embedResolvers.push(r);
          });
        }
        if (u.endsWith("/api/external/executions/e1") && (init?.method ?? "GET") === "GET") {
          return new Promise<Response>((r) => {
            statusResolvers.push(r);
          });
        }
        return Promise.reject(new Error(`unexpected fetch ${u}`));
      }),
    );
    const { getEs } = installControllableEventSource();
    const allow = () =>
      ({ ok: true, status: 200, json: async () => ({ data: { allowlist: [], enforce: false } }) }) as Response;
    const running = () =>
      ({ ok: true, status: 200, json: async () => ({ data: { executionId: "e1", status: "running" } }) }) as Response;

    renderHook(() => useWidget());
    boot();
    await waitFor(() => expect(embedResolvers.length).toBe(1));
    await act(async () => {
      embedResolvers[0](allow());
      await flushAsync();
    });
    await waitFor(() => expect(statusResolvers.length).toBe(1)); // 1차 복원 seed 진입 — 아직 연결 없음.
    expect(getEs()).toBeNull(); // 전제 — 이 시점에 스트림이 없어야 이 테스트가 의미를 갖는다.

    boot(); // 2차가 1차를 대체.
    await waitFor(() => expect(embedResolvers.length).toBe(2));

    // 1차의 seed 가 **비-terminal** 로 응답 — 대체됐으므로 연결을 열지 않고 물러난다.
    await act(async () => {
      statusResolvers[0](running());
      await flushAsync();
    });
    // 2차가 진행 — 연결을 세워야 한다(1차가 남긴 플래그에 막히면 안 된다).
    await act(async () => {
      embedResolvers[1](allow());
      await flushAsync();
    });
    if (statusResolvers.length > 1) {
      await act(async () => {
        statusResolvers[1](running());
        await flushAsync();
      });
    }

    expect(getEs()).not.toBeNull();
  });

  // §3(재전송) 두 번째 재검증 지점 — **복원 분기**(seed 뒤). 위 테스트는 첫 지점(embed 검증 뒤)만 덮는다.
  //
  // 이 지점이 왜 별도로 필요한가: 이 파일은 **비대칭 가드 누락**(한 호출부는 재검증하고 다른 호출부는
  // 빠뜨림)으로 3번 CRITICAL 을 냈다(`02_04_13` C1 · `08_29_33` W2 · `09_36_01` W5). 실제로 이 테스트를
  // 쓰기 전엔 둘째 지점의 가드를 제거해도 45건이 전부 통과했다 — 무방비였다.
  //
  // 시나리오: 복원 seed 가 떠 있는 동안 host 가 `wc:boot` 을 재전송하면, **대체된** 시도는 그 세션으로
  // SSE 를 열면 안 된다(`02_04_13` C1 과 동형 — 대체된 시도가 스트림·토큰 갱신을 되살리는 문제).
  it("§3(재전송): 복원 seed 중 재전송으로 대체된 시도는 SSE 를 열지 않는다", async () => {
    window.sessionStorage.setItem(
      "clemvion-web-chat:session:t1",
      JSON.stringify({ executionId: "e1", token: "iext_old", expiresAt: new Date(Date.now() + NINETY_MIN_MS).toISOString(), endpoints: ENDPOINTS }),
    );
    const embedResolvers: Array<(r: Response) => void> = [];
    let resolveStatus: ((r: Response) => void) | null = null;
    vi.stubGlobal(
      "fetch",
      vi.fn((url: unknown, init?: RequestInit) => {
        const u = String(url);
        if (u.includes("/embed-config")) {
          return new Promise<Response>((r) => {
            embedResolvers.push(r);
          });
        }
        // 복원 seed 의 getStatus 를 in-flight 로 잡아둔다.
        if (u.endsWith("/api/external/executions/e1") && (init?.method ?? "GET") === "GET") {
          return new Promise<Response>((r) => {
            resolveStatus = r;
          });
        }
        return Promise.reject(new Error(`unexpected fetch ${u}`));
      }),
    );
    const { getEs } = installControllableEventSource();

    renderHook(() => useWidget());
    boot(); // 1차
    await waitFor(() => expect(embedResolvers.length).toBe(1));
    await act(async () => {
      embedResolvers[0]({ ok: true, status: 200, json: async () => ({ data: { allowlist: [], enforce: false } }) } as Response);
      await flushAsync();
    });
    await waitFor(() => expect(resolveStatus).not.toBeNull()); // 복원 seed in-flight.

    // 2차 재전송 — 1차를 대체한다. (2차의 embed-config 는 일부러 미해결로 둬 1차 거동만 관측한다.)
    boot();
    await waitFor(() => expect(embedResolvers.length).toBe(2));

    // 1차의 seed 가 뒤늦게 정상 응답 — 그러나 1차는 대체됐으므로 물러나야 한다.
    await act(async () => {
      resolveStatus?.({
        ok: true,
        status: 200,
        json: async () => ({ data: { executionId: "e1", status: "running" } }),
      } as Response);
      await flushAsync();
    });

    // 대체된 시도가 옛 세션으로 SSE 를 열지 않았다.
    expect(getEs()).toBeNull();
  });

  // `applyConfig` 의 **world 축** 고정 — 위 두 §3(재전송) 테스트는 boot 축만 덮는다.
  //
  // A/B 로 확인한 기존 갭이다: 변경 전 코드(`isStale(gen)`)에서도 이 가드를 제거하면 44건이 전부
  // 통과했다 — `applyConfig` 의 world 재검증은 한 번도 고정된 적이 없다. `isAttemptStale` 이 두 축을
  // 함께 보게 되면서 mutation 매트릭스(world 축만 무력화)로 드러났다.
  //
  // 관측 경로: embed-config 왕복 중 언마운트. 언마운트는 world 를 무효화하므로(그 cleanup 이 세대를
  // 올린다) 뒤늦게 resolve 한 부팅은 물러나야 한다 — 아니면 사라진 컴포넌트가 저장 세션을 복원하고
  // SSE 를 연다(`08_29_33` W3 가 `start()` 경로에서 닫은 것과 동형).
  it("embed-config 왕복 중 언마운트 → 지연 응답이 세션·SSE 를 되살리지 않는다", async () => {
    window.sessionStorage.setItem(
      "clemvion-web-chat:session:t1",
      JSON.stringify({ executionId: "e1", token: "iext_old", expiresAt: new Date(Date.now() + NINETY_MIN_MS).toISOString(), endpoints: ENDPOINTS }),
    );
    let resolveEmbed: ((r: Response) => void) | null = null;
    vi.stubGlobal(
      "fetch",
      vi.fn((url: unknown) => {
        const u = String(url);
        if (u.includes("/embed-config")) {
          return new Promise<Response>((r) => {
            resolveEmbed = r;
          });
        }
        return Promise.reject(new Error(`unexpected fetch ${u}`));
      }),
    );
    const { getEs } = installControllableEventSource();

    const { unmount } = renderHook(() => useWidget());
    boot();
    await waitFor(() => expect(resolveEmbed).not.toBeNull()); // embed-config in-flight.

    unmount();

    // 사라진 위젯의 부팅이 뒤늦게 허용으로 resolve.
    await act(async () => {
      resolveEmbed?.({
        ok: true,
        status: 200,
        json: async () => ({ data: { allowlist: [], enforce: false } }),
      } as Response);
      await flushAsync();
    });

    // 복원 분기로 들어가 SSE 를 열지 않았다.
    expect(getEs()).toBeNull();
  });

  // **비-410 명령 실패는 세션을 지우지 않는다** — `3-auth-session.md` §3.1-3 의 storage 정리 조건
  // 열거(SSE terminal·200+terminal·404·복구불가 401·명령 410)에 "그 외 명령 실패" 가 없고, §3.1-2 는
  // "200 + running → 복원" 을 명시한다.
  //
  // 이 테스트는 한때 정반대(`storage 소거` + `부활 안 함`)를 단언했다. 그 단언이 스스로를 반증했다 —
  // mock 이 `getStatus` 를 처음부터 끝까지 `{status:"running"}`(서버 생존)으로 고정해 두고도 소거를
  // 요구했으니, 살아있는 대화를 죽이는 걸 고정하고 있던 셈이다. 실측: 그 구현에선 500 직후
  // 새로고침 시 `phase=collapsed`·`executionId` 없음(대화 영구 유실).
  // (ai-review 2026-07-17 18_39_11 requirement CRITICAL)
  it("일시적 명령 실패(500)는 저장 세션을 지우지 않는다 — 서버가 살아있으면 복원된다", async () => {
    window.sessionStorage.setItem(
      "clemvion-web-chat:session:t1",
      JSON.stringify({ executionId: "e1", token: "iext_old", expiresAt: new Date(Date.now() + NINETY_MIN_MS).toISOString(), endpoints: ENDPOINTS }),
    );
    const embedResolvers: Array<(r: Response) => void> = [];
    let statusCalls = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn((url: unknown, init?: RequestInit) => {
        const u = String(url);
        if (u.includes("/embed-config")) {
          return new Promise<Response>((r) => {
            embedResolvers.push(r);
          });
        }
        // 명령이 500 으로 실패 → ERROR → ended.
        if (u.includes("/interact")) {
          return Promise.resolve({ ok: false, status: 500, json: async () => ({}) } as Response);
        }
        if (u.endsWith("/api/external/executions/e1") && (init?.method ?? "GET") === "GET") {
          statusCalls += 1;
          return Promise.resolve({
            ok: true,
            status: 200,
            json: async () => ({ data: { executionId: "e1", status: "running" } }),
          } as Response);
        }
        return Promise.reject(new Error(`unexpected fetch ${u}`));
      }),
    );
    const { getEs } = installControllableEventSource();
    const allow = () =>
      ({ ok: true, status: 200, json: async () => ({ data: { allowlist: [], enforce: false } }) }) as Response;

    const { result } = renderHook(() => useWidget());
    boot();
    await waitFor(() => expect(embedResolvers.length).toBe(1));
    await act(async () => {
      embedResolvers[0](allow());
      await flushAsync();
    });
    await waitFor(() => expect(result.current.state.phase).toBe("streaming")); // 복원됨.

    // 대기 표면 → 명령 전송 → 500 → ERROR → ended. **이 경로는 세션을 지우지 않는다.**
    act(() => {
      getEs()?.emit("execution.waiting_for_input", {
        interactionType: "ai_conversation",
        waitingNodeId: "n1",
        conversationThread: { turns: [] },
      });
    });
    await waitFor(() => expect(result.current.state.phase).toBe("awaiting_user_message"));
    act(() => result.current.actions.submitMessage("실패할 명령"));
    await waitFor(() => expect(result.current.state.phase).toBe("ended"));

    // **세션이 보존된다** — 서버 execution 은 `running` 이고, spec 은 그런 세션을 복원하라고 한다.
    // (실제 복원은 새로고침 경로에서 일어난다 — 아래 테스트.)
    expect(window.sessionStorage.getItem("clemvion-web-chat:session:t1")).not.toBeNull();
    const esAfterError = getEs();
    const statusCallsAfterError = statusCalls;

    // host 가 외형 갱신 등으로 wc:boot 재전송(§3(재전송)).
    boot();
    await waitFor(() => expect(embedResolvers.length).toBe(2));
    await act(async () => {
      embedResolvers[1](allow());
      await flushAsync();
    });

    // **부작용 재발사 없음** — `getStatus` 재조회도, SSE 재오픈도 없다. 이걸 막는 건 리듀서 가드가
    // 아니라 `sessionEstablished()` 복원-스킵이다(스트림이 아직 살아있으므로 복원할 게 없다).
    // 한때 이 자리를 `teardownSession()`(storage 소거)으로 막으려 했는데, 그건 불필요했을 뿐 아니라
    // 살아있는 세션을 영구 파괴했다 — 스킵 판정이 이미 같은 일을 하고 있었다.
    expect(statusCalls).toBe(statusCallsAfterError);
    expect(getEs()).toBe(esAfterError);
    // phase 는 `ended` 로 남는다 — `ERROR` → `ended` 자체가 이 PR 이전부터의 gap 이다
    // (`1-widget-app.md` §2 Form 은 "실패 시 재제출" 을 약속한다). plan 에 이월.
    expect(result.current.state.phase).toBe("ended");
  });

  // 위 테스트의 사용자 관점 짝 — **탭 새로고침**으로 복원되는가. `wc:boot` 재전송(같은 마운트)이
  // 아니라 언마운트→재마운트라, 리듀서 가드가 아니라 **storage 생존** 만이 결과를 가른다.
  // 실측 A/B: `sendCommand` 비-410 경로의 `teardownSession()` 한 줄이 있으면
  // `phase=collapsed`·`executionId` 없음 / 없으면 `streaming`·`e1`.
  it("일시적 명령 실패(500) 후 새로고침하면 살아있는 대화가 복원된다", async () => {
    window.sessionStorage.setItem(
      "clemvion-web-chat:session:t1",
      JSON.stringify({ executionId: "e1", token: "iext_old", expiresAt: new Date(Date.now() + NINETY_MIN_MS).toISOString(), endpoints: ENDPOINTS }),
    );
    const embedResolvers: Array<(r: Response) => void> = [];
    vi.stubGlobal(
      "fetch",
      vi.fn((url: unknown, init?: RequestInit) => {
        const u = String(url);
        if (u.includes("/embed-config")) {
          return new Promise<Response>((r) => {
            embedResolvers.push(r);
          });
        }
        if (u.includes("/interact")) {
          return Promise.resolve({ ok: false, status: 500, json: async () => ({}) } as Response);
        }
        if (u.endsWith("/api/external/executions/e1") && (init?.method ?? "GET") === "GET") {
          // 서버 execution 은 내내 살아있다 — 위젯이 명령 하나를 못 보냈을 뿐이다.
          return Promise.resolve({
            ok: true,
            status: 200,
            json: async () => ({ data: { executionId: "e1", status: "running" } }),
          } as Response);
        }
        return Promise.reject(new Error(`unexpected fetch ${u}`));
      }),
    );
    const { getEs } = installControllableEventSource();
    const allow = () =>
      ({ ok: true, status: 200, json: async () => ({ data: { allowlist: [], enforce: false } }) }) as Response;

    const first = renderHook(() => useWidget());
    boot();
    await waitFor(() => expect(embedResolvers.length).toBe(1));
    await act(async () => {
      embedResolvers[0](allow());
      await flushAsync();
    });
    await waitFor(() => expect(first.result.current.state.phase).toBe("streaming"));
    act(() => {
      getEs()?.emit("execution.waiting_for_input", {
        interactionType: "ai_conversation",
        waitingNodeId: "n1",
        conversationThread: { turns: [] },
      });
    });
    await waitFor(() => expect(first.result.current.state.phase).toBe("awaiting_user_message"));
    act(() => first.result.current.actions.submitMessage("일시적으로 실패할 명령"));
    await waitFor(() => expect(first.result.current.state.phase).toBe("ended"));

    // 탭 새로고침 = 언마운트 → 새 마운트.
    first.unmount();
    const reloaded = renderHook(() => useWidget());
    boot();
    await waitFor(() => expect(embedResolvers.length).toBe(2));
    await act(async () => {
      embedResolvers[1](allow());
      await flushAsync();
    });

    // §3.1-2: 200 + running → 복원. 대화가 돌아온다.
    await waitFor(() => expect(reloaded.result.current.state.phase).toBe("streaming"));
    expect(reloaded.result.current.state.executionId).toBe("e1");
  });

  // **대체된 부팅 시도의 지연 `getStatus` 가 살아있는 화면을 되감지 않는다** (boot 축).
  //
  // 재현 확인: 호출부 checkpoint 2(`isAttemptStale`)는 `seedWaitingFromStatus` 가 **반환한 뒤** 만
  // 게이팅하는데 `WAITING` dispatch 는 함수 **안쪽**에서 그보다 먼저 끝난다 — "await 뒤 재검증"
  // 계약이 함수 경계에서 끊기는 유일한 자리였다. world 축은 이 시나리오 내내 안 바뀐다(대화가
  // 살아있으므로) → 옛 세계 가드로는 못 잡는다.
  //
  // 단순 flicker 가 아니라 고착이다: 되감긴 n1 표면에 사용자가 응답하면 이미 지나간 nodeId 로
  // 명령이 나가 백엔드가 거부한다. (ai-review 2026-07-17 18_39_11 concurrency CRITICAL)
  it("대체된 시도의 지연 getStatus 가 살아있는 화면을 옛 노드로 되감지 않는다", async () => {
    window.sessionStorage.setItem(
      "clemvion-web-chat:session:t1",
      JSON.stringify({ executionId: "e1", token: "iext_old", expiresAt: new Date(Date.now() + NINETY_MIN_MS).toISOString(), endpoints: ENDPOINTS }),
    );
    const embedResolvers: Array<(r: Response) => void> = [];
    const statusResolvers: Array<(r: Response) => void> = [];
    vi.stubGlobal("fetch", vi.fn((url: unknown, init?: RequestInit) => {
      const u = String(url);
      if (u.includes("/embed-config")) return new Promise<Response>((r) => { embedResolvers.push(r); });
      if (u.endsWith("/api/external/executions/e1") && (init?.method ?? "GET") === "GET") {
        return new Promise<Response>((r) => { statusResolvers.push(r); });
      }
      return Promise.reject(new Error(`unexpected fetch ${u}`));
    }));
    const { getEs } = installControllableEventSource();
    const allow = () => ({ ok: true, status: 200, json: async () => ({ data: { allowlist: [], enforce: false } }) }) as Response;
    const waitingAt = (nodeId: string) => ({ ok: true, status: 200, json: async () => ({ data: {
      executionId: "e1", status: "waiting_for_input",
      context: { interactionType: "ai_conversation", waitingNodeId: nodeId, conversationThread: { turns: [] } },
    } }) }) as Response;

    const { result } = renderHook(() => useWidget());

    // 부팅#1 — embed 왕복 중.
    boot();
    await waitFor(() => expect(embedResolvers.length).toBe(1));
    await act(async () => { embedResolvers[0](allow()); await flushAsync(); });
    // 부팅#1 이 복원 seed 진입 → getStatus A 발사(미해결).
    await waitFor(() => expect(statusResolvers.length).toBe(1));

    // A 가 아직 안 끝났는데 wc:boot 재전송(부팅#2).
    boot();
    await waitFor(() => expect(embedResolvers.length).toBe(2));
    await act(async () => { embedResolvers[1](allow()); await flushAsync(); });
    // 부팅#2 도 스트림 미확립 창에 걸려 자기 getStatus B 를 낸다.
    await waitFor(() => expect(statusResolvers.length).toBe(2));

    // B 가 먼저 응답 → n1 표면 + 스트림 오픈(부팅#2 소유).
    await act(async () => { statusResolvers[1](waitingAt("n1")); await flushAsync(); });
    expect(result.current.state.pending?.nodeId).toBe("n1");

    // 살아있는 대화가 SSE 로 전진 → n2.
    act(() => { getEs()?.emit("execution.waiting_for_input", { interactionType: "ai_conversation", waitingNodeId: "n2", conversationThread: { turns: [] } }); });
    expect(result.current.state.pending?.nodeId).toBe("n2");

    // 대체된 부팅#1 의 getStatus A 가 **뒤늦게** 옛 스냅샷(n1)으로 응답.
    await act(async () => { statusResolvers[0](waitingAt("n1")); await flushAsync(); });

    // 화면은 SSE 가 전진시킨 n2 그대로 — 대체된 시도는 표면을 그리지 못한다.
    expect(result.current.state.pending?.nodeId).toBe("n2");
  });

  // **반대 축 — 대체된 시도가 발견한 "진짜 종료" 는 그대로 확정돼야 한다.**
  //
  // 위 테스트와 짝이다. 같은 함수 안에서 표면 갱신은 boot 축을 보고(대체된 시도는 그리지 않음)
  // 종료 확정은 **일부러 보지 않는다**(대체된 시도도 확정함). 종료는 세계의 사실이지 시도의
  // 소유물이 아니기 때문 — 살아있는 시도가 `sessionEstablished()` 스킵으로 자기 getStatus 를 아예
  // 안 낼 수 있고, 버퍼 만료 구간에선 terminal SSE 도 다시 오지 않는다(§replay_unavailable).
  //
  // 이 방향을 고정하지 않으면 "대칭이 예뻐 보인다" 는 이유로 종료 확정에도 boot 가드가 붙는다 —
  // 실제로 mutation 시 이 테스트가 없을 땐 388건 전부 통과했다(무방비).
  it("대체된 시도가 발견한 종료는 그대로 확정된다 (종료 확정은 boot 축을 보지 않는다)", async () => {
    window.sessionStorage.setItem(
      "clemvion-web-chat:session:t1",
      JSON.stringify({ executionId: "e1", token: "iext_old", expiresAt: new Date(Date.now() + NINETY_MIN_MS).toISOString(), endpoints: ENDPOINTS }),
    );
    const embedResolvers: Array<(r: Response) => void> = [];
    const statusResolvers: Array<(r: Response) => void> = [];
    vi.stubGlobal("fetch", vi.fn((url: unknown, init?: RequestInit) => {
      const u = String(url);
      if (u.includes("/embed-config")) return new Promise<Response>((r) => { embedResolvers.push(r); });
      if (u.endsWith("/api/external/executions/e1") && (init?.method ?? "GET") === "GET") {
        return new Promise<Response>((r) => { statusResolvers.push(r); });
      }
      return Promise.reject(new Error(`unexpected fetch ${u}`));
    }));
    const { getEs } = installControllableEventSource();
    const allow = () => ({ ok: true, status: 200, json: async () => ({ data: { allowlist: [], enforce: false } }) }) as Response;
    const waitingAt = (nodeId: string) => ({ ok: true, status: 200, json: async () => ({ data: {
      executionId: "e1", status: "waiting_for_input",
      context: { interactionType: "ai_conversation", waitingNodeId: nodeId, conversationThread: { turns: [] } },
    } }) }) as Response;
    const completed = () => ({ ok: true, status: 200, json: async () => ({ data: { executionId: "e1", status: "completed" } }) }) as Response;

    const { result } = renderHook(() => useWidget());
    boot();
    await waitFor(() => expect(embedResolvers.length).toBe(1));
    await act(async () => { embedResolvers[0](allow()); await flushAsync(); });
    await waitFor(() => expect(statusResolvers.length).toBe(1)); // 부팅#1 의 getStatus A.

    boot();
    await waitFor(() => expect(embedResolvers.length).toBe(2));
    await act(async () => { embedResolvers[1](allow()); await flushAsync(); });
    await waitFor(() => expect(statusResolvers.length).toBe(2)); // 부팅#2 의 getStatus B.

    // B 가 먼저 응답 → 대화 진행 중으로 보이고 스트림이 열린다.
    await act(async () => { statusResolvers[1](waitingAt("n1")); await flushAsync(); });
    expect(result.current.state.phase).toBe("awaiting_user_message");
    expect(getEs()).not.toBeNull();

    // 대체된 부팅#1 의 A 가 뒤늦게 **종료**를 싣고 온다 — 살아있는 시도는 이 사실을 모른다.
    await act(async () => { statusResolvers[0](completed()); await flushAsync(); });

    // 대체됐어도 종료는 확정한다 — 아니면 위젯이 streaming 에 무기한 멈춘다.
    await waitFor(() => expect(result.current.state.phase).toBe("ended"));
    expect(window.sessionStorage.getItem("clemvion-web-chat:session:t1")).toBeNull();
  });

  // **언마운트된 위젯은 새 execution 을 시작하지 않는다** — `cannotApplyConfig` 의 `unmountedRef` 축.
  //
  // checkpoint 1 은 world 축을 일부러 보지 않으므로(§3(재전송) 을 위해), 언마운트를 잡는 건 `unmountedRef`
  // **뿐**이다. 그게 없으면 언마운트 후 도착한 `embed-config` 응답이 checkpoint 1 을 통과해
  // `establishConfig` 를 실행하고, 접수돼 있던 리셋을 이행하며 **사라진 컴포넌트가 webhook POST 로
  // 새 execution 을 시작한다**(리소스 누수).
  //
  // 이 축은 mutation 무방비였다 — `unmountedRef` 체크를 지워도 389건 전부 통과했다.
  // (ai-review 2026-07-17 18_39_11 testing 블라인드 스팟 ② / concurrency INFO)
  it("언마운트 후 도착한 embed 응답은 새 execution 을 시작하지 않는다", async () => {
    const embedResolvers: Array<(r: Response) => void> = [];
    const fetchMock = vi.fn((url: unknown, init?: RequestInit) => {
      const u = String(url);
      if (u.includes("/embed-config")) {
        return new Promise<Response>((r) => {
          embedResolvers.push(r);
        });
      }
      if (u.includes("/api/hooks/") && init?.method === "POST") {
        return Promise.resolve({
          ok: true,
          status: 202,
          json: async () => ({ data: { executionId: "e1", status: "pending", interaction: { token: "iext_x", expiresAt: new Date(Date.now() + NINETY_MIN_MS).toISOString(), endpoints: ENDPOINTS } } }),
        } as Response);
      }
      return Promise.reject(new Error(`unexpected fetch ${u}`));
    });
    vi.stubGlobal("fetch", fetchMock);
    installControllableEventSource();

    const { unmount } = renderHook(() => useWidget());
    boot();
    await waitFor(() => expect(embedResolvers.length).toBe(1)); // embed 왕복 중 — config 미확립.

    // 부팅 중 host 리셋 → `pendingResetRef` 에 접수(부팅 전엔 정리할 게 없다).
    sendHostCommand("resetSession");
    // 위젯이 사라진다(호스트가 iframe 제거 / 페이지 이탈).
    unmount();

    // 이제서야 embed 응답 도착.
    await act(async () => {
      embedResolvers[0]({ ok: true, status: 200, json: async () => ({ data: { allowlist: [], enforce: false } }) } as Response);
      await flushAsync();
    });

    // 사라진 컴포넌트는 아무것도 시작하지 않는다.
    const webhookPosts = fetchMock.mock.calls.filter(
      ([u, init]) => String(u).includes("/api/hooks/") && (init as RequestInit | undefined)?.method === "POST",
    );
    expect(webhookPosts.length).toBe(0);
  });

  // **`start()`(eager 부팅) 자신의 seed 도 boot 축으로 보호돼야 한다** — 세 번째(그리고 마지막) 되감기
  // 경로. 직전 라운드는 `applyConfig` 복원 분기만 boot 토큰으로 막았고, `start()` 는 "world 축만 필요"
  // 라는 (반증된) 근거로 무방비였다. 세 리뷰어(concurrency·requirement·side_effect)가 독립적으로 실제
  // 코드로 재현했다: start() 가 세션을 storage 에 쓴 직후·자기 getStatus 응답 전이라는 좁은 창에
  // wc:boot 재전송이 같은 세션을 복원 분기로 넘겨받아 SSE 로 화면을 전진시킨 뒤, start() 의 지연 응답이
  // 옛 노드로 화면을 되감고 **두 번째 EventSource 까지 연다**.
  //
  // start() 는 부팅 시도(config 경합자)가 아니므로 `beginBootAttempt()` 로 세대를 올리면 안 된다 —
  // 진입 시점의 `bootGenRef.current` 를 **읽기전용 스냅샷**으로만 잡아 넘긴다. "이 seed 가 응답할 때쯤
  // 더 최신 재전송이 이미 이 세션을 넘겨받았는가" 만 판별한다.
  // (ai-review 2026-07-17 23_58_23 concurrency·requirement·side_effect CRITICAL)
  it("start() 의 지연 seed 가 재전송이 전진시킨 화면을 되감거나 두번째 스트림을 열지 않는다", async () => {
    let esCount = 0;
    let latestEs: { emit: (t: string, d: unknown) => void } | null = null;
    class CountingES {
      private readonly listeners: Record<string, (e: MessageEvent) => void> = {};
      constructor() {
        esCount += 1;
        latestEs = this;
      }
      addEventListener(type: string, l: (e: MessageEvent) => void) {
        this.listeners[type] = l;
      }
      close() {}
      emit(type: string, data: unknown) {
        this.listeners[type]?.({ data: JSON.stringify(data) } as MessageEvent);
      }
    }
    vi.stubGlobal("EventSource", CountingES as unknown as typeof EventSource);

    const webhookResolvers: Array<(r: Response) => void> = [];
    const statusResolvers: Array<(r: Response) => void> = [];
    vi.stubGlobal(
      "fetch",
      vi.fn((url: unknown, init?: RequestInit) => {
        const u = String(url);
        if (u.includes("/embed-config")) {
          return Promise.resolve({ ok: true, status: 200, json: async () => ({ data: { allowlist: [], enforce: false } }) } as Response);
        }
        if (u.includes("/api/hooks/") && init?.method === "POST") {
          return new Promise<Response>((r) => { webhookResolvers.push(r); });
        }
        if (u.endsWith("/api/external/executions/e1") && (init?.method ?? "GET") === "GET") {
          return new Promise<Response>((r) => { statusResolvers.push(r); });
        }
        return Promise.reject(new Error(`unexpected fetch ${u}`));
      }),
    );
    const webhook202 = () =>
      ({ ok: true, status: 202, json: async () => ({ data: {
        executionId: "e1", status: "pending",
        interaction: { token: "iext_x", expiresAt: new Date(Date.now() + NINETY_MIN_MS).toISOString(), endpoints: ENDPOINTS },
      } }) }) as Response;
    const waitingAt = (nodeId: string) =>
      ({ ok: true, status: 200, json: async () => ({ data: {
        executionId: "e1", status: "waiting_for_input",
        context: { interactionType: "ai_conversation", waitingNodeId: nodeId, conversationThread: { turns: [] } },
      } }) }) as Response;

    const { result } = renderHook(() => useWidget());

    // 신규 방문(저장 세션 없음). wc:boot #1 → config 확립. 패널 open → start() 진입.
    boot();
    await waitFor(() => expect(result.current.config).not.toBeNull());
    act(() => result.current.actions.open());
    await waitFor(() => expect(webhookResolvers.length).toBe(1)); // start() 의 webhook POST in-flight.

    // webhook 해결 → start() 가 세션을 storage 에 쓰고 자기 getStatus(호출 C, attempt 없음)를 낸다.
    await act(async () => { webhookResolvers[0](webhook202()); await flushAsync(); });
    await waitFor(() => expect(statusResolvers.length).toBe(1));

    // C 미해결 중 wc:boot 재전송 → 스트림 미확립 창이라 복원 분기가 방금 쓴 세션을 넘겨받아
    // 자기 getStatus(호출 D, attempt 있음)를 낸다.
    boot();
    await waitFor(() => expect(statusResolvers.length).toBe(2));

    // D 먼저 응답(n1) → 스트림 오픈(부팅 재전송 소유), 화면 n1.
    await act(async () => { statusResolvers[1](waitingAt("n1")); await flushAsync(); });
    expect(result.current.state.pending?.nodeId).toBe("n1");
    expect(esCount).toBe(1);

    // 대화가 SSE 로 전진 → n2.
    act(() => { latestEs?.emit("execution.waiting_for_input", { interactionType: "ai_conversation", waitingNodeId: "n2", conversationThread: { turns: [] } }); });
    expect(result.current.state.pending?.nodeId).toBe("n2");

    // start() 의 지연 seed(호출 C, attempt 없음)가 뒤늦게 옛 n1 으로 응답.
    await act(async () => { statusResolvers[0](waitingAt("n1")); await flushAsync(); });

    // 화면은 n2 그대로, 두번째 EventSource 도 안 열린다 — start() seed 는 boot 축으로 스킵된다.
    expect(result.current.state.pending?.nodeId).toBe("n2");
    expect(esCount).toBe(1);
  });
});
