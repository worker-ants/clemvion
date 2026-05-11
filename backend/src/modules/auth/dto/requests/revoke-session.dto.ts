import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, Length } from 'class-validator';

/**
 * 세션 강제 종료 요청. 본인 인증 필수.
 *
 * - passwordHash 보유 사용자 → password 필수
 * - 2FA 활성 사용자        → totpCode 필수 (password 없이도 허용)
 * - OAuth-only + 2FA 미설정 사용자 → emailOtp 필수
 *
 * 한 요청에 여러 자격증명을 함께 보내도 무방하나 서비스 계층에서 사용자 유형별로
 * 필요한 한 가지가 채워졌는지만 검증한다.
 */
export class RevokeSessionDto {
  @ApiPropertyOptional({ description: '비밀번호 재확인', format: 'password' })
  @IsOptional()
  @IsString()
  password?: string;

  @ApiPropertyOptional({ description: '6자리 TOTP 코드', example: '123456' })
  @IsOptional()
  @IsString()
  @Length(6, 8)
  totpCode?: string;

  @ApiPropertyOptional({
    description: '이메일 OTP (OAuth-only fallback)',
    example: '482103',
  })
  @IsOptional()
  @IsString()
  @Length(6, 8)
  emailOtp?: string;
}
