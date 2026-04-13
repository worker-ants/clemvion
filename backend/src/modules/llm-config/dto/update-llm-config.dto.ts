import {
  IsString,
  IsOptional,
  IsBoolean,
  IsIn,
  IsObject,
  MaxLength,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { LLM_PROVIDERS } from './create-llm-config.dto';
import type { LlmProvider } from './create-llm-config.dto';

export class UpdateLlmConfigDto {
  /** 변경할 LLM Provider */
  @ApiPropertyOptional({
    description: '변경할 LLM Provider',
    enum: LLM_PROVIDERS,
  })
  @IsOptional()
  @IsIn(LLM_PROVIDERS as unknown as string[])
  provider?: LlmProvider;

  /** 변경할 표시 이름 */
  @ApiPropertyOptional({
    description: '변경할 LLM 설정 표시 이름',
    example: 'GPT-4o (renamed)',
    maxLength: 255,
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  name?: string;

  /** 변경할 API Key. 미전달 시 기존 키 유지. */
  @ApiPropertyOptional({
    description:
      '변경할 API Key. 값이 없으면 기존 키를 유지합니다. 저장 시 암호화됩니다.',
    maxLength: 500,
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  apiKey?: string;

  /** 변경할 Base URL */
  @ApiPropertyOptional({
    description: '변경할 API Base URL',
    maxLength: 500,
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  baseUrl?: string;

  /** 변경할 기본 모델명 */
  @ApiPropertyOptional({
    description: '변경할 기본 모델명',
    example: 'gpt-4o',
    maxLength: 100,
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  defaultModel?: string;

  /** 변경할 기본 파라미터 */
  @ApiPropertyOptional({
    description: '변경할 기본 호출 파라미터',
    type: 'object',
    additionalProperties: true,
    example: { temperature: 0.2 },
  })
  @IsOptional()
  @IsObject()
  defaultParams?: Record<string, unknown>;

  /** 기본 LLM 설정 여부 */
  @ApiPropertyOptional({
    description: '기본 LLM 설정 여부',
  })
  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}
