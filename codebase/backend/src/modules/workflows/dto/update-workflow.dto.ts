import {
  IsString,
  IsOptional,
  IsBoolean,
  IsArray,
  IsUUID,
  MaxLength,
  IsObject,
  ValidateNested,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { WorkflowSettingsDto } from './workflow-settings.dto';

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

  /**
   * 워크플로우 실행 설정 (검증 대상 키만 허용 — 현재 `maxConcurrentExecutions`).
   * 미지 키는 전역 pipe(whitelist+forbidNonWhitelisted)가 400 으로 거부한다.
   */
  @ApiPropertyOptional({
    type: () => WorkflowSettingsDto,
    description:
      '워크플로우 실행 설정. 현재 maxConcurrentExecutions(동시 실행 상한, §8)만 지원 — 미지 키는 거부(400).',
  })
  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => WorkflowSettingsDto)
  settings?: WorkflowSettingsDto;
}
