import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/** 트리거 응답 DTO */
export class TriggerDto {
  /** 트리거 UUID */
  @ApiProperty({ format: 'uuid' })
  id: string;

  /** 소속 워크스페이스 UUID */
  @ApiProperty({ format: 'uuid' })
  workspaceId: string;

  /** 연결된 워크플로우 UUID */
  @ApiProperty({ format: 'uuid' })
  workflowId: string;

  /** 트리거 타입 (webhook, manual, schedule) */
  @ApiProperty({ enum: ['webhook', 'manual', 'schedule'], example: 'webhook' })
  type: string;

  /** 트리거 이름 */
  @ApiProperty({ example: '리드 유입 웹훅' })
  name: string;

  /** 활성화 여부 */
  @ApiProperty()
  isActive: boolean;

  /** 트리거 설정 */
  @ApiProperty({ type: 'object', additionalProperties: true })
  config: Record<string, unknown>;

  /** 엔드포인트 경로 (webhook 타입) */
  @ApiPropertyOptional({ nullable: true, example: 'abcd1234' })
  endpointPath?: string | null;

  /** 인증 설정 UUID */
  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  authConfigId?: string | null;

  /** 마지막 실행 시각 */
  @ApiPropertyOptional({ format: 'date-time', nullable: true })
  lastTriggeredAt?: string | null;

  /** Cron 식 (schedule 타입 트리거의 목록·단건 조회 모두 채워짐) */
  @ApiPropertyOptional({ example: '0 9 * * 1-5' })
  cronExpression?: string;

  /** 타임존 (schedule 타입 트리거의 목록·단건 조회 모두 채워짐) */
  @ApiPropertyOptional({ example: 'Asia/Seoul' })
  timezone?: string;

  /** 다음 실행 예정 시각 (schedule 타입 트리거의 목록·단건 조회 모두 채워짐) */
  @ApiPropertyOptional({ format: 'date-time', nullable: true })
  nextRunAt?: string | null;

  /** 생성 시각 */
  @ApiProperty({ format: 'date-time' })
  createdAt: string;

  /** 수정 시각 */
  @ApiProperty({ format: 'date-time' })
  updatedAt: string;

  // ── 관측 필드 (chat-channel / outbound notification)
  //
  // 아래 7개는 **이미 응답에 실려 나가고 있었다** — 컨트롤러가 엔티티를 그대로 반환하기
  // 때문이다. §5.4 응답-계약 스윕이 "선언되지 않은 키" 로 검출했고, 그중 5개는 프런트엔드가
  // 실제로 소비한다(`chatChannelHealth` 7곳 · `notificationHealth` 6곳 ·
  // `chatChannelLastError` 4곳 · `chatChannelRotatedAt`·`chatChannelSetupAt` 각 2곳).
  // 나가는 것을 막는 대신 **선언을 실제에 맞춘다** — 소비 중인 필드를 빼면 계약 회귀다.
  //
  // 같은 스윕이 검출한 `notificationSecretV2`·`chatChannelTokenV2` 는 **선언하지 않는다.**
  // 그쪽은 비밀이라 응답에서 제거했다 (`TRIGGER_RESPONSE_STRIP_COLUMNS`).

  /** chat-channel 연동 상태 */
  @ApiPropertyOptional({ example: 'healthy' })
  chatChannelHealth?: string;

  /** chat-channel 마지막 오류 메시지 (없으면 `null`) */
  @ApiPropertyOptional({ nullable: true, type: String })
  chatChannelLastError?: string | null;

  /** chat-channel 최초 설정 시각 (없으면 `null`) */
  @ApiPropertyOptional({ format: 'date-time', nullable: true })
  chatChannelSetupAt?: string | null;

  /** chat-channel bot token 최종 회전 시각 (없으면 `null`) */
  @ApiPropertyOptional({ format: 'date-time', nullable: true })
  chatChannelRotatedAt?: string | null;

  /** outbound notification 발송 상태 */
  @ApiPropertyOptional({ example: 'healthy' })
  notificationHealth?: string;

  /** outbound notification 마지막 오류 메시지 (없으면 `null`) */
  @ApiPropertyOptional({ nullable: true, type: String })
  notificationLastError?: string | null;

  /** outbound notification secret 최종 회전 시각 (없으면 `null`) */
  @ApiPropertyOptional({ format: 'date-time', nullable: true })
  notificationRotatedAt?: string | null;
}

/** 트리거 실행 이력 아이템 */
export class TriggerHistoryItemDto {
  /** 실행 UUID */
  @ApiProperty({ format: 'uuid' })
  id: string;

  /** 실행 상태 */
  @ApiProperty({
    example: 'completed',
    enum: [
      'pending',
      'running',
      'completed',
      'failed',
      'cancelled',
      'waiting_for_input',
    ],
  })
  status: string;

  /** 시작 시각 */
  @ApiProperty({ format: 'date-time' })
  startedAt: string;

  /** 소요 시간(ms) */
  @ApiPropertyOptional({ nullable: true })
  durationMs?: number | null;
}
