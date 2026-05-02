import {
  IsOptional,
  IsInt,
  Min,
  Max,
  IsString,
  IsIn,
  MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class PaginationQueryDto {
  /** 조회할 페이지 번호 (1부터 시작) */
  @ApiPropertyOptional({
    description: '조회할 페이지 번호 (1부터 시작)',
    minimum: 1,
    default: 1,
    example: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  /** 페이지당 항목 수 (1~100) */
  @ApiPropertyOptional({
    description: '페이지당 항목 수',
    minimum: 1,
    maximum: 100,
    default: 20,
    example: 20,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  /** 정렬 기준 컬럼명 */
  @ApiPropertyOptional({
    description: '정렬 기준 컬럼명',
    default: 'created_at',
    example: 'created_at',
  })
  @IsOptional()
  @IsString()
  sort?: string = 'created_at';

  /** 정렬 방향 (asc | desc) */
  @ApiPropertyOptional({
    description: '정렬 방향',
    enum: ['asc', 'desc'],
    default: 'desc',
  })
  @IsOptional()
  @IsIn(['asc', 'desc'])
  order?: 'asc' | 'desc' = 'desc';

  /** 검색어 (이름/제목 기반 부분 일치) */
  @ApiPropertyOptional({
    description: '검색어 (부분 일치)',
    example: 'keyword',
    maxLength: 200,
  })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  search?: string;
}
