export interface SearchResult {
  chunkId: string;
  documentId: string;
  documentName: string;
  content: string;
  score: number;
  metadata: Record<string, unknown>;
}

export interface RagContext {
  context: string;
  sources: SearchResult[];
}
