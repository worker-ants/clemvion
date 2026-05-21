import { IsBoolean, IsIn, IsOptional } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Interaction token 발급 전략.
 * - `per_execution` (default): execution 종료 시 자동 invalidate 되는 단명 JWT (`iext_*`).
 * - `per_trigger`: trigger 가 만드는 모든 execution 에 적용되는 영구 토큰 (`itk_*`).
 * [Spec EIA §3.3 EIA-AU-02 / §R4].
 */
export type InteractionTokenStrategy = 'per_execution' | 'per_trigger';

/**
 * Trigger 의 inbound interaction 채널 설정. config JSONB 의 `interaction` 서브 필드.
 * [Spec EIA §4 / §7.1].
 *
 * 비활성 (enabled=false 또는 미지정) 시 webhook 응답에 interaction 필드 미동봉,
 * `/api/external/executions/*` 호출도 토큰 검증 단계에서 거부.
 */
export class InteractionConfigDto {
  /** 채널 활성화 여부. */
  @ApiPropertyOptional({
    description: 'Inbound interaction 채널 (REST + SSE) 활성화 여부.',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  /** 토큰 발급 전략. default = per_execution. */
  @ApiPropertyOptional({
    description:
      'Interaction token 발급 전략. per_execution 은 execution 종료 시 자동 invalidate (default, 가장 안전). per_trigger 는 trigger 가 만드는 모든 execution 에 적용되는 영구 토큰.',
    enum: ['per_execution', 'per_trigger'],
    default: 'per_execution',
  })
  @IsOptional()
  @IsIn(['per_execution', 'per_trigger'])
  tokenStrategy?: InteractionTokenStrategy;
}
