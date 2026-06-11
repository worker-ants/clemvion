import { IsOptional, IsString, IsDateString, IsUUID } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { PaginationQueryDto } from '../../../common/dto/pagination.dto';

export class QueryAuditLogDto extends PaginationQueryDto {
  /** 액션 종류 필터 */
  @ApiPropertyOptional({
    description: '액션 종류 필터 (예: create, update, delete, execute)',
    example: 'update',
  })
  @IsOptional()
  @IsString()
  action?: string;

  /** 리소스 타입 필터 */
  @ApiPropertyOptional({
    description: '리소스 타입 필터 (예: workflow, trigger, schedule)',
    example: 'workflow',
  })
  @IsOptional()
  @IsString()
  resourceType?: string;

  /** 행위자(사용자) 필터 — [Spec Auth §4.2] "기간, 사용자, 액션 유형으로 필터링" */
  @ApiPropertyOptional({
    description: '필터 대상 사용자(행위자) UUID',
    format: 'uuid',
    example: 'a3a3a3a3-1111-2222-3333-444444444444',
  })
  @IsOptional()
  @IsUUID()
  userId?: string;

  /** 조회 시작 시각 (ISO 8601, 포함) */
  @ApiPropertyOptional({
    description: '조회 시작 시각 (ISO 8601, 포함)',
    format: 'date-time',
    example: '2026-01-01T00:00:00.000Z',
  })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  /** 조회 종료 시각 (ISO 8601, 포함) */
  @ApiPropertyOptional({
    description: '조회 종료 시각 (ISO 8601, 포함)',
    format: 'date-time',
    example: '2026-12-31T23:59:59.999Z',
  })
  @IsOptional()
  @IsDateString()
  endDate?: string;
}
