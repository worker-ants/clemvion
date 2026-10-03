import { IsOptional, IsBoolean } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

// 근거:
//   - [알림 「이메일 수신 토글」](CLE-OBS-NOTIFY#이메일-수신-토글) 채널별 이메일 on/off
//   - [알림 「알림 API」](CLE-OBS-NOTIFY#알림-api)
//   - [통합 상태와 만료 알림 「채널과 이메일」](CLE-INT-STATUS#채널과-이메일) integrationExpiryEmail opt-in
/**
 * `PATCH /api/notifications/settings` 본문 — 부분 수정(제공된 키만 머지).
 *
 * 의미론이 타입별로 다름에 유의:
 * - `integrationExpiryEmail`: **opt-in** (기본 off).
 * - `executionFailedEmail`/`scheduleFailedEmail`: **opt-out** (기본 on).
 */
export class UpdateNotificationSettingsDto {
  @ApiPropertyOptional({
    description: 'Integration 만료/조치필요 이메일 수신 (opt-in — 기본 off)',
  })
  @IsOptional()
  @IsBoolean()
  integrationExpiryEmail?: boolean;

  @ApiPropertyOptional({
    description: '워크플로우 실행 실패 이메일 수신 (opt-out — 기본 on)',
  })
  @IsOptional()
  @IsBoolean()
  executionFailedEmail?: boolean;

  @ApiPropertyOptional({
    description: '스케줄 실행 실패 이메일 수신 (opt-out — 기본 on)',
  })
  @IsOptional()
  @IsBoolean()
  scheduleFailedEmail?: boolean;
}
