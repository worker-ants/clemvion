import { IsOptional, IsBoolean } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

/**
 * `PATCH /api/notifications/settings` 본문 — 부분 수정(제공된 키만 머지).
 * spec/2-navigation/9-user-profile.md §5.1(채널별 이메일 on/off)·§6.2.
 *
 * 의미론이 타입별로 다름에 유의:
 * - `integrationExpiryEmail`: **opt-in** (기본 off — 4-integration §11.3).
 * - `executionFailedEmail`/`scheduleFailedEmail`: **opt-out** (기본 on — §5.1).
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
