import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/** 알림 규칙 응답 DTO */
export class AlertRuleDto {
  /** 알림 규칙 UUID */
  @ApiProperty({ format: 'uuid' })
  id: string;

  /** 소속 워크스페이스 UUID */
  @ApiProperty({ format: 'uuid' })
  workspaceId: string;

  /** 규칙 타입 */
  @ApiProperty({
    enum: ['failure_rate', 'duration', 'llm_cost'],
    example: 'failure_rate',
  })
  type: string;

  /** 임계값 */
  @ApiProperty({ example: 10 })
  threshold: number;

  /** 평가 윈도우 (ISO 8601 duration) */
  @ApiPropertyOptional({ nullable: true, example: 'PT1H' })
  window?: string | null;

  /** 알림 채널 */
  @ApiProperty({ enum: ['in_app', 'email'], example: 'in_app' })
  channel: string;

  /** 감시 대상 워크플로우 UUID (null 이면 워크스페이스 전체) */
  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  workflowId?: string | null;

  /** 활성화 여부 */
  @ApiProperty()
  enabled: boolean;

  /** 생성 시각 */
  @ApiProperty({ format: 'date-time' })
  createdAt: string;

  /** 수정 시각 */
  @ApiProperty({ format: 'date-time' })
  updatedAt: string;
}
