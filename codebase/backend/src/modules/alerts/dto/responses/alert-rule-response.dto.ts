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

  /**
   * 임계값. **wire 는 문자열이다** — 컬럼이 `numeric(12,4)` 이고 TypeORM 은 numeric 을
   * 정밀도 손실 없이 넘기려고 문자열로 준다. 이 엔드포인트는 엔티티를 그대로 반환하므로
   * 그 문자열이 그대로 나간다(예: `"10.0000"`).
   *
   * > **종전 이 자리는 `number` 라고 적었다 — 거짓이었다** (2026-09-04 정정). 컨트롤러에
   * > 반환 타입이 없어 `tsc` 가 DTO 와 엔티티를 대조한 적이 없었고, 아무도 알아채지
   * > 못했다. 프런트엔드는 이미 진실을 알고 있었다 — `lib/api/alerts.ts` 가 읽기 타입을
   * > `string`, 쓰기 DTO 를 `number` 로 **손수 갈라** 두었다. 즉 **OpenAPI 만 거짓말을
   * > 하고 있었다.**
   * >
   * > 그래서 wire 를 바꾸지 않고 문서를 사실에 맞춘다 — 유일한 소비자가 이미 이 형태를
   * > 기대하고, `numeric` 을 숫자로 내보내면 정밀도 보존이라는 컬럼 타입의 이유가 사라진다.
   * > 쓰기(`CreateAlertRuleDto.threshold`)는 `number` 를 받고 서비스가 `String(...)` 으로
   * > 저장한다 — 읽기/쓰기 비대칭은 의도된 것이다.
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
}
