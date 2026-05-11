import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/** 지식 베이스 응답 DTO */
export class KnowledgeBaseDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ format: 'uuid' })
  workspaceId: string;

  @ApiProperty({ example: '고객 FAQ' })
  name: string;

  @ApiPropertyOptional({ nullable: true })
  description?: string | null;

  @ApiProperty({ example: 'text-embedding-3-small' })
  embeddingModel: string;

  @ApiPropertyOptional({
    example: 1536,
    nullable: true,
    description:
      '저장된 청크들의 임베딩 차원. 첫 임베딩 후 자동으로 채워지며, 모델 변경 후 KB 재임베딩 시 재설정됩니다.',
  })
  embeddingDimension?: number | null;

  @ApiProperty({
    example: 'idle',
    enum: ['idle', 'in_progress'],
    description:
      'KB 전체 재임베딩 진행 상태. in_progress 동안에는 RAG 검색이 일시적으로 제외되고, 추가 reEmbedAll 호출은 409 로 거절됩니다.',
  })
  reembedStatus: 'idle' | 'in_progress';

  @ApiProperty({
    example: 'vector',
    enum: ['vector', 'graph'],
    description: '검색 모드. 생성 시 결정 후 불변.',
  })
  ragMode: 'vector' | 'graph';

  @ApiPropertyOptional({
    nullable: true,
    format: 'uuid',
    description:
      'graph 모드 KB 의 추출 LLMConfig (NULL 이면 워크스페이스 default).',
  })
  extractionLlmConfigId?: string | null;

  @ApiPropertyOptional({
    nullable: true,
    format: 'uuid',
    description: '임베딩 LLMConfig (NULL 이면 워크스페이스 default).',
  })
  embeddingLlmConfigId?: string | null;

  @ApiProperty({ example: 1, description: 'graph 검색 확장 깊이 (1 또는 2)' })
  maxHops: number;

  @ApiProperty({ example: 5, description: 'graph 검색 vector seed 개수' })
  vectorSeedTopK: number;

  @ApiProperty({
    example: 15,
    description: 'graph expansion 후 회수할 청크 상한',
  })
  expandedChunkLimit: number;

  @ApiProperty({ example: 0, description: 'KB 의 entity 총 수 (캐시)' })
  entityCount: number;

  @ApiProperty({ example: 0, description: 'KB 의 relation 총 수 (캐시)' })
  relationCount: number;

  @ApiProperty({
    example: 'idle',
    enum: ['idle', 'in_progress'],
    description:
      'KB 전체 그래프 재추출 진행 상태. in_progress 동안 추가 호출은 409 로 거절됩니다.',
  })
  reextractStatus: 'idle' | 'in_progress';

  @ApiProperty({ example: 1000 })
  chunkSize: number;

  @ApiProperty({ example: 100 })
  chunkOverlap: number;

  @ApiProperty({ format: 'date-time' })
  createdAt: string;

  @ApiProperty({ format: 'date-time' })
  updatedAt: string;
}

/** 문서 응답 DTO */
export class DocumentDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ format: 'uuid' })
  knowledgeBaseId: string;

  @ApiProperty()
  name: string;

  @ApiProperty({ example: 'pdf' })
  fileType: string;

  @ApiProperty()
  fileUrl: string;

  @ApiProperty({ example: 20480 })
  fileSize: number;

  @ApiProperty({
    example: 'completed',
    enum: ['pending', 'processing', 'completed', 'error', 'failed'],
    description:
      "'error' = in-flight 재시도 중 일시 오류, 'failed' = 최대 재시도 소진 또는 비재시도성 오류로 인한 최종 실패",
  })
  embeddingStatus: string;

  @ApiProperty({
    example: 0,
    description: '임베딩 재시도 누적 횟수 (성공 시 0 으로 리셋)',
  })
  embeddingRetryCount: number;

  @ApiPropertyOptional({
    nullable: true,
    format: 'date-time',
    description: '마지막 임베딩 시도 시각',
  })
  embeddingLastAttemptedAt?: string | null;

  @ApiPropertyOptional({
    nullable: true,
    description: '마지막 임베딩 오류 메시지 (성공 시 NULL)',
  })
  embeddingErrorMessage?: string | null;

  @ApiPropertyOptional({
    nullable: true,
    enum: ['pending', 'processing', 'completed', 'error', 'failed'],
    description:
      "graph 모드 KB 의 그래프 추출 진행 상태. vector 모드 문서는 NULL. 'error'·'failed' 의미는 embeddingStatus 와 동일.",
  })
  graphExtractionStatus?:
    | 'pending'
    | 'processing'
    | 'completed'
    | 'error'
    | 'failed'
    | null;

  @ApiProperty({ example: 0, description: '그래프 추출 재시도 누적 횟수' })
  graphRetryCount: number;

  @ApiPropertyOptional({
    nullable: true,
    format: 'date-time',
    description: '마지막 그래프 추출 시도 시각',
  })
  graphLastAttemptedAt?: string | null;

  @ApiPropertyOptional({
    nullable: true,
    description: '마지막 그래프 추출 오류 메시지',
  })
  graphErrorMessage?: string | null;

  @ApiProperty({ example: 12 })
  chunkCount: number;

  @ApiProperty({ type: [String] })
  tags: string[];

  @ApiProperty({ type: 'object', additionalProperties: true })
  metadata: Record<string, unknown>;

  @ApiProperty({ format: 'date-time' })
  createdAt: string;

  @ApiProperty({ format: 'date-time' })
  updatedAt: string;
}

