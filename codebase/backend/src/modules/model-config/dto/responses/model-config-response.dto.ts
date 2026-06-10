import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { MODEL_CONFIG_KINDS } from '../../entities/model-config.entity';

/** ModelConfig 응답 DTO. apiKey 는 마스킹(또는 null)된 상태로 반환됩니다. */
export class ModelConfigDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ format: 'uuid' })
  workspaceId: string;

  @ApiProperty({ enum: MODEL_CONFIG_KINDS, example: 'chat' })
  kind: string;

  @ApiProperty({ example: 'openai' })
  provider: string;

  @ApiProperty({ example: 'GPT-4o Production' })
  name: string;

  /** 마스킹된 API Key (예: sk-****abcd). 자가호스팅 키 미설정 시 null. */
  @ApiPropertyOptional({ nullable: true, example: 'sk-****abcd' })
  apiKey?: string | null;

  @ApiPropertyOptional({ nullable: true })
  baseUrl?: string | null;

  @ApiProperty({ example: 'gpt-4o-mini' })
  defaultModel: string;

  @ApiPropertyOptional({ type: 'object', additionalProperties: true })
  defaultParams?: Record<string, unknown>;

  @ApiPropertyOptional({ nullable: true, example: 1536 })
  dimension?: number | null;

  @ApiProperty()
  isDefault: boolean;

  @ApiProperty({ format: 'date-time' })
  createdAt: string;

  @ApiProperty({ format: 'date-time' })
  updatedAt: string;
}

/** 연결 테스트 결과 */
export class ModelTestConnectionResultDto {
  @ApiProperty()
  success: boolean;

  @ApiPropertyOptional()
  latencyMs?: number;

  @ApiPropertyOptional({ nullable: true })
  message?: string | null;
}

/** 모델 목록 항목 */
export class ModelItemDto {
  @ApiProperty({ example: 'gpt-4o-mini' })
  id: string;

  @ApiPropertyOptional()
  name?: string;

  @ApiPropertyOptional({ type: 'object', additionalProperties: true })
  meta?: Record<string, unknown>;
}

export class ModelListDto {
  @ApiProperty({ type: [ModelItemDto] })
  models: ModelItemDto[];
}
