import {
  IsString,
  IsOptional,
  IsBoolean,
  IsArray,
  IsUUID,
  MaxLength,
  IsObject,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateWorkflowDto {
  /** 변경할 워크플로우 이름 (최대 255자) */
  @ApiPropertyOptional({
    description: '변경할 워크플로우 이름',
    maxLength: 255,
    example: '리드 처리 자동화 v2',
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  name?: string;

  /** 변경할 설명 */
  @ApiPropertyOptional({
    description: '변경할 워크플로우 설명',
    example: '설명을 갱신합니다.',
  })
  @IsOptional()
  @IsString()
  description?: string;

  /** 활성화 여부 */
  @ApiPropertyOptional({
    description: '활성화 여부',
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  /** 태그 목록 (분류/검색용) */
  @ApiPropertyOptional({
    description: '태그 목록',
    type: [String],
    example: ['sales', 'v2'],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  /** 이동할 폴더 UUID (루트일 경우 null 또는 빈 문자열) */
  @ApiPropertyOptional({
    description: '이동할 폴더 UUID. 루트로 이동 시 null',
    format: 'uuid',
    nullable: true,
  })
  @IsOptional()
  @IsUUID()
  @Transform(({ value }: { value: unknown }) => (value === '' ? null : value))
  folderId?: string | null;

  /** 워크플로우 실행/UI 관련 설정 객체 */
  @ApiPropertyOptional({
    description: '워크플로우 설정 객체 (실행/UI 관련 임의 속성)',
    type: 'object',
    additionalProperties: true,
    example: { timeoutMs: 30000, retryCount: 3 },
  })
  @IsOptional()
  @IsObject()
  settings?: Record<string, unknown>;
}
