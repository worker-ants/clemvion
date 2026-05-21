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
  it('cancel — POST /cancel', async () => {
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
