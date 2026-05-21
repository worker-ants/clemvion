import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * `POST /api/external/executions/:id/interact` / `/cancel` 의 ack body.
 *
 * [Spec EIA §5.1 / §5.4]. 명령 수신 직후의 동기 응답 — 실제 노드 진행은 비동기.
 * `currentStatus` 는 명령 직후 본 endpoint 가 관측한 최근 상태.
 */
export class InteractAckDto {
  @ApiProperty({ format: 'uuid' })
  executionId: string;

  @ApiProperty({ example: true, description: '명령이 큐에 적재됨' })
  accepted: boolean;

  @ApiPropertyOptional({
    enum: [
      'pending',
      'running',
      'waiting_for_input',
      'completed',
      'failed',
      'cancelled',
    ],
    description:
      '명령 수신 직후 관측된 execution status. 즉시 다른 상태로 전이될 수 있으므로 SSE 스트림으로 확정 상태를 받는 것을 권장.',
  })
  currentStatus?:
    | 'pending'
    | 'running'
    | 'waiting_for_input'
    | 'completed'
    | 'failed'
    | 'cancelled';
}

/**
 * `POST /api/external/executions/:id/refresh-token` 응답. [Spec EIA §5.5].
 */
export class RefreshTokenResponseDto {
  @ApiProperty({
    description: 'iext_ prefixed JWT (단명, default 1h).',
    example: 'iext_eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
  })
  token: string;

  @ApiProperty({
    description: 'ISO 8601 만료 시각.',
    example: '2026-05-21T01:00:00.000Z',
  })
  expiresAt: string;
}

/**
 * `GET /api/external/executions/:id` 단발 상태 조회 응답. [Spec EIA §5.3].
 *
 * `context` 의 sub-config 는 노드 종류에 따라 0~1개만 동봉. 클라이언트는 `currentNode.interactionType`
 * 으로 분기.
 */
export class ExecutionStatusDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ format: 'uuid' })
  workflowId: string;

  @ApiProperty({
    enum: [
      'pending',
      'running',
      'waiting_for_input',
      'completed',
      'failed',
      'cancelled',
    ],
  })
  status:
    | 'pending'
    | 'running'
    | 'waiting_for_input'
    | 'completed'
    | 'failed'
    | 'cancelled';

  @ApiPropertyOptional({
    description: 'waiting_for_input 상태에서만. 현재 입력 대기 중인 노드.',
    type: 'object',
    additionalProperties: true,
  })
  currentNode?: {
    id: string;
    type: string;
    interactionType: 'form' | 'buttons' | 'ai_conversation' | null;
  } | null;

  @ApiPropertyOptional({
    description:
      'waiting_for_input 상태의 form/button/conversation config + conversationThread snapshot.',
    type: 'object',
    additionalProperties: true,
  })
  context?: Record<string, unknown> | null;

  @ApiPropertyOptional({
    description: 'completed 시점의 최종 결과 envelope.',
    type: 'object',
    additionalProperties: true,
  })
  result?: Record<string, unknown> | null;

  @ApiPropertyOptional({
    description: 'failed 시점의 에러 envelope.',
    type: 'object',
    additionalProperties: true,
  })
  error?: Record<string, unknown> | null;

  @ApiProperty({
    description:
      '본 execution 의 WS event monotonic seq 최신값. 클라이언트가 SSE 재연결 시 사용.',
    example: 42,
  })
  seq: number;

  @ApiProperty({ format: 'date-time' })
  updatedAt: string;
}
