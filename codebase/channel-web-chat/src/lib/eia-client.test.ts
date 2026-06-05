import { describe, it, expect, vi } from "vitest";
import { EiaClient, EiaError, type EventSourceLike } from "./eia-client";
import type { InteractionEndpoints } from "./eia-types";

const endpoints: InteractionEndpoints = {
  stream: "/api/external/executions/e1/stream",
  submit: "/api/external/executions/e1/interact",
  status: "/api/external/executions/e1",
  cancel: "/api/external/executions/e1/cancel",
  refresh: "/api/external/executions/e1/refresh-token",
};

function jsonResponse(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response;
}

describe("startConversation", () => {
  it("전역 TransformInterceptor `{ data }` 봉투를 언랩해 반환 + 올바른 URL/메서드", async () => {
    // 실제 백엔드 응답은 전역 TransformInterceptor 로 `{ data: {...} }` 래핑됨 (webhook §3.1 SoT).
    const fetchImpl = vi.fn().mockResolvedValue(
      jsonResponse(202, {
        data: {
          executionId: "e1",
          status: "pending",
          interaction: { token: "iext_x", expiresAt: "2026-01-01", endpoints },
        },
      }),
    );
    const client = new EiaClient({ apiBase: "https://api.test", fetchImpl });
    const res = await client.startConversation("path-1", { firstMessage: "hi", profile: { a: 1 } });
    expect(res.executionId).toBe("e1");
    expect(res.interaction?.token).toBe("iext_x");
    expect(res.interaction?.endpoints.stream).toBe(endpoints.stream);
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe("https://api.test/api/hooks/path-1");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body)).toMatchObject({ firstMessage: "hi" });
  });

  it("봉투 없는 응답도 그대로 수용 (하위 호환·방어)", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      jsonResponse(202, {
        executionId: "e1",
        interaction: { token: "iext_x", expiresAt: "2026-01-01", endpoints },
      }),
    );
    const client = new EiaClient({ apiBase: "https://api.test", fetchImpl });
    const res = await client.startConversation("path-1", {});
    expect(res.executionId).toBe("e1");
    expect(res.interaction?.token).toBe("iext_x");
  });

  it("비-2xx → EiaError(status)", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(429, {}));
    const client = new EiaClient({ apiBase: "https://api.test", fetchImpl });
    await expect(client.startConversation("p", {})).rejects.toMatchObject({ status: 429 });
  });
});

describe("interact", () => {
  it("Bearer 토큰으로 명령 제출", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(202, { accepted: true }));
    const client = new EiaClient({ apiBase: "https://api.test", fetchImpl });
    await client.interact(endpoints, "iext_x", { command: "submit_message", message: "안녕" });
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe("https://api.test/api/external/executions/e1/interact");
    expect(init.headers.authorization).toBe("Bearer iext_x");
    expect(JSON.parse(init.body)).toMatchObject({ command: "submit_message", message: "안녕" });
  });

  it("410 → 종료 에러", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(410, {}));
    const client = new EiaClient({ apiBase: "https://api.test", fetchImpl });
    await expect(
      client.interact(endpoints, "t", { command: "end_conversation" }),
    ).rejects.toMatchObject({ status: 410 });
  });
});

describe("openStream", () => {
  it("토큰 쿼리 + 이벤트 파싱", () => {
    const listeners: Record<string, (e: MessageEvent) => void> = {};
    let createdUrl = "";
    const es: EventSourceLike = {
      addEventListener: (t, l) => {
        listeners[t] = l;
      },
      close: () => {},
    };
    const client = new EiaClient({
      apiBase: "https://api.test",
      eventSourceFactory: (url) => {
        createdUrl = url;
        return es;
      },
    });
    const onEvent = vi.fn();
    client.openStream(endpoints, "iext_x", { onEvent });
    expect(createdUrl).toContain("/api/external/executions/e1/stream");
    expect(createdUrl).toContain("token=iext_x");

    listeners["execution.ai_message"]?.({ data: JSON.stringify({ text: "응답" }) } as MessageEvent);
    expect(onEvent).toHaveBeenCalledWith("execution.ai_message", { text: "응답" });
  });

  it("error 이벤트를 onError 로 전달(SSE/CORS 실패 가시화 seam)", () => {
    const listeners: Record<string, (e: MessageEvent) => void> = {};
    const es: EventSourceLike = {
      addEventListener: (t, l) => {
        listeners[t] = l;
      },
      close: () => {},
    };
    const client = new EiaClient({
      apiBase: "https://api.test",
      eventSourceFactory: () => es,
    });
    const onError = vi.fn();
    client.openStream(endpoints, "iext_x", { onEvent: vi.fn(), onError });
    const errEvent = { type: "error" } as unknown as MessageEvent;
    listeners["error"]?.(errEvent);
    expect(onError).toHaveBeenCalledWith(errEvent);
  });
});

describe("getStatus", () => {
  it("`{ data }` 봉투를 언랩해 상태 객체 반환", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(jsonResponse(200, { data: { status: "running", seq: 3 } }));
    const client = new EiaClient({ apiBase: "https://api.test", fetchImpl });
    const r = await client.getStatus(endpoints, "iext_x");
    expect(r.status).toBe("running");
    expect(r.seq).toBe(3);
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe("https://api.test/api/external/executions/e1");
    expect(init.headers.authorization).toBe("Bearer iext_x");
  });

  it("410 → 종료 에러", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(410, {}));
    const client = new EiaClient({ apiBase: "https://api.test", fetchImpl });
    await expect(client.getStatus(endpoints, "t")).rejects.toMatchObject({ status: 410 });
  });
});

describe("refreshToken", () => {
  it("`{ data }` 봉투를 언랩해 새 토큰 반환", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(jsonResponse(200, { data: { token: "iext_new", expiresAt: "2026" } }));
    const client = new EiaClient({ apiBase: "https://api.test", fetchImpl });
    const r = await client.refreshToken(endpoints, "old");
    expect(r.token).toBe("iext_new");
    expect(r.expiresAt).toBe("2026");
  });
});

describe("EiaError", () => {
  it("status/detail 보존", () => {
    const e = new EiaError("x", 400, { fieldErrors: [] });
    expect(e.status).toBe(400);
    expect(e.detail).toEqual({ fieldErrors: [] });
  });
});
