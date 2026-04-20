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

  /** 알림 타입 */
  @ApiProperty({ example: 'workflow.failed' })
  type: string;

  /** 제목 */
  @ApiProperty({ example: '워크플로우 실행 실패' })
  title: string;

  /** 본문 메시지 */
  @ApiProperty()
  message: string;

  /** 관련 리소스 타입 */
  @ApiPropertyOptional({ nullable: true, example: 'execution' })
  resourceType?: string | null;

  /** 관련 리소스 UUID */
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
