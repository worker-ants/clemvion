import { ApiProperty } from '@nestjs/swagger';
import { ExecutionStatus } from '../../../executions/entities/execution.entity';
import {
  EXECUTION_TRIGGER_SOURCES,
  type ExecutionTriggerSource,
} from '../../../executions/utils';

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

  @ApiProperty({ type: Number, nullable: true, example: 35.29 })
  runs7dChangePercent: number | null;

  @ApiProperty({ example: 92.75 })
  successRate: number;

  /** 최근 7일 평균 전체 경과(ms). 입력 대기를 뺀 실행 시간(`activeRunningMs`) 평균이 아니다. */
  @ApiProperty({
    example: 1820,
    description:
      '최근 7일 평균 전체 경과(ms). 완료(completed) 실행의 duration_ms 평균을 정수로 반올림한다. 실행이 없으면 0',
  })
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

  /**
   * 실행 상태. 실행 행의 값을 그대로 싣는다. enum 은 실행 응답(`ExecutionDto.status`)과 같은
   * `ExecutionStatus` 스키마를 쓴다. 손으로 적은 목록은 `waiting_for_input` 이 빠진 채 갈렸다.
   */
  @ApiProperty({
    enum: ExecutionStatus,
    enumName: 'ExecutionStatus',
    example: ExecutionStatus.COMPLETED,
  })
  status: ExecutionStatus;

  /** 전체 경과(ms). 입력 대기 시간이 들어간다. 끝나지 않았으면 null */
  @ApiProperty({ type: Number, nullable: true, example: 1540 })
  durationMs: number | null;

  /**
   * 실행 시간(ms). 입력 대기를 뺀 순수 실행 시간이다. 끝나지 않았거나 측정되지 않은
   * 실행은 null 이다. 판정 규칙은 실행 응답(`ExecutionDto.activeRunningMs`)과 같다.
   */
  @ApiProperty({ type: Number, nullable: true, example: 1320 })
  activeRunningMs: number | null;

  @ApiProperty({ format: 'date-time' })
  startedAt: string;

  /**
   * 실행 출처 분류. 자세한 판정 규칙은 {@link ExecutionTriggerSource} 참조.
   */
  @ApiProperty({ enum: EXECUTION_TRIGGER_SOURCES, example: 'manual' })
  triggerSource: ExecutionTriggerSource;

  /** 출처 보조 라벨 (트리거명/실행자명/부모 워크플로명). 정보가 없으면 null */
  @ApiProperty({ nullable: true, type: String, example: 'Alice' })
  triggerLabel: string | null;
}
