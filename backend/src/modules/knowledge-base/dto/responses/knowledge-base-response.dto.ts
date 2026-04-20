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

  @ApiProperty({ example: 'text-embedding-ada-002' })
  embeddingModel: string;

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
