import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { useWidget } from "./use-widget";
import { TOKEN_REFRESH_LEAD_MS } from "./use-token-refresh";

/**
 * 명령(`interact`) 실패 처리 — CLE-WEBCHAT-WIDGET 「명령 실패」, CLE-WEBCHAT-SESSION REQ-WCSESS-037~040
 * (NERV Task CLE-T-79PFHB).
 *
 * 예전에는 `410` 이 아닌 명령 실패가 모두 `ERROR` → `[ended]` 였다. 위젯 세션과 SSE 는 남아서 같은 화면은
 * 끝났는데 스트림은 살아 있었고, 새로고침하면 대화가 되살아났다. 이제는 종료가 확정될 때(`410`, 갱신도
 * 거부된 `401`, `409` 재동기화의 종료 스냅샷)만 끝내고, 그 밖은 같은 표면에서 다시 보내게 한다.
 *
 * 가짜 서버는 `use-widget-refresh-race.test.ts` 와 같은 토큰 회전 규칙(갱신이 닿으면 옛 토큰 폐기)을 따른다.
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
/** 주기 갱신까지의 간격. 실경과시간 드리프트가 단계 경계를 흔들지 못하게 크게 잡는다. */
const SCHEDULE_MS = 90 * 60 * 1000;
const ADVANCE_PAST_SCHEDULE_MS = SCHEDULE_MS + 60 * 1000;
const TOKEN_TTL_MS = TOKEN_REFRESH_LEAD_MS + SCHEDULE_MS;
const RESYNC_TEXT = "재동기화된 표면";

/** `interact` 응답. `"network"` 는 fetch 자체가 실패한다(서버가 받았는지 모른다). */
type InteractReply = { status: number; body?: unknown } | "network";
/** refresh 응답. `"rotate"` 는 옛 토큰을 폐기하고 새 토큰을 준다. */
type RefreshReply = "rotate" | "network" | { status: number };

interface Held {
  release: () => void;
}

