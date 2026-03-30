import { IsOptional, IsIn, IsUUID } from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination.dto';

export class QueryExecutionDto extends PaginationQueryDto {
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

  @IsOptional()
  @IsUUID()
  workflowId?: string;
}
