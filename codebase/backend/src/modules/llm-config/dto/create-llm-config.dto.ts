import {
  IsString,
  IsOptional,
  IsBoolean,
  IsIn,
  IsObject,
  IsNotEmpty,
  MaxLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export const LLM_PROVIDERS = [
  'openai',
  'anthropic',
  'google',
  'azure',
  'local',
] as const;
export type LlmProvider = (typeof LLM_PROVIDERS)[number];

export class CreateLlmConfigDto {
  /** LLM Provider 식별자 */
  @ApiProperty({
    description:
      'LLM Provider 식별자. openai/anthropic/google/azure/local 중 선택.',
    enum: LLM_PROVIDERS,
    example: 'openai',
  })
  @IsIn(LLM_PROVIDERS)
  provider: LlmProvider;

  /** LLM 설정 표시 이름 */
  @ApiProperty({
    description: 'LLM 설정 표시 이름 (사용자 구분용)',
    example: 'GPT-4o Production',
    maxLength: 255,
  })
  @IsString()
  @MaxLength(255)
  name: string;

  /** API Key. 저장 시 암호화되며 응답 시 마스킹됩니다. */
  @ApiProperty({
    description: 'Provider API Key. 저장 시 암호화되며 응답 시 마스킹됩니다.',
    example: 'sk-xxxxxxxxxxxxxxxx',
    maxLength: 500,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  apiKey: string;

  /** Custom base URL (Azure, local, 프록시 등 사용 시) */
  @ApiPropertyOptional({
    description:
      'Custom API Base URL. Azure/local/프록시 환경에서 기본 엔드포인트를 오버라이드할 때 사용.',
    example: 'https://api.openai.com/v1',
    maxLength: 500,
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  baseUrl?: string;

  /** 기본 모델명 */
  @ApiProperty({
    description: '기본으로 사용할 모델명',
    example: 'gpt-4o-mini',
    maxLength: 100,
  })
  @IsString()
  @MaxLength(100)
  defaultModel: string;

  /** 기본 파라미터 (temperature, maxTokens 등) */
  @ApiPropertyOptional({
    description:
      '기본 호출 파라미터. temperature, maxTokens, topP 등을 지정할 수 있습니다.',
    type: 'object',
    additionalProperties: true,
    example: { temperature: 0.7, maxTokens: 2000 },
  })
  @IsOptional()
  @IsObject()
  defaultParams?: Record<string, unknown>;

  /** 워크스페이스 기본 LLM 설정 여부 */
  @ApiPropertyOptional({
    description:
      '워크스페이스 기본 LLM 여부. true로 설정 시 기존 기본 설정은 해제됩니다.',
    example: false,
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}
