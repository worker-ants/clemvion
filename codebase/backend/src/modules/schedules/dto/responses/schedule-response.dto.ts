import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/** 스케줄 응답 DTO */
export class ScheduleDto {
  /** 스케줄 UUID */
  @ApiProperty({ format: 'uuid' })
  id: string;

  /** 소속 워크스페이스 UUID */
  @ApiProperty({ format: 'uuid' })
  workspaceId: string;

  /** 연결된 트리거 UUID */
  @ApiProperty({ format: 'uuid' })
  triggerId: string;

  /** Cron 식 */
  @ApiProperty({ example: '0 9 * * 1-5' })
  cronExpression: string;

  /** 타임존 */
  @ApiProperty({ example: 'Asia/Seoul' })
  timezone: string;

  /** 활성화 여부 */
  @ApiProperty()
  isActive: boolean;

  /** 다음 실행 예정 시각 */
  @ApiPropertyOptional({ format: 'date-time', nullable: true })
  nextRunAt?: string | null;

  /** 마지막 실행 시각 */
  @ApiPropertyOptional({ format: 'date-time', nullable: true })
  lastRunAt?: string | null;

  /** 파라미터 값 */
  @ApiProperty({ type: 'object', additionalProperties: true })
  parameterValues: Record<string, unknown>;

  /** 생성 시각 */
  @ApiProperty({ format: 'date-time' })
  createdAt: string;

  /** 수정 시각 */
  @ApiProperty({ format: 'date-time' })
  updatedAt: string;
}

/** Cron 다음 실행 시각 프리뷰 */
export class CronPreviewDto {
  /** 다음 실행 예정 시각 목록 (ISO 8601) */
  @ApiProperty({
    type: [String],
    example: ['2026-04-21T00:00:00+09:00', '2026-04-22T00:00:00+09:00'],
  })
  nextRuns: string[];
}

/** 스케줄 즉시 실행 결과 */
export class ScheduleRunNowResultDto {
  /** 생성된 실행 UUID */
  @ApiProperty({ format: 'uuid' })
  executionId: string;
}
