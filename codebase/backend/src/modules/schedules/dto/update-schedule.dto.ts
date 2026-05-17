import {
  IsString,
  IsOptional,
  IsBoolean,
  IsObject,
  MaxLength,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateScheduleDto {
  /** 스케줄 이름 */
  @ApiPropertyOptional({
    description: '스케줄 이름 (연결된 트리거 이름도 동기화)',
    maxLength: 255,
    example: '매일 오전 9시 리포트',
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  name?: string;

  /** 변경할 Cron 식 */
  @ApiPropertyOptional({
    description: '변경할 cron 식. 변경 시 nextRunAt이 재계산됨',
    maxLength: 100,
    example: '0 */2 * * *',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  cronExpression?: string;

  /** 변경할 타임존 (IANA) */
  @ApiPropertyOptional({
    description: '변경할 타임존. 변경 시 nextRunAt이 재계산됨',
    maxLength: 100,
    example: 'UTC',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  timezone?: string;

  /** 활성화 여부 */
  @ApiPropertyOptional({
    description:
      '활성화 여부. false로 설정 시 BullMQ 반복 작업이 제거되고 트리거도 비활성화됩니다.',
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  /** 실행 시 전달할 파라미터 값 */
  @ApiPropertyOptional({
    description: '실행 시 워크플로우에 전달할 파라미터 값',
    type: 'object',
    additionalProperties: true,
    example: { region: 'kr' },
  })
  @IsOptional()
  @IsObject()
  parameterValues?: Record<string, unknown>;
}
