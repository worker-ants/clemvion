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

/**
 * UUID 발급 — 환경 호환 layer.
 *
 * - Node 20+ : `globalThis.crypto.randomUUID()` (Web Crypto API, 표준)
 * - 모던 브라우저 : 동일 (HTTPS 컨텍스트 필수)
 * - Node 18 또는 미지원 브라우저 : node:crypto fallback (require 로 lazy 로드 — 번들러가 강제
 *   포함하지 않도록 동적 import). 둘 다 없으면 throw.
 *
 * `import { randomUUID } from 'crypto'` 를 top-level import 했더니 브라우저 번들에서 런타임 에러
 * 가 났던 [ai-review W4] 의 해소.
 */
function newUuid(): string {
  const wc = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
  if (wc && typeof wc.randomUUID === 'function') {
    return wc.randomUUID();
  }
  // Node 18 fallback — eval('require') 패턴은 webpack/esbuild 등이 정적 분석으로 잡아 번들 포함
  // 시키는 것을 피한다.
  try {
    const nodeCrypto = (eval('require') as NodeRequire)('crypto') as {
      randomUUID?: () => string;
    };
    if (typeof nodeCrypto.randomUUID === 'function') return nodeCrypto.randomUUID();
  } catch {
    // 브라우저 등 require 미지원 환경
  }
  throw new Error(
    '@workflow/sdk: UUID 발급 불가 — globalThis.crypto.randomUUID 또는 node:crypto 가 필요합니다 (HTTPS / Node 18+).',
  );
}

