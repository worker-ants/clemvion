// EIA 클라이언트 — 위젯이 EIA 외부 표면(webhook + REST + SSE)을 호출. SoT: spec/5-system/14, 7-channel-web-chat/0-architecture §3.
// 브라우저 fetch + EventSource 사용. 테스트 위해 DI 가능.

import type { HookStartResponse, InteractCommand, InteractionEndpoints } from "./eia-types";

export interface EiaClientDeps {
  apiBase: string;
  fetchImpl?: typeof fetch;
  /** SSE 팩토리(테스트용). 기본 전역 EventSource. */
  eventSourceFactory?: (url: string) => EventSourceLike;
}

/** EventSource 의 최소 인터페이스(테스트 더블 허용). */
export interface EventSourceLike {
  addEventListener(type: string, listener: (ev: MessageEvent) => void): void;
  close(): void;
}

function joinUrl(base: string, path: string): string {
  if (/^https?:\/\//.test(path)) return path;
  return base.replace(/\/$/, "") + (path.startsWith("/") ? path : "/" + path);
}

export class EiaClient {
  private readonly apiBase: string;
  private readonly fetchImpl: typeof fetch;
  private readonly esFactory: (url: string) => EventSourceLike;

  constructor(deps: EiaClientDeps) {
    this.apiBase = deps.apiBase;
    this.fetchImpl = deps.fetchImpl ?? ((...a) => fetch(...a));
    this.esFactory =
      deps.eventSourceFactory ?? ((url) => new EventSource(url) as unknown as EventSourceLike);
  }

  /** 대화 시작 — POST /api/hooks/:endpointPath. auth 없음(공개). 202 + per_execution 토큰. */
  async startConversation(
    endpointPath: string,
    payload: { profile?: Record<string, unknown>; firstMessage?: string; [k: string]: unknown },
  ): Promise<HookStartResponse> {
    const res = await this.fetchImpl(joinUrl(this.apiBase, `/api/hooks/${endpointPath}`), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      throw new EiaError(`webhook 시작 실패(${res.status})`, res.status);
    }
    return (await res.json()) as HookStartResponse;
  }

  /** 인터랙션 명령 제출 — POST endpoints.submit. Bearer 토큰. */
  async interact(
    endpoints: InteractionEndpoints,
    token: string,
    command: InteractCommand,
  ): Promise<void> {
    const res = await this.fetchImpl(joinUrl(this.apiBase, endpoints.submit), {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
      body: JSON.stringify(command),
    });
    if (res.status === 410) throw new EiaError("대화 종료됨", 410);
    if (!res.ok) {
      const detail = await safeJson(res);
      throw new EiaError(`명령 실패(${res.status})`, res.status, detail);
    }
  }

  /** 단발 상태 조회 — GET endpoints.status. */
  async getStatus(endpoints: InteractionEndpoints, token: string): Promise<Record<string, unknown>> {
    const res = await this.fetchImpl(joinUrl(this.apiBase, endpoints.status), {
      headers: { authorization: `Bearer ${token}` },
    });
    if (res.status === 410) throw new EiaError("대화 종료됨", 410);
    if (!res.ok) throw new EiaError(`상태 조회 실패(${res.status})`, res.status);
    return (await res.json()) as Record<string, unknown>;
  }

  /** 토큰 갱신 — POST endpoints.refresh (만료 30분 이내). */
  async refreshToken(
    endpoints: InteractionEndpoints,
    token: string,
  ): Promise<{ token: string; expiresAt: string }> {
    const res = await this.fetchImpl(joinUrl(this.apiBase, endpoints.refresh), {
      method: "POST",
      headers: { authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new EiaError(`토큰 갱신 실패(${res.status})`, res.status);
    return (await res.json()) as { token: string; expiresAt: string };
  }

  /** SSE 스트림 — GET endpoints.stream?token=. EventSource 헤더 미지원 → 쿼리 토큰(EIA §8.3). */
  openStream(
    endpoints: InteractionEndpoints,
    token: string,
    handlers: {
      onEvent: (name: string, data: unknown) => void;
      onError?: (e: unknown) => void;
    },
    lastEventId?: string | number,
  ): EventSourceLike {
    const url = new URL(joinUrl(this.apiBase, endpoints.stream), this.apiBase || undefined);
    url.searchParams.set("token", token);
    if (lastEventId != null) url.searchParams.set("lastEventId", String(lastEventId));
    const es = this.esFactory(url.toString());
    const names = [
      "execution.started",
      "execution.waiting_for_input",
      "execution.ai_message",
      "execution.resumed",
      "execution.completed",
      "execution.failed",
      "execution.cancelled",
      "execution.replay_unavailable",
    ];
    for (const name of names) {
      es.addEventListener(name, (ev: MessageEvent) => {
        handlers.onEvent(name, parseData(ev.data));
      });
    }
    if (handlers.onError) {
      es.addEventListener("error", (e) => handlers.onError!(e));
    }
    return es;
  }
}

export class EiaError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
    public readonly detail?: unknown,
  ) {
    super(message);
    this.name = "EiaError";
  }
}

function parseData(data: unknown): unknown {
  if (typeof data !== "string") return data;
  try {
    return JSON.parse(data);
  } catch {
    return data;
  }
}

async function safeJson(res: Response): Promise<unknown> {
  try {
    return await res.json();
  } catch {
    return undefined;
  }
}
