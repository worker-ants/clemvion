import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/** 폴더 응답 DTO */
export class FolderDto {
  /** 폴더 UUID */
  @ApiProperty({ format: 'uuid' })
  id: string;

  /** 소속 워크스페이스 UUID */
  @ApiProperty({ format: 'uuid' })
  workspaceId: string;

  /** 폴더 이름 */
  @ApiProperty({ example: '마케팅' })
  name: string;

  /** 부모 폴더 UUID (루트면 null) */
  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  parentId?: string | null;

  /** 같은 레벨에서의 정렬 순서 */
  @ApiProperty({ example: 0 })
  sortOrder: number;

  /** 생성 시각 */
  @ApiProperty({ format: 'date-time' })
  createdAt: string;

  /** 수정 시각 */
  @ApiProperty({ format: 'date-time' })
  updatedAt: string;
}
