import { randomUUID } from 'crypto';

/**
 * Clemvion External Interaction API SDK 의 주요 client.
 *
 * 사용 흐름:
 *   const client = new ClemvionClient({ baseUrl: 'https://api.clemvion.ai' });
 *   const { executionId, interaction } = await client.triggerWebhook(endpointPath, body);
 *   const sub = client.subscribeToExecution(executionId, interaction!.token, {
 *     onEvent: (e) => console.log(e),
 *     onError: (e) => console.error(e),
 *   });
 *   await client.interact(executionId, interaction!.token, {
 *     command: 'submit_form',
 *     nodeId: '...',
 *     data: { ... },
 *   });
 *
 * [Spec EIA §4 / §5].
 */

export interface ClemvionClientOptions {
  /** API base URL, 예: `https://api.clemvion.ai`. trailing slash 없이 권장. */
  baseUrl: string;
  /** Webhook trigger 호출용 default headers (예: Authorization Bearer 등). */
  webhookHeaders?: Record<string, string>;
  /** fetch override — 환경 호환 (Node 20+ global fetch, browser fetch, 또는 mock). */
  fetchImpl?: typeof fetch;
}

export type InteractCommand =
  | 'submit_form'
  | 'click_button'
  | 'submit_message'
  | 'end_conversation'
  | 'cancel';

export interface InteractRequest {
  command: InteractCommand;
  nodeId?: string;
  data?: Record<string, unknown>;
  buttonId?: string;
  message?: string;
  reason?: string;
}

export interface InteractAck {
  executionId: string;
  accepted: boolean;
  currentStatus?:
    | 'pending'
    | 'running'
    | 'waiting_for_input'
    | 'completed'
    | 'failed'
    | 'cancelled';
}

export interface TriggerWebhookResult {
  executionId: string;
  status?: 'pending';
  interaction?: {
    token?: string;
    expiresAt?: string;
    endpoints: {
      stream: string;
      submit: string;
      status: string;
      cancel: string;
      refresh: string;
    };
  };
}

export interface ExecutionStatus {
  id: string;
  workflowId: string;
  status:
    | 'pending'
    | 'running'
    | 'waiting_for_input'
    | 'completed'
    | 'failed'
    | 'cancelled';
  currentNode?: {
    id: string;
    type: string;
    interactionType: 'form' | 'buttons' | 'ai_conversation' | null;
  } | null;
  context?: Record<string, unknown> | null;
  result?: Record<string, unknown> | null;
  error?: Record<string, unknown> | null;
  seq: number;
  updatedAt: string;
}

export interface RefreshTokenResult {
  token: string;
  expiresAt: string;
}

/** SSE 이벤트. `id` 가 `seq` 와 동일. */
export interface SseEvent {
  event: string;
  seq: number;
  data: Record<string, unknown>;
}

export type SseEventHandler = (event: SseEvent) => void;

export interface SseSubscription {
  /** 연결 종료. cleanup 호출자 책임. */
  close: () => void;
  /** 현재까지 수신한 마지막 seq. 재연결 시 Last-Event-Id 로 전달 가능. */
  readonly lastSeq: () => number;
}

/**
 * Clemvion External Interaction API 의 facade client.
 */
export class ClemvionClient {
  private readonly baseUrl: string;
  private readonly webhookHeaders: Record<string, string>;
  private readonly fetchImpl: typeof fetch;

  constructor(opts: ClemvionClientOptions) {
    this.baseUrl = opts.baseUrl.replace(/\/$/, '');
    this.webhookHeaders = opts.webhookHeaders ?? {};
    this.fetchImpl = opts.fetchImpl ?? globalThis.fetch;
    if (typeof this.fetchImpl !== 'function') {
      throw new Error(
        '@workflow/sdk: global fetch 미지원 — Node 20+ 또는 fetchImpl 옵션을 전달하세요.',
      );
    }
  }

