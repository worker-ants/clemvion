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
  @ApiProperty({ enum: RULE_TYPES })
  @IsEnum(RULE_TYPES)
  type: (typeof RULE_TYPES)[number];

  @ApiProperty({ description: '실패율 % / 평균 duration ms / LLM 비용 USD' })
  @IsNumber()
  @Min(0)
  threshold: number;

  @ApiPropertyOptional({ description: 'ISO 8601 duration', example: 'PT1H' })
  @IsOptional()
  @IsString()
  window?: string;

  @ApiPropertyOptional({ enum: CHANNELS, default: 'in_app' })
  @IsOptional()
  @IsEnum(CHANNELS)
  channel?: (typeof CHANNELS)[number];

  @ApiPropertyOptional({
    description: '특정 워크플로우만 모니터링하려면 ID 지정',
  })
  @IsOptional()
  @IsUUID()
  workflowId?: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;
}

export class UpdateAlertRuleDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  threshold?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  window?: string;

  @ApiPropertyOptional({ enum: CHANNELS })
  @IsOptional()
  @IsEnum(CHANNELS)
  channel?: (typeof CHANNELS)[number];

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;
}
