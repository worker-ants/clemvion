import { IsEmail } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CheckEmailDto {
  /** 중복 여부를 확인할 이메일 주소 */
  @ApiProperty({
    description: '중복 여부를 확인할 이메일 주소',
    format: 'email',
    example: 'user@example.com',
  })
  @IsEmail()
  email: string;
}
