import { ApiProperty } from '@nestjs/swagger';

// 근거:
//   - [알림 「이메일 수신 토글」](CLE-OBS-NOTIFY-SETTINGS#이메일-수신-토글)
//   - [알림 「알림 API」](CLE-OBS-NOTIFY-INBOX#알림-api)
//   - [알림 설정 「설정 키」](CLE-OBS-NOTIFY-SETTINGS#설정-키)
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

  @ApiProperty({
    description: '워크플로우 실행 실패 인앱(벨) 알림 (opt-out — 기본 true)',
  })
  executionFailedInApp: boolean;

  @ApiProperty({
    description: '스케줄 실행 실패 인앱(벨) 알림 (opt-out — 기본 true)',
  })
  scheduleFailedInApp: boolean;

  @ApiProperty({
    description:
      'Integration 만료 인앱(벨) 알림 (opt-out — 기본 true). 조치 필요 알림은 이 키와 무관하게 인앱으로 보낸다',
  })
  integrationExpiryInApp: boolean;
}
