import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  EXECUTION_STATUS_VALUES,
  type ExecutionStatusLiteral,
} from './execution-status.literal';

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
    enum: [...EXECUTION_STATUS_VALUES],
    description:
      '명령 수신 직후 관측된 execution status. 즉시 다른 상태로 전이될 수 있으므로 SSE 스트림으로 확정 상태를 받는 것을 권장.',
  })
  currentStatus?: ExecutionStatusLiteral;
}
