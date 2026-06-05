import {
  IsOptional,
  IsInt,
  IsString,
  Min,
  Max,
  MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

/**
 * `GET /agent-memories/scopes` 쿼리 (spec/5-system/17-agent-memory.md §6, AGM-12).
 *
 * 페이지네이션은 `limit`/`offset` 로 받는다. 응답은 프로젝트 표준 `PaginatedResponseDto`
 * shape (`{ data, pagination: { page, limit, totalItems, totalPages } }`) 로 정규화되며,
 * `page` 는 서비스가 `offset`/`limit` 에서 파생한다. workspace_id 는 쿼리로 받지 않고
 * 인증 컨텍스트(@WorkspaceId())에서만 온다 (격리 의무 §5).
 */
export class ListAgentMemoryScopesQueryDto {
  /** 반환할 scope 수 (1~100, 기본 30). */
  @ApiPropertyOptional({
    description: '반환할 scope 수',
    minimum: 1,
    maximum: 100,
    default: 30,
    example: 30,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 30;

  /** 건너뛸 scope 수 (offset, 기본 0). */
  @ApiPropertyOptional({
    description: '건너뛸 scope 수 (offset)',
    minimum: 0,
    default: 0,
    example: 0,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset?: number = 0;

  /** scope_key 부분일치 검색어 (ILIKE). */
  @ApiPropertyOptional({
    description: 'scope_key 부분일치 검색어 (대소문자 무시)',
    example: 'cust-',
    maxLength: 512,
  })
  @IsOptional()
  @IsString()
  @MaxLength(512)
  q?: string;
}
