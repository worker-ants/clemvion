import {
  IsEmail,
  IsOptional,
  IsString,
  Length,
  MaxLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * 이메일 변경 시작 요청 (spec/5-system/1-auth.md §1.1.B).
 *
 * 재인증: `password` 보유 사용자 → password / 비밀번호 없는 2FA 사용자 → `totpCode`.
 * 두 수단 모두 없는 OAuth-only 계정은 서비스가 `REAUTH_NOT_AVAILABLE` 로 거절한다.
 * (이메일 OTP 는 변경 대상 메일함과의 순환성 때문에 재인증 수단에서 배제 — Rationale 1.1.B-4.)
 */
export class EmailChangeRequestDto {
  @ApiProperty({
    description: '변경할 신규 이메일',
    format: 'email',
    example: 'new@example.com',
  })
  @IsEmail()
  @MaxLength(255)
  newEmail: string;

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
