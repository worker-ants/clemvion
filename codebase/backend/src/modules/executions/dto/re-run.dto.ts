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
      'dry-run 모드로 실행할지. true 면 HTTP Request/Send Email/Database Query/Cafe24 같은 외부 부수효과 노드는 실제 호출 대신 mock 출력(_dryRun: true)을 반환. 기본 false (spec/5-system/13-replay-rerun.md §7·§8.1)',
    default: false,
    example: false,
  })
  @IsOptional()
  @IsBoolean()
  dryRun?: boolean;
}