function installServer() {
  const valid = new Set<string>();
  let issued = 0;
  const issue = () => {
    issued += 1;
    const token = `iext_${issued}`;
    valid.add(token);
    return { token, expiresAt: new Date(Date.now() + TOKEN_TTL_MS).toISOString() };
  };
  const server = {
    interactReply: { status: 202 } as InteractReply,
    holdInteract: false,
    heldInteract: [] as Held[],
    /** 사용자 명령만 담는다(새 대화의 `cancel` 은 뺀다). */
    commands: [] as Array<{ token: string; body: Record<string, unknown> }>,
    refreshReply: "rotate" as RefreshReply,
    holdRefresh: false,
    heldRefresh: [] as Held[],
    refreshTokensSent: [] as string[],
    statusTokensSent: [] as string[],
    statusSnapshot: "running" as "running" | "waiting" | "completed",
    /** 상태 조회 응답을 붙잡는다. 놓아주는 시점의 토큰 · 스냅샷 설정으로 판정한다. */
    holdStatus: false,
    heldStatus: [] as Held[],
    isValid: (token: string) => valid.has(token),
  };

  const bearer = (init?: RequestInit) =>
    String((init?.headers as Record<string, string> | undefined)?.authorization ?? "").replace(/^Bearer /, "");
  const respond = (status: number, body: unknown = {}) =>
    ({ ok: status >= 200 && status < 300, status, json: async () => body }) as Response;
  const ok = (data: unknown) => respond(200, { data });

  const statusResponse = (token: string): Response => {
    if (!valid.has(token)) return respond(401);
    if (server.statusSnapshot === "completed") return ok({ executionId: "e1", status: "completed" });
    if (server.statusSnapshot === "running") return ok({ executionId: "e1", status: "running" });
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
      return Promise.resolve(
        respond(202, { data: { executionId: "e1", status: "pending", interaction: { ...issue(), endpoints: ENDPOINTS } } }),
      );
    }
    if (u.endsWith("/refresh-token") && init?.method === "POST") {
      const token = bearer(init);
      server.refreshTokensSent.push(token);
      const reply = server.refreshReply;
      let settle: () => Promise<Response>;
      if (reply === "network") {
        settle = () => Promise.reject(new TypeError("Failed to fetch"));
      } else if (reply === "rotate") {
        // 서버 처리는 닿은 즉시 끝난다 — 응답을 붙잡아도 회전은 이미 일어났다.
        const response = valid.delete(token) ? ok(issue()) : respond(401);
        settle = () => Promise.resolve(response);
      } else {
        settle = () => Promise.resolve(respond(reply.status));
      }
      if (!server.holdRefresh) return settle();
      return new Promise<Response>((resolve, reject) =>
        server.heldRefresh.push({ release: () => void settle().then(resolve, reject) }),
      );
    }
    if (u.endsWith("/api/external/executions/e1") && (init?.method ?? "GET") === "GET") {
      const token = bearer(init);
      server.statusTokensSent.push(token);
      if (!server.holdStatus) return Promise.resolve(statusResponse(token));
      return new Promise<Response>((resolve) =>
        server.heldStatus.push({ release: () => resolve(statusResponse(token)) }),
      );
    }
    if (u.includes("/interact")) {
      const body = JSON.parse(String(init?.body ?? "{}")) as Record<string, unknown>;
      if (body.command === "cancel") return Promise.resolve(respond(202));
      server.commands.push({ token: bearer(init), body });
      // 판정은 놓아주는 시점의 응답 설정으로 한다.
      const settle = () => {
        const reply = server.interactReply;
        if (reply === "network") return Promise.reject(new TypeError("Failed to fetch"));
        return Promise.resolve(respond(reply.status, reply.body ?? {}));
      };
      if (!server.holdInteract) return settle();
      return new Promise<Response>((resolve, reject) =>
        server.heldInteract.push({ release: () => void settle().then(resolve, reject) }),
      );
    }
    return Promise.reject(new Error(`unexpected fetch ${u}`));
  });
  vi.stubGlobal("fetch", fetchMock);
  return server;
}

