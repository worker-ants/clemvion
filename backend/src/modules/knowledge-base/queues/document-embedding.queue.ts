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
  /** KB id (finalize / chained dispatch 양쪽에서 사용). enqueue 시점에 producer 가 채운다. */
  knowledgeBaseId?: string;
  /** KB 의 ragMode. producer 가 미리 주입 — worker 가 매번 DB JOIN 으로 ragMode 를 조회하던
   *  부담을 회피. payload 에 없으면(레거시 job) worker 가 fallback DB 조회. */
  ragMode?: 'vector' | 'graph';
}
