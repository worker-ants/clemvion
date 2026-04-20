import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/** LLM 설정 응답 DTO. apiKey 는 마스킹된 상태로 반환됩니다. */
export class LlmConfigDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ format: 'uuid' })
  workspaceId: string;

  @ApiProperty({
    enum: ['openai', 'anthropic', 'google', 'azure', 'local'],
    example: 'openai',
  })
  provider: string;

  @ApiProperty({ example: 'GPT-4o Production' })
  name: string;

  /** 마스킹된 API Key (예: sk-****abcd) */
  @ApiProperty({ example: 'sk-****abcd' })
  apiKey: string;

  @ApiPropertyOptional({ nullable: true })
  baseUrl?: string | null;

  @ApiProperty({ example: 'gpt-4o-mini' })
  defaultModel: string;

  @ApiPropertyOptional({ type: 'object', additionalProperties: true })
  defaultParams?: Record<string, unknown>;

  @ApiProperty()
  isDefault: boolean;

  @ApiProperty({ format: 'date-time' })
  createdAt: string;

  @ApiProperty({ format: 'date-time' })
  updatedAt: string;
}

/** 연결 테스트 결과 */
export class LlmTestConnectionResultDto {
  @ApiProperty()
  success: boolean;

  @ApiPropertyOptional()
  latencyMs?: number;

  @ApiPropertyOptional({ nullable: true })
  message?: string | null;
}

/** 모델 목록 */
export class LlmModelItemDto {
  @ApiProperty({ example: 'gpt-4o-mini' })
  id: string;

  @ApiPropertyOptional()
  name?: string;

  @ApiPropertyOptional({ type: 'object', additionalProperties: true })
  meta?: Record<string, unknown>;
}

export class LlmModelListDto {
  @ApiProperty({ type: [LlmModelItemDto] })
  models: LlmModelItemDto[];
}