class ControllableEventSource {
  readonly listeners: Record<string, (e: MessageEvent) => void> = {};
  closed = false;
  addEventListener(type: string, listener: (ev: MessageEvent) => void) {
    this.listeners[type] = listener;
  }
  close() {
    this.closed = true;
  }
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

async function flushAsync() {
  await act(async () => {
    await new Promise((r) => setTimeout(r, 0));
  });
}

/** host 로 나간 `conversationEnded` 통지의 `reason` 을 모은다. */
function recordEndedReasons(): unknown[] {
  const reasons: unknown[] = [];
  vi.spyOn(window.parent, "postMessage").mockImplementation(((msg: unknown) => {
    const m = msg as { type?: string; payload?: { name?: string; data?: { reason?: unknown } } };
    if (m?.type === "wc:event" && m?.payload?.name === "conversationEnded") reasons.push(m.payload.data?.reason);
  }) as never);
  return reasons;
}

const TEXT_SURFACE = { interactionType: "ai_conversation", waitingNodeId: "n1", conversationThread: { turns: [] } };
const BUTTON_SURFACE = {
  interactionType: "buttons",
  waitingNodeId: "n2",
  buttonConfig: { buttons: [{ buttonId: "b1", label: "예" }] },
  conversationThread: { turns: [] },
};
const FORM_SURFACE = {
  interactionType: "form",
  waitingNodeId: "n3",
  nodeOutput: { formConfig: { fields: [{ name: "email", label: "이메일" }] } },
  conversationThread: { turns: [] },
};

/** 대화를 시작해 스트림을 열고 주어진 대기 표면까지 간다. 첫 토큰은 `iext_1` 이다. */
async function startAt(surface: Record<string, unknown>) {
  const endedReasons = recordEndedReasons();
  const server = installServer();
  const { getEs } = installEventSource();
  const { result } = renderHook(() => useWidget());
  boot();
  await waitFor(() => expect(result.current.config).not.toBeNull());
  act(() => result.current.actions.open());
  await waitFor(() => expect(getEs()).not.toBeNull());
  await waitFor(() => expect(server.statusTokensSent).toEqual(["iext_1"]));
  await flushAsync();
  act(() => getEs()?.emit("execution.waiting_for_input", surface));
  await waitFor(() => expect(result.current.state.phase).toBe("awaiting_user_message"));
  return { server, getEs, result, endedReasons };
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

describe("useWidget — 종료로 확정되지 않는 명령 실패는 대화를 끝내지 않는다(REQ-WCWIDGET-053)", () => {
  it.each<[string, InteractReply]>([
    ["5xx", { status: 500 }],
    ["503 EXECUTION_ENQUEUE_FAILED", { status: 503, body: { error: { code: "EXECUTION_ENQUEUE_FAILED" } } }],
    ["429", { status: 429, body: { error: { code: "RATE_LIMITED" } } }],
    ["400 MESSAGE_TOO_LONG", { status: 400, body: { error: { code: "MESSAGE_TOO_LONG" } } }],
    ["네트워크 에러", "network"],
  ])("메시지 전송 %s → 말풍선을 거두고 글을 입력창에 되돌린다 · 세션과 SSE 유지(REQ-WCWIDGET-054)", async (_, reply) => {
    const { server, getEs, result, endedReasons } = await startAt(TEXT_SURFACE);
    const es = getEs();
    server.interactReply = reply;

    act(() => result.current.actions.submitMessage("안녕하세요"));
    await waitFor(() => expect(result.current.state.commandFailed).toBe(true));

    const s = result.current.state;
    expect(s.phase).toBe("awaiting_user_message");
    expect(s.pending).toMatchObject({ type: "ai_conversation", nodeId: "n1" });
    expect(s.messages.some((m) => m.role === "user")).toBe(false);
    expect(s.composerDraft).toEqual({ text: "안녕하세요" });
    expect(s.error).toBeUndefined();
    // 위젯 세션 · SSE 를 그대로 둔다(REQ-WCSESS-037). 종료 통지도 없다.
    expect(window.sessionStorage.getItem(STORAGE_KEY)).toContain("iext_1");
    expect(getEs()).toBe(es);
    expect(es?.closed).toBe(false);
    expect(endedReasons).toEqual([]);
    // 자동으로 다시 보내지 않는다(Idempotency-Key 가 없다).
    expect(server.commands).toHaveLength(1);
  });

  it("버튼 선택 실패 → 버튼 표면을 그대로 두고 안내를 보인다", async () => {
    const { server, result } = await startAt(BUTTON_SURFACE);
    server.interactReply = { status: 500 };

    act(() => result.current.actions.clickButton("b1"));
    await waitFor(() => expect(result.current.state.commandFailed).toBe(true));

    expect(result.current.state.phase).toBe("awaiting_user_message");
    expect(result.current.state.pending).toMatchObject({ type: "buttons", nodeId: "n2" });
    expect(window.sessionStorage.getItem(STORAGE_KEY)).not.toBeNull();
  });

  it("다시 보내면 안내를 지우고 성공하면 그대로 진행한다(REQ-WCWIDGET-056)", async () => {
    const { server, result } = await startAt(BUTTON_SURFACE);
    server.interactReply = { status: 500 };
    act(() => result.current.actions.clickButton("b1"));
    await waitFor(() => expect(result.current.state.commandFailed).toBe(true));

    server.interactReply = { status: 202 };
    act(() => result.current.actions.clickButton("b1"));
    expect(result.current.state.commandFailed).toBeUndefined();
    await flushAsync();
    expect(result.current.state.commandFailed).toBeUndefined();
    expect(server.commands).toHaveLength(2);
  });

  it("실패 전에 SSE 로 응답이 왔으면 서버가 처리한 것이라 말풍선을 거두지 않는다", async () => {
    const { server, getEs, result } = await startAt(TEXT_SURFACE);
    server.holdInteract = true;
    server.interactReply = "network";

    act(() => result.current.actions.submitMessage("안녕하세요"));
    act(() => getEs()?.emit("execution.ai_message", { message: "반가워요" }));
    for (const held of server.heldInteract.splice(0)) held.release();
    await waitFor(() => expect(result.current.state.commandFailed).toBe(true));

    expect(result.current.state.messages.map((m) => m.text)).toEqual(["안녕하세요", "반가워요"]);
    expect(result.current.state.composerDraft).toBeUndefined();
    expect(result.current.state.phase).toBe("streaming");
  });

  it("명령이 뜬 사이 새 대화로 바뀌면 옛 실패를 새 대화에 그리지 않는다(staleness)", async () => {
    const { server, result } = await startAt(TEXT_SURFACE);
    server.holdInteract = true;
    server.interactReply = { status: 500 };

    act(() => result.current.actions.submitMessage("옛 대화의 글"));
    await act(async () => {
      await result.current.actions.newChat();
    });
    for (const held of server.heldInteract.splice(0)) held.release();
    await flushAsync();
    await flushAsync();

    expect(result.current.state.commandFailed).toBeUndefined();
    expect(result.current.state.composerDraft).toBeUndefined();
  });
});

describe("useWidget — Form 검증 실패(REQ-WCWIDGET-041)", () => {
  it("400 VALIDATION_ERROR + details → 필드 문구를 두고 Form 표면을 유지한다", async () => {
    const { server, result } = await startAt(FORM_SURFACE);
    server.interactReply = {
      status: 400,
      body: {
        error: {
          code: "VALIDATION_ERROR",
          message: "검증 실패",
          details: [{ field: "email", message: "이메일 형식이 아니에요", code: "INVALID_FIELD" }],
        },
      },
    };

    act(() => result.current.actions.submitForm({ email: "x" }));
    await waitFor(() => expect(result.current.state.fieldErrors).toEqual({ email: "이메일 형식이 아니에요" }));

    expect(result.current.state.commandFailed).toBeUndefined();
    expect(result.current.state.phase).toBe("awaiting_user_message");
    expect(result.current.state.pending).toMatchObject({ type: "form", nodeId: "n3" });
  });

  it("details 가 없는 400 → 일반 명령 실패 안내", async () => {
    const { server, result } = await startAt(FORM_SURFACE);
    server.interactReply = { status: 400, body: { error: { code: "VALIDATION_ERROR", message: "검증 실패" } } };

    act(() => result.current.actions.submitForm({ email: "x" }));
    await waitFor(() => expect(result.current.state.commandFailed).toBe(true));
    expect(result.current.state.fieldErrors).toBeUndefined();
  });
});

describe("useWidget — 명령 409 는 상태 조회로 표면을 다시 맞춘다(REQ-WCWIDGET-055)", () => {
  it("스냅샷이 대기 중이면 그 표면을 그린다 · 대화는 이어진다", async () => {
    const { server, result, endedReasons } = await startAt(TEXT_SURFACE);
    server.interactReply = { status: 409, body: { error: { code: "STATE_MISMATCH" } } };
    server.statusSnapshot = "waiting";
    const statusBefore = server.statusTokensSent.length;

    act(() => result.current.actions.submitMessage("어긋난 입력"));
    await waitFor(() => expect(result.current.state.pending?.nodeId).toBe("n-resync"));

    expect(server.statusTokensSent.length).toBe(statusBefore + 1);
    expect(result.current.state.messages.some((m) => m.text === RESYNC_TEXT)).toBe(true);
    expect(result.current.state.phase).toBe("awaiting_user_message");
    // 되돌린 글은 입력창에 남는다(새 대기 표면이 안내만 지운다).
    expect(result.current.state.composerDraft).toEqual({ text: "어긋난 입력" });
    // 재동기화가 방금 띄운 실패 안내를 지우지 않는다.
    expect(result.current.state.commandFailed).toBe(true);
    expect(endedReasons).toEqual([]);
    expect(window.sessionStorage.getItem(STORAGE_KEY)).not.toBeNull();
  });

  it("스냅샷이 종료면 종료로 확정한다 · 위젯 세션을 지운다", async () => {
    const { server, result, endedReasons } = await startAt(BUTTON_SURFACE);
    server.interactReply = { status: 409, body: { error: { code: "STATE_MISMATCH" } } };
    server.statusSnapshot = "completed";

    act(() => result.current.actions.clickButton("b1"));
    await waitFor(() => expect(result.current.state.phase).toBe("ended"));

    expect(endedReasons).toHaveLength(1);
    expect(window.sessionStorage.getItem(STORAGE_KEY)).toBeNull();
    expect(result.current.state.commandFailed).toBeUndefined();
  });
});

/** 붙잡아 둔 상태 조회 응답을 놓아주고 그 뒤 처리가 끝나기를 기다린다. */
async function releaseHeldStatus(server: ReturnType<typeof installServer>) {
  server.holdStatus = false;
  for (const held of server.heldStatus.splice(0)) held.release();
  await flushAsync();
  await flushAsync();
}

describe("useWidget — 재동기화 스냅샷은 그 사이 보낸 명령을 덮지 않는다(CLE-T-GYRSVK)", () => {
  // 상태 조회가 뜬 사이 사용자가 새 명령을 보냈으면, 늦게 온 스냅샷은 그 명령을 보내기 전의 서버 상태다.
  // 그 스냅샷으로 대기 표면을 그리면 새 말풍선이 사라지고(`mergeMessages` 가 스냅샷을 고른다)
  // `unconfirmedSend` 도 지워져, 새 명령이 실패해도 보낸 글을 되돌리지 못한다.
  it("명령 409 재동기화 중 다시 보낸 메시지를 늦게 온 스냅샷이 지우지 않는다", async () => {
    const { server, result } = await startAt(TEXT_SURFACE);
    server.interactReply = { status: 409, body: { error: { code: "STATE_MISMATCH" } } };
    server.statusSnapshot = "waiting";
    server.holdStatus = true;

    act(() => result.current.actions.submitMessage("어긋난 입력"));
    await waitFor(() => expect(server.heldStatus).toHaveLength(1));
    expect(result.current.state.composerDraft).toEqual({ text: "어긋난 입력" });

    // 재동기화 응답이 오기 전에 다시 보낸다. 이번 명령은 서버에 붙잡혀 결과가 아직 없다.
    server.interactReply = { status: 500 };
    server.holdInteract = true;
    act(() => result.current.actions.submitMessage("다시 보낸 글"));
    await flushAsync();
    expect(result.current.state.phase).toBe("streaming");

    await releaseHeldStatus(server);

    const s = result.current.state;
    expect(s.phase).toBe("streaming");
    expect(s.pending).toBeNull();
    expect(s.messages.map((m) => m.text)).toEqual(["다시 보낸 글"]);

    // 새 명령이 실패하면 그 글을 입력창에 되돌린다. 스냅샷이 `unconfirmedSend` 를 지웠으면 되돌리지 못한다.
    for (const held of server.heldInteract.splice(0)) held.release();
    await waitFor(() => expect(result.current.state.commandFailed).toBe(true));
    expect(result.current.state.composerDraft).toEqual({ text: "다시 보낸 글" });
    expect(result.current.state.messages.some((m) => m.role === "user")).toBe(false);
    expect(result.current.state.pending).toMatchObject({ type: "ai_conversation", nodeId: "n1" });
  });

  it("replay_unavailable 재동기화 중 보낸 메시지를 늦게 온 스냅샷이 지우지 않는다", async () => {
    const { server, getEs, result } = await startAt(TEXT_SURFACE);
    server.statusSnapshot = "waiting";
    server.holdStatus = true;

    act(() => getEs()?.emit("execution.replay_unavailable", { executionId: "e1" }));
    await waitFor(() => expect(server.heldStatus).toHaveLength(1));

    act(() => result.current.actions.submitMessage("재동기화 중 보낸 글"));
    await flushAsync();
    expect(server.commands.at(-1)?.body).toMatchObject({ message: "재동기화 중 보낸 글" });

    await releaseHeldStatus(server);

    const s = result.current.state;
    expect(s.phase).toBe("streaming");
    expect(s.pending).toBeNull();
    expect(s.messages.map((m) => m.text)).toEqual(["재동기화 중 보낸 글"]);
    expect(s.unconfirmedSend).toMatchObject({ text: "재동기화 중 보낸 글" });
  });

  it("그 사이 명령을 보내지 않았으면 늦게 온 스냅샷으로 표면을 그린다(대조)", async () => {
    const { server, getEs, result } = await startAt(TEXT_SURFACE);
    server.statusSnapshot = "waiting";
    server.holdStatus = true;

    act(() => getEs()?.emit("execution.replay_unavailable", { executionId: "e1" }));
    await waitFor(() => expect(server.heldStatus).toHaveLength(1));
    await releaseHeldStatus(server);

    expect(result.current.state.pending?.nodeId).toBe("n-resync");
    expect(result.current.state.messages.map((m) => m.text)).toEqual([RESYNC_TEXT]);
  });

  it("그 사이 명령을 보냈어도 종료 스냅샷이면 종료로 확정한다", async () => {
    const { server, result, endedReasons } = await startAt(TEXT_SURFACE);
    server.interactReply = { status: 409, body: { error: { code: "STATE_MISMATCH" } } };
    server.statusSnapshot = "completed";
    server.holdStatus = true;

    act(() => result.current.actions.submitMessage("어긋난 입력"));
    await waitFor(() => expect(server.heldStatus).toHaveLength(1));
    server.interactReply = { status: 202 };
    act(() => result.current.actions.submitMessage("다시 보낸 글"));
    await flushAsync();

    await releaseHeldStatus(server);

    expect(result.current.state.phase).toBe("ended");
    expect(endedReasons).toHaveLength(1);
    expect(window.sessionStorage.getItem(STORAGE_KEY)).toBeNull();
  });
});

describe("useWidget — 명령 401 은 갱신을 한 번 시도한 뒤 판정한다(REQ-WCSESS-038~040)", () => {
  it("갱신 성공 → 토큰을 바꾸고 대화를 이어 간다 · 명령은 다시 보내지 않는다", async () => {
    const { server, result, endedReasons } = await startAt(TEXT_SURFACE);
    server.interactReply = { status: 401, body: { error: { code: "TOKEN_EXPIRED" } } };

    act(() => result.current.actions.submitMessage("안녕하세요"));
    await waitFor(() => expect(result.current.state.commandFailed).toBe(true));

    expect(server.refreshTokensSent).toEqual(["iext_1"]);
    expect(window.sessionStorage.getItem(STORAGE_KEY)).toContain("iext_2");
    expect(server.commands).toHaveLength(1);
    expect(result.current.state.phase).toBe("awaiting_user_message");
    expect(result.current.state.composerDraft).toEqual({ text: "안녕하세요" });
    expect(endedReasons).toEqual([]);
  });

  it.each<[string, RefreshReply]>([
    ["401", { status: 401 }],
    ["410", { status: 410 }],
  ])("갱신이 %s 로 거부되면 종료로 확정하고 위젯 세션을 지운다(REQ-WCSESS-039)", async (_, refresh) => {
    const { server, result, endedReasons } = await startAt(TEXT_SURFACE);
    server.interactReply = { status: 401, body: { error: { code: "TOKEN_REVOKED" } } };
    server.refreshReply = refresh;

    act(() => result.current.actions.submitMessage("안녕하세요"));
    await waitFor(() => expect(result.current.state.phase).toBe("ended"));

    expect(endedReasons).toEqual(["execution.token_revoked"]);
    expect(window.sessionStorage.getItem(STORAGE_KEY)).toBeNull();
    expect(result.current.state.commandFailed).toBeUndefined();
  });

  it.each<[string, RefreshReply]>([
    ["네트워크 에러", "network"],
    ["5xx", { status: 503 }],
  ])("갱신이 %s 로 실패하면 위젯 세션을 유지한다(REQ-WCSESS-040)", async (_, refresh) => {
    const { server, getEs, result, endedReasons } = await startAt(TEXT_SURFACE);
    server.interactReply = { status: 401, body: { error: { code: "TOKEN_EXPIRED" } } };
    server.refreshReply = refresh;

    act(() => result.current.actions.submitMessage("안녕하세요"));
    await waitFor(() => expect(result.current.state.commandFailed).toBe(true));

    expect(result.current.state.phase).toBe("awaiting_user_message");
    expect(window.sessionStorage.getItem(STORAGE_KEY)).toContain("iext_1");
    expect(getEs()?.closed).toBe(false);
    expect(endedReasons).toEqual([]);
  });

  it("명령이 뜬 사이 주기 갱신이 토큰을 회전시켰으면 refresh 를 다시 보내지 않고 대화를 이어 간다(REQ-WCSESS-036)", async () => {
    const { server, result, endedReasons } = await startAt(TEXT_SURFACE);
    server.holdInteract = true;

    act(() => result.current.actions.submitMessage("안녕하세요"));
    expect(server.commands.at(-1)?.token).toBe("iext_1");
    // 주기 갱신이 iext_1 을 회전시킨다 — 명령은 서버에서 폐기된 토큰으로 판정된다.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(ADVANCE_PAST_SCHEDULE_MS);
    });
    await waitFor(() => expect(window.sessionStorage.getItem(STORAGE_KEY)).toContain("iext_2"));
    server.interactReply = { status: 401, body: { error: { code: "TOKEN_REVOKED" } } };
    for (const held of server.heldInteract.splice(0)) held.release();
    await waitFor(() => expect(result.current.state.commandFailed).toBe(true));

    // 옛 토큰으로 refresh 를 다시 보내면 401 을 받아 살아 있는 대화를 끝낸다. 주기 갱신의 한 번뿐이어야 한다.
    expect(server.refreshTokensSent).toEqual(["iext_1"]);
    expect(result.current.state.phase).toBe("awaiting_user_message");
    expect(endedReasons).toEqual([]);
  });

  it("갱신을 기다리는 사이 새 대화로 바뀌면 옛 실패를 새 대화에 그리지 않는다(staleness)", async () => {
    const { server, result } = await startAt(TEXT_SURFACE);
    server.interactReply = { status: 401, body: { error: { code: "TOKEN_EXPIRED" } } };
    server.refreshReply = "network";
    server.holdRefresh = true;

    act(() => result.current.actions.submitMessage("옛 대화의 글"));
    await waitFor(() => expect(server.heldRefresh).toHaveLength(1));
    await act(async () => {
      await result.current.actions.newChat();
    });
    for (const held of server.heldRefresh.splice(0)) held.release();
    await flushAsync();
    await flushAsync();

    expect(result.current.state.commandFailed).toBeUndefined();
    expect(result.current.state.composerDraft).toBeUndefined();
    expect(result.current.state.phase).not.toBe("ended");
  });
});
