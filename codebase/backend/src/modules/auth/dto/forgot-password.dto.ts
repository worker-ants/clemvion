import { IsEmail } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ForgotPasswordDto {
  /** 비밀번호 재설정 메일을 받을 이메일 주소 */
  @ApiProperty({
    description: '비밀번호 재설정 메일을 받을 이메일 주소',
    format: 'email',
    example: 'user@example.com',
  })
  @IsEmail()
  email: string;
}
