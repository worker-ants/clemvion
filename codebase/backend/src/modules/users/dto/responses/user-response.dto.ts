import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/** 사용자 프로필 응답 DTO */
export class UserProfileDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ format: 'email' })
  email: string;

  @ApiProperty()
  name: string;

  @ApiPropertyOptional({ nullable: true })
  avatarUrl?: string | null;

  @ApiProperty({ example: 'ko' })
  locale: string;

  @ApiProperty({ enum: ['light', 'dark'], example: 'light' })
  theme: string;
}

/** 비밀번호 변경 결과 */
export class PasswordChangeResultDto {
  @ApiProperty({ example: true })
  success: boolean;
}
