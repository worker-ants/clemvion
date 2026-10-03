import { ApiProperty } from '@nestjs/swagger';

// 근거:
//   - [알림 「이메일 수신 토글」](CLE-OBS-NOTIFY#이메일-수신-토글)
//   - [알림 「알림 API」](CLE-OBS-NOTIFY#알림-api)
/**
 * `GET/PATCH /api/notifications/settings` 응답 — **기본값이 적용된 해소값**을 반환한다.
 * (JSONB 에 키가 없어도 타입별 기본값으로 채워, FE 가 기본값을 추측하지 않게 한다.)
 */
export class NotificationSettingsDto {
  @ApiProperty({
    description: 'Integration 만료/조치필요 이메일 수신 (opt-in — 기본 false)',
  })
  integrationExpiryEmail: boolean;

  @ApiProperty({
    description: '워크플로우 실행 실패 이메일 수신 (opt-out — 기본 true)',
  })
  executionFailedEmail: boolean;

  @ApiProperty({
    description: '스케줄 실행 실패 이메일 수신 (opt-out — 기본 true)',
  })
  scheduleFailedEmail: boolean;
}
