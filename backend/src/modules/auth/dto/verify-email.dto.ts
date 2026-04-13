import { IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class VerifyEmailDto {
  /** 이메일 검증 토큰 (회원가입 시 발송된 링크에 포함) */
  @ApiProperty({
    description:
      '이메일 검증 토큰. 회원가입 완료 시 해당 이메일로 발송된 링크에 포함됩니다. 발급 후 24시간 내 1회 사용.',
    example: '6c84fb90-12c4-11e1-840d-7b25c5ee775a',
  })
  @IsString()
  token: string;
}
