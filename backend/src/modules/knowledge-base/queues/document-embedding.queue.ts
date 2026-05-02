/**
 * 문서 단위 임베딩 작업을 처리하는 BullMQ 큐 이름.
 *
 * 진입점:
 *   - 문서 업로드 직후 (단발 임베딩)
 *   - 문서 단건 재임베딩
 *   - KB 전체 재임베딩 (addBulk 으로 N개 child job 큐잉, isKbBatch=true)
 *
 * Worker concurrency 는 EmbeddingProcessor 에서 설정. 다중 인스턴스 환경에서
 * Redis 기반으로 동시성/지속성이 보장된다.
 */
export const DOCUMENT_EMBEDDING_QUEUE = 'document-embedding';

export interface DocumentEmbeddingJob {
  documentId: string;
  /** true 면 기존 청크/임베딩을 삭제하고 처음부터 다시 처리한다. */
  reEmbed?: boolean;
  /** KB 전체 재임베딩으로 발사된 child job 일 때 true. */
  isKbBatch?: boolean;
  /** isKbBatch=true 일 때만 채워진다. 마지막 child 가 끝났을 때 KB.reembed_status reset 에 사용. */
  knowledgeBaseId?: string;
}
