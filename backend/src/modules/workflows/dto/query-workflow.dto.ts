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

  /**
   * 소유 기반 필터 (팀 워크스페이스에서만 의미가 있음).
   * - `mine`: `createdBy = 현재 사용자`
   * - `shared`: `createdBy != 현재 사용자` (= 다른 멤버가 만든 워크플로)
   * - `all` (default, 또는 미지정): 추가 조건 없음
   *
   * 개인 워크스페이스에서는 서버가 ownership 을 무시한다 (= `all` 처럼 동작).
   * spec/2-navigation/1-workflow-list.md §2.3, §3
   */
  @ApiPropertyOptional({
    description:
      '소유 필터 (팀 워크스페이스 전용). mine=내 워크플로, shared=다른 멤버 워크플로, all=전체.',
    enum: ['mine', 'shared', 'all'],
    example: 'all',
  })
  @IsOptional()
  @IsIn(['mine', 'shared', 'all'])
  ownership?: 'mine' | 'shared' | 'all';
}
