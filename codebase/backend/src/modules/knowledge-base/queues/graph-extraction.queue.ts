/**
 * graph 모드 KB 의 문서 단위 entity/relation 추출 작업 큐.
 *
 * 진입점:
 *   - 임베딩 완료 직후 chained dispatch (DocumentEmbeddingProcessor.onCompleted)
 *   - 문서 단건 재추출 API
 *   - KB 전체 재추출 API (모든 문서를 addBulk)
 *
 * Worker concurrency 는 GraphExtractionProcessor 에서 설정 (LLM rate limit 고려해
 * 임베딩 큐(3) 보다 보수적으로 2 로 둔다).
 */
export const GRAPH_EXTRACTION_QUEUE = 'graph-extraction';

export interface GraphExtractionJob {
  documentId: string;
  knowledgeBaseId: string;
  /** KB 전체 재추출로 발사된 child job 일 때 true. 마지막 child 가 끝났을 때 reextract_status reset 에 사용. */
  isKbBatch?: boolean;
}
