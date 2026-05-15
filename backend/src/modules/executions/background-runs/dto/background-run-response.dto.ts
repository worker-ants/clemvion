import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export type BackgroundRunStatus =
  | 'pending'
  | 'running'
  | 'completed'
  | 'failed'
  | 'cancelled';

export class BackgroundRunNodeExecutionDto {
  @ApiProperty({ description: 'NodeExecution UUID', format: 'uuid' })
  id: string;

  @ApiProperty({ description: '소속 Execution UUID', format: 'uuid' })
  executionId: string;

  @ApiProperty({ description: '노드 UUID', format: 'uuid' })
  nodeId: string;

  @ApiProperty({
    description: '부모 NodeExecution — Background 노드의 NodeExecution.id',
    format: 'uuid',
  })
  parentNodeExecutionId: string;

  @ApiProperty({
    description: 'NodeExecution 상태',
    enum: [
      'pending',
      'running',
      'completed',
      'failed',
      'skipped',
      'waiting_for_input',
    ],
  })
  status: string;

  @ApiProperty({ description: '실행 시작 시각 (ISO8601)' })
  startedAt: string;

  @ApiPropertyOptional({ description: '실행 종료 시각 (ISO8601)' })
  finishedAt: string | null;

  @ApiPropertyOptional({ description: '실행 소요 시간 (ms)' })
  durationMs: number | null;

  @ApiPropertyOptional({
    description: '입력 데이터 (JSON)',
    type: 'object',
    additionalProperties: true,
  })
  inputData: Record<string, unknown> | null;

  @ApiPropertyOptional({
    description: '출력 데이터 (JSON, NodeHandlerOutput shape)',
    type: 'object',
    additionalProperties: true,
  })
  outputData: Record<string, unknown> | null;

  @ApiPropertyOptional({
    description: '에러 정보',
    type: 'object',
    additionalProperties: true,
  })
  error: Record<string, unknown> | null;
}

export class BackgroundRunNodeExecutionsPageDto {
  @ApiProperty({
    description: '현재 페이지의 NodeExecution 목록',
    type: () => [BackgroundRunNodeExecutionDto],
  })
  data: BackgroundRunNodeExecutionDto[];

  @ApiPropertyOptional({
    description: '다음 페이지 cursor (opaque base64). 없으면 null.',
  })
  nextCursor: string | null;

  @ApiProperty({ description: '추가 페이지 존재 여부' })
  hasMore: boolean;
}

export class BackgroundRunNotificationDto {
  @ApiProperty({ description: 'Notification UUID', format: 'uuid' })
  id: string;

  @ApiProperty({
    description: '알림 타입',
    example: 'background_failure',
  })
  type: string;

  @ApiProperty({ description: '알림 제목' })
  title: string;

  @ApiProperty({ description: '알림 본문' })
  message: string;

  @ApiProperty({ description: '발송 채널 (in_app / email)' })
  channel: string;

  @ApiProperty({ description: '생성 시각 (ISO8601)' })
  createdAt: string;
}

export class BackgroundRunResponseDto {
  @ApiProperty({
    description: 'Background 본문 run 식별자 (UUID v4)',
    format: 'uuid',
  })
  backgroundRunId: string;

  @ApiProperty({ description: '메인 Execution UUID', format: 'uuid' })
  executionId: string;

  @ApiProperty({
    description: 'Background 노드 자체의 NodeExecution.id',
    format: 'uuid',
  })
  parentNodeExecutionId: string;

  @ApiProperty({
    description: 'Background 본문 집계 상태',
    enum: ['pending', 'running', 'completed', 'failed', 'cancelled'],
  })
  status: BackgroundRunStatus;

  @ApiProperty({ description: 'fork 시점 (ISO8601)' })
  startedAt: string;

  @ApiPropertyOptional({ description: '본문 종료 시점 (ISO8601)' })
  completedAt: string | null;

  @ApiPropertyOptional({
    description: '본문 실행 시간 (ms). 진행 중이면 null',
  })
  durationMs: number | null;

  @ApiProperty({
    description: '본문 노드들의 NodeExecution (cursor 페이지네이션)',
    type: () => BackgroundRunNodeExecutionsPageDto,
  })
  nodeExecutions: BackgroundRunNodeExecutionsPageDto;

  @ApiProperty({
    description:
      '본 backgroundRun 와 연관된 알림 (background_failure 등). 전체 반환.',
    type: () => [BackgroundRunNotificationDto],
  })
  notifications: BackgroundRunNotificationDto[];
}
