import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, Length, MaxLength } from 'class-validator';

/**
 * 세션 강제 종료 요청. 본인 인증 필수.
 *
 * - 비밀번호가 있는 계정 → `password`
 * - 비밀번호 없는 TOTP 계정 → `totpCode`
 * - 비밀번호와 TOTP 가 모두 있는 계정은 둘 중 하나만 보내면 된다. 둘 다 보내면 비밀번호로만 판정한다.
 * - OAuth-only + 2FA 미설정 사용자 → 본인 인증 수단 없음. 서버는 `REAUTH_NOT_AVAILABLE` 로 거절하며,
 *   사용자는 먼저 2FA 활성화 또는 비밀번호 설정 후 재시도해야 한다.
 *
 * `password`, `totpCode` 중 하나는 채워져야 한다 (검증은 서비스 계층).
 */
export class RevokeSessionDto {
  @ApiPropertyOptional({ description: '비밀번호 재확인', format: 'password' })
  @IsOptional()
  @IsString()
  @MaxLength(128)
  password?: string;

  @ApiPropertyOptional({ description: '6자리 TOTP 코드', example: '123456' })
  @IsOptional()
  @IsString()
  @Length(6, 8)
  totpCode?: string;
}
