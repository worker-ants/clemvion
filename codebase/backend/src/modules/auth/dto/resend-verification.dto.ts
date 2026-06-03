import { IsEmail } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ResendVerificationDto {
  /** 인증 메일을 다시 받을 이메일 주소 */
  @ApiProperty({
    description: '인증 메일을 다시 받을 이메일 주소',
    format: 'email',
    example: 'user@example.com',
  })
  @IsEmail()
  email: string;
}
