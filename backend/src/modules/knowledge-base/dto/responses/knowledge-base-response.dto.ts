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
    enum: ['pending', 'processing', 'completed', 'failed'],
  })
  embeddingStatus: string;

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
}

/** KB 단위 그래프 재추출 접수 결과 */
export class KbReExtractAcceptedDto {
  @ApiProperty({ example: 'KB graph re-extraction started' })
  message: string;

  @ApiProperty({ example: 12, description: '큐잉된 문서 개수' })
  documentCount: number;
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

  @ApiProperty({ example: 7, description: 'KB 의 총 문서 수' })
  totalDocumentCount: number;

  @ApiProperty({
    example: 'idle',
    enum: ['idle', 'in_progress'],
    description: 'KB 전체 재추출 잠금 상태',
  })
  reextractStatus: 'idle' | 'in_progress';
}
