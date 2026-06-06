// EIA 클라이언트 — 위젯이 EIA 외부 표면(webhook + REST + SSE)을 호출. SoT: spec/5-system/14, 7-channel-web-chat/0-architecture §3.
// 브라우저 fetch + EventSource 사용. 테스트 위해 DI 가능.

import type { ExecutionStatus, HookStartResponse, InteractCommand, InteractionEndpoints } from "./eia-types";

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

/**
 * 전역 `TransformInterceptor` 의 `{ data: ... }` 봉투 해제.
 * 백엔드 성공 응답은 모두 `{ data }` 로 래핑된다 (SoT: webhook §3.1 / api-convention §5).
 * 봉투가 없으면(`data` 키 부재) body 를 그대로 반환 — 하위 호환·테스트 안전.
 * 에러 응답은 `{ error }`/`{ statusCode }` shape 이라 이 경로를 타지 않는다(success-path 전용).
 * @internal — unit-test seam only. Do not use in application code.
 * (`@workflow/sdk` 의 동명 private 헬퍼와 구분하기 위해 `unwrapEnvelope` 로 명명 — naming-collision W2.)
 */
export function unwrapEnvelope<T>(body: unknown): T {
  if (body !== null && typeof body === "object" && "data" in body) {
    return (body as { data: T }).data;
  }
  return body as T;
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

  /**
   * 대화 시작 — POST /api/hooks/:endpointPath. auth 없음(공개). 202 + per_execution 토큰.
   * 응답은 전역 TransformInterceptor 봉투(`{ data }`)를 언랩한 `HookStartResponse` 반환.
   */
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
    return unwrapEnvelope<HookStartResponse>(await res.json());
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

  /**
   * 단발 상태 조회 — GET endpoints.status. Bearer 토큰.
   * 응답은 전역 TransformInterceptor 봉투(`{ data }`)를 언랩한 상태 객체 반환
   * (status, seq, ... — EIA §5.3).
   */
  async getStatus(endpoints: InteractionEndpoints, token: string): Promise<ExecutionStatus> {
    const res = await this.fetchImpl(joinUrl(this.apiBase, endpoints.status), {
      headers: { authorization: `Bearer ${token}` },
    });
    if (res.status === 410) throw new EiaError("대화 종료됨", 410);
    if (!res.ok) throw new EiaError(`상태 조회 실패(${res.status})`, res.status);
    return unwrapEnvelope<ExecutionStatus>(await res.json());
  }

  /**
   * 토큰 갱신 — POST endpoints.refresh (만료 30분 이내).
   * 응답 봉투(`{ data }`) 언랩 후 `{ token, expiresAt }` 반환 (EIA §5.5).
   */
  async refreshToken(
    endpoints: InteractionEndpoints,
    token: string,
  ): Promise<{ token: string; expiresAt: string }> {
    const res = await this.fetchImpl(joinUrl(this.apiBase, endpoints.refresh), {
      method: "POST",
      headers: { authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new EiaError(`토큰 갱신 실패(${res.status})`, res.status);
    return unwrapEnvelope<{ token: string; expiresAt: string }>(await res.json());
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
