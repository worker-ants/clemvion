import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/** 알림 규칙 응답 DTO */
export class AlertRuleDto {
  /** 알림 규칙 UUID */
  @ApiProperty({ format: 'uuid' })
  id: string;

  /** 소속 워크스페이스 UUID */
  @ApiProperty({ format: 'uuid' })
  workspaceId: string;

  /** 규칙 타입 */
  @ApiProperty({
    enum: ['failure_rate', 'duration', 'llm_cost'],
    example: 'failure_rate',
  })
  type: string;

  // 이 필드가 왜 문자열인지의 **경위**(2026-09-04 정정)는 CHANGELOG 에 있다. 아래 JSDoc 은
  // `nest-cli.json` 의 `@nestjs/swagger` 플러그인이 **공개 OpenAPI `description` 으로 내보내므로**
  // 소비자에게 필요한 것만 적는다 — 내부 서사를 넣으면 API 문서에 그대로 실린다
  // (`--impl-done 20_05_42` W1).
  /**
   * 임계값. **문자열로 내려간다** — 컬럼이 `numeric(12,4)` 라 정밀도 보존을 위해 문자열로
   * 직렬화된다(예: `"10.0000"`). 쓰기(`POST`/`PATCH`)는 `number` 를 받는다.
   */
  @ApiProperty({ type: String, example: '10.0000' })
  threshold: string;

  /** 평가 윈도우 (ISO 8601 duration) */
  @ApiPropertyOptional({ nullable: true, example: 'PT1H' })
  window?: string | null;

  /** 알림 채널 */
  @ApiProperty({ enum: ['in_app', 'email'], example: 'in_app' })
  channel: string;

  /** 감시 대상 워크플로우 UUID (null 이면 워크스페이스 전체) */
  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  workflowId?: string | null;

  /** 활성화 여부 */
  @ApiProperty()
  enabled: boolean;

  /** 생성 시각 */
  @ApiProperty({ format: 'date-time' })
  createdAt: string;

  /** 수정 시각 */
  @ApiProperty({ format: 'date-time' })
  updatedAt: string;

  // ── 아래 필드는 **이미 응답에 실려 나가고 있었다** — 컨트롤러가 엔티티를 그대로
  // 반환하기 때문이다. §5.4 응답-계약 스윕이 "선언되지 않은 키" 로 검출했고,
  // 프런트엔드가 실제로 소비하므로 빼면 계약 회귀다. 선언을 실제에 맞춘다.
  //
  // 전부 **엔티티 컬럼이라 응답에 상시 존재**한다 → §5.4 의 기본형
  // (`@ApiProperty` + 컬럼이 nullable 이면 `nullable: true`). `@ApiPropertyOptional`
  // 은 `required: false` 의 별칭이라 상시 존재 필드에 쓰면 "상시 존재" 와 모순된다.

  /** 생성한 사용자 ID (없으면 `null`) */
  @ApiProperty({ format: 'uuid', nullable: true, type: String })
  createdBy: string | null;

  /** 마지막 발화 시각 (없으면 `null`) */
  @ApiProperty({ format: 'date-time', nullable: true, type: String })
  lastTriggeredAt: string | null;
}
