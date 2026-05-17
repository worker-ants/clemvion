import { IsString, MaxLength, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ChangePasswordDto {
  @ApiProperty({
    description: '현재 비밀번호',
    format: 'password',
    example: 'CurrentP@ss1',
  })
  @IsString()
  @MinLength(1)
  currentPassword: string;

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
