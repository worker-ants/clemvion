import {
  IsString,
  IsOptional,
  IsBoolean,
  IsIn,
  MaxLength,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { RERANK_PROVIDERS } from './create-rerank-config.dto';
import type { RerankProvider } from './create-rerank-config.dto';

export class UpdateRerankConfigDto {
  /** 변경할 Rerank Provider */
  @ApiPropertyOptional({
    description: '변경할 Rerank Provider',
    enum: RERANK_PROVIDERS,
  })
  @IsOptional()
  @IsIn(RERANK_PROVIDERS)
  provider?: RerankProvider;

  /** 변경할 표시 이름 */
  @ApiPropertyOptional({
    description: '변경할 Rerank 설정 표시 이름',
    example: 'bge-reranker (renamed)',
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
    description: '변경할 Rerank endpoint base URL',
    maxLength: 500,
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  baseUrl?: string;

  /** 변경할 기본 리랭커 모델명 */
  @ApiPropertyOptional({
    description: '변경할 기본 리랭커 모델 ID',
    example: 'bge-reranker-v2-m3',
    maxLength: 100,
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  defaultModel?: string;

  /** 기본 Rerank 설정 여부 */
  @ApiPropertyOptional({
    description: '기본 Rerank 설정 여부',
  })
  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}
