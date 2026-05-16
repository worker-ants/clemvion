import {
  IsOptional,
  IsInt,
  Min,
  Max,
  IsString,
  IsIn,
  MaxLength,
  Matches,
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
  @MaxLength(64)
  // 안전한 컬럼명 패턴 (영문/숫자/밑줄). 서비스별 화이트리스트(`getSortColumn`)가
  // 다층 방어를 제공하지만 DTO 레벨에서 raw SQL 식별자에 들어갈 수 있는 위험
  // 문자를 1차 차단해 ORDER BY 인젝션 / 식별자 우회를 막는다.
  @Matches(/^[a-zA-Z][a-zA-Z0-9_]*$/, {
    message: 'sort must be alphanumeric/underscore identifier',
  })
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
