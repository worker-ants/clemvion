import { IsOptional, IsString, IsIn, IsUUID } from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { PaginationQueryDto } from '../../../common/dto/pagination.dto';

export class QueryWorkflowDto extends PaginationQueryDto {
  /** 상태 필터 (active: 활성, inactive: 비활성) */
  @ApiPropertyOptional({
    description: '활성 상태 필터',
    enum: ['active', 'inactive'],
    example: 'active',
  })
  @IsOptional()
  @IsIn(['active', 'inactive'])
  status?: string;

  /** 태그 단일 필터 (tags 배열에 포함된 항목만 조회) */
  @ApiPropertyOptional({
    description: '태그 필터 (tags 배열에 해당 값이 포함된 항목)',
    example: 'sales',
  })
  @IsOptional()
  @IsString()
  tag?: string;

  /** 폴더 단일 필터. 빈 문자열일 경우 루트 폴더로 간주 */
  @ApiPropertyOptional({
    description: '폴더 UUID 필터',
    format: 'uuid',
    nullable: true,
  })
  @IsOptional()
  @IsUUID()
  @Transform(({ value }: { value: unknown }) => (value === '' ? null : value))
  folderId?: string | null;
}
