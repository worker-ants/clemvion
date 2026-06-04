import {
  IsString,
  IsOptional,
  IsInt,
  IsIn,
  IsUUID,
  IsNumber,
  Min,
  Max,
  MaxLength,
  Matches,
  ValidateIf,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { EMBEDDING_MODEL_PATTERN } from '../embedding/embedding-dimensions.const';

export class UpdateKnowledgeBaseDto {
  /** 변경할 지식 베이스 이름 */
  @ApiPropertyOptional({
    description: '변경할 지식 베이스 이름',
    example: 'Product Docs (v2)',
    maxLength: 255,
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  name?: string;

  /** 변경할 설명 */
  @ApiPropertyOptional({
    description: '변경할 지식 베이스 설명',
  })
  @IsOptional()
  @IsString()
  description?: string;

  /** 변경할 임베딩 모델 식별자 */
  @ApiPropertyOptional({
    description:
      '변경할 임베딩 모델 식별자. 차원이 달라지면 기존 청크와 호환되지 않으므로 KB 재임베딩이 필요합니다.',
    example: 'text-embedding-3-large',
    maxLength: 100,
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  @Matches(EMBEDDING_MODEL_PATTERN, {
    message:
      'embeddingModel must contain only letters, digits, ".", "_", ":", "/" or "-" (max 100 chars)',
  })
  embeddingModel?: string;

  /** 변경할 청크 크기 (토큰 기준, 100~8000) */
  @ApiPropertyOptional({
    description: '변경할 문서 분할 청크 크기. 변경 후 재임베딩이 필요합니다.',
    minimum: 100,
    maximum: 8000,
    example: 1500,
  })
  @IsOptional()
  @IsInt()
  @Min(100)
  @Max(8000)
  chunkSize?: number;

  /** 변경할 청크 중첩 토큰 수 (0~2000) */
  @ApiPropertyOptional({
    description: '변경할 청크 중첩 토큰 수. 변경 후 재임베딩이 필요합니다.',
    minimum: 0,
    maximum: 2000,
    example: 300,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(2000)
  chunkOverlap?: number;

  // rag_mode 는 생성 시 불변이므로 update 에 포함하지 않는다.

  /** graph 모드 KB 의 추출 LLMConfig 변경. null 로 보내면 워크스페이스 default 로 되돌림. */
  @ApiPropertyOptional({
    description:
      'graph 모드 KB 의 그래프 추출에 사용할 LLMConfig 변경. null 로 보내면 워크스페이스 default LLMConfig 로 되돌립니다. 적용은 다음 추출/재추출부터.',
    format: 'uuid',
    nullable: true,
  })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsUUID()
  extractionLlmConfigId?: string | null;

  /** 임베딩 LLMConfig 변경. null 로 보내면 워크스페이스 default 로 되돌림. */
  @ApiPropertyOptional({
    description:
      '임베딩에 사용할 LLMConfig 변경. null 로 보내면 워크스페이스 default LLMConfig 로 되돌립니다. 적용은 다음 임베딩부터. 차원이 달라지면 KB 재임베딩이 필요합니다.',
    format: 'uuid',
    nullable: true,
  })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsUUID()
  embeddingLlmConfigId?: string | null;

  @ApiPropertyOptional({
    description: 'graph 모드 검색 시 그래프 확장 깊이 (1 또는 2).',
    minimum: 1,
    maximum: 2,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(2)
  maxHops?: number;

  @ApiPropertyOptional({
    description: 'graph 모드 검색 시 vector seed 개수.',
    minimum: 1,
    maximum: 50,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(50)
  vectorSeedTopK?: number;

  @ApiPropertyOptional({
    description: 'graph expansion 후 회수할 청크 상한.',
    minimum: 1,
    maximum: 100,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  expandedChunkLimit?: number;

  // ──────── 검색 후처리(리랭킹) — Spec RAG 검색 §3.3. 검색 시점 적용이라 사후 변경 가능 ────────
  @ApiPropertyOptional({
    description: '리랭킹 모드 (off / cross_encoder / cross_encoder_llm).',
    enum: ['off', 'cross_encoder', 'cross_encoder_llm'],
  })
  @IsOptional()
  @IsString()
  @IsIn(['off', 'cross_encoder', 'cross_encoder_llm'])
  rerankMode?: 'off' | 'cross_encoder' | 'cross_encoder_llm';

  @ApiPropertyOptional({
    description: '사용할 RerankConfig (미지정 시 워크스페이스 default).',
    format: 'uuid',
  })
  @IsOptional()
  @IsUUID()
  rerankConfigId?: string;

  @ApiPropertyOptional({
    description: '리랭크에 투입할 1차 회수 후보 수 (1~200).',
    minimum: 1,
    maximum: 200,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(200)
  rerankCandidateK?: number;

  @ApiPropertyOptional({
    description: '리랭크 점수 동적 컷 임계 (미지정 시 컷 없음).',
  })
  @IsOptional()
  @IsNumber()
  rerankScoreThreshold?: number;

  @ApiPropertyOptional({
    description:
      'cross_encoder_llm grading LLMConfig (후속 구현). 미지정 시 ws default chat.',
    format: 'uuid',
  })
  @IsOptional()
  @IsUUID()
  rerankLlmConfigId?: string;
}