/** RAG 검색 결과 청크 */
export class RagSearchChunkDto {
  @ApiProperty({ format: 'uuid' })
  documentId: string;

  @ApiProperty()
  content: string;

  @ApiProperty({ example: 0.87 })
  score: number;

  @ApiPropertyOptional({ type: 'object', additionalProperties: true })
  metadata?: Record<string, unknown>;
}

/** RAG 검색 결과 응답 */
export class RagSearchResultDto {
  @ApiProperty({ type: [RagSearchChunkDto] })
  results: RagSearchChunkDto[];
}

/** 재임베딩 접수 결과 */
export class ReEmbedAcceptedDto {
  @ApiProperty({ example: 'Re-embedding started' })
  message: string;
}

/** KB 단위 재임베딩 접수 결과 */
export class KbReEmbedAcceptedDto {
  @ApiProperty({ example: 'KB re-embedding started' })
  message: string;

  @ApiProperty({ example: 12, description: '큐잉된 문서 개수' })
  documentCount: number;

  @ApiProperty({
    example: false,
    description:
      'graph 모드 KB 인 경우 임베딩 완료 후 그래프 추출이 자동 chained 되어 추가 LLM 비용이 발생함을 의미합니다. UI 가 사용자에게 안내할 수 있도록 응답에 포함됩니다.',
  })
  chainedGraphExtraction: boolean;
}

/** KB 단위 그래프 재추출 접수 결과 */
export class KbReExtractAcceptedDto {
  @ApiProperty({ example: 'KB graph re-extraction started' })
  message: string;

  @ApiProperty({ example: 12, description: '큐잉된 문서 개수' })
  documentCount: number;
}

/** 문서 단건 그래프 재추출 접수 결과 */
export class KbReExtractDocumentAcceptedDto {
  @ApiProperty({ example: 'Graph re-extraction started' })
  message: string;
}

/** Graph entity (P1 entity 목록) */
export class GraphEntityDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ example: 'acme corp' })
  name: string;

  @ApiProperty({ example: 'Acme Corp' })
  displayName: string;

  @ApiProperty({
    enum: ['person', 'organization', 'concept', 'location', 'event', 'other'],
  })
  type: string;

  @ApiPropertyOptional({ nullable: true })
  description?: string | null;

  @ApiProperty({ example: 12 })
  mentionCount: number;

  @ApiProperty({ format: 'date-time' })
  createdAt: string;

  @ApiProperty({ format: 'date-time' })
  updatedAt: string;
}

/** entity 상세에서 함께 반환되는 등장 chunk 미리보기 */
export class EntityChunkPreviewDto {
  @ApiProperty({ format: 'uuid' })
  chunkId: string;

  @ApiProperty({ format: 'uuid' })
  documentId: string;

  @ApiProperty({ example: 'Acme Annual Report 2024' })
  documentName: string;

  @ApiProperty({ example: 'Acme Corp announced...' })
  contentPreview: string;
}

export class GraphEntityDetailDto extends GraphEntityDto {
  @ApiProperty({ type: [EntityChunkPreviewDto] })
  mentionedInChunks: EntityChunkPreviewDto[];

