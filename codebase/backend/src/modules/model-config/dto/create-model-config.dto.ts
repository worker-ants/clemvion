import {
  IsString,
  IsOptional,
  IsBoolean,
  IsIn,
  IsObject,
  IsInt,
  Min,
  MaxLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  MODEL_CONFIG_KINDS,
  type ModelConfigKind,
} from '../entities/model-config.entity';

// chat/embedding/rerank 전체 provider. kind 별 유효 provider 는 서비스에서 추가 검증 가능.
export const MODEL_PROVIDERS = [
  'openai',
  'anthropic',
  'google',
  'azure',
  'local',
  'tei',
  'cohere',
] as const;
export type ModelProvider = (typeof MODEL_PROVIDERS)[number];

export class CreateModelConfigDto {
  /** 모델 역할 (chat/embedding/rerank) */
  @ApiProperty({
    description: '모델 역할 판별자',
    enum: MODEL_CONFIG_KINDS,
    example: 'chat',
  })
  @IsIn(MODEL_CONFIG_KINDS as readonly string[])
  kind: ModelConfigKind;

  /** Provider 식별자 */
  @ApiProperty({
    description:
      'Provider 식별자. chat: openai/anthropic/google/azure/local, embedding: openai/azure/google/local, rerank: tei/cohere.',
    enum: MODEL_PROVIDERS,
    example: 'openai',
  })
  @IsIn(MODEL_PROVIDERS)
  provider: ModelProvider;

  @ApiProperty({
    description: '설정 표시 이름 (사용자 구분용)',
    example: 'GPT-4o Production',
    maxLength: 255,
  })
  @IsString()
  @MaxLength(255)
  name: string;

  /** API Key. 자가호스팅(local/tei) 은 선택, 그 외 필수. 저장 시 암호화. */
  @ApiPropertyOptional({
    description:
      'Provider API Key. 자가호스팅(local/tei)은 선택, 그 외 provider 는 필수. 저장 시 암호화되며 응답 시 마스킹됩니다.',
    example: 'sk-xxxxxxxxxxxxxxxx',
    maxLength: 500,
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  apiKey?: string;

  @ApiPropertyOptional({
    description:
      'Custom API Base URL. Azure/local/tei/프록시 환경에서 사용. local/tei 는 사설망 허용.',
    example: 'https://api.openai.com/v1',
    maxLength: 500,
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  baseUrl?: string;

  @ApiProperty({
    description: '기본으로 사용할 모델 ID',
    example: 'gpt-4o-mini',
    maxLength: 100,
  })
  @IsString()
  @MaxLength(100)
  defaultModel: string;

  /** 기본 호출 파라미터 (chat 전용) */
  @ApiPropertyOptional({
    description: 'chat 전용 기본 호출 파라미터 (temperature, maxTokens 등).',
    type: 'object',
    additionalProperties: true,
    example: { temperature: 0.7, maxTokens: 2000 },
  })
  @IsOptional()
  @IsObject()
  defaultParams?: Record<string, unknown>;

  /** 임베딩 벡터 차원 (embedding 전용) */
  @ApiPropertyOptional({
    description:
      'embedding 전용 벡터 차원 (예: 1536). pgvector 차원과 결합되는 SoT.',
    example: 1536,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  dimension?: number;

  @ApiPropertyOptional({
    description:
      'kind 별 워크스페이스 기본 설정 여부. true 시 동일 kind 의 기존 기본은 해제됩니다.',
    example: false,
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}
