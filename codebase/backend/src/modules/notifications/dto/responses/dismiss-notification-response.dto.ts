import { ApiProperty } from '@nestjs/swagger';

// 근거: [알림 「닫기 엔드포인트」](CLE-OBS-NOTIFY#닫기-엔드포인트)
/**
 * 단건 알림 dismiss 결과.
 *
 * `POST /notifications/:id/dismiss` 응답으로 dismiss 시각을 그대로 반환해
 * 클라이언트가 낙관적 업데이트를 정정 없이 반영할 수 있도록 한다. 멱등 호출
 * (이미 dismissed 인 알림에 다시 호출) 의 경우 기존 dismissed_at 값을 그대로 돌려준다.
 */
export class DismissNotificationResponseDto {
  /** 알림 UUID */
  @ApiProperty({ format: 'uuid' })
  id: string;

  /** dismiss 시각 (ISO 8601, UTC). 항상 채워진다 — 멱등 호출 시 기존 값. */
  @ApiProperty({ format: 'date-time' })
  dismissedAt: string;
}
