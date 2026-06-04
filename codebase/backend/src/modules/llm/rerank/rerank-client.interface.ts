export interface RerankScore {
  index: number;
  score: number;
}

/**
 * cross-encoder 리랭킹 클라이언트 인터페이스 (Spec LLM Client §3.6).
 * chat/embedding 과 API shape 가 달라 `LLMClient` 와 분리한다.
 */
export interface RerankClient {
  /**
   * (query, document) 쌍을 cross-encoder 로 점수화해 관련도 순 index+score 반환.
   * documents 순서와 무관하게 score 내림차순 정렬된 결과.
   */
  rerank(
    query: string,
    documents: string[],
    model?: string,
    opts?: { topK?: number },
  ): Promise<RerankScore[]>;
}
