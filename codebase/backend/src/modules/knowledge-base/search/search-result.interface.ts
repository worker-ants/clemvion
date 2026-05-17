export interface SearchResult {
  chunkId: string;
  documentId: string;
  documentName: string;
  content: string;
  score: number;
  metadata: Record<string, unknown>;
  // graph 모드 KB 검색 결과인 경우 'seed' (vector top-K) 또는 'expanded' (그래프 확장).
  // vector 모드 결과에서는 생략.
  origin?: 'seed' | 'expanded';
}

// graph 모드 KB 가 검색에 한 번이라도 참여했을 때 응답 메타에 첨부.
export interface GraphTraversalSummary {
  mode: 'graph';
  seedChunkCount: number;
  traversedEntityCount: number;
  maxDepth: number;
  expandedChunkCount: number;
}

export interface RagContext {
  context: string;
  sources: SearchResult[];
  graphTraversal?: GraphTraversalSummary;
}
