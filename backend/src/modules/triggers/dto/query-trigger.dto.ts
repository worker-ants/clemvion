import { IsOptional, IsIn } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { PaginationQueryDto } from '../../../common/dto/pagination.dto';

export class QueryTriggerDto extends PaginationQueryDto {
  /** 트리거 타입 필터 */
  @ApiPropertyOptional({
    description: '트리거 타입 필터',
    enum: ['webhook', 'schedule', 'manual'],
    example: 'webhook',
  })
  @IsOptional()
  @IsIn(['webhook', 'schedule', 'manual'])
  type?: string;

  /** 활성화 상태 필터 */
  @ApiPropertyOptional({
    description: '활성화 상태 필터',
    enum: ['active', 'inactive'],
    example: 'active',
  })
  @IsOptional()
  @IsIn(['active', 'inactive'])
  status?: string;
}
