import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/** 알림 응답 DTO */
export class NotificationDto {
  /** 알림 UUID */
  @ApiProperty({ format: 'uuid' })
  id: string;

  /** 워크스페이스 UUID */
  @ApiProperty({ format: 'uuid' })
  workspaceId: string;

  /** 수신자 UUID */
  @ApiProperty({ format: 'uuid' })
  userId: string;

  /** 알림 타입 (snake_case enum — data-model §2.19) */
  @ApiProperty({ example: 'execution_failed' })
  type: string;

  /** 제목 */
  @ApiProperty({ example: '워크플로우 실행 실패' })
  title: string;

  /** 본문 메시지 */
  @ApiProperty()
  message: string;

  /**
   * 관련 리소스 타입 — 팝오버 딥링크 계약(`_layout.md §3.1`)의 라우팅 키.
   * 알림 유형에 따라 `workflow` (실행/스케줄/Background 실패 — `/workflows/<resourceId>`),
   * `integration` (통합 관련 — `/integrations/<resourceId>`),
   * `workspace_invitation` (팀 초대) 등이 들어간다. 클라이언트는 unknown 값을 dead link 로 처리한다.
   * (Background 본문 실패의 per-run attribution 은 REST 에 노출되지 않는 내부 컬럼 `background_run_id` 가 담당.)
   */
  @ApiPropertyOptional({
    nullable: true,
    example: 'workflow',
    description:
      '연관 리소스 종류 (딥링크 라우팅 키) — 현재 발행되는 값: `workflow`, `integration`, `workspace_invitation`',
  })
  resourceType?: string | null;

  /** 관련 리소스 UUID (딥링크 대상 — 실패 알림은 workflow id) */
  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  resourceId?: string | null;

  /** 읽음 여부 */
  @ApiProperty()
  isRead: boolean;

  /** 전달 채널 */
  @ApiProperty({ example: 'in_app', enum: ['in_app', 'email'] })
  channel: string;

  /** 이메일 발송 시각 (채널이 email 인 경우) */
  @ApiPropertyOptional({ format: 'date-time', nullable: true })
  emailSentAt?: string | null;

  /**
   * dismiss 시각 (soft delete) — `null` 이면 visible, 채워지면 사용자가 닫은 상태.
   * 목록·미읽음 카운트는 `dismissed_at IS NULL` 만 반환하므로 본 응답에 나타나는
   * row 의 값은 일반적으로 `null` 이다. 자세한 라이프사이클은
   * spec/data-flow/8-notifications.md §4 참조.
   */
  @ApiPropertyOptional({ format: 'date-time', nullable: true })
  dismissedAt?: string | null;

  /** 생성 시각 */
  @ApiProperty({ format: 'date-time' })
  createdAt: string;
}

/** 읽지 않은 알림 개수 */
export class UnreadCountDto {
  /** 읽지 않은 알림 개수 */
  @ApiProperty({ example: 3 })
  count: number;
}

/** 전체 읽음 처리 결과 */
export class MarkAllReadResultDto {
  /** 읽음 처리된 건수 */
  @ApiProperty({ example: 12 })
  affected: number;
}
