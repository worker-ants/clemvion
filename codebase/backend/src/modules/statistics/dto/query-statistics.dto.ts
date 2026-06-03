import { IsOptional, IsIn, IsUUID, IsDateString } from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class QueryStatisticsDto {
  /** 조회 기간 구분 (1d | 7d | 30d | 90d | custom). custom 선택 시 startDate/endDate 사용 */
  @ApiPropertyOptional({
    description:
      '조회 기간 구분. 1d/7d/30d/90d 는 현재 시각 기준 상대 구간, custom 은 startDate~endDate 구간 사용',
    enum: ['1d', '7d', '30d', '90d', 'custom'],
    default: '7d',
    example: '7d',
  })
  @IsOptional()
  @IsIn(['1d', '7d', '30d', '90d', 'custom'])
  period?: string = '7d';

  /** 특정 워크플로우로 필터링할 UUID (미지정 시 전체 대상) */
  @ApiPropertyOptional({
    description:
      '특정 워크플로우로 필터링할 UUID. 빈 문자열은 null 로 변환되어 전체 집계됨',
    format: 'uuid',
    example: 'b2f7c1d4-6e8a-4a7f-9b3c-1234567890ab',
    nullable: true,
  })
  @IsOptional()
  @IsUUID()
  @Transform(({ value }: { value: unknown }) => (value === '' ? null : value))
  workflowId?: string | null;

  /** custom 기간 시작일 (ISO 8601 날짜/일시 문자열) */
  @ApiPropertyOptional({
    description:
      'custom 기간 시작일 (ISO 8601 형식). period=custom 일 때만 사용',
    format: 'date-time',
    example: '2026-03-01T00:00:00.000Z',
  })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  /** custom 기간 종료일 (ISO 8601 날짜/일시 문자열) */
  @ApiPropertyOptional({
    description:
      'custom 기간 종료일 (ISO 8601 형식). 미지정 시 현재 시각을 사용',
    format: 'date-time',
    example: '2026-04-14T23:59:59.000Z',
  })
  @IsOptional()
  @IsDateString()
  endDate?: string;
}
