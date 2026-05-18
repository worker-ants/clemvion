import { ApiProperty } from '@nestjs/swagger';
import type { LoginHistoryEvent } from '../../entities/login-history.entity';

/** 로그인 이력 한 건 */
export class LoginHistoryItemDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({
    description: '발생 이벤트',
    enum: [
      'login_success',
      'login_failed',
      'totp_failed',
      'logout',
      'session_revoked',
      'token_reuse_detected',
    ],
  })
  event: LoginHistoryEvent;

  @ApiProperty({ nullable: true, example: '203.0.113.7' })
  ipAddress: string | null;

  @ApiProperty({ nullable: true, example: 'Chrome on macOS' })
  deviceLabel: string | null;

  @ApiProperty({
    nullable: true,
    description:
      'login_failed/totp_failed 시 사유 코드 — INVALID_PASSWORD, ACCOUNT_LOCKED 등',
    example: null,
  })
  failureReason: string | null;

  @ApiProperty({ example: '2026-05-12T03:14:00Z' })
  createdAt: string;
}

/**
 * 로그인 이력 페이지 응답 (커서 기반).
 *
 * 응답 shape 은 외부 wrapping 까지 합쳐 `{ data: { items: LoginHistoryItemDto[], nextCursor } }`.
 * 옛 필드명 `data` (내부) → `items` 로 개명 — `res.data.data.data` 와 같은
 * 이중 중첩 가독성 문제 해소.
 */
export class LoginHistoryPageDto {
  @ApiProperty({ type: [LoginHistoryItemDto] })
  items: LoginHistoryItemDto[];

  @ApiProperty({
    nullable: true,
    description: '다음 페이지 커서. 없으면 마지막 페이지',
    example: '2026-04-01T00:00:00.000Z',
  })
  nextCursor: string | null;
}
