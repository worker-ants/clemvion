import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsObject, IsOptional } from 'class-validator';

/**
 * `POST /executions/:id/re-run` 요청 본문
 * (spec/5-system/13-replay-rerun.md §8.1).
 */
export class ReRunRequestDto {
  @ApiPropertyOptional({
    description:
      '원본 입력을 그대로 사용할지 (true) 또는 inputOverride 사용 (false). 기본 true',
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  useOriginalInput?: boolean;

  @ApiPropertyOptional({
    description:
      'useOriginalInput=false 일 때 사용할 입력. Manual Trigger parameters 스키마와 호환 (resolveTriggerParameters 검증)',
    type: Object,
  })
  @IsOptional()
  @IsObject()
  inputOverride?: Record<string, unknown>;

  @ApiPropertyOptional({
    description:
      'dry-run 모드 실행 여부. 기본 false (v1 미지원 — RERUN_DRY_RUN_NOT_APPLICABLE)',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  dryRun?: boolean;
}
