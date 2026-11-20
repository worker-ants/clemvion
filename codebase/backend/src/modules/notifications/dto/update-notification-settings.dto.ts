import { IsBoolean } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptionalNonNull } from '../../../common/utils/optional-non-null';

// 근거:
//   - [알림 「이메일 수신 토글」](CLE-OBS-NOTIFY-SETTINGS#이메일-수신-토글) 채널별 이메일 on/off
//   - [알림 「알림 API」](CLE-OBS-NOTIFY-INBOX#알림-api)
//   - [통합 상태와 만료 알림 「채널과 이메일」](CLE-INT-STATUS-SCAN#채널과-이메일) integrationExpiryEmail opt-in
/**
 * `PATCH /api/notifications/settings` 본문 — 부분 수정(제공된 키만 머지).
 *
 * 의미론이 타입별로 다름에 유의:
 * - `integrationExpiryEmail`: **opt-in** (기본 off).
 * - `executionFailedEmail`/`scheduleFailedEmail`: **opt-out** (기본 on).
 *
 * `null` 은 400 이다(CLE-T-9Q304H). `true` · `false` 로 값을 정할 수 있어 null 에 따로 줄 뜻이 없고, 받으면
 * null 이 저장된 뒤 읽을 때 기본값으로 바뀐다.
 */
export class UpdateNotificationSettingsDto {
  @ApiPropertyOptional({
    description: 'Integration 만료/조치필요 이메일 수신 (opt-in — 기본 off)',
  })
  @IsOptionalNonNull()
  @IsBoolean()
  integrationExpiryEmail?: boolean;

  @ApiPropertyOptional({
    description: '워크플로우 실행 실패 이메일 수신 (opt-out — 기본 on)',
  })
  @IsOptionalNonNull()
  @IsBoolean()
  executionFailedEmail?: boolean;

  @ApiPropertyOptional({
    description: '스케줄 실행 실패 이메일 수신 (opt-out — 기본 on)',
  })
  @IsOptionalNonNull()
  @IsBoolean()
  scheduleFailedEmail?: boolean;
}
