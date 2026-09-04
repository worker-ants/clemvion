import { IsOptional, IsIn } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { PaginationQueryDto } from '../../../common/dto/pagination.dto';

/**
 * `GET /api/executions/workflow/:workflowId` 의 쿼리.
 *
 * > **`workflowId` 쿼리 파라미터를 제거했다 (2026-09-04).** 이 엔드포인트는 **경로가 이미
 * > 하나의 워크플로우로 한정**하므로 쿼리 레벨 워크플로우 필터는 개념적으로 성립하지
 * > 않는다(같으면 no-op, 다르면 항상 빈 결과). 실제로 `findByWorkflow` 는 그 값을 읽은
 * > 적이 없고, spec(`2-navigation/14-execution-history.md:345`)도 "페이지네이션, 상태 필터,
 * > 정렬" 만 약속한다. 그런데 `@IsUUID()` 가 붙어 있어 **읽지도 않는 값 때문에 400 을
 * > 내던** 자리였다 — 무시되는 것이 아니라 거절했다.
 */
export class QueryExecutionDto extends PaginationQueryDto {
  /** 실행 상태로 필터링 */
  @ApiPropertyOptional({
    description: '실행 상태 필터',
    enum: [
      'pending',
      'running',
      'completed',
      'failed',
      'cancelled',
      'waiting_for_input',
    ],
    example: 'completed',
  })
  @IsOptional()
  @IsIn([
    'pending',
    'running',
    'completed',
    'failed',
    'cancelled',
    'waiting_for_input',
  ])
  status?: string;
}
