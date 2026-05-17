import { ApiProperty } from '@nestjs/swagger';
import { IsString, Length, MinLength } from 'class-validator';

export class LoginTotpDto {
  @ApiProperty({ description: '/auth/login에서 발급한 challenge token' })
  @IsString()
  challengeToken: string;

  @ApiProperty({ description: '6자리 TOTP 코드 또는 복구 코드' })
  @IsString()
  @Length(6, 32)
  code: string;
}

export class Verify2faDto {
  @ApiProperty({ description: 'Authenticator 앱이 표시한 6자리 코드' })
  @IsString()
  @Length(6, 6)
  code: string;
}

export class Disable2faDto {
  @ApiProperty({ description: '계정 비밀번호 (재확인용)' })
  @IsString()
  @MinLength(8)
  password: string;
}
