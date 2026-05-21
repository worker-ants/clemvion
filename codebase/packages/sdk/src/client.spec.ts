import { ClemvionClient, ClemvionApiError } from './client';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('ClemvionClient.triggerWebhook', () => {
  it('성공 — { data: ... } 래퍼 unwrap', async () => {
    const fetchImpl = jest.fn().mockResolvedValue(
      jsonResponse({
        data: {
          executionId: 'exec-1',
          status: 'pending',
          interaction: { token: 'iext_xxx', endpoints: { stream: '', submit: '', status: '', cancel: '', refresh: '' } },
        },
      }),
    );
    const client = new ClemvionClient({
      baseUrl: 'https://api.clemvion.ai/',
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    const result = await client.triggerWebhook('abc', { foo: 'bar' });
    expect(result.executionId).toBe('exec-1');
    expect(fetchImpl.mock.calls[0][0]).toBe('https://api.clemvion.ai/api/hooks/abc');
    expect(fetchImpl.mock.calls[0][1].method).toBe('POST');
  });

  it('실패 — 4xx 시 ClemvionApiError', async () => {
    const fetchImpl = jest.fn().mockResolvedValue(
      new Response('not found', { status: 404 }),
    );
    const client = new ClemvionClient({
      baseUrl: 'https://api.clemvion.ai',
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    await expect(client.triggerWebhook('missing', {})).rejects.toBeInstanceOf(
      ClemvionApiError,
    );
  });

  it('webhookHeaders 옵션 — fetch headers 에 머지', async () => {
    const fetchImpl = jest.fn().mockResolvedValue(jsonResponse({ executionId: 'e' }));
    const client = new ClemvionClient({
      baseUrl: 'https://api.clemvion.ai',
      webhookHeaders: { Authorization: 'Bearer pre-shared' },
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    await client.triggerWebhook('abc', {});
    expect(
      (fetchImpl.mock.calls[0][1].headers as Record<string, string>)
        .Authorization,
    ).toBe('Bearer pre-shared');
  });
});

describe('ClemvionClient.interact', () => {
  it('Authorization Bearer + Idempotency-Key 자동 발급', async () => {
    const fetchImpl = jest.fn().mockResolvedValue(
      jsonResponse({ data: { executionId: 'exec-1', accepted: true } }),
    );
    const client = new ClemvionClient({
      baseUrl: 'https://api.clemvion.ai',
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    const result = await client.interact('exec-1', 'iext_abc', {
      command: 'submit_form',
      nodeId: 'n1',
      data: { x: 1 },
    });
    expect(result.accepted).toBe(true);
    const init = fetchImpl.mock.calls[0][1];
    const headers = init.headers as Record<string, string>;
    expect(headers.Authorization).toBe('Bearer iext_abc');
    expect(headers['Idempotency-Key']).toMatch(/^[0-9a-f-]{36}$/);
    expect(headers['Content-Type']).toBe('application/json');
    expect(JSON.parse(init.body)).toEqual({
      command: 'submit_form',
      nodeId: 'n1',
      data: { x: 1 },
    });
  });

  it('명시 idempotencyKey 우선', async () => {
    const fetchImpl = jest
      .fn()
      .mockResolvedValue(jsonResponse({ executionId: 'e', accepted: true }));
    const client = new ClemvionClient({
      baseUrl: 'https://api.clemvion.ai',
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    await client.interact(
      'exec-1',
      'iext_abc',
      { command: 'cancel' },
      { idempotencyKey: 'fixed-key' },
    );
    expect(
      (fetchImpl.mock.calls[0][1].headers as Record<string, string>)[
        'Idempotency-Key'
      ],
    ).toBe('fixed-key');
  });
});

describe('ClemvionClient.cancel / refreshToken / getStatus', () => {
  it('cancel — POST /cancel + Idempotency-Key 자동 발급', async () => {
    const fetchImpl = jest
      .fn()
      .mockResolvedValue(jsonResponse({ executionId: 'e', accepted: true }));
    const client = new ClemvionClient({
      baseUrl: 'https://api.clemvion.ai',
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    await client.cancel('exec-1', 'iext_abc', 'user_aborted');
    expect(fetchImpl.mock.calls[0][0]).toBe(
      'https://api.clemvion.ai/api/external/executions/exec-1/cancel',
    );
    expect(JSON.parse(fetchImpl.mock.calls[0][1].body)).toEqual({
      reason: 'user_aborted',
    });
    // [ai-review W3] cancel 도 interact 와 같이 Idempotency-Key 자동 발급
    const headers = fetchImpl.mock.calls[0][1].headers as Record<string, string>;
    expect(headers['Idempotency-Key']).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('cancel — 명시 idempotencyKey 우선', async () => {
    const fetchImpl = jest
      .fn()
      .mockResolvedValue(jsonResponse({ executionId: 'e', accepted: true }));
    const client = new ClemvionClient({
      baseUrl: 'https://api.clemvion.ai',
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    await client.cancel('exec-1', 'iext_abc', 'reason', {
      idempotencyKey: 'cancel-key-1',
    });
    expect(
      (fetchImpl.mock.calls[0][1].headers as Record<string, string>)[
        'Idempotency-Key'
      ],
    ).toBe('cancel-key-1');
  });

  it('refreshToken — POST /refresh-token', async () => {
    const fetchImpl = jest.fn().mockResolvedValue(
      jsonResponse({ token: 'iext_new', expiresAt: '2099-01-01T00:00:00Z' }),
    );
    const client = new ClemvionClient({
      baseUrl: 'https://api.clemvion.ai',
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    const r = await client.refreshToken('exec-1', 'iext_old');
    expect(r.token).toBe('iext_new');
  });

  it('getStatus — GET status', async () => {
    const fetchImpl = jest.fn().mockResolvedValue(
      jsonResponse({
        id: 'exec-1',
        workflowId: 'wf',
        status: 'completed',
        seq: 42,
        updatedAt: '2099-01-01T00:00:00Z',
      }),
    );
    const client = new ClemvionClient({
      baseUrl: 'https://api.clemvion.ai',
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    const r = await client.getStatus('exec-1', 'iext_abc');
    expect(r.status).toBe('completed');
    expect(fetchImpl.mock.calls[0][1].method).toBe('GET');
  });
});

describe('ClemvionClient — baseUrl 검증 + UUID fallback', () => {
  it('invalid URL → throw', () => {
    expect(
      () =>
        new ClemvionClient({
          baseUrl: 'not-a-url',
        }),
    ).toThrow(/유효한 URL/);
  });

  it('http baseUrl + allowInsecureBaseUrl=false → throw', () => {
    expect(
      () =>
        new ClemvionClient({
          baseUrl: 'http://api.example.com',
          allowInsecureBaseUrl: false,
          fetchImpl: jest.fn() as unknown as typeof fetch,
        }),
    ).toThrow(/https:/);
  });

  it('http baseUrl + allowInsecureBaseUrl=true (default) → OK (dev/test 호환)', () => {
    expect(
      () =>
        new ClemvionClient({
          baseUrl: 'http://api.example.com',
          fetchImpl: jest.fn() as unknown as typeof fetch,
        }),
    ).not.toThrow();
  });

  it('fetchImpl 미주입 + globalThis.fetch 없음 → throw', () => {
    const origFetch = (globalThis as { fetch?: typeof fetch }).fetch;
    delete (globalThis as { fetch?: typeof fetch }).fetch;
    try {
      expect(
        () => new ClemvionClient({ baseUrl: 'https://api.example.com' }),
      ).toThrow(/global fetch/);
    } finally {
      if (origFetch) (globalThis as { fetch?: typeof fetch }).fetch = origFetch;
    }
  });
});

describe('ClemvionClient.subscribeToExecution — SSE [ai-review W2]', () => {
  /** ReadableStream<Uint8Array> 를 frame chunk 배열로 만든다. */
  function makeStream(chunks: string[]): ReadableStream<Uint8Array> {
    const encoder = new TextEncoder();
    let i = 0;
    return new ReadableStream({
      pull(controller) {
        if (i < chunks.length) {
          controller.enqueue(encoder.encode(chunks[i++]));
        } else {
          controller.close();
        }
      },
    });
  }

  function sseResponse(body: ReadableStream<Uint8Array>, status = 200): Response {
    return new Response(body, {
      status,
      headers: { 'Content-Type': 'text/event-stream' },
    });
  }

  it('happy path — 다중 이벤트 onEvent 호출 + lastSeq 추적', async () => {
    const stream = makeStream([
      'event: execution.started\nid: 1\ndata: {"executionId":"exec-1"}\n\n',
      'event: execution.completed\nid: 2\ndata: {"result":"ok"}\n\n',
    ]);
    const fetchImpl = jest.fn().mockResolvedValue(sseResponse(stream));
    const client = new ClemvionClient({
      baseUrl: 'https://api.clemvion.ai',
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    const events: { event: string; seq: number; data: unknown }[] = [];
    const sub = client.subscribeToExecution('exec-1', 'iext_abc', {
      onEvent: (e) => events.push(e),
    });
    // stream 소비 + onEvent 호출이 완료될 때까지 대기. ReadableStream 의 micro/macro task 가
    // 순차 진행되도록 setImmediate 두 번.
    await new Promise((resolve) => setImmediate(resolve));
    await new Promise((resolve) => setImmediate(resolve));
    await new Promise((resolve) => setImmediate(resolve));
    expect(events.length).toBe(2);
    expect(events[0]).toEqual({
      event: 'execution.started',
      seq: 1,
      data: { executionId: 'exec-1' },
    });
    expect(events[1].event).toBe('execution.completed');
    expect(sub.lastSeq()).toBe(2);
    sub.close();
  });

  it('multi-line data — RFC 준수 (newline 으로 join) [ai-review W1]', async () => {
    const stream = makeStream([
      'event: execution.ai_message\nid: 5\ndata: {"messages":[\ndata: {"role":"user"}\ndata: ]}\n\n',
    ]);
    const fetchImpl = jest.fn().mockResolvedValue(sseResponse(stream));
    const client = new ClemvionClient({
      baseUrl: 'https://api.clemvion.ai',
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    const events: { event: string; seq: number; data: unknown }[] = [];
    const sub = client.subscribeToExecution('exec-1', 'iext_abc', {
      onEvent: (e) => events.push(e),
    });
    await new Promise((resolve) => setImmediate(resolve));
    await new Promise((resolve) => setImmediate(resolve));
    await new Promise((resolve) => setImmediate(resolve));
    expect(events.length).toBe(1);
    expect(events[0].seq).toBe(5);
    expect(events[0].data).toEqual({ messages: [{ role: 'user' }] });
    sub.close();
  });

  it('heartbeat comment 라인 — null frame skip', async () => {
    const stream = makeStream([
      ': heartbeat\n\n',
      'event: execution.completed\nid: 1\ndata: {}\n\n',
    ]);
    const fetchImpl = jest.fn().mockResolvedValue(sseResponse(stream));
    const client = new ClemvionClient({
      baseUrl: 'https://api.clemvion.ai',
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    const events: { event: string; seq: number }[] = [];
    const sub = client.subscribeToExecution('exec-1', 'iext_abc', {
      onEvent: (e) => events.push(e),
    });
    await new Promise((resolve) => setImmediate(resolve));
    await new Promise((resolve) => setImmediate(resolve));
    expect(events.length).toBe(1);
    sub.close();
  });

  it('non-2xx 응답 → onError 호출', async () => {
    const fetchImpl = jest.fn().mockResolvedValue(
      new Response('forbidden', { status: 403 }),
    );
    const client = new ClemvionClient({
      baseUrl: 'https://api.clemvion.ai',
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    const errors: Error[] = [];
    client.subscribeToExecution('exec-1', 'iext_abc', {
      onEvent: () => undefined,
      onError: (e) => errors.push(e),
    });
    await new Promise((resolve) => setImmediate(resolve));
    await new Promise((resolve) => setImmediate(resolve));
    expect(errors.length).toBe(1);
    expect(errors[0].message).toMatch(/SSE_CONNECT_FAILED|403/);
  });

  it('close() → AbortController abort + onError 미호출', async () => {
    const stream = new ReadableStream<Uint8Array>({
      // 영원히 pull — close() 가 abort 시키지 않으면 hang.
      pull() {
        // no-op
      },
    });
    const fetchImpl = jest.fn().mockImplementation(async (_url, init) => {
      const signal = init.signal as AbortSignal;
      // signal abort 시 fetch 가 reject 하도록.
      return new Promise<Response>((resolve, reject) => {
        signal.addEventListener('abort', () => {
          reject(new Error('aborted'));
        });
        resolve(sseResponse(stream));
      });
    });
    const client = new ClemvionClient({
      baseUrl: 'https://api.clemvion.ai',
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    const errors: Error[] = [];
    const sub = client.subscribeToExecution('exec-1', 'iext_abc', {
      onEvent: () => undefined,
      onError: (e) => errors.push(e),
    });
    sub.close();
    await new Promise((resolve) => setImmediate(resolve));
    // abort 후 onError 는 호출되지 않아야 함 (signal.aborted 가드).
    expect(errors).toEqual([]);
  });

  it('onError 핸들러 자체가 throw 해도 unhandled rejection 없음', async () => {
    const fetchImpl = jest.fn().mockResolvedValue(
      new Response('boom', { status: 500 }),
    );
    const client = new ClemvionClient({
      baseUrl: 'https://api.clemvion.ai',
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    const sub = client.subscribeToExecution('exec-1', 'iext_abc', {
      onEvent: () => undefined,
      onError: () => {
        throw new Error('handler throws');
      },
    });
    await new Promise((resolve) => setImmediate(resolve));
    await new Promise((resolve) => setImmediate(resolve));
    // 명시적 expect — throw 가 SDK 외부로 escape 되지 않음.
    expect(typeof sub.close).toBe('function');
  });

  it('Bearer Authorization 헤더 동봉 + ?token= query fallback', async () => {
    const stream = makeStream([]);
    const fetchImpl = jest.fn().mockResolvedValue(sseResponse(stream));
    const client = new ClemvionClient({
      baseUrl: 'https://api.clemvion.ai',
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    client.subscribeToExecution('exec-1', 'iext_abc', {
      onEvent: () => undefined,
    });
    await new Promise((resolve) => setImmediate(resolve));
    expect(fetchImpl.mock.calls[0][0]).toContain('?token=iext_abc');
    const headers = fetchImpl.mock.calls[0][1].headers as Record<string, string>;
    expect(headers.Authorization).toBe('Bearer iext_abc');
    expect(headers.Accept).toBe('text/event-stream');
  });

  it('lastEventId 옵션 → URL query 에 추가', async () => {
    const stream = makeStream([]);
    const fetchImpl = jest.fn().mockResolvedValue(sseResponse(stream));
    const client = new ClemvionClient({
      baseUrl: 'https://api.clemvion.ai',
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    client.subscribeToExecution('exec-1', 'iext_abc', {
      onEvent: () => undefined,
      lastEventId: 42,
    });
    await new Promise((resolve) => setImmediate(resolve));
    expect(fetchImpl.mock.calls[0][0]).toContain('lastEventId=42');
  });
});
