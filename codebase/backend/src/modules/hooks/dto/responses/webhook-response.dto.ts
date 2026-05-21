import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * 외부 인터랙션 채널 활성화 시 응답에 동봉되는 endpoints 묶음. [Spec EIA §4.1].
 * `interaction` 의 의미는 Form/Button node 의 `output.interaction` 과 다름 — 여기는 외부 호출자가
 * 후속 인터랙션을 위해 사용할 endpoint URL + 토큰 정보. JSDoc 으로 명확히 분리한다.
 */
export class WebhookInteractionDto {
  /**
   * per_execution 전략의 단명 JWT. per_trigger 전략일 때는 응답에 미동봉
   * (호출자가 trigger 등록 시 받은 itk_* 토큰을 그대로 사용).
   */
  @ApiPropertyOptional({
    description:
      'iext_ prefix 의 단명 JWT (default 1h). per_execution 전략일 때만 동봉.',
  })
  token?: string;

  /** ISO 8601 만료 시각. `token` 과 짝. */
  @ApiPropertyOptional({ format: 'date-time' })
  expiresAt?: string;

  /** 외부 호출자가 사용할 4종 endpoint 의 절대/상대 경로 묶음. */
  @ApiProperty({
    description:
      'External Interaction API endpoint 경로. SSE / interact / status / cancel / refresh-token.',
    example: {
      stream: '/api/external/executions/{id}/stream',
      submit: '/api/external/executions/{id}/interact',
      status: '/api/external/executions/{id}',
      cancel: '/api/external/executions/{id}/cancel',
      refresh: '/api/external/executions/{id}/refresh-token',
    },
  })
  endpoints: {
    stream: string;
    submit: string;
    status: string;
    cancel: string;
    refresh: string;
  };
}

/** 웹훅 접수 결과. `{ data: <이 객체> }` 로 래핑되어 반환됩니다. */
export class WebhookAcceptedDto {
  /** 시작된 실행의 ID */
  @ApiProperty({ format: 'uuid' })
  executionId: string;

  @ApiProperty({ example: 'Webhook received, workflow execution started' })
  message: string;

  /** `interaction.enabled=true` 트리거에서만 동봉되는 초기 상태 표시. */
  @ApiPropertyOptional({ enum: ['pending'] })
  status?: 'pending';

  /**
   * External Interaction API 의 endpoints 묶음. [Spec EIA §4.1].
   * 본 필드는 외부 인터랙션 채널 메타 — Form 노드의 `output.interaction` (사용자 입력 페이로드) 과
   * 의미가 다르다. trigger 의 interaction.enabled=true 일 때만 노출.
   */
  @ApiPropertyOptional({ type: () => WebhookInteractionDto })
  interaction?: WebhookInteractionDto;
}
