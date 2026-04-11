import { IsOptional, IsString, IsIn } from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination.dto';

export class QueryTriggerDto extends PaginationQueryDto {
  @IsOptional()
  @IsIn(['webhook', 'schedule', 'manual'])
  type?: string;

  @IsOptional()
  @IsIn(['active', 'inactive'])
  status?: string;
}
