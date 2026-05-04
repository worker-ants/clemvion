import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  EXECUTION_TRIGGER_SOURCES,
  type ExecutionTriggerSource,
} from '../../../executions/utils/execution-trigger';

/** 대시보드 요약 지표 */
export class DashboardSummaryDto {
  @ApiProperty({ example: 12 })
  totalWorkflows: number;

  @ApiProperty({ example: 7 })
  activeWorkflows: number;

  @ApiProperty({ example: 138 })
  runs7d: number;

  @ApiProperty({ example: 102 })
  runs7dPrevious: number;

  @ApiPropertyOptional({ nullable: true, example: 35.29 })
  runs7dChangePercent?: number | null;

  @ApiProperty({ example: 92.75 })
  successRate: number;

  /** 평균 실행 시간(ms) */
  @ApiProperty({ example: 1820 })
  avgExecutionTime: number;
}

/** 최근 갱신 워크플로우 아이템 */
export class RecentWorkflowDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ example: '메일 자동화 워크플로우' })
  name: string;

  @ApiProperty()
  isActive: boolean;

  @ApiProperty({ format: 'date-time' })
  updatedAt: string;
}

/** 최근 실행 이력 아이템 */
export class RecentExecutionDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ format: 'uuid' })
  workflowId: string;

  @ApiProperty({ example: '이메일 알림 플로우' })
  workflowName: string;

  @ApiProperty({
    enum: ['pending', 'running', 'completed', 'failed', 'cancelled'],
    example: 'completed',
  })
  status: string;

  @ApiPropertyOptional({ nullable: true, example: 1540 })
  durationMs?: number | null;

  @ApiProperty({ format: 'date-time' })
  startedAt: string;

  /**
   * 실행 출처 분류. 분류 규칙은
   * `backend/src/modules/executions/utils/execution-trigger.ts` 참조.
   */
  @ApiProperty({ enum: EXECUTION_TRIGGER_SOURCES, example: 'manual' })
  triggerSource: ExecutionTriggerSource;

  /** 출처 보조 라벨 (트리거명/실행자명/부모 워크플로명) */
  @ApiPropertyOptional({ nullable: true, example: 'Alice' })
  triggerLabel?: string | null;
}
