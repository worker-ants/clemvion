import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';

const RULE_TYPES = ['failure_rate', 'duration', 'llm_cost'] as const;
const CHANNELS = ['in_app', 'email'] as const;

export class CreateAlertRuleDto {
  /** 알림 규칙 타입 (failure_rate: 실패율, duration: 평균 실행 시간, llm_cost: LLM 비용) */
  @ApiProperty({
    description:
      '알림 규칙 타입. failure_rate: 실패율(%) / duration: 평균 실행 시간(ms) / llm_cost: 누적 LLM 비용(USD).',
    enum: RULE_TYPES,
    example: 'failure_rate',
  })
  @IsEnum(RULE_TYPES)
  type: (typeof RULE_TYPES)[number];

  /** 트리거 임계값 — type 에 따라 단위가 달라집니다 */
  @ApiProperty({
    description: '실패율 % / 평균 duration ms / LLM 비용 USD',
    example: 10,
    minimum: 0,
  })
  @IsNumber()
  @Min(0)
  threshold: number;

  /** 임계값을 평가할 시간 윈도우 (ISO 8601 duration) */
  @ApiPropertyOptional({
    description:
      '임계값을 평가할 시간 윈도우 (ISO 8601 duration). 지정하지 않으면 모듈 기본값을 사용합니다.',
    example: 'PT1H',
  })
  @IsOptional()
  @IsString()
  window?: string;

  /** 알림 전송 채널 (기본 in_app) */
  @ApiPropertyOptional({
    description: '알림 전송 채널. 기본값 in_app.',
    enum: CHANNELS,
    default: 'in_app',
    example: 'in_app',
  })
  @IsOptional()
  @IsEnum(CHANNELS)
  channel?: (typeof CHANNELS)[number];

  /** 감시 대상 워크플로우 ID — 지정하지 않으면 워크스페이스 전체 */
  @ApiPropertyOptional({
    description:
      '특정 워크플로우만 모니터링하려면 ID 지정. 미지정 시 워크스페이스 전체를 대상으로 합니다.',
    format: 'uuid',
  })
  @IsOptional()
  @IsUUID()
  workflowId?: string;

  /** 활성화 여부 (기본 true) */
  @ApiPropertyOptional({
    description: '활성화 여부. true 일 때 감시·알림이 수행됩니다.',
    default: true,
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;
}

export class UpdateAlertRuleDto {
  /** 트리거 임계값 */
  @ApiPropertyOptional({
    description: '트리거 임계값 — 해당 규칙 type 에 따라 단위가 달라집니다.',
    example: 15,
    minimum: 0,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  threshold?: number;

  /** 임계값을 평가할 시간 윈도우 (ISO 8601 duration) */
  @ApiPropertyOptional({
    description: '임계값을 평가할 시간 윈도우 (ISO 8601 duration).',
    example: 'PT30M',
  })
  @IsOptional()
  @IsString()
  window?: string;

  /** 알림 전송 채널 */
  @ApiPropertyOptional({
    description: '알림 전송 채널.',
    enum: CHANNELS,
    example: 'email',
  })
  @IsOptional()
  @IsEnum(CHANNELS)
  channel?: (typeof CHANNELS)[number];

  /** 활성화 여부 */
  @ApiPropertyOptional({
    description: '활성화 여부.',
    example: false,
  })
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;
}
