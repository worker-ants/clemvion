import { IsEmail, IsString, IsOptional, IsBoolean } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class LoginDto {
  /** 로그인 이메일 주소 */
  @ApiProperty({
    description: '로그인 이메일 주소',
    format: 'email',
    example: 'user@example.com',
  })
  @IsEmail()
  email: string;

  /** 로그인 비밀번호 */
  @ApiProperty({
    description: '로그인 비밀번호',
    format: 'password',
    example: 'P@ssw0rd!',
    minLength: 8,
  })
  @IsString()
  password: string;

  /** true이면 Refresh Token 유효기간을 7일 → 30일로 연장 */
  @ApiPropertyOptional({
    description:
      'true이면 Refresh Token 유효기간이 30일로 연장됩니다 (기본 7일)',
    default: false,
    example: false,
  })
  @IsOptional()
  @IsBoolean()
  rememberMe?: boolean;
}
