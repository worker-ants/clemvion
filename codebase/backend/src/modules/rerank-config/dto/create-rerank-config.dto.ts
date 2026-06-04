import {
  IsString,
  IsOptional,
  IsBoolean,
  IsIn,
  IsNotEmpty,
  MaxLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

// 현재 구현 제공 provider. jina/voyage/local 은 Planned (data-model §2.16.1).
export const RERANK_PROVIDERS = ['tei', 'cohere'] as const;
export type RerankProvider = (typeof RERANK_PROVIDERS)[number];

export class CreateRerankConfigDto {
  /** Rerank Provider 식별자 */
  @ApiProperty({
    description:
      'Rerank Provider 식별자. tei(자가호스팅 HF Text-Embeddings-Inference)/cohere 중 선택.',
    enum: RERANK_PROVIDERS,
    example: 'tei',
  })
  @IsIn(RERANK_PROVIDERS)
  provider: RerankProvider;

  /** Rerank 설정 표시 이름 */
  @ApiProperty({
    description: 'Rerank 설정 표시 이름 (사용자 구분용)',
    example: 'bge-reranker-v2-m3-ko',
    maxLength: 255,
  })
  @IsString()
  @MaxLength(255)
  name: string;

  /** API Key. tei 셀프호스팅은 선택, cohere 는 필수. 저장 시 암호화됩니다. */
  @ApiPropertyOptional({
    description:
      'Provider API Key. tei 셀프호스팅은 선택, cohere 는 필수입니다. 저장 시 암호화되며 응답 시 마스킹됩니다.',
    example: 'co-xxxxxxxxxxxxxxxx',
    maxLength: 500,
  })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  apiKey?: string;

  /** Rerank endpoint base URL. tei 는 필수. */
  @ApiPropertyOptional({
    description:
      'Rerank endpoint base URL. tei provider 는 필수(자가호스팅 endpoint). cohere 는 선택(미지정 시 공식 endpoint).',
    example: 'http://tei-reranker:8080',
    maxLength: 500,
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  baseUrl?: string;

  /** 기본 리랭커 모델명 */
  @ApiProperty({
    description: '기본으로 사용할 리랭커 모델 ID',
    example: 'dragonkue/bge-reranker-v2-m3-ko',
    maxLength: 100,
  })
  @IsString()
  @MaxLength(100)
  defaultModel: string;

  /** 워크스페이스 기본 Rerank 설정 여부 */
  @ApiPropertyOptional({
    description:
      '워크스페이스 기본 Rerank 여부. true로 설정 시 기존 기본 설정은 해제됩니다.',
    example: false,
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}
