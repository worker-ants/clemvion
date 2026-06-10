import {
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { EMBEDDING_MODEL_PATTERN } from '../embedding/embedding-dimensions.const';

/**
 * KB 생성/설정 화면에서 "임베딩 테스트" 버튼이 호출하는 라이브 probe 요청.
 * 사용자가 고른 LLMConfig + 모델 조합으로 1회 embed("probe") 호출을 수행해
 * 실제 vector 차원을 측정한다. KB 종속이 아니므로 (신규 KB 생성 화면에서도 호출 가능)
 * workspace 스코프 라우트.
 *
 * 우선순위 (WARNING #5/#17):
 *   1급 경로: `embeddingModelConfigId` 지정 시 → 해당 kind=embedding config 로 probe.
 *             `embeddingModel` 은 그 config 의 범위 안에서 probe 할 모델 문자열.
 *   legacy 경로: `embeddingModelConfigId` 미지정 → `llmConfigId` (legacy chat config),
 *                미지정 시 워크스페이스 default LLMConfig 폴백.
 */
export class EmbeddingProbeDto {
  @ApiPropertyOptional({
    description:
      'legacy 경로: 테스트할 LLMConfig. embeddingModelConfigId 미지정 시에만 사용. 미지정 시 워크스페이스 default LLMConfig 가 사용됩니다.',
    format: 'uuid',
  })
  @IsOptional()
  @IsUUID()
  llmConfigId?: string;

  @ApiPropertyOptional({
    description:
      '1급 경로: 테스트할 ModelConfig(kind=embedding). 지정 시 이 config 로 probe 수행 — llmConfigId/ws-default 보다 우선. 미지정 시 llmConfigId(legacy)/워크스페이스 default 폴백.',
    format: 'uuid',
  })
  @IsOptional()
  @IsUUID()
  embeddingModelConfigId?: string;

  @ApiProperty({
    description:
      '테스트할 임베딩 모델 식별자. embeddingModelConfigId 지정 시: 해당 config 범위 내 probe 대상 모델. 미지정(legacy 경로) 시: LLMConfig 에서 호출할 모델.',
    example: 'text-embedding-3-small',
    maxLength: 100,
  })
  @IsString()
  @MaxLength(100)
  @Matches(EMBEDDING_MODEL_PATTERN, {
    message:
      'embeddingModel must contain only letters, digits, ".", "_", ":", "/" or "-" (max 100 chars)',
  })
  embeddingModel!: string;
}

export class EmbeddingProbeResultDto {
  @ApiProperty({
    example: 1536,
    description: '실제 측정된 임베딩 벡터 차원',
  })
  dimension: number;

  @ApiProperty({
    example: 'openai',
    description: '실제 호출에 사용된 LLMConfig 의 provider',
  })
  provider: string;
}
