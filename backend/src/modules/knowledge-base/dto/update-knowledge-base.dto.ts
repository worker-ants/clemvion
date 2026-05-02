import {
  IsString,
  IsOptional,
  IsInt,
  Min,
  Max,
  MaxLength,
  Matches,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { EMBEDDING_MODEL_PATTERN } from '../embedding/embedding-dimensions.const';

export class UpdateKnowledgeBaseDto {
  /** 변경할 지식 베이스 이름 */
  @ApiPropertyOptional({
    description: '변경할 지식 베이스 이름',
    example: 'Product Docs (v2)',
    maxLength: 255,
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  name?: string;

  /** 변경할 설명 */
  @ApiPropertyOptional({
    description: '변경할 지식 베이스 설명',
  })
  @IsOptional()
  @IsString()
  description?: string;

  /** 변경할 임베딩 모델 식별자 */
  @ApiPropertyOptional({
    description:
      '변경할 임베딩 모델 식별자. 차원이 달라지면 기존 청크와 호환되지 않으므로 KB 재임베딩이 필요합니다.',
    example: 'text-embedding-3-large',
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

  /** 변경할 청크 크기 (토큰 기준, 100~8000) */
  @ApiPropertyOptional({
    description: '변경할 문서 분할 청크 크기. 변경 후 재임베딩이 필요합니다.',
    minimum: 100,
    maximum: 8000,
    example: 1500,
  })
  @IsOptional()
  @IsInt()
  @Min(100)
  @Max(8000)
  chunkSize?: number;

  /** 변경할 청크 중첩 토큰 수 (0~2000) */
  @ApiPropertyOptional({
    description: '변경할 청크 중첩 토큰 수. 변경 후 재임베딩이 필요합니다.',
    minimum: 0,
    maximum: 2000,
    example: 300,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(2000)
  chunkOverlap?: number;
}
