import { RerankClient, RerankScore } from '../rerank-client.interface';

const RERANK_TIMEOUT_MS = 30_000;

/**
 * HuggingFace Text-Embeddings-Inference (TEI) rerank 클라이언트.
 * `POST {baseUrl}/rerank` body `{ query, texts, raw_scores: false }`.
 * 응답은 `[{ index, score }]` 배열 (Spec LLM Client §5.6).
 *
 * apiKey 는 선택 — 자가호스팅 endpoint 는 보통 인증이 없다. 있으면
 * `Authorization: Bearer` 헤더를 붙인다.
 */
export class TeiRerankClient implements RerankClient {
  constructor(
    private readonly baseUrl: string,
    private readonly defaultModel: string,
    private readonly apiKey?: string,
  ) {}

  async rerank(
    query: string,
    documents: string[],
    _model?: string,
    _opts?: { topK?: number },
  ): Promise<RerankScore[]> {
    // TEI rerank 엔드포인트는 모델이 서버에 고정 로드돼 있어 body 로 model 을
    // 받지 않는다 (defaultModel 은 식별/로깅 용도로만 보관). topK 도 미지원 —
    // 호출 측에서 정렬 후 slice 한다.
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (this.apiKey) {
      headers['Authorization'] = `Bearer ${this.apiKey}`;
    }

    let response: Response;
    try {
      response = await fetch(`${this.baseUrl}/rerank`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          query,
          texts: documents,
          raw_scores: false,
        }),
        signal: AbortSignal.timeout(RERANK_TIMEOUT_MS),
      });
    } catch {
      // 네트워크/타임아웃 — endpoint·키 노출 금지.
      throw new Error('TEI rerank request failed');
    }

    if (!response.ok) {
      throw new Error(`TEI rerank failed with status ${response.status}`);
    }

    const data = (await response.json()) as Array<{
      index: number;
      score: number;
    }>;

    return data
      .map((d) => ({ index: d.index, score: d.score }))
      .sort((a, b) => b.score - a.score);
  }
}
