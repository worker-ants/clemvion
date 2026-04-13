import { IsOptional, IsString, IsBoolean } from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { PaginationQueryDto } from '../../../common/dto/pagination.dto';

export class QueryNotificationDto extends PaginationQueryDto {
  /** 알림 타입 필터 */
  @ApiPropertyOptional({
    description: '알림 타입 필터 (예: execution_failed, workflow_shared 등)',
    example: 'execution_failed',
  })
  @IsOptional()
  @IsString()
  type?: string;

  /** 읽음 여부 필터 */
  @ApiPropertyOptional({
    description: '읽음 여부 필터. true/false 문자열 또는 불리언',
    example: false,
  })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  isRead?: boolean;
}
