import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/** 트리거 응답 DTO */
export class TriggerDto {
  /** 트리거 UUID */
  @ApiProperty({ format: 'uuid' })
  id: string;

  /** 소속 워크스페이스 UUID */
  @ApiProperty({ format: 'uuid' })
  workspaceId: string;

  /** 연결된 워크플로우 UUID */
  @ApiProperty({ format: 'uuid' })
  workflowId: string;

  /** 트리거 타입 (webhook, manual, schedule) */
  @ApiProperty({ enum: ['webhook', 'manual', 'schedule'], example: 'webhook' })
  type: string;

  /** 트리거 이름 */
  @ApiProperty({ example: '리드 유입 웹훅' })
  name: string;

  /** 활성화 여부 */
  @ApiProperty()
  isActive: boolean;

  /** 트리거 설정 */
  @ApiProperty({ type: 'object', additionalProperties: true })
  config: Record<string, unknown>;

  /** 엔드포인트 경로 (webhook 타입) */
  @ApiPropertyOptional({ nullable: true, example: 'abcd1234' })
  endpointPath?: string | null;

  /** 인증 설정 UUID */
  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  authConfigId?: string | null;

  /** 마지막 실행 시각 */
  @ApiPropertyOptional({ format: 'date-time', nullable: true })
  lastTriggeredAt?: string | null;

  /** 생성 시각 */
  @ApiProperty({ format: 'date-time' })
  createdAt: string;

  /** 수정 시각 */
  @ApiProperty({ format: 'date-time' })
  updatedAt: string;
}

/** 트리거 실행 이력 아이템 */
export class TriggerHistoryItemDto {
  /** 실행 UUID */
  @ApiProperty({ format: 'uuid' })
  id: string;

  /** 실행 상태 */
  @ApiProperty({
    example: 'completed',
    enum: [
      'pending',
      'running',
      'completed',
      'failed',
      'cancelled',
      'waiting_for_input',
    ],
  })
  status: string;

  /** 시작 시각 */
  @ApiProperty({ format: 'date-time' })
  startedAt: string;

  /** 소요 시간(ms) */
  @ApiPropertyOptional({ nullable: true })
  durationMs?: number | null;
}
