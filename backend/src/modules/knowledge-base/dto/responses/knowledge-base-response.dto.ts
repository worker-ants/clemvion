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
