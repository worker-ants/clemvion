import { IsString, MinLength, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ResetPasswordDto {
  /** 비밀번호 재설정 토큰 (이메일 링크로 수신) */
  @ApiProperty({
    description:
      '비밀번호 재설정 토큰. `POST /auth/forgot-password` 요청 시 메일로 발송된 링크에 포함됩니다. 30분 내 1회 사용.',
    example: '6c84fb90-12c4-11e1-840d-7b25c5ee775a',
  })
  @IsString()
  token: string;

  /** 새 비밀번호 (8~100자, 강도 요건 동일) */
  @ApiProperty({
    description:
      '새 비밀번호. 최소 8자, 영문 대/소문자·숫자·특수문자 중 3종 이상 포함.',
    format: 'password',
    minLength: 8,
    maxLength: 100,
    example: 'N3wP@ssw0rd!',
  })
  @IsString()
  @MinLength(8)
  @MaxLength(100)
  newPassword: string;
}