  /**
   * Webhook 트리거를 호출해 워크플로우를 시작한다. trigger 의 interaction.enabled=true 면 응답에
   * interaction.token / endpoints 가 동봉되므로 그 token 으로 후속 interact / SSE 호출.
   */
  async triggerWebhook(
    endpointPath: string,
    body: unknown,
    init: { headers?: Record<string, string> } = {},
  ): Promise<TriggerWebhookResult> {
    const url = `${this.baseUrl}/api/hooks/${encodeURIComponent(endpointPath)}`;
    const res = await this.fetchImpl(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...this.webhookHeaders,
        ...(init.headers ?? {}),
      },
      body: JSON.stringify(body ?? {}),
    });
    if (!res.ok) {
      const text = await safeText(res);
      throw new ClemvionApiError(res.status, text, 'WEBHOOK_TRIGGER_FAILED');
    }
    const parsed = (await res.json()) as { data?: TriggerWebhookResult };
    // backend 가 { data: ... } 래퍼 사용. 호환을 위해 두 가지 모두 수용.
    return (parsed.data ?? (parsed as unknown as TriggerWebhookResult));
  }

  /**
   * 인터랙션 명령 제출. [Spec EIA §5.1].
   */
  async interact(
    executionId: string,
    token: string,
    request: InteractRequest,
    init: { idempotencyKey?: string } = {},
  ): Promise<InteractAck> {
    const url = `${this.baseUrl}/api/external/executions/${encodeURIComponent(executionId)}/interact`;
    const res = await this.fetchImpl(url, {
      method: 'POST',
      headers: this.buildHeaders(token, {
        'Idempotency-Key': init.idempotencyKey ?? randomUUID(),
      }),
      body: JSON.stringify(request),
    });
    return this.parseJsonOrThrow<InteractAck>(res, 'INTERACT_FAILED');
  }

  /**
   * 명시적 cancel (interact 의 alias). [Spec EIA §5.4].
   */
  async cancel(
    executionId: string,
    token: string,
    reason?: string,
  ): Promise<InteractAck> {
    const url = `${this.baseUrl}/api/external/executions/${encodeURIComponent(executionId)}/cancel`;
    const res = await this.fetchImpl(url, {
      method: 'POST',
      headers: this.buildHeaders(token),
      body: JSON.stringify({ reason }),
    });
    return this.parseJsonOrThrow<InteractAck>(res, 'CANCEL_FAILED');
  }

  /**
   * iext 토큰 갱신 (만료 30분 이내일 때만 valid). [Spec EIA §5.5].
   */
  async refreshToken(
    executionId: string,
    token: string,
  ): Promise<RefreshTokenResult> {
    const url = `${this.baseUrl}/api/external/executions/${encodeURIComponent(executionId)}/refresh-token`;
    const res = await this.fetchImpl(url, {
      method: 'POST',
      headers: this.buildHeaders(token),
    });
    return this.parseJsonOrThrow<RefreshTokenResult>(
      res,
      'TOKEN_REFRESH_FAILED',
    );
  }

  /**
   * 단발 상태 조회. [Spec EIA §5.3].
   */
  async getStatus(
    executionId: string,
    token: string,
  ): Promise<ExecutionStatus> {
    const url = `${this.baseUrl}/api/external/executions/${encodeURIComponent(executionId)}`;
    const res = await this.fetchImpl(url, {
      method: 'GET',
      headers: this.buildHeaders(token),
    });
    return this.parseJsonOrThrow<ExecutionStatus>(res, 'STATUS_FETCH_FAILED');
  }

  /**
   * SSE 이벤트 스트림 구독. EventSource 가 가능한 환경 (브라우저) 이면 그것을 사용. Node 환경은
   * fetch + ReadableStream 으로 직접 파싱.
   *
   * [Spec EIA §5.2]. Last-Event-Id 자동 재연결은 v1 에서 미지원 — 호출자가 lastSeq 를 보고 직접
   * 재연결 시 onError 의 throw 후 재호출 권장.
   */
  subscribeToExecution(
    executionId: string,
    token: string,
    handlers: {
      onEvent: SseEventHandler;
      onError?: (err: Error) => void;
      lastEventId?: number;
    },
  ): SseSubscription {
    const lastSeqRef = { value: handlers.lastEventId ?? 0 };
    const controller = new AbortController();
    const qs = handlers.lastEventId
      ? `?token=${encodeURIComponent(token)}&lastEventId=${handlers.lastEventId}`
      : `?token=${encodeURIComponent(token)}`;
    const url = `${this.baseUrl}/api/external/executions/${encodeURIComponent(executionId)}/stream${qs}`;
    void (async () => {
      try {
        const res = await this.fetchImpl(url, {
          method: 'GET',
          headers: { Accept: 'text/event-stream' },
          signal: controller.signal,
        });
        if (!res.ok || !res.body) {
          throw new ClemvionApiError(
            res.status,
            await safeText(res),
            'SSE_CONNECT_FAILED',
          );
        }
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buf = '';
        // eslint-disable-next-line no-constant-condition
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          buf += decoder.decode(value, { stream: true });
          // SSE frames split by \n\n
          let idx: number;
          while ((idx = buf.indexOf('\n\n')) !== -1) {
            const frame = buf.slice(0, idx);
            buf = buf.slice(idx + 2);
            const parsed = parseSseFrame(frame);
            if (!parsed) continue;
            lastSeqRef.value = parsed.seq;
            try {
              handlers.onEvent(parsed);
            } catch (err) {
              handlers.onError?.(
                err instanceof Error ? err : new Error(String(err)),
              );
            }
          }
        }
      } catch (err) {
        if (controller.signal.aborted) return;
        handlers.onError?.(
          err instanceof Error ? err : new Error(String(err)),
        );
      }
    })();
    return {
      close: () => controller.abort(),
      lastSeq: () => lastSeqRef.value,
    };
  }

  private buildHeaders(
    token: string,
    extra: Record<string, string> = {},
  ): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...extra,
    };
  }

  private async parseJsonOrThrow<T>(
    res: Response,
    fallbackCode: string,
  ): Promise<T> {
    if (!res.ok) {
      const text = await safeText(res);
      throw new ClemvionApiError(res.status, text, fallbackCode);
    }
    const parsed = (await res.json()) as { data?: T };
    return (parsed.data ?? (parsed as unknown as T));
  }
}

/**
 * `event:`/`id:`/`data:` 3 줄짜리 SSE frame 을 파싱. comment-only (`: heartbeat`) frame 은 null.
 */
function parseSseFrame(frame: string): SseEvent | null {
  let event = '';
  let id = '';
  let data = '';
  for (const line of frame.split('\n')) {
    if (line.startsWith(':')) continue; // comment
    if (line.startsWith('event:')) event = line.slice(6).trim();
    else if (line.startsWith('id:')) id = line.slice(3).trim();
    else if (line.startsWith('data:')) data += line.slice(5).trim();
  }
  if (!event && !id && !data) return null;
  const seq = Number(id);
  if (!Number.isFinite(seq)) return null;
  try {
    return { event, seq, data: JSON.parse(data || '{}') as Record<string, unknown> };
  } catch {
    return null;
  }
}

async function safeText(res: Response): Promise<string> {
  try {
    return await res.text();
  } catch {
    return '';
  }
}

/**
 * API 호출 실패 시 throw. status / body / suggestedCode 노출.
 */
export class ClemvionApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly body: string,
    public readonly code: string,
  ) {
    super(`Clemvion API error ${status} (${code})`);
    this.name = 'ClemvionApiError';
  }
}
