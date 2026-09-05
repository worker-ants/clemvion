import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * 스케줄 응답에 동봉되는 **트리거 참조** — 목록 UI 가 실제로 쓰는 필드만 담는다.
 *
 * 종전 응답은 조인된 `Trigger` **엔티티 전체**를 실어 보냈고, 거기에는
 * `notificationSecretV2`(평문 서명 secret) 와 `chatChannelTokenV2`(secret store ref) 가
 * 들어 있었다 — `TriggersService` 가 트리거 자신의 응답에서 빼는 바로 그 컬럼들이
 * **조인을 타고** 새어 나왔다. §5.4 응답-계약 스윕이 `trigger` 를 "선언되지 않은 키" 로
 * 검출해 드러났다.
 *
 * 프런트엔드 소비처는 `schedules/page.tsx` 의 네 곳뿐이다 (`name` · `id` ·
 * `workflowId` · `workflow.name`).
 */
export class ScheduleTriggerWorkflowRefDto {
  /** 워크플로우 이름 */
  @ApiProperty()
  name: string;
}

/** 스케줄 응답에 동봉되는 트리거 참조 */
export class ScheduleTriggerRefDto {
  /** 트리거 UUID */
  @ApiProperty({ format: 'uuid' })
  id: string;

  /** 트리거 이름 */
  @ApiProperty()
  name: string;

  /** 연결된 워크플로우 UUID */
  @ApiProperty({ format: 'uuid' })
  workflowId: string;

  /** 연결된 워크플로우 (조회 경로에 따라 없을 수 있다) */
  @ApiPropertyOptional({ type: () => ScheduleTriggerWorkflowRefDto })
  workflow?: ScheduleTriggerWorkflowRefDto;
}

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

  /**
   * 연결된 트리거 — **참조 수준으로 좁혀진** 형태다 (`ScheduleTriggerRefDto` 주석 참조).
   * 조회 경로에 따라 없을 수 있다.
   */
  @ApiPropertyOptional({ type: () => ScheduleTriggerRefDto, nullable: true })
  trigger?: ScheduleTriggerRefDto | null;
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
