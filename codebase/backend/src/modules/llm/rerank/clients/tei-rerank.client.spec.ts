import { TeiRerankClient } from './tei-rerank.client';

describe('TeiRerankClient', () => {
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

  it('POSTs to {baseUrl}/rerank with correct body and maps + sorts response', async () => {
    const fetchSpy = mockFetchOnce([
      { index: 0, score: 0.2 },
      { index: 1, score: 0.9 },
      { index: 2, score: 0.5 },
    ]);

    const client = new TeiRerankClient('http://tei:8080', 'bge-reranker-v2-m3');
    const result = await client.rerank('q', ['a', 'b', 'c']);

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, init] = fetchSpy.mock.calls[0];
    expect(url).toBe('http://tei:8080/rerank');
    expect(init?.method).toBe('POST');
    expect(JSON.parse(init?.body as string)).toEqual({
      query: 'q',
      texts: ['a', 'b', 'c'],
      raw_scores: false,
    });
    // sorted by score desc
    expect(result).toEqual([
      { index: 1, score: 0.9 },
      { index: 2, score: 0.5 },
      { index: 0, score: 0.2 },
    ]);
  });

  it('adds Authorization header when apiKey is provided', async () => {
    const fetchSpy = mockFetchOnce([]);
    const client = new TeiRerankClient('http://tei:8080', 'm', 'secret');
    await client.rerank('q', ['a']);

    const headers = (fetchSpy.mock.calls[0][1]?.headers ?? {}) as Record<
      string,
      string
    >;
    expect(headers['Authorization']).toBe('Bearer secret');
  });

  it('omits Authorization header when no apiKey', async () => {
    const fetchSpy = mockFetchOnce([]);
    const client = new TeiRerankClient('http://tei:8080', 'm');
    await client.rerank('q', ['a']);

    const headers = (fetchSpy.mock.calls[0][1]?.headers ?? {}) as Record<
      string,
      string
    >;
    expect(headers['Authorization']).toBeUndefined();
  });

  it('throws a sanitized error on non-2xx without leaking url/key', async () => {
    mockFetchOnce(null, false, 503);
    const client = new TeiRerankClient('http://tei:8080', 'm', 'secret');

    await expect(client.rerank('q', ['a'])).rejects.toThrow(
      'TEI rerank failed with status 503',
    );
    await expect(
      new TeiRerankClient('http://tei:8080', 'm', 'secret')
        .rerank('q', ['a'])
        .catch((e) => {
          throw e;
        }),
    ).rejects.not.toThrow(/secret/);
  });

  it('throws a sanitized error on network failure', async () => {
    jest
      .spyOn(global, 'fetch')
      .mockRejectedValueOnce(new Error('ECONNREFUSED http://tei:8080'));
    const client = new TeiRerankClient('http://tei:8080', 'm', 'secret');

    await expect(client.rerank('q', ['a'])).rejects.toThrow(
      'TEI rerank request failed',
    );
  });
});
