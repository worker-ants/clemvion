import { ApiProperty } from '@nestjs/swagger';
import { IsString, Length } from 'class-validator';
import { PasswordRecheckDto } from './password-recheck.dto';

export class LoginTotpDto {
  @ApiProperty({ description: '/auth/login에서 발급한 challenge token' })
  @IsString()
  challengeToken: string;

  @ApiProperty({ description: '6자리 TOTP 코드 또는 복구 코드' })
  @IsString()
  @Length(6, 32)
  code: string;
}

/** 2FA 설정 시작 (비밀번호 재확인). */
export class Setup2faDto extends PasswordRecheckDto {}

export class Verify2faDto {
  @ApiProperty({ description: 'Authenticator 앱이 표시한 6자리 코드' })
  @IsString()
  @Length(6, 6)
  code: string;
}

/** 2FA 끄기 (비밀번호 재확인 + 인증 코드). */
export class Disable2faDto extends PasswordRecheckDto {
  @ApiProperty({
    description: 'Authenticator 앱이 표시한 6자리 코드 또는 복구 코드',
  })
  @IsString()
  @Length(6, 32)
  code: string;
}
