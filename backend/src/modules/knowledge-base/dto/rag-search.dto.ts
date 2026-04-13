import {
  IsArray,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class RagSearchDto {
  /** 검색 쿼리 문자열 */
  @ApiProperty({
    description: '검색 쿼리 문자열. 임베딩 후 벡터 유사도로 검색합니다.',
    example: '환불 정책 알려줘',
  })
  @IsString()
  @IsNotEmpty()
  query: string;

  /** 검색 대상 지식 베이스 ID 목록 */
  @ApiProperty({
    description: '검색 대상 지식 베이스 UUID 목록',
    type: [String],
    format: 'uuid',
    example: ['3fa85f64-5717-4562-b3fc-2c963f66afa6'],
  })
  @IsArray()
  @IsUUID('4', { each: true })
  knowledgeBaseIds: string[];

  /** 반환할 최대 유사 청크 개수 */
  @ApiPropertyOptional({
    description: '반환할 최대 유사 청크 개수',
    minimum: 1,
    maximum: 50,
    default: 5,
    example: 5,
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(50)
  topK?: number;

  /** 유사도 임계값 (0~1). 이 값 미만의 청크는 제외됩니다. */
  @ApiPropertyOptional({
    description: '유사도 임계값. 이 값 미만의 청크는 결과에서 제외됩니다.',
    minimum: 0,
    maximum: 1,
    example: 0.7,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  threshold?: number;
}
