import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import type {
  TriggerChatChannelHealth,
  TriggerNotificationHealth,
} from '../../entities/trigger.entity';

// 왜 좁혔나 — `findAll` 의 `leftJoinAndSelect('t.workflow','w')` 와 `findById` 의
// `relations: ['workflow']` 가 **Workflow 엔티티 전체**를 실어 왔고 `TriggerDto` 는 그것을
// 선언조차 하지 않았다. §5.4 응답-계약 대조를 목록·수정 경로로 넓히자 드러났다
// (`review/code/2026/09/05/21_40_37` W1). `ScheduleDto.trigger` 와 같은 처방이다.
// 소비처는 `triggers/page.tsx` 두 곳뿐 — `t.workflow?.id` · `t.workflow?.name`.
//
// 내부 서사를 `//` 에 두는 이유: `swagger.md §3` · `review-citations.md §3`.
/**
 * 트리거에 연결된 워크플로우의 **참조** — `id` 와 `name` 을 담는다.
 *
 * 스케줄 응답의 자매 타입 `ScheduleTriggerWorkflowRefDto` 는 `name` **하나만** 싣는다 —
 * **의도적으로 다르다.** 각 참조는 그 응답의 소비처가 실제로 읽는 필드만 담는다:
 * `triggers/page.tsx` 는 `t.workflow?.id` 로 링크를 걸지만 스케줄 화면은 이름만 표시한다.
 * 이름이 접두어 하나만 다르므로 **한쪽을 다른 쪽으로 갈아 끼우지 말 것**
 * (`review/consistency/2026/09/06/00_48_52` W2).
 */
export class TriggerWorkflowRefDto {
  /** 워크플로우 UUID */
  @ApiProperty({ format: 'uuid' })
  id: string;

  /** 워크플로우 이름 */
  @ApiProperty()
  name: string;
}

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

  /**
   * 연결된 워크플로우 — **키 생략형**이다 (§5.4 기준 (b)).
   *
   * 목록·단건 조회와 **수정**(`update()` 가 `findById` 로 시작한다) 에서 로드된다.
   * **생성 응답에만 없다** — 그래서 소비처도 `t.workflow?.name ?? ""` 로 읽는다.
   */
  @ApiPropertyOptional({ type: () => TriggerWorkflowRefDto })
  workflow?: TriggerWorkflowRefDto;

  // ── 아래 필드는 **이미 응답에 실려 나가고 있었다** — 컨트롤러가 엔티티를 그대로
  // 반환하기 때문이다. §5.4 응답-계약 스윕이 "선언되지 않은 키" 로 검출했고,
  // 프런트엔드가 실제로 소비하므로 빼면 계약 회귀다. 선언을 실제에 맞춘다.
  //
  // 전부 **엔티티 컬럼이라 응답에 상시 존재**한다 → §5.4 의 기본형
  // (`@ApiProperty` + 컬럼이 nullable 이면 `nullable: true`). `@ApiPropertyOptional`
  // 은 `required: false` 의 별칭이라 상시 존재 필드에 쓰면 "상시 존재" 와 모순된다.

  /** chat-channel 연동 상태 */
  @ApiProperty({ enum: ['unknown', 'healthy', 'degraded'], example: 'healthy' })
  chatChannelHealth: TriggerChatChannelHealth;

  /** chat-channel 마지막 오류 메시지 (없으면 `null`) */
  @ApiProperty({ nullable: true, type: String })
  chatChannelLastError: string | null;

  /** chat-channel 최초 설정 시각 (없으면 `null`) */
  @ApiProperty({ format: 'date-time', nullable: true, type: String })
  chatChannelSetupAt: string | null;

  /** chat-channel bot token 최종 회전 시각 (없으면 `null`) */
  @ApiProperty({ format: 'date-time', nullable: true, type: String })
  chatChannelRotatedAt: string | null;

  /** outbound notification 발송 상태 */
  @ApiProperty({ enum: ['unknown', 'healthy', 'degraded'], example: 'healthy' })
  notificationHealth: TriggerNotificationHealth;

  /** outbound notification 마지막 오류 메시지 (없으면 `null`) */
  @ApiProperty({ nullable: true, type: String })
  notificationLastError: string | null;

  /** outbound notification secret 최종 회전 시각 (없으면 `null`) */
  @ApiProperty({ format: 'date-time', nullable: true, type: String })
  notificationRotatedAt: string | null;
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