  @ApiProperty({
    example: false,
    description:
      'true 면 등장 chunk 가 100건 한계를 초과해 일부만 반환되었음을 의미합니다.',
  })
  truncated: boolean;
}

/** Graph relation (P1 relation 목록) */
export class GraphRelationDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ example: 'founded' })
  predicate: string;

  @ApiProperty({ example: 4 })
  weight: number;

  @ApiProperty({ type: GraphEntityDto, nullable: true })
  headEntity: GraphEntityDto | null;

  @ApiProperty({ type: GraphEntityDto, nullable: true })
  tailEntity: GraphEntityDto | null;

  @ApiProperty({ format: 'date-time' })
  createdAt: string;

  @ApiProperty({ format: 'date-time' })
  updatedAt: string;
}

/** Graph visualization node */
export class GraphVizNodeDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty()
  label: string;

  @ApiProperty()
  type: string;

  @ApiProperty()
  mentionCount: number;
}

/** Graph visualization edge */
export class GraphVizEdgeDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ format: 'uuid' })
  source: string;

  @ApiProperty({ format: 'uuid' })
  target: string;

  @ApiProperty()
  predicate: string;

  @ApiProperty()
  weight: number;
}

/** 그래프 시각화용 부분 페이로드 (P2) */
export class GraphVisualizationDto {
  @ApiProperty({ type: [GraphVizNodeDto] })
  nodes: GraphVizNodeDto[];

  @ApiProperty({ type: [GraphVizEdgeDto] })
  edges: GraphVizEdgeDto[];

  @ApiProperty({
    description: 'true 면 entity 가 limit 을 초과해 잘렸음을 의미',
  })
  truncated: boolean;
}

/** 그래프 통계 응답 */
export class KbGraphStatsDto {
  @ApiProperty({ example: 1240, description: 'KB 내 entity 총 수' })
  entityCount: number;

  @ApiProperty({ example: 3802, description: 'KB 내 relation 총 수' })
  relationCount: number;

  @ApiProperty({
    example: 5,
    description:
      '그래프 추출이 완료된 문서 수 (graph_extraction_status = completed)',
  })
  extractedDocumentCount: number;

  @ApiProperty({
    example: 1,
    description:
      '그래프 추출이 최종 실패한 문서 수 (graph_extraction_status = failed). UI 에서 재시도 버튼 활성화 조건.',
  })
  failedDocumentCount: number;

  @ApiProperty({
    example: 1,
    description:
      '아직 추출이 진행 중이거나 일시 오류 상태인 문서 수 (pending / processing / error)',
  })
  pendingDocumentCount: number;

  @ApiProperty({ example: 7, description: 'KB 의 총 문서 수' })
  totalDocumentCount: number;

  @ApiProperty({
    example: 'idle',
    enum: ['idle', 'in_progress'],
    description: 'KB 전체 재추출 잠금 상태',
  })
  reextractStatus: 'idle' | 'in_progress';
}

/** KB 임베딩 진행 통계 응답 */
export class KbEmbeddingStatsDto {
  @ApiProperty({
    example: 5,
    description: 'embedding_status = completed 문서 수',
  })
  completedDocumentCount: number;

  @ApiProperty({
    example: 1,
    description: 'embedding_status = failed 문서 수 (최종 실패)',
  })
  failedDocumentCount: number;

  @ApiProperty({
    example: 1,
    description: 'pending / processing / error 문서 수 (진행 중 + 일시 오류)',
  })
  pendingDocumentCount: number;

  @ApiProperty({ example: 7, description: 'KB 의 총 문서 수' })
  totalDocumentCount: number;

  @ApiProperty({
    example: 'idle',
    enum: ['idle', 'in_progress'],
    description: 'KB 전체 재임베딩 잠금 상태',
  })
  reembedStatus: 'idle' | 'in_progress';
}

/** retry-failed 응답 */
export class KbRetryFailedAcceptedDto {
  @ApiProperty({ example: 'Retry of failed documents started' })
  message: string;

  @ApiProperty({ example: 2, description: '임베딩 재큐잉된 문서 수' })
  embeddingRequeued: number;

  @ApiProperty({ example: 1, description: '그래프 추출 재큐잉된 문서 수' })
  graphRequeued: number;
}
