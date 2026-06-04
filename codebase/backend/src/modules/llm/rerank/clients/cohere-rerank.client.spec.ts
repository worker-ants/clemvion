import { CohereRerankClient } from './cohere-rerank.client';

describe('CohereRerankClient', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  function mockFetchOnce(body: unknown, ok = true, status = 200) {
    return jest.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok,
      status,
      json: async () => body,
    } as Response);
  }

  it('POSTs to {base}/v2/rerank with model/query/documents/top_n and maps relevance_score', async () => {
    const fetchSpy = mockFetchOnce({
      results: [
        { index: 1, relevance_score: 0.95 },
        { index: 0, relevance_score: 0.4 },
      ],
    });

    const client = new CohereRerankClient('co-key', 'rerank-3.5');
    const result = await client.rerank('q', ['a', 'b'], undefined, { topK: 2 });

    const [url, init] = fetchSpy.mock.calls[0];
    expect(url).toBe('https://api.cohere.com/v2/rerank');
    expect(init?.method).toBe('POST');
    const headers = (init?.headers ?? {}) as Record<string, string>;
    expect(headers['Authorization']).toBe('Bearer co-key');
    expect(headers['Content-Type']).toBe('application/json');
    expect(JSON.parse(init?.body as string)).toEqual({
      model: 'rerank-3.5',
      query: 'q',
      documents: ['a', 'b'],
      top_n: 2,
    });

    expect(result).toEqual([
      { index: 1, score: 0.95 },
      { index: 0, score: 0.4 },
    ]);
  });

  it('uses model override and custom baseUrl, omits top_n when topK absent', async () => {
    const fetchSpy = mockFetchOnce({ results: [] });
    const client = new CohereRerankClient(
      'co-key',
      'rerank-3.5',
      'https://proxy.internal',
    );
    await client.rerank('q', ['a'], 'rerank-multilingual-v3.0');

    const [url, init] = fetchSpy.mock.calls[0];
    expect(url).toBe('https://proxy.internal/v2/rerank');
    const parsed = JSON.parse(init?.body as string);
    expect(parsed.model).toBe('rerank-multilingual-v3.0');
    expect(parsed.top_n).toBeUndefined();
  });

  it('throws sanitized error on non-2xx', async () => {
    mockFetchOnce(null, false, 429);
    const client = new CohereRerankClient('co-key', 'rerank-3.5');
    await expect(client.rerank('q', ['a'])).rejects.toThrow(
      'Cohere rerank failed with status 429',
    );
  });

  it('throws sanitized error on network failure without leaking apiKey', async () => {
    jest.spyOn(global, 'fetch').mockRejectedValueOnce(new Error('boom co-key'));
    const client = new CohereRerankClient('co-key', 'rerank-3.5');
    await expect(client.rerank('q', ['a'])).rejects.toThrow(
      'Cohere rerank request failed',
    );
    await expect(client.rerank('q', ['a'])).rejects.not.toThrow(/co-key/);
  });
});
