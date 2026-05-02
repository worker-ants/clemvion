import {
  IsString,
  IsOptional,
  IsInt,
  IsIn,
  IsUUID,
  Min,
  Max,
  MaxLength,
  Matches,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { EMBEDDING_MODEL_PATTERN } from '../embedding/embedding-dimensions.const';

export class CreateKnowledgeBaseDto {
  /** 지식 베이스 표시 이름 */
  @ApiProperty({
    description: '지식 베이스 표시 이름',
    example: 'Product Docs',
    maxLength: 255,
  })
  @IsString()
  @MaxLength(255)
  name: string;

  /** 지식 베이스 설명 */
  @ApiPropertyOptional({
    description: '지식 베이스 설명',
    example: '제품 사용 가이드 및 FAQ 모음',
  })
  @IsOptional()
  @IsString()
  description?: string;

  /** 사용할 임베딩 모델 식별자 */
  @ApiPropertyOptional({
    description:
      '사용할 임베딩 모델 식별자. 미지정 시 워크스페이스 기본 모델이 사용됩니다.',
    example: 'text-embedding-3-small',
    maxLength: 100,
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  @Matches(EMBEDDING_MODEL_PATTERN, {
    message:
      'embeddingModel must contain only letters, digits, ".", "_", ":", "/" or "-" (max 100 chars)',
  })
  embeddingModel?: string;

  /** 청크 크기 (토큰 기준, 100~8000) */
  @ApiPropertyOptional({
    description: '문서 분할 청크 크기 (토큰 기준)',
    minimum: 100,
    maximum: 8000,
    example: 1000,
  })
  @IsOptional()
  @IsInt()
  @Min(100)
  @Max(8000)
  chunkSize?: number;

  /** 청크 간 중첩 토큰 수 (0~2000) */
  @ApiPropertyOptional({
    description:
      '청크 간 중첩 토큰 수. 문맥 보존을 위해 이전 청크 말미를 다음 청크에 포함합니다.',
    minimum: 0,
    maximum: 2000,
    example: 200,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(2000)
  chunkOverlap?: number;

  /** 검색 모드 — 생성 시에만 결정. 사후 변경 불가 (모드 전환은 새 KB 생성). */
  @ApiPropertyOptional({
    description:
      '검색 모드. `vector` (default) 는 유사도 기반 단순 검색, `graph` 는 entity/relation 추출 후 vector seed → 그래프 확장 → rerank Hybrid 검색. 생성 시에만 결정 (불변).',
    enum: ['vector', 'graph'],
    example: 'vector',
  })
  @IsOptional()
  @IsString()
  @IsIn(['vector', 'graph'])
  ragMode?: 'vector' | 'graph';

  /** graph 모드 일 때 그래프 추출에 사용할 LLMConfig */
  @ApiPropertyOptional({
    description:
      'graph 모드 KB 의 그래프 추출에 사용할 LLMConfig 의 chat 모델. 미지정 시 워크스페이스 default LLMConfig.',
    format: 'uuid',
  })
  @IsOptional()
  @IsUUID()
  extractionLlmConfigId?: string;

  /** graph 모드 검색 시 그래프 확장 깊이 (1 또는 2) */
  @ApiPropertyOptional({
    description: 'graph 모드 검색 시 그래프 확장 깊이 (1 또는 2, 기본 1).',
    minimum: 1,
    maximum: 2,
    example: 1,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(2)
  maxHops?: number;

  /** graph 모드 검색 시 vector seed 개수 */
  @ApiPropertyOptional({
    description: 'graph 모드 검색 시 vector seed 개수 (기본 5).',
    minimum: 1,
    maximum: 50,
    example: 5,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(50)
  vectorSeedTopK?: number;

  /** graph expansion 후 회수할 청크 상한 */
  @ApiPropertyOptional({
    description: 'graph expansion 후 회수할 청크 상한 (기본 15).',
    minimum: 1,
    maximum: 100,
    example: 15,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  expandedChunkLimit?: number;
}
