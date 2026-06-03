import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/** 실행 통계 요약 */
export class StatisticsSummaryDto {
  @ApiProperty({ example: 230 })
  totalExecutions: number;

  @ApiProperty({ example: 210 })
  successCount: number;

  @ApiProperty({ example: 15 })
  failedCount: number;

  @ApiProperty({ example: 5 })
  cancelledCount: number;

  @ApiProperty({ example: 91.3 })
  successRate: number;

  @ApiProperty({ example: 1320 })
  avgDurationMs: number;
}

/** 일자별 실행 집계 */
export class ExecutionPeriodItemDto {
  @ApiProperty({ example: '2026-04-10' })
  date: string;

  @ApiProperty({ example: 32 })
  total: number;

  @ApiProperty({ example: 30 })
  completed: number;

  @ApiProperty({ example: 1 })
  failed: number;

  @ApiProperty({ example: 1 })
  cancelled: number;
}

/** 오류 집계 */
export class ErrorAggregationDto {
  @ApiProperty({ format: 'uuid' })
  workflowId: string;

  @ApiProperty({ example: '데이터 동기화' })
  workflowName: string;

  @ApiProperty({ example: 7 })
  errorCount: number;

  @ApiProperty({ format: 'date-time' })
  lastErrorAt: string;
}

/** 상위 워크플로우 */
export class TopWorkflowDto {
  @ApiProperty({ format: 'uuid' })
  workflowId: string;

  @ApiProperty({ example: '이메일 알림 플로우' })
  workflowName: string;

  @ApiProperty({ example: 85 })
  executionCount: number;

  @ApiProperty({ example: 97.65 })
  successRate: number;

  @ApiProperty({ example: 980 })
  avgDurationMs: number;
}

/** 노드별 실행 통계 */
export class NodeStatDto {
  @ApiProperty({ format: 'uuid' })
  nodeId: string;

  @ApiProperty({ example: 'HTTP 요청' })
  nodeLabel: string;

  @ApiProperty({ example: 'http-request' })
  nodeType: string;

  @ApiProperty({ example: 120 })
  executionCount: number;

  @ApiProperty({ example: 420 })
  avgDurationMs: number;

  @ApiProperty({ example: 1.67 })
  errorRate: number;
}

/** LLM 사용량 모델별 집계 */
export class LlmUsageByModelDto {
  @ApiProperty({ example: 'openai' })
  provider: string;

  @ApiProperty({ example: 'gpt-4o-mini' })
  model: string;

  @ApiProperty()
  promptTokens: number;

  @ApiProperty()
  completionTokens: number;

  @ApiProperty()
  totalTokens: number;

  @ApiPropertyOptional({ nullable: true })
  costUsd?: number | null;
}

export class LlmUsageSummaryDto {
  @ApiProperty({ type: [LlmUsageByModelDto] })
  byModel: LlmUsageByModelDto[];

  @ApiProperty({ description: '전체 input(prompt) 토큰 합계' })
  totalPromptTokens: number;

  @ApiProperty({ description: '전체 output(completion) 토큰 합계' })
  totalCompletionTokens: number;

  @ApiProperty()
  totalTokens: number;

  @ApiPropertyOptional({ nullable: true })
  totalCostUsd?: number | null;

  @ApiPropertyOptional({
    nullable: true,
    description: '토큰 사용량 최다 프로바이더명 (사용량 0 이면 null)',
  })
  topProvider?: string | null;
}

/** 일자별 LLM 사용량 */
export class LlmUsageTimeseriesItemDto {
  @ApiProperty({ example: '2026-04-10' })
  date: string;

  @ApiProperty({ example: 'openai' })
  provider: string;

  @ApiProperty()
  totalTokens: number;

  @ApiPropertyOptional({ nullable: true })
  costUsd?: number | null;
}

export class LlmUsageTimeseriesDto {
  @ApiProperty({ type: [LlmUsageTimeseriesItemDto] })
  items: LlmUsageTimeseriesItemDto[];
}
