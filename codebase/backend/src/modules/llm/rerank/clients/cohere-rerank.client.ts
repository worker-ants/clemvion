import { RerankClient, RerankScore } from '../rerank-client.interface';

const RERANK_TIMEOUT_MS = 30_000;
const COHERE_DEFAULT_BASE_URL = 'https://api.cohere.com';

/**
 * Cohere rerank 클라이언트. `POST {baseUrl}/v2/rerank`
 * body `{ model, query, documents, top_n }`,
 * 응답 `{ results: [{ index, relevance_score }] }` (Cohere v2 API).
 */
export class CohereRerankClient implements RerankClient {
  constructor(
    private readonly apiKey: string,
    private readonly defaultModel: string,
    private readonly baseUrl?: string,
  ) {}

  async rerank(
    query: string,
    documents: string[],
    model?: string,
    opts?: { topK?: number },
  ): Promise<RerankScore[]> {
    const base = this.baseUrl ?? COHERE_DEFAULT_BASE_URL;
    const body: {
      model: string;
      query: string;
      documents: string[];
      top_n?: number;
    } = {
      model: model ?? this.defaultModel,
      query,
      documents,
    };
    if (opts?.topK !== undefined) {
      body.top_n = opts.topK;
    }

    let response: Response;
    try {
      response = await fetch(`${base}/v2/rerank`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(RERANK_TIMEOUT_MS),
      });
    } catch {
      // 네트워크/타임아웃 — apiKey·endpoint 노출 금지.
      throw new Error('Cohere rerank request failed');
    }

    if (!response.ok) {
      throw new Error(`Cohere rerank failed with status ${response.status}`);
    }

    const data = (await response.json()) as {
      results: Array<{ index: number; relevance_score: number }>;
    };

    return (data.results ?? [])
      .map((r) => ({ index: r.index, score: r.relevance_score }))
      .sort((a, b) => b.score - a.score);
  }
}
