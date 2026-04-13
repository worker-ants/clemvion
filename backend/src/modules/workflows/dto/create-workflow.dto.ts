import {
  IsString,
  IsOptional,
  IsBoolean,
  IsArray,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateWorkflowDto {
  /** 워크플로우 표시 이름 (최대 255자) */
  @ApiProperty({
    description: '워크플로우 표시 이름',
    maxLength: 255,
    example: '신규 리드 처리 자동화',
  })
  @IsString()
  @MaxLength(255)
  name: string;

  /** 워크플로우 설명 (선택) */
  @ApiPropertyOptional({
    description: '워크플로우에 대한 설명',
    example: '신규 리드가 유입될 때 Slack 알림과 DB 저장을 수행합니다.',
  })
  @IsOptional()
  @IsString()
  description?: string;

  /** 활성화 여부 (기본 false). 활성화된 워크플로우만 스케줄/트리거 대상이 됩니다. */
  @ApiPropertyOptional({
    description: '활성화 여부 (true일 때 트리거/스케줄 대상)',
    default: false,
    example: false,
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  /** 태그 목록 (분류/검색용) */
  @ApiPropertyOptional({
    description: '태그 목록 (분류/검색용)',
    type: [String],
    example: ['sales', 'automation'],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  /** 포함될 폴더 ID (루트일 경우 null 또는 빈 문자열) */
  @ApiPropertyOptional({
    description: '배치할 폴더 UUID. 루트일 경우 null',
    format: 'uuid',
    nullable: true,
    example: '6f8a9b7c-1d2e-4f3a-9b8c-1234567890ab',
  })
  @IsOptional()
  @IsUUID()
  @Transform(({ value }: { value: unknown }) => (value === '' ? null : value))
  folderId?: string | null;
}
