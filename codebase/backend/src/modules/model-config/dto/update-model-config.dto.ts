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
import { ApiPropertyOptional } from '@nestjs/swagger';
import { MODEL_PROVIDERS, type ModelProvider } from './create-model-config.dto';

// kind 는 생성 시 확정되며 수정 불가 (역할 변경은 재생성).
export class UpdateModelConfigDto {
  @ApiPropertyOptional({
    description: '변경할 Provider',
    enum: MODEL_PROVIDERS,
  })
  @IsOptional()
  @IsIn(MODEL_PROVIDERS)
  provider?: ModelProvider;

  @ApiPropertyOptional({
    description: '변경할 표시 이름',
    maxLength: 255,
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  name?: string;

  @ApiPropertyOptional({
    description: '변경할 API Key. 값이 없으면 기존 키를 유지합니다.',
    maxLength: 500,
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  apiKey?: string;

  @ApiPropertyOptional({ description: '변경할 Base URL', maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  baseUrl?: string;

  @ApiPropertyOptional({
    description: '변경할 기본 모델 ID',
    maxLength: 100,
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  defaultModel?: string;

  @ApiPropertyOptional({
    description: '변경할 기본 호출 파라미터 (chat 전용)',
    type: 'object',
    additionalProperties: true,
  })
  @IsOptional()
  @IsObject()
  defaultParams?: Record<string, unknown>;

  @ApiPropertyOptional({ description: '변경할 임베딩 차원 (embedding 전용)' })
  @IsOptional()
  @IsInt()
  @Min(1)
  dimension?: number;

  @ApiPropertyOptional({ description: 'kind 별 기본 설정 여부' })
  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}
