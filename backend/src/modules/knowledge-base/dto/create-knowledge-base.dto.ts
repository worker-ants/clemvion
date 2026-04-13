import {
  IsString,
  IsOptional,
  IsInt,
  Min,
  Max,
  MaxLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

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
}
