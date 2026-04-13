import { IsOptional, IsIn, IsUUID } from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { PaginationQueryDto } from '../../../common/dto/pagination.dto';

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

  /** 특정 워크플로우로 필터링 (UUID) */
  @ApiPropertyOptional({
    description: '특정 워크플로우 ID로 필터링',
    format: 'uuid',
    example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  })
  @IsOptional()
  @IsUUID()
  @Transform(({ value }: { value: unknown }) => (value === '' ? null : value))
  workflowId?: string | null;
}