export interface ClemvionClientOptions {
  /** API base URL, 예: `https://api.clemvion.ai`. trailing slash 없이 권장. */
  baseUrl: string;
  /** Webhook trigger 호출용 default headers (예: Authorization Bearer 등). */
  webhookHeaders?: Record<string, string>;
  /** fetch override — 환경 호환 (Node 20+ global fetch, browser fetch, 또는 mock). */
  fetchImpl?: typeof fetch;
  /**
   * `false` 면 `baseUrl` 의 protocol 이 `https:` 가 아닐 때 throw — SSRF 방어 [ai-review W15].
   * default `true` (검증 OFF) 는 dev/test 호환. production 통합에서는 명시 `false` 권장.
   */
  allowInsecureBaseUrl?: boolean;
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
  /** SSE `event:` line. 예: `execution.completed`, `execution.ai_message`. */
  event: string;
  /** SSE `id:` line. backend WebsocketService 의 monotonic seq. */
  seq: number;
  /**
   * SSE `data:` line 들을 합친 후 `JSON.parse` 한 결과. 이벤트 타입별 페이로드는
   * [Spec WS §4.1·§4.4] / [Spec EIA §6.2~§6.5]. 호출자는 `event` 로 discriminate.
   */
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
    // [ai-review W15] baseUrl 형식 + scheme 검증 — SSRF 방어.
    let parsed: URL;
    try {
      parsed = new URL(opts.baseUrl);
    } catch {
      throw new Error(
        `@workflow/sdk: baseUrl 이 유효한 URL 이 아닙니다: ${opts.baseUrl}`,
      );
    }
    const allowInsecure = opts.allowInsecureBaseUrl ?? true;
    if (!allowInsecure && parsed.protocol !== 'https:') {
      throw new Error(
        `@workflow/sdk: baseUrl 의 protocol 은 https: 이어야 합니다 (allowInsecureBaseUrl=true 로 우회 가능): ${parsed.protocol}`,
      );
    }
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
    return unwrapData<TriggerWebhookResult>(await res.json());
  }

  /**
   * 인터랙션 명령 제출. [Spec EIA §5.1].
   *
   * `Idempotency-Key` 헤더는 `init.idempotencyKey` 미명시 시 UUID v4 자동 발급. 호출자가 재시도
   * 시 동일 key 를 보내려면 `idempotencyKey` 를 명시해야 한다 — 자동 발급은 매번 새 UUID 라
   * 재시도 멱등성을 보장하지 않는다 [ai-review W34].
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
        'Idempotency-Key': init.idempotencyKey ?? newUuid(),
      }),
      body: JSON.stringify(request),
    });
    return this.parseJsonOrThrow<InteractAck>(res, 'INTERACT_FAILED');
  }

  /**
   * 명시적 cancel. `interact({ command: 'cancel' })` 와 동일한 backend 효과이지만 별도 endpoint
   * (`POST /api/external/executions/:id/cancel`) 를 사용한다 [Spec EIA §5.4]. 멱등성을 위해
   * `init.idempotencyKey` 미명시 시 UUID v4 자동 발급 — `interact` 와 일관 [ai-review W3].
   */
  async cancel(
    executionId: string,
    token: string,
    reason?: string,
    init: { idempotencyKey?: string } = {},
  ): Promise<InteractAck> {
    const url = `${this.baseUrl}/api/external/executions/${encodeURIComponent(executionId)}/cancel`;
    const res = await this.fetchImpl(url, {
      method: 'POST',
      headers: this.buildHeaders(token, {
        'Idempotency-Key': init.idempotencyKey ?? newUuid(),
      }),
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
   * SSE 이벤트 스트림 구독. fetch + ReadableStream 으로 직접 파싱 (EventSource 대신 — Bearer 헤더
   * 사용 가능). 다만 EventSource 호환을 위해 token 도 query `?token=` 으로 fallback 노출.
   *
   * [Spec EIA §5.2]. **v1 자동 재연결 미지원** — 호출자가 `onError` 안에서 `lastSeq()` 를 읽어
   * 재호출해야 한다. 예시는 README 의 "Reconnect" 절 참고.
   *
   * 종료 정책:
   * - terminal event (`execution.completed/failed/cancelled`) 후 backend 가 stream 을 자동 종료 →
   *   handlers.onEvent 가 마지막 호출 후 onError 없이 자연 종료.
   * - 클라이언트가 `close()` 호출 시 AbortController 로 fetch abort + reader 정리.
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

    const onError = (err: unknown): void => {
      if (controller.signal.aborted) return;
      try {
        handlers.onError?.(err instanceof Error ? err : new Error(String(err)));
      } catch {
        // onError 핸들러 자체가 throw 한 경우 swallow — unhandled rejection 방지.
      }
    };

    void runSseLoop(
      this.fetchImpl,
      url,
      controller.signal,
      token,
      handlers.onEvent,
      onError,
      lastSeqRef,
    );

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
    return unwrapData<T>(await res.json());
  }
}

/**
 * SSE stream 본체 — `subscribeToExecution` 의 책임 분리 [ai-review W9].
 *
 * fetch → ReadableStream reader 루프 → frame split → parse → onEvent. 종료/에러 시 reader 정리.
 */
async function runSseLoop(
  fetchImpl: typeof fetch,
  url: string,
  signal: AbortSignal,
  token: string,
  onEvent: SseEventHandler,
  onError: (err: unknown) => void,
  lastSeqRef: { value: number },
): Promise<void> {
  let reader: ReadableStreamDefaultReader<Uint8Array> | null = null;
  try {
    const res = await fetchImpl(url, {
      method: 'GET',
      headers: {
        Accept: 'text/event-stream',
        // EventSource 환경에서는 ?token=, fetch 환경에서는 Authorization 도 동봉 [ai-review W7].
        Authorization: `Bearer ${token}`,
      },
      signal,
    });
    if (!res.ok || !res.body) {
      throw new ClemvionApiError(
        res.status,
        await safeText(res),
        'SSE_CONNECT_FAILED',
      );
    }
    reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buf = '';
    const MAX_BUF = 1024 * 1024; // 1MB — `\n\n` 없는 비정상 청크 폭주 차단 [ai-review INFO 4]
    let done = false;
    while (!done) {
      const next = await reader.read();
      done = next.done;
      if (next.value) buf += decoder.decode(next.value, { stream: true });
      if (buf.length > MAX_BUF) {
        throw new ClemvionApiError(
          0,
          'SSE buffer overflow (1MB without frame terminator)',
          'SSE_BUFFER_OVERFLOW',
        );
      }
      let idx: number;
      while ((idx = buf.indexOf('\n\n')) !== -1) {
        const frame = buf.slice(0, idx);
        buf = buf.slice(idx + 2);
        const parsed = parseSseFrame(frame);
        if (!parsed) continue;
        lastSeqRef.value = parsed.seq;
        try {
          onEvent(parsed);
        } catch (handlerErr) {
          // onEvent 가 throw → onError 로 우회. 단 reader 루프는 계속 (서버가 abort 결정).
          onError(handlerErr);
        }
      }
    }
  } catch (err) {
    onError(err);
  } finally {
    // [ai-review W17] reader cancel — abort/done 후 ReadableStream lock 해제 보장.
    if (reader) {
      try {
        await reader.cancel();
      } catch {
        // 이미 종료된 stream cancel 은 무시
      }
    }
  }
}

/**
 * `event:`/`id:`/`data:` 줄 single frame 파싱. comment-only (`: heartbeat`) frame 은 null.
 *
 * 다중 `data:` 라인은 newline 으로 join (SSE 표준 — `event-stream` MIME 의 multi-line data
 * concatenation) [ai-review W1].
 */
function parseSseFrame(frame: string): SseEvent | null {
  let event = '';
  let id = '';
  const dataLines: string[] = [];
  for (const line of frame.split('\n')) {
    if (line.startsWith(':')) continue; // comment
    if (line.startsWith('event:')) event = line.slice(6).trim();
    else if (line.startsWith('id:')) id = line.slice(3).trim();
    else if (line.startsWith('data:')) {
      // SSE 표준: 각 data: 라인의 prefix 단일 공백만 strip (전체 trim 아님 — JSON 의 leading
      // whitespace 가 의미 있을 수 있음). 그러나 본 SDK 는 backend 가 trim 된 줄을 보낸다는 사실을
      // 알고 있어 trim() 으로 단순화 — JSON 직렬화의 leading whitespace 는 안전.
      let value = line.slice(5);
      if (value.startsWith(' ')) value = value.slice(1);
      dataLines.push(value);
    }
  }
  if (!event && !id && dataLines.length === 0) return null;
  const seq = Number(id);
  if (!Number.isFinite(seq)) return null;
  const data = dataLines.join('\n');
  try {
    return {
      event,
      seq,
      data: JSON.parse(data || '{}') as Record<string, unknown>,
    };
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
 * Backend 의 `{ data: T }` 래퍼 / 직접 T 응답 둘 다 수용 [ai-review W11]. 중복 로직 제거.
 *
 * 안전성: `parsed.data` 가 `undefined` 인 경우 (=backend 가 직접 T 를 반환한 경우) 전체 parsed 를
 * T 로 캐스팅. 호출자가 필수 필드를 사용할 때 undefined 면 명시적 throw 가 발생하도록 두는 것이
 * 본 SDK 의 정책 — 응답 schema 검증은 호출자 책임.
 */
function unwrapData<T>(parsed: unknown): T {
  if (
    parsed !== null &&
    typeof parsed === 'object' &&
    'data' in (parsed as object) &&
    (parsed as { data: unknown }).data !== undefined
  ) {
    return (parsed as { data: T }).data;
  }
  return parsed as T;
}

/**
 * API 호출 실패 시 throw. status / body / code 노출.
 *
 * `body` 는 응답의 raw text — 잠재적으로 민감 정보를 포함할 수 있으므로 외부 로깅 시 redact 권장
 * [ai-review INFO 2].
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
